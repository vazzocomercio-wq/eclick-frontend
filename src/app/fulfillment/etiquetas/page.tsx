'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, Printer, CheckCircle2, AlertTriangle, Clock, Inbox, Loader2, FileText, Square, CheckSquare, ShieldCheck } from 'lucide-react'
import { fulfillmentApi, type EtiquetasData, type EtiquetaEnvio } from '../_lib/api'
import { conectarQz, listarImpressoras, impressoraSalva, salvarImpressora, sugerirEtiquetadora, imprimirPdfEtiquetas, baixarCertificadoQz } from '../_lib/qz'

const platformColor = (p: string | null) => p === 'mercadolivre' ? '#FFE600' : p === 'shopee' ? '#EE4D2D' : '#a1a1aa'
const platformName = (p: string) => p === 'mercadolivre' ? 'Mercado Livre' : p === 'shopee' ? 'Shopee' : p
const logisticLabel = (t: string | null) =>
  t === 'self_service' ? 'Flex' : t === 'cross_docking' ? 'Coleta' : t === 'xd_drop_off' ? 'Agência' : t === 'drop_off' ? 'Correios/Agência' : (t ?? '')

type Estado = { fase: 'baixando' | 'imprimindo' | 'ok' | 'erro'; msg?: string; labelUrl?: string | null }

/**
 * Etiquetas do dia — operação SIMPLES da expedição: lista os envios prontos das
 * contas ativas e imprime a etiqueta oficial do marketplace direto na térmica
 * (QZ Tray). Cada impressão fica registrada na expedição (pedido + etiqueta),
 * então a virada pra separação com bipagem não perde histórico.
 */
