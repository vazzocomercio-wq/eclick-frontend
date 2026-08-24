'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, CheckCircle2, AlertTriangle, FileText, RefreshCw, Upload, MapPin, IdCard, Package, ArrowRight } from 'lucide-react'
import { fulfillmentApi, type FilaFiscal, type FilaFiscalPedido } from '../_lib/api'

/**
 * FILA FISCAL (F2b-6) — a tela de trabalho do faturamento.
 *
 * Leitura em 3 blocos, na ordem do que o operador precisa fazer:
 *   1. AGIR    — quantos estão prontos + o botão que emite tudo
 *   2. RESOLVER — os que faltam dado (com o dado que falta em destaque)
 *   3. FEITO   — os já faturados (e se a nota subiu pro marketplace)
 *
 * As funções são as mesmas — este arquivo mudou só de apresentação.
 */

// tokens do e-Click (mesmos hex usados no resto do módulo Fulfillment)
const CARD = { background: '#18181b', border: '1px solid #27272a' } as const
const CIANO = '#00E5FF', VERDE = '#4ADE50', AMBAR = '#fcd34d', VERMELHO = '#f87171'
const TXT = '#FAFAFA', TXT2 = '#A1A1AA', TXT3 = '#71717A'

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

  if (loading) return <Esqueleto />

  const pedidos = fila?.pedidos ?? []
  const prontos = pedidos.filter((p) => p.pronto)
  const bloqueados = pedidos.filter((p) => !p.nota && !p.pronto)
  const faturados = pedidos.filter((p) => !!p.nota)
  const somaProntos = prontos.reduce((s, p) => s + p.valor, 0)
  const naShopeePendente = faturados.filter((p) => !p.nota?.noMarketplace).length

  return (
    <div className="flex flex-col gap-4">
      {err && <Aviso cor={VERMELHO} texto={err} />}
      {resultado && <Aviso cor={VERDE} texto={resultado} />}

      {/* ── 1. AGIR ─────────────────────────────────────────────────────── */}
      <section className="rounded-2xl p-5" style={{ background: '#121214', border: `1px solid ${prontos.length ? 'rgba(74,222,80,0.35)' : '#27272a'}` }}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold tabular-nums" style={{ color: prontos.length ? VERDE : TXT3 }}>{prontos.length}</span>
              <span className="text-base font-semibold" style={{ color: TXT }}>
                {prontos.length === 1 ? 'pedido pronto pra faturar' : 'pedidos prontos pra faturar'}
              </span>
            </div>
            {prontos.length > 0 && (
              <p className="mt-1 text-sm tabular-nums" style={{ color: TXT2 }}>
                Total das notas: <b style={{ color: TXT }}>R$ {somaProntos.toFixed(2)}</b>
              </p>
            )}
            {prontos.length === 0 && (
              <p className="mt-1 text-sm" style={{ color: TXT3 }}>
                {bloqueados.length ? 'Resolva os pendentes abaixo pra liberar a emissão.' : 'Nada aguardando nota agora.'}
              </p>
            )}
          </div>

          <button
            onClick={emitirLote}
            disabled={busy != null || prontos.length === 0}
            className="flex items-center gap-2 rounded-xl px-6 py-3.5 text-base font-bold transition-opacity duration-200 hover:opacity-90 focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-30"
            style={{ background: VERDE, color: '#052e12' }}
          >
            {busy === 'lote' ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />}
            Emitir {prontos.length > 0 ? prontos.length : ''} {prontos.length === 1 ? 'nota' : 'notas'}
          </button>
        </div>

        {/* ações de apoio — visualmente secundárias */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3" style={{ borderColor: '#27272a' }}>
          <button onClick={carregar} disabled={busy != null}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors duration-150 hover:brightness-125 disabled:opacity-40"
            style={{ background: '#18181b', color: TXT2, border: '1px solid #27272a' }}>
            <RefreshCw size={13} /> Atualizar
          </button>
          <button onClick={reenviar} disabled={busy != null}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors duration-150 hover:brightness-125 disabled:opacity-40"
            style={{ background: '#18181b', color: naShopeePendente ? AMBAR : TXT2, border: `1px solid ${naShopeePendente ? 'rgba(252,211,77,0.3)' : '#27272a'}` }}>
            {busy === 'reenvio' ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            Reenviar à Shopee {naShopeePendente ? `(${naShopeePendente})` : ''}
          </button>
        </div>
      </section>

      {/* ── 2. RESOLVER ─────────────────────────────────────────────────── */}
      {bloqueados.length > 0 && (
        <Secao titulo="Falta dado pra emitir" cor={AMBAR} n={bloqueados.length}
          ajuda="Enquanto faltar, o pedido não entra no lote.">
          {bloqueados.map((p, i) => (
            <Linha key={p.orderSn} p={p} cor={AMBAR} delay={i}>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {p.falta.map((f) => <Chip key={f} texto={f} />)}
              </div>
            </Linha>
          ))}
        </Secao>
      )}

      {/* ── 3. PRONTOS (detalhe do que vai no lote) ──────────────────────── */}
      {prontos.length > 0 && (
        <Secao titulo="Entram no próximo lote" cor={VERDE} n={prontos.length}
          ajuda="Endereço, CPF e dados fiscais conferidos.">
          {prontos.map((p, i) => (
            <Linha key={p.orderSn} p={p} cor={VERDE} delay={i}>
              <span className="mt-1 block text-xs" style={{ color: VERDE }}>pronto</span>
            </Linha>
          ))}
        </Secao>
      )}

      {/* ── 4. FEITO ─────────────────────────────────────────────────────── */}
      {faturados.length > 0 && (
        <Secao titulo="Já faturados" cor={CIANO} n={faturados.length}
          ajuda="A nota libera o “Organizar Envio” na Shopee.">
          {faturados.map((p, i) => (
            <Linha key={p.orderSn} p={p} cor={CIANO} delay={i}
              acao={p.nota?.podeCancelar ? (
                <button onClick={() => cancelar({ orderSn: p.orderSn, valor: p.valor, nota: p.nota! })} disabled={busy != null}
                  title={`Cancelar NF ${p.nota.number} — restam ~${p.nota.horasPraCancelar}h do prazo da SEFAZ`}
                  className="shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors duration-150 hover:brightness-125 disabled:opacity-40"
                  style={{ background: '#18181b', color: VERMELHO, border: '1px solid rgba(248,113,113,0.3)' }}>
                  Cancelar · {p.nota.horasPraCancelar}h
                </button>
              ) : undefined}
            >
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <span style={{ color: CIANO }}>NF {p.nota?.number}</span>
                <span style={{ color: TXT3 }}>·</span>
                {p.nota?.noMarketplace
                  ? <span style={{ color: VERDE }}>enviada à Shopee ✓</span>
                  : <span style={{ color: AMBAR }}>ainda não subiu à Shopee</span>}
              </div>
            </Linha>
          ))}
        </Secao>
      )}

      {/* vazio — orienta em vez de só informar */}
      {pedidos.length === 0 && (
        <div className="rounded-2xl px-6 py-10 text-center" style={CARD}>
          <Package size={30} className="mx-auto mb-3" color="#3f3f46" />
          <p className="text-sm font-semibold" style={{ color: TXT2 }}>Nenhum pedido aguardando nota.</p>
          <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed" style={{ color: TXT3 }}>
            Assim que uma venda entra em <b>A Enviar</b> na Shopee, ela aparece aqui.
            Deixe a aba da Shopee aberta com o coletor ligado — o endereço do comprador chega sozinho.
          </p>
        </div>
      )}

      {/* como funciona — rodapé em 3 passos */}
      <div className="rounded-2xl p-4" style={CARD}>
        <p className="mb-3 text-xs font-semibold" style={{ color: TXT2 }}>Como o faturamento funciona</p>
        <ol className="flex flex-col gap-2.5">
          {[
            { i: <MapPin size={14} />, t: 'Endereço vem da Shopee', d: 'A Shopee só mostra o endereço na tela dela. Deixe a aba “A Enviar” aberta com o coletor — ele traz sozinho a cada 10 min.' },
            { i: <FileText size={14} />, t: 'Você confere e emite', d: 'O que estiver verde entra no lote. A emissão é definitiva — dá pra cancelar em até 24h.' },
            { i: <Upload size={14} />, t: 'A nota volta pra Shopee', d: 'Emitida, ela sobe automaticamente e o “Organizar Envio” libera.' },
          ].map((s, i) => (
            <li key={s.t} className="flex gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg" style={{ background: '#09090b', color: CIANO, border: '1px solid #27272a' }}>{s.i}</span>
              <span className="min-w-0">
                <b className="text-xs" style={{ color: TXT }}>{i + 1}. {s.t}</b>
                <span className="block text-[11px] leading-relaxed" style={{ color: TXT3 }}>{s.d}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

// ── peças ──────────────────────────────────────────────────────────────────

function Secao({ titulo, cor, n, ajuda, children }: { titulo: string; cor: string; n: number; ajuda: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-baseline gap-2 px-1">
        <span className="h-2 w-2 rounded-full" style={{ background: cor }} />
        <h2 className="text-sm font-bold" style={{ color: TXT }}>{titulo}</h2>
        <span className="rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums" style={{ background: `${cor}1a`, color: cor }}>{n}</span>
        <span className="ml-auto hidden text-[11px] sm:block" style={{ color: TXT3 }}>{ajuda}</span>
      </div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </section>
  )
}

/** Linha do pedido: identidade à esquerda, dinheiro à direita, ação no fim. */
function Linha({ p, cor, delay, children, acao }: {
  p: FilaFiscalPedido; cor: string; delay: number; children?: React.ReactNode; acao?: React.ReactNode
}) {
  const Icone = cor === VERDE ? CheckCircle2 : cor === AMBAR ? AlertTriangle : FileText
  return (
    <div
      className="flex items-start gap-3 rounded-xl px-4 py-3 transition-colors duration-150 hover:brightness-110"
      style={{ background: '#18181b', borderLeft: `3px solid ${cor}`, border: '1px solid #27272a', borderLeftWidth: 3, borderLeftColor: cor, animation: `fadeUp .25s ease-out ${Math.min(delay, 8) * 35}ms both` }}
    >
      <Icone size={16} color={cor} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="truncate text-sm font-semibold" style={{ color: TXT }}>{p.comprador ?? 'Comprador não identificado'}</span>
          <span className="font-mono text-[11px]" style={{ color: TXT3 }}>{p.orderSn}</span>
        </div>
        {children}
      </div>
      <div className="shrink-0 text-right">
        <div className="text-sm font-bold tabular-nums" style={{ color: TXT }}>R$ {p.valor.toFixed(2)}</div>
      </div>
      {acao}
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}`}</style>
    </div>
  )
}

function Chip({ texto }: { texto: string }) {
  const icone = /endere/i.test(texto) ? <MapPin size={11} /> : /cpf|cnpj/i.test(texto) ? <IdCard size={11} /> : <Package size={11} />
  return (
    <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium"
      style={{ background: 'rgba(252,211,77,0.12)', color: AMBAR, border: '1px solid rgba(252,211,77,0.25)' }}>
      {icone} {texto}
    </span>
  )
}

function Aviso({ cor, texto }: { cor: string; texto: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl p-3 text-sm" style={{ background: `${cor}1a`, color: cor, border: `1px solid ${cor}44` }}>
      <ArrowRight size={15} className="mt-0.5 shrink-0" />
      <span className="min-w-0 break-words">{texto}</span>
    </div>
  )
}

/** Esqueleto preserva o layout enquanto carrega (melhor que só o spinner). */
function Esqueleto() {
  return (
    <div className="flex animate-pulse flex-col gap-4">
      <div className="h-32 rounded-2xl" style={CARD} />
      <div className="flex flex-col gap-1.5">
        {[0, 1, 2].map((i) => <div key={i} className="h-16 rounded-xl" style={CARD} />)}
      </div>
    </div>
  )
}
