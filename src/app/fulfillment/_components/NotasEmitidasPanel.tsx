'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, FileDown, FileText, Search, XCircle, CheckCircle2, AlertTriangle } from 'lucide-react'
import { fulfillmentApi, type ListaNotas, type ContaFiscal, type NotaEmitida } from '../_lib/api'

/**
 * CONTROLE DE NOTAS (F2b-8) — o histórico, separado da fila do dia.
 *
 * Responde "o que já foi faturado?" por plataforma, loja e período, e entrega
 * os dois arquivos que o cliente precisa guardar/enviar: o XML (procNFe, que é
 * o documento de verdade) e o DANFE em PDF (o espelho pra imprimir).
 */
const CIANO = '#00E5FF', VERDE = '#4ADE50', AMBAR = '#fcd34d', VERMELHO = '#f87171'
const TXT = '#FAFAFA', TXT2 = '#A1A1AA', TXT3 = '#71717A'
const CARD = { background: '#18181b', border: '1px solid #27272a' } as const
const inp = { background: '#09090b', color: TXT, border: '1px solid #27272a' } as const

const PLATAFORMAS = [
  { v: '', label: 'Todas as plataformas' },
  { v: 'shopee', label: 'Shopee' },
  { v: 'mercadolivre', label: 'Mercado Livre' },
  { v: 'loja', label: 'Loja própria' },
]

