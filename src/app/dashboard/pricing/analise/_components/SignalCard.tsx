'use client'

import {
  PricingSignal, SEVERITY_META, SIGNAL_TYPE_META,
  fmtCurrency, fmtRelativeTime, confidenceColor,
} from './types'

/** Card individual de signal — border-l-4 colorido por severity, com
 * ações inline (Aprovar/Dispensar/Ver mais). */
export function SignalCard({
  signal, onAction, onOpen,
}: {
  signal:    PricingSignal
  onAction:  (action: 'approve' | 'dismiss') => Promise<void> | void
  onOpen:    () => void
}) {
  const sev      = SEVERITY_META[signal.severity]
  const typeMeta = SIGNAL_TYPE_META[signal.signal_type]
  const cur      = signal.current_price
  const sug      = signal.suggested_price
  const movePct  = (cur && sug && cur > 0) ? ((sug - cur) / cur) * 100 : null

  return (
    <div className="rounded-xl p-4" style={{
      background: sev.bg,
      border:     '1px solid #1e1e24',
      borderLeft: `4px solid ${sev.border}`,
    }}>
      {/* Top row: severity + type + time */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-semibold"
          style={{ background: `${sev.color}1a`, color: sev.color }}>
          {sev.emoji} {sev.label}
        </span>
        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full"
          style={{ background: `${typeMeta.color}1a`, color: typeMeta.color }}>
          {typeMeta.icon} {typeMeta.label}
        </span>
        <span className="text-[10px] uppercase px-2 py-0.5 rounded-full" style={{ background: '#27272a', color: '#a1a1aa' }}>
          {signal.channel}
        </span>
        <span className="ml-auto text-zinc-500 text-xs">{fmtRelativeTime(signal.created_at)}</span>
      </div>

      {/* Title + description */}
      <p className="text-white text-sm font-semibold mb-1 leading-snug">{signal.title}</p>
      {signal.description && <p className="text-zinc-400 text-xs leading-relaxed">{signal.description}</p>}

      {/* Price row */}
      {cur != null && sug != null && (
        <div className="mt-3 flex items-center gap-3 flex-wrap text-sm">
          <span className="text-zinc-400">Preço:</span>
          <span className="text-zinc-300 font-mono">{fmtCurrency(cur)}</span>
          <span className="text-zinc-500">→</span>
          <span className="font-semibold font-mono" style={{ color: typeMeta.color }}>{fmtCurrency(sug)}</span>
          {movePct != null && (
            <span className="text-xs font-semibold" style={{ color: typeMeta.color }}>
              ({movePct > 0 ? '+' : ''}{movePct.toFixed(1)}%)
            </span>
          )}
          {signal.current_margin_pct != null && (
            <span className="ml-auto text-xs text-zinc-400">
              Margem atual: <span className="text-zinc-300 font-mono">{signal.current_margin_pct.toFixed(1)}%</span>
            </span>
          )}
        </div>
      )}

      {/* Confidence bar */}
      <div className="mt-3 flex items-center gap-3">
        <span className="text-zinc-500 text-xs whitespace-nowrap">Confiança:</span>
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#27272a' }}>
          <div className="h-full transition-all" style={{
            width:      `${signal.confidence_score}%`,
            background: confidenceColor(signal.confidence_score),
          }} />
        </div>
        <span className="text-xs font-mono font-semibold" style={{ color: confidenceColor(signal.confidence_score) }}>
          {signal.confidence_score}%
        </span>
      </div>

      {/* Actions */}
      <div className="mt-4 flex gap-2 flex-wrap">
        <button
          onClick={() => onAction('approve')}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold"
          style={{ background: '#34d399', color: '#08323b' }}
        >
          ✓ Aprovar
        </button>
        <button
          onClick={() => onAction('dismiss')}
          className="px-3 py-1.5 rounded-lg text-xs font-medium border"
          style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}
        >
          ✗ Dispensar
        </button>
        <button
          onClick={onOpen}
          className="ml-auto px-3 py-1.5 rounded-lg text-xs font-medium border"
          style={{ borderColor: '#00E5FF', color: '#00E5FF' }}
        >
          Ver mais →
        </button>
      </div>
    </div>
  )
}
