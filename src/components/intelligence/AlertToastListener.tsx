'use client'

import { useEffect, useState, useCallback } from 'react'
import { getSocket } from '@/lib/socket'
import { AlertTriangle, X, ExternalLink, Sparkles } from 'lucide-react'

interface IntelligenceAlertEvent {
  id:           string
  analyzer:     string
  category:     string
  severity:     'critical' | 'warning' | 'info'
  score:        number
  entity_type:  string | null
  entity_id:    string | null
  entity_name:  string | null
  summary:      string
  suggestion:   string | null
  created_at:   string
}

const SEVERITY_COLOR: Record<IntelligenceAlertEvent['severity'], string> = {
  critical: '#ef4444',
  warning:  '#fbbf24',
  info:     '#a5f3fc',
}

const SEVERITY_LABEL: Record<IntelligenceAlertEvent['severity'], string> = {
  critical: 'Crítico',
  warning:  'Atenção',
  info:     'Informativo',
}

const CATEGORY_LABEL: Record<string, string> = {
  claim_opened:           'Reclamação aberta',
  mediation_started:      'Mediação iniciada',
  shipping_delayed:       'Pedido atrasado',
  reputation_dropped:     'Reputação em risco',
  critical_message:       'Mensagem crítica',
  claim_removal_candidate: 'Possível exclusão',
}

const MAX_TOASTS = 5
const AUTO_DISMISS_MS = 30_000  // toasts INFO/WARNING somem; CRITICAL fica até user fechar

/**
 * Global Socket.IO listener que mostra toasts persistentes pra alertas
 * Intelligence Hub. Plugar 1x no dashboard layout.
 *
 * Critical: fica até user clicar X. Warning/Info: auto-dismiss em 30s.
 */
export default function AlertToastListener() {
  const [alerts, setAlerts] = useState<IntelligenceAlertEvent[]>([])

  const dismiss = useCallback((id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id))
  }, [])

  useEffect(() => {
    let mounted = true
    let sock: Awaited<ReturnType<typeof getSocket>> | null = null

    const handler = (payload: IntelligenceAlertEvent) => {
      if (!mounted) return
      setAlerts(prev => {
        const next = [payload, ...prev.filter(a => a.id !== payload.id)]
        return next.slice(0, MAX_TOASTS)
      })

      // Auto-dismiss não-críticos
      if (payload.severity !== 'critical') {
        setTimeout(() => {
          if (mounted) dismiss(payload.id)
        }, AUTO_DISMISS_MS)
      }
    }

    void (async () => {
      try {
        sock = await getSocket()
        sock.on('intelligence:alert', handler)
      } catch (e) {
        console.warn('[AlertToastListener] socket falhou:', (e as Error).message)
      }
    })()

    return () => {
      mounted = false
      if (sock) sock.off('intelligence:alert', handler)
    }
  }, [dismiss])

  if (alerts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm pointer-events-none">
      {alerts.map(alert => (
        <ToastCard key={alert.id} alert={alert} onDismiss={() => dismiss(alert.id)} />
      ))}
    </div>
  )
}

function ToastCard({ alert, onDismiss }: {
  alert:     IntelligenceAlertEvent
  onDismiss: () => void
}) {
  const color = SEVERITY_COLOR[alert.severity]
  const isCritical = alert.severity === 'critical'

  return (
    <div
      className={`pointer-events-auto rounded-lg p-3 shadow-lg ${isCritical ? 'animate-pulse-slow' : ''}`}
      style={{
        background: '#0a0a0e',
        border: `1px solid ${color}88`,
        boxShadow: `0 0 20px ${color}33`,
      }}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle size={16} style={{ color }} className="flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-[10px] uppercase tracking-wider font-semibold"
              style={{ color }}
            >
              {SEVERITY_LABEL[alert.severity]}
            </span>
            <span className="text-[10px]" style={{ color: '#52525b' }}>
              {CATEGORY_LABEL[alert.category] ?? alert.category}
            </span>
          </div>
          <div className="text-xs whitespace-pre-wrap" style={{ color: '#fafafa' }}>
            {alert.summary}
          </div>
          {alert.suggestion && (
            <div className="text-[11px] mt-2 flex items-start gap-1" style={{ color: '#a5f3fc' }}>
              <Sparkles size={10} className="flex-shrink-0 mt-0.5" />
              <span>{alert.suggestion}</span>
            </div>
          )}
          {alert.analyzer === 'ml' && (
            <a
              href="/dashboard/inteligencia/ml"
              className="inline-flex items-center gap-1 text-[10px] mt-2"
              style={{ color: '#00E5FF' }}
            >
              Ver no painel ML <ExternalLink size={10} />
            </a>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="flex-shrink-0 hover:bg-zinc-800 rounded p-0.5"
          style={{ color: '#52525b' }}
          aria-label="Fechar"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  )
}
