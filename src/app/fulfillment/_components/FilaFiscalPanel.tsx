'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, CheckCircle2, AlertTriangle, FileText, RefreshCw, Upload } from 'lucide-react'
import { fulfillmentApi, type FilaFiscal } from '../_lib/api'

/**
 * FILA FISCAL (F2b-6) — a tela de trabalho do faturamento.
 *
 * Lista os pedidos que estão na JANELA de despacho (pagos, ainda não enviados)
 * com um semáforo do que falta pra virar nota: endereço do comprador (que a
 * Shopee só abre na tela dela — vem pelo coletor), CPF e NCM do produto.
 * O que está verde vai num clique só; o que está vermelho mostra o motivo.
 */
export function FilaFiscalPanel() {
  const [fila, setFila] = useState<FilaFiscal | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState<'lote' | 'reenvio' | 'cancelar' | null>(null)
  const [resultado, setResultado] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    try { setFila(await fulfillmentApi.filaFiscal()); setErr(null) }
    catch (e) { setErr((e as Error).message) } finally { setLoading(false) }
  }, [])
  useEffect(() => { void carregar() }, [carregar])

  async function emitirLote() {
    const n = fila?.resumo.prontos ?? 0
    if (!n) return
    // lote de NF-e é irreversível — confirma quantas e o total
    const soma = (fila?.pedidos ?? []).filter((p) => p.pronto).reduce((s, p) => s + p.valor, 0)
    if (!window.confirm(`Emitir ${n} NF-e agora, somando R$ ${soma.toFixed(2)}?\n\nA emissão é definitiva (só se desfaz por cancelamento, prazo de 24h).`)) return
    setBusy('lote'); setErr(null); setResultado(null)
    try {
      const r = await fulfillmentApi.emitirLote()
      const falhas = r.falhas.length ? ` · ${r.falhas.length} falha(s): ${r.falhas.slice(0, 3).map((f) => `${f.pedido} (${f.erro})`).join(' · ')}` : ''
      setResultado(`${r.emitidas} nota(s) emitida(s)${falhas}`)
      await carregar()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(null) }
  }

  /** Cancelamento (110111) — a justificativa é PÚBLICA e a SEFAZ exige 15+
   *  caracteres. Prazo de 24h; passado isso o caminho é devolução, com o contador. */
  async function cancelar(p: { orderSn: string; valor: number; nota: { id: string; number: string | null; horasPraCancelar: number | null } }) {
    const just = window.prompt(
      `Cancelar a NF ${p.nota.number} (${p.orderSn}, R$ ${p.valor.toFixed(2)})?\n\n` +
      `Restam ~${p.nota.horasPraCancelar}h do prazo da SEFAZ.\n` +
      `Escreva o motivo (mín. 15 caracteres — vai no registro público da nota):`,
      '',
    )
    if (just === null) return
    if (just.trim().length < 15) { setErr('A justificativa precisa de pelo menos 15 caracteres.'); return }
    setBusy('cancelar'); setErr(null); setResultado(null)
    try {
      const r = await fulfillmentApi.cancelarNota({ invoiceId: p.nota.id, justificativa: just.trim() })
      setResultado(r.cancelada ? `NF ${p.nota.number} cancelada (${r.cStat} ${r.xMotivo}).` : `Não cancelou — ${r.cStat}: ${r.xMotivo}`)
      await carregar()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(null) }
  }

  async function reenviar() {
    setBusy('reenvio'); setErr(null); setResultado(null)
    try {
      const r = await fulfillmentApi.reenviarMarketplace()
      setResultado(r.tentadas === 0 ? 'Nenhuma nota pendente de envio.' : `${r.enviadas}/${r.tentadas} nota(s) aceitas pela Shopee.`)
      await carregar()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(null) }
  }

  if (loading) return <div className="grid place-items-center py-6"><Loader2 size={18} className="animate-spin" color="#00E5FF" /></div>

  const r = fila?.resumo
  return (
    <div className="flex flex-col gap-3">
      {err && <div className="rounded-lg p-3 text-sm" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>}
      {resultado && <div className="rounded-lg p-3 text-sm" style={{ background: 'rgba(74,222,80,0.10)', color: '#4ADE50' }}>{resultado}</div>}

      {/* placar */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { t: 'Na janela', v: r?.total ?? 0, c: '#fafafa' },
          { t: 'Prontos', v: r?.prontos ?? 0, c: '#4ADE50' },
          { t: 'Já emitidos', v: r?.jaEmitidos ?? 0, c: '#00E5FF' },
          { t: 'Bloqueados', v: r?.bloqueados ?? 0, c: '#fcd34d' },
        ].map((k) => (
          <div key={k.t} className="rounded-xl p-3" style={{ background: '#111114', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="text-2xl font-bold" style={{ color: k.c }}>{k.v}</div>
            <div className="text-[11px]" style={{ color: '#71717a' }}>{k.t}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={emitirLote} disabled={busy != null || !(r?.prontos)} className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-40" style={{ background: '#00E5FF', color: '#04222a' }}>
          {busy === 'lote' ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
          Emitir {r?.prontos ?? 0} nota(s)
        </button>
        <button onClick={reenviar} disabled={busy != null} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50" style={{ background: '#18181b', color: '#a5f3fc', border: '1px solid rgba(0,229,255,0.25)' }}>
          {busy === 'reenvio' ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Reenviar pendentes à Shopee
        </button>
        <button onClick={carregar} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs" style={{ background: '#18181b', color: '#a1a1aa', border: '1px solid rgba(255,255,255,0.08)' }}>
          <RefreshCw size={13} /> Atualizar
        </button>
      </div>

      {/* lista */}
      <div className="flex flex-col gap-1.5">
        {(fila?.pedidos ?? []).length === 0 && (
          <p className="py-6 text-center text-sm" style={{ color: '#52525b' }}>Nenhum pedido aguardando nota agora.</p>
        )}
        {(fila?.pedidos ?? []).map((p) => {
          const cor = p.nota ? '#00E5FF' : p.pronto ? '#4ADE50' : '#fcd34d'
          return (
            <div key={p.orderSn} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: '#111114', border: `1px solid ${cor}22` }}>
              <div style={{ color: cor }}>
                {p.nota ? <FileText size={16} /> : p.pronto ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-semibold" style={{ color: '#fafafa' }}>{p.comprador ?? '—'}</span>
                  <span className="text-[11px]" style={{ color: '#52525b' }}>{p.orderSn}</span>
                </div>
                <div className="text-[11px]" style={{ color: cor }}>
                  {p.nota
                    ? `NF ${p.nota.number} emitida · ${p.nota.noMarketplace ? 'na Shopee ✓' : 'ainda não subiu pra Shopee'}`
                    : p.pronto ? 'pronto pra emitir' : `falta: ${p.falta.join(', ')}`}
                </div>
              </div>
              <div className="text-sm font-bold" style={{ color: '#fafafa' }}>R$ {p.valor.toFixed(2)}</div>
              {/* cancelar só enquanto a SEFAZ aceita (24h) — depois é devolução */}
              {p.nota?.podeCancelar && (
                <button onClick={() => cancelar({ orderSn: p.orderSn, valor: p.valor, nota: p.nota! })} disabled={busy != null}
                  title={`Cancelar NF ${p.nota.number} — restam ~${p.nota.horasPraCancelar}h`}
                  className="rounded-lg px-2 py-1 text-[10px] font-semibold disabled:opacity-40"
                  style={{ background: '#18181b', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}>
                  Cancelar ({p.nota.horasPraCancelar}h)
                </button>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-[11px] leading-relaxed" style={{ color: '#52525b' }}>
        O endereço do comprador só existe na tela da Shopee — deixe a aba <b>Meus Pedidos → A Enviar</b> aberta com o coletor
        ligado e os pedidos entram aqui sozinhos. Emitida a nota, ela sobe pra Shopee automaticamente e o <b>Organizar Envio</b> libera.
      </p>
    </div>
  )
}
