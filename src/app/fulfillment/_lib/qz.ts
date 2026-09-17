'use client'

/**
 * Impressão DIRETA na etiquetadora térmica via QZ Tray (programa instalado no
 * PC que recebe o trabalho do navegador pelo websocket local e manda pro
 * driver do Windows — sem abrir PDF nem a janela de impressão).
 *
 * A lib é carregada da CDN só quando a tela de Etiquetas precisa (versão
 * travada = a do QZ Tray instalado). Toda requisição vai ASSINADA pelo backend
 * com o certificado da org: depois que esse certificado é instalado uma vez no
 * QZ Tray do computador (override.crt), ele não pergunta mais "Allow". Sem ele
 * instalado, o QZ pede "Allow" a cada ação — funciona, mas é lento.
 *
 * ⚠️ Etiquetadora chinesa genérica NÃO entende ZPL: o PDF do marketplace vai
 * RASTERIZADO (pixel) em preto e branco, 100×150 mm.
 */

import { api } from './api'

const QZ_SRC = 'https://cdn.jsdelivr.net/npm/qz-tray@2.2.4/qz-tray.js'
const PRINTER_KEY = 'eclick_label_printer'

// tipagem mínima do que usamos da API do QZ
interface Qz {
  api: {
    setPromiseType: (fn: (resolver: (resolve: (v?: unknown) => void, reject: (e?: unknown) => void) => void) => Promise<unknown>) => void
    setSha256Type: (fn: (data: string) => Promise<string>) => void
  }
  security: {
    setCertificatePromise: (fn: (resolve: (v?: unknown) => void, reject: (e?: unknown) => void) => void) => void
    setSignatureAlgorithm: (alg: string) => void
    setSignaturePromise: (fn: (toSign: string) => (resolve: (v?: unknown) => void, reject: (e?: unknown) => void) => void) => void
  }
  websocket: { isActive: () => boolean; connect: (opts?: { retries?: number; delay?: number }) => Promise<void> }
  printers: { find: (query?: string) => Promise<string[] | string>; getDefault: () => Promise<string> }
  configs: { create: (printer: string, opts: Record<string, unknown>) => unknown }
  print: (config: unknown, data: unknown[]) => Promise<void>
}

declare global {
  interface Window { qz?: Qz }
}

let loading: Promise<Qz> | null = null

function loadScript(): Promise<Qz> {
  if (window.qz) return Promise.resolve(window.qz)
  if (loading) return loading
  loading = new Promise<Qz>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = QZ_SRC
    s.async = true
    s.onload = () => (window.qz ? resolve(window.qz) : reject(new Error('Biblioteca do QZ Tray não carregou.')))
    s.onerror = () => { loading = null; reject(new Error('Não consegui baixar a biblioteca do QZ Tray (sem internet?).')) }
    document.head.appendChild(s)
  }).then((qz) => {
    qz.api.setPromiseType((resolver) => new Promise(resolver))
    qz.api.setSha256Type(async (data) => {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data))
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
    })
    // certificado + assinatura da org vêm do backend (a chave privada nunca sai de lá)
    qz.security.setCertificatePromise((resolve, reject) => {
      certificadoQz().then(resolve, reject)
    })
    qz.security.setSignatureAlgorithm('SHA512')
    qz.security.setSignaturePromise((toSign) => (resolve, reject) => {
      api<{ signature: string }>('/fulfillment/qz/assinar', { method: 'POST', body: JSON.stringify({ toSign }) })
        .then((r) => resolve(r.signature), reject)
    })
    return qz
  })
  return loading
}

let certCache: Promise<string> | null = null

/** Certificado público da org (PEM). Também é o arquivo que se instala no QZ Tray. */
export function certificadoQz(): Promise<string> {
  if (!certCache) {
    certCache = api<{ certificate: string }>('/fulfillment/qz/certificado')
      .then((r) => r.certificate)
      .catch((e) => { certCache = null; throw e })
  }
  return certCache
}

/** Baixa o certificado como override.crt — nome que o QZ Tray reconhece na pasta dele. */
export async function baixarCertificadoQz() {
  const pem = await certificadoQz()
  const url = URL.createObjectURL(new Blob([pem], { type: 'application/x-x509-ca-cert' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'override.crt'
  a.click()
  URL.revokeObjectURL(url)
}

/** Conecta no QZ Tray. Lança erro amigável se o programa estiver fechado. */
export async function conectarQz(): Promise<Qz> {
  const qz = await loadScript()
  if (!qz.websocket.isActive()) {
    try {
      await qz.websocket.connect({ retries: 1, delay: 1 })
    } catch {
      throw new Error('O QZ Tray não está aberto neste computador. Abra o QZ Tray (ícone perto do relógio) e tente de novo.')
    }
  }
  return qz
}

export async function listarImpressoras(): Promise<string[]> {
  const qz = await conectarQz()
  const r = await qz.printers.find()
  return Array.isArray(r) ? r : [r]
}

/** Impressora salva neste computador; senão chuta a que parece etiquetadora. */
export function impressoraSalva(): string | null {
  try { return localStorage.getItem(PRINTER_KEY) } catch { return null }
}

export function salvarImpressora(nome: string) {
  try { localStorage.setItem(PRINTER_KEY, nome) } catch { /* navegador sem storage: só não lembra */ }
}

export function sugerirEtiquetadora(nomes: string[]): string | null {
  return nomes.find((n) => /etiq|itiq|label|zebra|elgin|argox|tsc|zjiang|xprinter|4bar/i.test(n)) ?? null
}

/** Manda o PDF (todas as páginas: etiqueta + DACE/DANFE) pra térmica 100×150. */
export async function imprimirPdfEtiqueta(impressora: string, pdfBase64: string) {
  const qz = await conectarQz()
  const config = qz.configs.create(impressora, {
    size: { width: 100, height: 150 },
    units: 'mm',
    margins: 0,
    colorType: 'blackwhite',
    scaleContent: true,
    rasterize: true,
    interpolation: 'nearest-neighbor',
  })
  await qz.print(config, [{ type: 'pixel', format: 'pdf', flavor: 'base64', data: pdfBase64 }])
}
