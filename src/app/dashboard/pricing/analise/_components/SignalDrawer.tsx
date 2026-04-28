'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { api } from './api'
import {
  PricingSignal, SEVERITY_META, SIGNAL_TYPE_META,
  TRIGGER_LABELS, PENALTY_LABELS,
  fmtCurrency, fmtPct, confidenceColor, fmtRelativeTime,
} from './types'

interface ProductRow {
  id:                string
  name:              string | null
  sku:               string | null
  cost_price:        number | null
  current_price:     number | null
  abc_curve:         'A' | 'B' | 'C' | null
  segment:           string | null
  stock_quantity:    number | null
  ml_listing_id:     string | null
}

/** Drawer slide-direita 600px com 5 seções: Produto / Por que /
 * Snapshot / Confiança / Ação. Click em "Aprovar/Dispensar/Snooze"
 * fecha o drawer e recarrega lista no parent. */
export function SignalDrawer({
  signal, onClose, onActionTaken, onError,
}: {
  signal:        PricingSignal
  onClose:       () => void
  onActionTaken: (msg: string) => void
  onError:       (m: string) => void
}) {
  const [product, setProduct] = useState<ProductRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing]   = useState(false)

  useEffect(() => {
    if (!signal.product_id) { setLoading(false); return }
    api<ProductRow>(`/products/${signal.product_id}`)
      .then(setProduct)
      .catch(() => { /* silent */ })
      .finally(() => setLoading(false))
  }, [signal.product_id])

  async function takeAction(action: 'approve' | 'dismiss' | 'snooze', snoozeHours?: number) {
    setActing(true)
    try {
      await api(`/pricing/signals/${signal.id}/action`, {
        method: 'POST',
        body:   JSON.stringify({ action, snooze_hours: snoozeHours }),
      })
      const msgs: Record<string, string> = {
        approve: 'Sinal aprovado',
        dismiss: 'Sinal dispensado',
        snooze:  `Sinal adiado ${snoozeHours}h`,
      }
      onActionTaken(msgs[action])
    } catch (e) {
      onError((e as Error).message)
      setActing(false)
    }
  }

  const sev      = SEVERITY_META[signal.severity]
  const typeMeta = SIGNAL_TYPE_META[signal.signal_type]
  const triggerLabel = TRIGGER_LABELS[signal.trigger_id] ?? signal.trigger_id
  const movePct = (signal.current_price && signal.suggested_price && signal.current_price > 0)
    ? ((Number(signal.suggested_price) - Number(signal.current_price)) / Number(signal.current_price)) * 100
    : null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sd: any = signal.signal_data ?? {}

  if (typeof window === 'undefined') return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div
        className="w-full max-w-[600px] h-full overflow-y-auto"
        style={{ background: '#0a0a0e', borderLeft: '1px solid #1e1e24' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 px-6 py-4" style={{ background: '#0a0a0e', borderBottom: '1px solid #1e1e24' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-semibold"
                style={{ background: `${sev.color}1a`, color: sev.color }}>
                {sev.emoji} {sev.label}
              </span>
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{ background: `${typeMeta.color}1a`, color: typeMeta.color }}>
                {typeMeta.icon} {typeMeta.label}
              </span>
            </div>
            <button onClick={onClose} className="text-zinc-400 hover:text-white text-xl">✕</button>
          </div>
          <p className="text-white text-base font-semibold mt-3">{signal.title}</p>
          <p className="text-zinc-500 text-xs mt-1">Detectado {fmtRelativeTime(signal.created_at)} · expira {fmtRelativeTime(signal.expires_at)}</p>
        </div>

        <div className="p-6 space-y-6">
          {/* 1. PRODUTO */}
          <Section title="Produto" emoji="📦">
            {loading
              ? <div className="h-16 rounded-xl animate-pulse" style={{ background: '#111114' }} />
              : product ? (
                <div className="rounded-xl p-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
                  <p className="text-white font-semibold">{product.name ?? '—'}</p>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs">
                    {product.sku && <span className="text-zinc-500">SKU <span className="font-mono text-zinc-300">{product.sku}</span></span>}
                    {product.abc_curve && (
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: `${typeMeta.color}1a`, color: typeMeta.color }}>
                        Curva {product.abc_curve}
                      </span>
                    )}
                    {product.segment && <span className="text-zinc-500">{product.segment}</span>}
                    <span className="text-zinc-500">{signal.channel}</span>
                  </div>
                </div>
              ) : (
                <p className="text-zinc-500 text-xs italic">Produto não encontrado.</p>
              )}
          </Section>

          {/* 2. POR QUE ESTE SINAL? */}
          <Section title="Por que este sinal?" emoji="🤔">
            <div className="rounded-xl p-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
              <p className="text-zinc-300 text-sm leading-relaxed">
                Detectado pelo gatilho <span className="font-semibold text-cyan-400">&quot;{triggerLabel}&quot;</span>.
              </p>
              {signal.description && (
                <p className="text-zinc-400 text-sm mt-2 leading-relaxed">{signal.description}</p>
              )}
              {Object.keys(sd).length > 0 && (
                <div className="mt-3 space-y-1">
                  {Object.entries(sd).map(([k, v]) => (
                    <div key={k} className="flex justify-between text-xs">
                      <span className="text-zinc-500 font-mono">{k}</span>
                      <span className="text-zinc-300 font-mono">{String(v)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Section>

          {/* 3. SNAPSHOT — limited (sem endpoint /snapshot na P2 v1) */}
          <Section title="Snapshot do produto" emoji="📊">
            <div className="grid grid-cols-3 gap-2">
              <Metric label="Preço atual"      value={fmtCurrency(signal.current_price)} />
              <Metric label="Custo"            value={fmtCurrency(product?.cost_price)} />
              <Metric label="Estoque"          value={product?.stock_quantity != null ? String(product.stock_quantity) : '—'} />
              <Metric label="Margem atual"     value={fmtPct(signal.current_margin_pct)} />
              <Metric label="Mín seguro"       value={fmtCurrency(signal.min_safe_price)} />
              <Metric label="Sugerido"         value={fmtCurrency(signal.suggested_price)} />
            </div>
            <p className="text-zinc-600 text-[11px] italic mt-2">
              Snapshot completo (vendas/CTR/concorrentes/cobertura) virá quando endpoint /pricing/snapshot/:id for exposto. Por ora, evidência do gatilho está em &quot;Por que&quot;.
            </p>
          </Section>

          {/* 4. CONFIANÇA */}
          <Section title="Análise de confiança" emoji="🎯">
            <div className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: '#27272a' }}>
                  <div className="h-full" style={{ width: `${signal.confidence_score}%`, background: confidenceColor(signal.confidence_score) }} />
                </div>
                <span className="text-2xl font-bold font-mono" style={{ color: confidenceColor(signal.confidence_score) }}>
                  {signal.confidence_score}%
                </span>
              </div>

              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-zinc-300">
                  <span>Base</span>
                  <span className="font-mono">100%</span>
                </div>
                {Object.entries(signal.confidence_breakdown ?? {}).map(([key, value]) => (
                  <div key={key} className="flex justify-between text-red-400">
                    <span>− {PENALTY_LABELS[key] ?? key}</span>
                    <span className="font-mono">−{value}%</span>
                  </div>
                ))}
                <div className="flex justify-between font-semibold pt-2" style={{ borderTop: '1px solid #1e1e24', color: confidenceColor(signal.confidence_score) }}>
                  <span>Score final</span>
                  <span className="font-mono">{signal.confidence_score}%</span>
                </div>
              </div>

              <p className="text-xs mt-3" style={{ color: confidenceColor(signal.confidence_score) }}>
                {signal.confidence_score >= 75
                  ? '✓ Confiança suficiente para ação automática'
                  : signal.confidence_score >= 50
                    ? '⚠ Apenas sugestão — confiança baixa para auto'
                    : '✗ Confiança insuficiente — revisar manualmente'}
              </p>
            </div>
          </Section>

          {/* 5. AÇÃO RECOMENDADA */}
          {(signal.signal_type === 'decrease_price' || signal.signal_type === 'increase_price') && (
            <Section title="Ação recomendada" emoji="⚡">
              <div className="rounded-xl p-4" style={{ background: `${typeMeta.color}08`, border: `1px solid ${typeMeta.color}40` }}>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <Metric label="Atual"       value={fmtCurrency(signal.current_price)}   color="#a1a1aa" />
                  <Metric label="Sugerido"    value={fmtCurrency(signal.suggested_price)} color={typeMeta.color} />
                  <Metric label="Variação"    value={movePct != null ? `${movePct > 0 ? '+' : ''}${movePct.toFixed(1)}%` : '—'} color={typeMeta.color} />
                </div>
                {signal.current_margin_pct != null && signal.min_safe_price != null && (
                  <p className="text-xs text-zinc-400">
                    Margem após: <span className="font-mono text-zinc-300">{signal.current_margin_pct.toFixed(1)}%</span> (mínimo seguro R$ {Number(signal.min_safe_price).toFixed(2)})
                  </p>
                )}
              </div>
            </Section>
          )}

          {/* Botões de ação */}
          <div className="space-y-2">
            <button
              onClick={() => takeAction('approve')}
              disabled={acting}
              className="w-full px-4 py-3 rounded-lg text-sm font-semibold disabled:opacity-50"
              style={{ background: '#34d399', color: '#08323b' }}
            >
              ✓ Aprovar e marcar como acionado
            </button>
            <button
              onClick={() => takeAction('dismiss')}
              disabled={acting}
              className="w-full px-4 py-3 rounded-lg text-sm font-semibold disabled:opacity-50"
              style={{ background: '#1a0a0a', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}
            >
              ✗ Dispensar este sinal
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => takeAction('snooze', 24)}
                disabled={acting}
                className="px-4 py-2 rounded-lg text-xs font-medium border disabled:opacity-50"
                style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}
              >⏰ Adiar 24h</button>
              <button
                onClick={() => takeAction('snooze', 24 * 7)}
                disabled={acting}
                className="px-4 py-2 rounded-lg text-xs font-medium border disabled:opacity-50"
                style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}
              >⏰ Adiar 7 dias</button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function Section({ title, emoji, children }: { title: string; emoji: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="text-zinc-300 text-sm font-semibold mb-2">{emoji} {title}</p>
      {children}
    </section>
  )
}

function Metric({ label, value, color = '#fafafa' }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg px-3 py-2" style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
      <p className="text-zinc-500 text-[10px] uppercase tracking-wider">{label}</p>
      <p className="text-sm font-mono mt-0.5 truncate" style={{ color }}>{value}</p>
    </div>
  )
}
