'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { getSocket } from '@/lib/socket'
import { AlertTriangle, AlertCircle, Info, X, ExternalLink, Sparkles } from 'lucide-react'

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

/** Toast com lista de alertas agrupados — um cartão pode representar 1+
 *  alertas da mesma categoria criados em janela curta. */
interface ToastGroup {
  id:           string                       // id do mais recente do grupo
  category:     string
  severity:     IntelligenceAlertEvent['severity']
  analyzer:     string
  alerts:       IntelligenceAlertEvent[]     // mais novos primeiro
  arrivedAt:    number                       // pra cancelar timer ao expandir
}

const SEVERITY_TOKENS: Record<IntelligenceAlertEvent['severity'], {
  color:    string
  glow:     string
  ringRgb:  string
  Icon:     typeof AlertTriangle
  label:    string
}> = {
  critical: { color: '#ef4444', glow: 'rgba(239,68,68,0.35)',  ringRgb: '239,68,68',  Icon: AlertCircle,    label: 'Crítico' },
  warning:  { color: '#f59e0b', glow: 'rgba(245,158,11,0.30)', ringRgb: '245,158,11', Icon: AlertTriangle,  label: 'Atenção' },
  info:     { color: '#06b6d4', glow: 'rgba(6,182,212,0.25)',  ringRgb: '6,182,212',  Icon: Info,           label: 'Informativo' },
}

const CATEGORY_LABEL: Record<string, string> = {
  claim_opened:           'Reclamação aberta',
  mediation_started:      'Mediação iniciada',
  shipping_delayed:       'Pedido atrasado',
  reputation_dropped:     'Reputação em risco',
  critical_message:       'Mensagem crítica',
  claim_removal_candidate: 'Possível exclusão',
  sem_movimento:          'Sem movimento',
  estoque_alto:           'Estoque parado',
  margem_alta:            'Margem alta',
  estoque_baixo:          'Estoque baixo',
}

const MAX_VISIBLE      = 3            // 3 cards visíveis simultâneos
const GROUP_WINDOW_MS  = 60_000       // alertas mesma categoria em <60s agrupam
const AUTO_DISMISS_MS  = 8_000        // info/warning some em 8s (era 30s)
                                       // critical fica até user fechar

/**
 * Global Socket.IO listener — toasts modernos pra alertas Intelligence Hub.
 *
 * Design 2026-05-08 (redesign):
 * - Posição top-right (abaixo do header, perto do sino — origem visual)
 * - Glassmorphism: backdrop-blur + bg semi-transparente
 * - Grupo inteligente: alertas mesma categoria em <60s viram um card
 *   com badge de contagem "+N"
 * - Compact mode default (320px × 60px); hover expande pra mostrar
 *   summary completo + suggestion. Pausa auto-dismiss enquanto hover.
 * - Progress bar fina embaixo mostra countdown
 * - Slide+fade entry animation
 * - Critical: sem auto-dismiss, ring ligeiramente pulsante pra chamar atenção
 *
 * Plugar 1x no dashboard layout.
 */