export function NotasEmitidasPanel() {
  const [lista, setLista] = useState<ListaNotas | null>(null)
  const [contas, setContas] = useState<ContaFiscal[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [baixando, setBaixando] = useState<string | null>(null)
  const [f, setF] = useState({ plataforma: '', conta: '', status: '', de: '', ate: '', busca: '' })

  const carregar = useCallback(async () => {
    setLoading(true)
    try { setLista(await fulfillmentApi.listarNotas(f)); setErr(null) }
    catch (e) { setErr((e as Error).message) } finally { setLoading(false) }
  }, [f])
  useEffect(() => { void carregar() }, [carregar])
  useEffect(() => { fulfillmentApi.contasFiscais().then(setContas).catch(() => setContas([])) }, [])

  async function baixarXml(n: NotaEmitida) {
    setBaixando(`${n.id}-xml`); setErr(null)
    try {
      const { url, filename } = await fulfillmentApi.xmlDaNota(n.id)
      const a = document.createElement('a'); a.href = url; a.download = filename; a.target = '_blank'; a.click()
    } catch (e) { setErr((e as Error).message) } finally { setBaixando(null) }
  }
  async function baixarPdf(n: NotaEmitida) {
    setBaixando(`${n.id}-pdf`); setErr(null)
    try { await fulfillmentApi.baixarDanfe(n.id, `DANFE-${n.chave ?? n.numero}.pdf`) }
    catch (e) { setErr((e as Error).message) } finally { setBaixando(null) }
  }

  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }))
  const contasDaPlataforma = contas.filter((c) => !f.plataforma || c.plataforma === f.plataforma)
  const r = lista?.resumo

  return (
    <div className="flex flex-col gap-4">
      {err && <div className="rounded-xl p-3 text-sm" style={{ background: `${VERMELHO}1a`, color: VERMELHO, border: `1px solid ${VERMELHO}44` }}>{err}</div>}

      {/* resumo do período filtrado */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { t: 'Notas', v: String(r?.quantidade ?? 0), c: TXT },
          { t: 'Faturado', v: `R$ ${(r?.valorTotal ?? 0).toFixed(2)}`, c: VERDE },
          { t: 'Canceladas', v: String(r?.canceladas ?? 0), c: r?.canceladas ? VERMELHO : TXT3 },
          { t: 'Fora da Shopee', v: String(r?.pendentesMarketplace ?? 0), c: r?.pendentesMarketplace ? AMBAR : TXT3 },
        ].map((k) => (
          <div key={k.t} className="rounded-xl p-3" style={CARD}>
            <div className="text-xl font-bold tabular-nums" style={{ color: k.c }}>{k.v}</div>
            <div className="text-[11px]" style={{ color: TXT3 }}>{k.t}</div>
          </div>
        ))}
      </div>

      {/* filtros */}
      <div className="rounded-xl p-3" style={CARD}>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <label className="relative">
            <Search size={13} className="absolute left-2.5 top-2.5" color={TXT3} />
            <input value={f.busca} onChange={(e) => set('busca', e.target.value)} placeholder="pedido, comprador, nº ou chave"
              className="w-full rounded-lg py-2 pl-8 pr-2 text-sm outline-none" style={inp} />
          </label>
          <select value={f.plataforma} onChange={(e) => { set('plataforma', e.target.value); set('conta', '') }}
            className="rounded-lg px-2 py-2 text-sm outline-none" style={inp}>
            {PLATAFORMAS.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}
          </select>
          <select value={f.conta} onChange={(e) => set('conta', e.target.value)}
            className="rounded-lg px-2 py-2 text-sm outline-none" style={inp}>
            <option value="">Todas as lojas</option>
            {contasDaPlataforma.map((c) => (
              <option key={`${c.plataforma}:${c.conta}`} value={c.conta}>{c.label ?? c.conta}</option>
            ))}
          </select>
        </div>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <select value={f.status} onChange={(e) => set('status', e.target.value)}
            className="rounded-lg px-2 py-2 text-sm outline-none" style={inp}>
            <option value="">Emitidas e canceladas</option>
            <option value="issued">Só emitidas</option>
            <option value="cancelled">Só canceladas</option>
          </select>
          <label className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs" style={inp}>
            <span style={{ color: TXT3 }}>De</span>
            <input type="date" value={f.de} onChange={(e) => set('de', e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none" style={{ color: TXT }} />
          </label>
          <label className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs" style={inp}>
            <span style={{ color: TXT3 }}>Até</span>
            <input type="date" value={f.ate} onChange={(e) => set('ate', e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none" style={{ color: TXT }} />
          </label>
        </div>
      </div>

      {/* lista */}
      {loading ? (
        <div className="flex animate-pulse flex-col gap-1.5">
          {[0, 1, 2].map((i) => <div key={i} className="h-16 rounded-xl" style={CARD} />)}
        </div>
      ) : (lista?.notas ?? []).length === 0 ? (
        <div className="rounded-2xl px-6 py-10 text-center" style={CARD}>
          <FileText size={28} className="mx-auto mb-3" color="#3f3f46" />
          <p className="text-sm font-semibold" style={{ color: TXT2 }}>Nenhuma nota neste filtro.</p>
          <p className="mt-1 text-xs" style={{ color: TXT3 }}>Limpe os filtros ou emita na aba <b>Fila</b>.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {(lista?.notas ?? []).map((n) => {
            const cancelada = n.status === 'cancelled'
            const cor = cancelada ? VERMELHO : CIANO
            return (
              <div key={n.id} className="flex flex-wrap items-center gap-3 rounded-xl px-4 py-3"
                style={{ ...CARD, borderLeftWidth: 3, borderLeftColor: cor }}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-sm font-bold tabular-nums" style={{ color: cor }}>NF {n.numero}</span>
                    <span className="truncate text-sm" style={{ color: TXT }}>{n.comprador ?? '—'}</span>
                    {cancelada && <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: `${VERMELHO}22`, color: VERMELHO }}>CANCELADA</span>}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]" style={{ color: TXT3 }}>
                    <span>{new Date(n.emitidaEm).toLocaleDateString('pt-BR')}</span>
                    <span>·</span>
                    <span className="font-mono">{n.pedido ?? '—'}</span>
                    {n.contaLabel && <><span>·</span><span>{n.contaLabel}</span></>}
                    {!cancelada && (
                      <>
                        <span>·</span>
                        {n.noMarketplace
                          ? <span className="inline-flex items-center gap-1" style={{ color: VERDE }}><CheckCircle2 size={10} /> na Shopee</span>
                          : <span className="inline-flex items-center gap-1" style={{ color: AMBAR }}><AlertTriangle size={10} /> fora da Shopee</span>}
                      </>
                    )}
                  </div>
                </div>

                <div className="text-sm font-bold tabular-nums" style={{ color: cancelada ? TXT3 : TXT, textDecoration: cancelada ? 'line-through' : 'none' }}>
                  R$ {n.valor.toFixed(2)}
                </div>

                <div className="flex shrink-0 gap-1.5">
                  <button onClick={() => baixarXml(n)} disabled={baixando != null}
                    title="Baixar XML (arquivo oficial da nota)"
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors duration-150 hover:brightness-125 disabled:opacity-40"
                    style={{ background: '#09090b', color: CIANO, border: `1px solid ${CIANO}44` }}>
                    {baixando === `${n.id}-xml` ? <Loader2 size={11} className="animate-spin" /> : <FileDown size={11} />} XML
                  </button>
                  <button onClick={() => baixarPdf(n)} disabled={baixando != null}
                    title="Baixar DANFE em PDF (espelho pra imprimir)"
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors duration-150 hover:brightness-125 disabled:opacity-40"
                    style={{ background: '#09090b', color: TXT2, border: '1px solid #27272a' }}>
                    {baixando === `${n.id}-pdf` ? <Loader2 size={11} className="animate-spin" /> : <FileText size={11} />} PDF
                  </button>
                </div>
              </div>
            )
          })}
          {(lista?.total ?? 0) > (lista?.notas.length ?? 0) && (
            <p className="py-2 text-center text-[11px]" style={{ color: TXT3 }}>
              Mostrando {lista?.notas.length} de {lista?.total}. Refine os filtros pra ver o resto.
            </p>
          )}
        </div>
      )}

      <p className="flex items-start gap-1.5 text-[11px] leading-relaxed" style={{ color: TXT3 }}>
        <XCircle size={12} className="mt-0.5 shrink-0" />
        <span>O <b>XML</b> é o documento fiscal de verdade — é ele que vai pro contador e pra Shopee. O <b>PDF (DANFE)</b> é o espelho pra imprimir e pôr na caixa. Guarde os dois por 5 anos; o e-Click já mantém a cópia.</span>
      </p>
    </div>
  )
}