export default function EtiquetasPage() {
  const [data, setData] = useState<EtiquetasData | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [estado, setEstado] = useState<Record<string, Estado>>({})
  const [rodando, setRodando] = useState(false)

  const [impressoras, setImpressoras] = useState<string[]>([])
  const [impressora, setImpressora] = useState<string | null>(null)
  const [qzErr, setQzErr] = useState<string | null>(null)
  const [qzOk, setQzOk] = useState(false)
  const [ajudaCert, setAjudaCert] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await fulfillmentApi.etiquetas()); setErr(null) }
    catch (e) { setErr((e as Error).message) } finally { setLoading(false) }
  }, [])

  const conectar = useCallback(async () => {
    try {
      await conectarQz()
      const nomes = await listarImpressoras()
      setImpressoras(nomes)
      const salva = impressoraSalva()
      setImpressora(salva && nomes.includes(salva) ? salva : sugerirEtiquetadora(nomes))
      setQzOk(true); setQzErr(null)
    } catch (e) {
      setQzOk(false); setQzErr((e as Error).message)
    }
  }, [])

  useEffect(() => { void load(); void conectar() }, [load, conectar])

  const imprimiveis = useMemo(() => (data?.envios ?? []).filter((e) => e.podeImprimir), [data])
  const pendentes = useMemo(() => imprimiveis.filter((e) => !e.impressoNoMl && !e.impressoPorNosEm), [imprimiveis])
  const aguardando = useMemo(() => (data?.envios ?? []).filter((e) => !e.podeImprimir), [data])

  function toggle(id: string) {
    setSel((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  async function imprimir(envios: EtiquetaEnvio[]) {
    if (!impressora) { setQzErr('Escolha a impressora de etiquetas antes de imprimir.'); return }
    setRodando(true)

    // 1) busca as etiquetas no marketplace, uma a uma (um erro não derruba as outras)
    const prontos: Array<{ envio: EtiquetaEnvio; pdf: string; labelUrl: string | null }> = []
    for (const e of envios) {
      setEstado((p) => ({ ...p, [e.shipmentId]: { fase: 'baixando' } }))
      let labelUrl: string | null = null
      try {
        const r = await fulfillmentApi.imprimirEtiqueta(e.pedidos[0])
        labelUrl = r.labelUrl
        if (!r.pdfBase64) throw new Error('O marketplace não devolveu o PDF da etiqueta.')
        prontos.push({ envio: e, pdf: r.pdfBase64, labelUrl })
        setEstado((p) => ({ ...p, [e.shipmentId]: { fase: 'imprimindo', labelUrl } }))
      } catch (x) {
        setEstado((p) => ({ ...p, [e.shipmentId]: { fase: 'erro', msg: (x as Error).message, labelUrl } }))
      }
    }

    // 2) TODAS as etiquetas num único trabalho de impressão — é isso que faz o QZ
    //    Tray perguntar no máximo uma vez, em vez de uma janela por etiqueta
    if (prontos.length > 0) {
      try {
        await imprimirPdfEtiquetas(impressora, prontos.map((p) => p.pdf))
        setEstado((p) => {
          const n = { ...p }
          for (const { envio, labelUrl } of prontos) n[envio.shipmentId] = { fase: 'ok', labelUrl }
          return n
        })
      } catch (x) {
        const msg = (x as Error).message
        setEstado((p) => {
          const n = { ...p }
          for (const { envio, labelUrl } of prontos) n[envio.shipmentId] = { fase: 'erro', msg, labelUrl }
          return n
        })
      }
    }

    setRodando(false)
    setSel(new Set())
    void load()
  }

  const selecionados = imprimiveis.filter((e) => sel.has(e.shipmentId))

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-3 pt-1">
        <Link href="/fulfillment" className="rounded-xl p-2.5" style={{ background: '#18181b' }}><ArrowLeft size={20} /></Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Etiquetas do dia</h1>
          <p className="text-xs" style={{ color: '#71717a' }}>
            {/* conta TODOS os envios: o que está travado esperando nota também é trabalho do dia */}
            {data
              ? `${data.envios.length} envio(s) · ${pendentes.length} sem imprimir${aguardando.length ? ` · ${aguardando.length} aguardando nota` : ''}`
              : 'envios prontos pra despachar'}
          </p>
        </div>
        <button onClick={() => void load()} className="rounded-xl p-2.5" style={{ background: '#18181b' }} aria-label="Atualizar">
          <RefreshCw size={18} color="#00E5FF" className={loading ? 'animate-spin' : ''} />
        </button>
      </header>

      {/* Impressora */}
      <section className="rounded-2xl p-3" style={{ background: '#0c0c10', border: `1px solid ${qzOk ? 'rgba(74,222,80,0.3)' : 'rgba(252,211,77,0.35)'}` }}>
        <div className="flex items-center gap-2">
          <Printer size={18} color={qzOk ? '#4ADE50' : '#fcd34d'} />
          {qzOk ? (
            <select
              value={impressora ?? ''}
              onChange={(ev) => { setImpressora(ev.target.value); salvarImpressora(ev.target.value) }}
              className="flex-1 rounded-lg px-2 py-2 text-sm outline-none"
              style={{ background: '#0a0a0e', color: '#fafafa', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <option value="" disabled>Escolha a impressora de etiquetas</option>
              {impressoras.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          ) : (
            <span className="flex-1 text-sm" style={{ color: '#fcd34d' }}>{qzErr ?? 'Conectando ao QZ Tray…'}</span>
          )}
          {!qzOk && (
            <button onClick={() => void conectar()} className="rounded-lg px-3 py-2 text-xs font-semibold" style={{ background: '#18181b', color: '#00E5FF' }}>
              Tentar de novo
            </button>
          )}
        </div>
        {qzOk && qzErr && <p className="mt-2 text-xs" style={{ color: '#fcd34d' }}>{qzErr}</p>}
        <button onClick={() => setAjudaCert((v) => !v)} className="mt-2 flex items-center gap-1 text-xs" style={{ color: '#71717a' }}>
          <ShieldCheck size={12} /> O QZ Tray fica pedindo &quot;Allow&quot;?
        </button>
        {ajudaCert && (
          <div className="mt-2 rounded-lg p-3 text-xs leading-relaxed" style={{ background: '#0a0a0e', color: '#a1a1aa' }}>
            Faça uma vez em cada computador que imprime:
            <ol className="ml-4 mt-1 list-decimal">
              <li><button onClick={() => void baixarCertificadoQz()} className="underline" style={{ color: '#00E5FF' }}>Baixe o certificado</button> (arquivo <b>override.crt</b>).</li>
              <li>Copie o arquivo para <b>C:\Program Files\QZ Tray</b> (o Windows pede confirmação de administrador).</li>
              <li>Feche o QZ Tray (ícone perto do relógio → Exit) e abra de novo.</li>
              <li>Na próxima impressão marque <b>Remember this decision</b> e clique <b>Allow</b> — sem marcar, ele pergunta a cada impressão.</li>
            </ol>
          </div>
        )}
      </section>

      {/* Contas */}
      {data && (
        <div className="flex flex-wrap gap-2">
          {data.contas.map((c) => (
            <span key={c.id} className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs" style={{ background: '#111114', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span className="h-2 w-2 rounded-full" style={{ background: platformColor(c.platform) }} />
              {c.label ?? c.externalAccountId} · {platformName(c.platform)}
              {!c.suportado && <span style={{ color: '#71717a' }}>(etiqueta em breve)</span>}
            </span>
          ))}
        </div>
      )}

      {err && <div className="rounded-xl p-3 text-sm" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>}

      {loading && !data && <div className="flex flex-col gap-2">{[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl" style={{ background: '#0c0c10' }} />)}</div>}

      {!loading && data && data.envios.length === 0 && !err && (
        <div className="rounded-2xl p-8 text-center" style={{ background: '#0c0c10', border: '1px solid rgba(255,255,255,0.08)' }}>
          <Inbox size={30} className="mx-auto mb-2" color="#52525b" />
          <p className="text-sm" style={{ color: '#a1a1aa' }}>Nenhum envio esperando etiqueta agora.</p>
        </div>
      )}

      {imprimiveis.length > 1 && (
        <div className="flex gap-2 text-xs">
          <button onClick={() => setSel(new Set(pendentes.map((e) => e.shipmentId)))} className="rounded-lg px-3 py-1.5" style={{ background: '#18181b', color: '#a1a1aa' }}>
            Selecionar as não impressas ({pendentes.length})
          </button>
          <button onClick={() => setSel(new Set(imprimiveis.map((e) => e.shipmentId)))} className="rounded-lg px-3 py-1.5" style={{ background: '#18181b', color: '#a1a1aa' }}>
            Todas
          </button>
          {sel.size > 0 && <button onClick={() => setSel(new Set())} className="rounded-lg px-3 py-1.5" style={{ background: '#18181b', color: '#a1a1aa' }}>Limpar</button>}
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {data?.envios.map((e) => (
          <EnvioCard
            key={e.shipmentId}
            envio={e}
            marcado={sel.has(e.shipmentId)}
            estado={estado[e.shipmentId]}
            bloqueado={rodando || !qzOk}
            onToggle={() => toggle(e.shipmentId)}
            onImprimir={() => void imprimir([e])}
          />
        ))}
      </ul>

      {selecionados.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-md px-4 pb-4">
          <button
            onClick={() => void imprimir(selecionados)}
            disabled={rodando || !qzOk}
            className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold disabled:opacity-50"
            style={{ background: '#00E5FF', color: '#04222a' }}
          >
            {rodando ? <Loader2 size={20} className="animate-spin" /> : <Printer size={20} />}
            Imprimir {selecionados.length} etiqueta(s)
          </button>
        </div>
      )}
    </div>
  )
}

function EnvioCard({ envio: e, marcado, estado, bloqueado, onToggle, onImprimir }: {
  envio: EtiquetaEnvio; marcado: boolean; estado?: Estado; bloqueado: boolean
  onToggle: () => void; onImprimir: () => void
}) {
  const prazo = e.prazoDespacho ? new Date(e.prazoDespacho) : null
  const horas = prazo ? (prazo.getTime() - Date.now()) / 3_600_000 : null
  const corPrazo = horas == null ? '#71717a' : horas < 0 ? '#f87171' : horas < 4 ? '#fcd34d' : '#a1a1aa'
  const jaImpresso = e.impressoNoMl || !!e.impressoPorNosEm

  return (
    <li className="rounded-2xl p-3" style={{ background: '#0c0c10', border: `1px solid ${marcado ? '#00E5FF77' : 'rgba(255,255,255,0.08)'}` }}>
      <div className="flex items-start gap-3">
        {e.podeImprimir ? (
          <button onClick={onToggle} className="mt-0.5" aria-label="Selecionar">
            {marcado ? <CheckSquare size={20} color="#00E5FF" /> : <Square size={20} color="#52525b" />}
          </button>
        ) : <AlertTriangle size={20} color="#fcd34d" className="mt-0.5" />}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs" style={{ color: '#71717a' }}>
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: platformColor(e.platform) }} />
            <span className="truncate">{e.contaLabel ?? platformName(e.platform)}</span>
            {e.logisticType && <span>· {logisticLabel(e.logisticType)}</span>}
          </div>
          <div className="mt-0.5 truncate font-semibold">{e.comprador ?? 'Comprador'}</div>
          <ul className="mt-1 flex flex-col gap-0.5 text-sm" style={{ color: '#d4d4d8' }}>
            {e.itens.map((it, i) => (
              <li key={i} className="truncate"><span className="font-bold tabular-nums">{it.qty}×</span> {it.title ?? it.sku}</li>
            ))}
          </ul>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            {prazo && (
              <span className="flex items-center gap-1" style={{ color: corPrazo }}>
                <Clock size={12} />
                {horas != null && horas < 0 ? 'Atrasado · ' : 'Despachar até '}
                {prazo.toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {e.impressoPorNosEm && (
              <span className="rounded-full px-2 py-0.5" style={{ background: '#4ADE5022', color: '#4ADE50' }}>
                impressa aqui {new Date(e.impressoPorNosEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {e.impressoNoMl && !e.impressoPorNosEm && (
              <span className="rounded-full px-2 py-0.5" style={{ background: '#a1a1aa22', color: '#a1a1aa' }}>já impressa no marketplace</span>
            )}
            {e.motivo && <span style={{ color: '#fcd34d' }}>{e.motivo}</span>}
          </div>

          {(estado?.fase === 'baixando' || estado?.fase === 'imprimindo') && (
            <p className="mt-2 flex items-center gap-1 text-xs" style={{ color: '#00E5FF' }}>
              <Loader2 size={14} className="animate-spin" />
              {estado.fase === 'baixando' ? 'Buscando a etiqueta no marketplace…' : 'Indo pra impressora…'}
            </p>
          )}
          {estado?.fase === 'ok' && (
            <p className="mt-2 flex items-center gap-1 text-xs" style={{ color: '#4ADE50' }}><CheckCircle2 size={14} /> Enviada pra impressora</p>
          )}
          {estado?.fase === 'erro' && (
            <div className="mt-2 rounded-lg p-2 text-xs" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
              {estado.msg}
              {estado.labelUrl && (
                <a href={estado.labelUrl} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 underline" style={{ color: '#fafafa' }}>
                  <FileText size={12} /> abrir PDF
                </a>
              )}
            </div>
          )}
        </div>

        {e.podeImprimir && (
          <button
            onClick={onImprimir}
            disabled={bloqueado}
            className="flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-40"
            style={{ background: jaImpresso ? '#18181b' : '#00E5FF1a', color: '#00E5FF', border: '1px solid #00E5FF44' }}
          >
            {estado && (estado.fase === 'baixando' || estado.fase === 'imprimindo') ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
            {jaImpresso ? 'Reimprimir' : 'Imprimir'}
          </button>
        )}
      </div>
    </li>
  )
}