export default function AlertToastListener() {
  const [groups, setGroups] = useState<ToastGroup[]>([])
  const groupsRef = useRef(groups)
  groupsRef.current = groups

  const dismiss = useCallback((id: string) => {
    setGroups(prev => prev.filter(g => g.id !== id))
  }, [])

  useEffect(() => {
    let mounted = true
    let sock: Awaited<ReturnType<typeof getSocket>> | null = null

    const handler = (payload: IntelligenceAlertEvent) => {
      if (!mounted) return
      setGroups(prev => {
        // Tenta acrescer ao grupo aberto da mesma categoria+severity em
        // janela GROUP_WINDOW_MS. Senão cria novo grupo.
        const now = Date.now()
        const existing = prev.find(g =>
          g.category === payload.category
          && g.severity === payload.severity
          && (now - g.arrivedAt) < GROUP_WINDOW_MS,
        )
        if (existing) {
          // Agrupa: mais novo primeiro, atualiza id pro mais recente
          const updated: ToastGroup = {
            ...existing,
            id:        payload.id,
            alerts:    [payload, ...existing.alerts.filter(a => a.id !== payload.id)].slice(0, 6),
            arrivedAt: now,
          }
          return [updated, ...prev.filter(g => g.id !== existing.id)].slice(0, MAX_VISIBLE)
        }
        const fresh: ToastGroup = {
          id:        payload.id,
          category:  payload.category,
          severity:  payload.severity,
          analyzer:  payload.analyzer,
          alerts:    [payload],
          arrivedAt: now,
        }
        return [fresh, ...prev].slice(0, MAX_VISIBLE)
      })
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
  }, [])

  if (groups.length === 0) return null

  return (
    <div className="fixed top-[64px] right-4 z-[100] flex flex-col gap-2 pointer-events-none w-[340px]">
      {groups.map((group, i) => (
        <ToastCard
          key={group.id}
          group={group}
          stackIndex={i}
          onDismiss={() => dismiss(group.id)}
        />
      ))}
    </div>
  )
}

function ToastCard({ group, stackIndex, onDismiss }: {
  group:      ToastGroup
  stackIndex: number
  onDismiss:  () => void
}) {
  const { Icon, color, glow, ringRgb, label } = SEVERITY_TOKENS[group.severity]
  const isCritical = group.severity === 'critical'
  const latest     = group.alerts[0]
  const groupCount = group.alerts.length
  const isGrouped  = groupCount > 1

  const [hovered, setHovered]   = useState(false)
  const [progress, setProgress] = useState(0)  // 0→100 (preencheu, dismiss)
  const [entered, setEntered]   = useState(false)

  // Slide-in animation (mounts at -translate-x-4 + opacity-0)
  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 16)
    return () => clearTimeout(t)
  }, [])

  // Auto-dismiss progress (paused on hover, never for critical)
  useEffect(() => {
    if (isCritical) return
    if (hovered)    return

    const start    = Date.now() - (progress / 100) * AUTO_DISMISS_MS
    const interval = setInterval(() => {
      const elapsed = Date.now() - start
      const pct     = Math.min(100, (elapsed / AUTO_DISMISS_MS) * 100)
      setProgress(pct)
      if (pct >= 100) {
        clearInterval(interval)
        onDismiss()
      }
    }, 50)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hovered, isCritical])

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="pointer-events-auto relative overflow-hidden group/toast"
      style={{
        // Glassmorphism: backdrop-blur + low-opacity bg + colored ring
        background:    'rgba(13, 13, 16, 0.72)',
        backdropFilter:        'blur(16px) saturate(140%)',
        WebkitBackdropFilter:  'blur(16px) saturate(140%)',
        border:        `1px solid rgba(${ringRgb}, ${isCritical ? 0.5 : 0.28})`,
        borderRadius:  12,
        boxShadow:     `0 8px 32px -8px ${glow}, 0 0 0 1px rgba(255,255,255,0.04) inset`,
        // Entry: slide from right + fade
        transform:     entered ? 'translateX(0) scale(1)' : 'translateX(40px) scale(0.96)',
        opacity:       entered ? 1 : 0,
        transition:    'transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 220ms ease, box-shadow 200ms ease',
        // Stack hint: slightly smaller scale for cards behind
        scale:         String(1 - stackIndex * 0.015),
      }}
    >
      {/* Critical: subtle ring pulse */}
      {isCritical && (
        <div
          className="absolute inset-0 rounded-[12px] pointer-events-none"
          style={{
            boxShadow:  `0 0 0 1px rgba(${ringRgb}, 0.6)`,
            animation:  'criticalPulse 2.4s ease-in-out infinite',
          }}
        />
      )}

      {/* Severity bar à esquerda (gradient sutil) */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{
          background: `linear-gradient(180deg, ${color}cc, ${color}55)`,
        }}
      />

      <div className="px-3.5 py-2.5 pl-4">
        {/* Linha 1 — header compacto sempre visível */}
        <div className="flex items-center gap-2">
          <Icon size={13} style={{ color }} className="flex-shrink-0" />

          <span
            className="text-[10px] uppercase tracking-[0.08em] font-semibold"
            style={{ color }}
          >
            {label}
          </span>

          <span className="text-[10px] text-zinc-500 truncate flex-1 min-w-0">
            {CATEGORY_LABEL[group.category] ?? group.category}
          </span>

          {/* Badge de contagem quando agrupado */}
          {isGrouped && (
            <span
              className="text-[10px] font-bold px-1.5 rounded-full tabular-nums leading-[16px]"
              style={{
                background: `rgba(${ringRgb}, 0.18)`,
                color,
                border:     `1px solid rgba(${ringRgb}, 0.35)`,
              }}
            >
              +{groupCount}
            </span>
          )}

          <button
            onClick={onDismiss}
            className="flex-shrink-0 -mr-1 p-1 rounded text-zinc-600 hover:text-zinc-300 hover:bg-white/5 transition-colors opacity-0 group-hover/toast:opacity-100"
            aria-label="Fechar"
          >
            <X size={11} />
          </button>
        </div>

        {/* Linha 2 — summary (1 linha em compact, ilimitado em hover) */}
        <p
          className={`text-[12px] text-zinc-200 leading-snug mt-1 transition-all ${
            hovered ? '' : 'truncate'
          }`}
          style={{
            // Forçar truncate em compact (line-clamp inline pra não depender de plugin)
            display:           hovered ? 'block' : '-webkit-box',
            WebkitLineClamp:   hovered ? 'unset' : 1,
            WebkitBoxOrient:   'vertical',
            overflow:          'hidden',
          }}
        >
          {latest.summary}
        </p>

        {/* Suggestion + link — só aparecem em hover (mantém compact limpo) */}
        <div
          className="overflow-hidden transition-all"
          style={{
            maxHeight: hovered ? 200 : 0,
            opacity:   hovered ? 1   : 0,
          }}
        >
          {latest.suggestion && (
            <div className="flex items-start gap-1 mt-2 text-[11px] text-cyan-200/90">
              <Sparkles size={10} className="flex-shrink-0 mt-0.5" />
              <span className="leading-snug">{latest.suggestion}</span>
            </div>
          )}

          {/* Lista compacta dos outros do grupo */}
          {isGrouped && (
            <div className="mt-2 pl-2 border-l border-white/10 space-y-1">
              {group.alerts.slice(1, 4).map(a => (
                <p key={a.id} className="text-[10.5px] text-zinc-500 leading-snug truncate">
                  · {a.summary}
                </p>
              ))}
              {groupCount > 4 && (
                <p className="text-[10px] text-zinc-600 italic">+{groupCount - 4} outros…</p>
              )}
            </div>
          )}

          {group.analyzer === 'ml' && (
            <a
              href="/dashboard/inteligencia/ml"
              className="inline-flex items-center gap-1 text-[10px] mt-2 text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              Ver no painel <ExternalLink size={9} />
            </a>
          )}
          {group.analyzer !== 'ml' && (
            <a
              href="/dashboard/inteligencia/alertas"
              className="inline-flex items-center gap-1 text-[10px] mt-2 text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              Ver todos <ExternalLink size={9} />
            </a>
          )}
        </div>
      </div>

      {/* Progress bar fina embaixo — auto-dismiss countdown */}
      {!isCritical && (
        <div className="absolute left-0 right-0 bottom-0 h-[2px] bg-white/5">
          <div
            className="h-full transition-[width] duration-100 ease-linear"
            style={{
              width:      `${100 - progress}%`,
              background: `linear-gradient(90deg, ${color}cc, ${color}66)`,
            }}
          />
        </div>
      )}
    </div>
  )
}
