'use client'

import { useMemo, type ReactNode, type CSSProperties } from 'react'
import type { LucideIcon } from 'lucide-react'

/**
 * Carrossel animado de chips de sugestão de prompt.
 *
 * Visual: 1-3 rows de "pílulas" translúcidas fluindo horizontalmente em
 * direções alternadas atrás de um input em destaque. Hover em qualquer
 * chip pausa todas as animações (pause-on-hover via group/aps).
 *
 * Uso típico: empty states de copilot/IA — quando o user ainda não
 * mandou pergunta, os chips dão sensação de "IA viva" + ajudam a iniciar.
 *
 * Replica o componente do eclick-active. Aqui usamos cores hardcoded
 * (palette zinc/cyan #00E5FF) porque o tailwind config do SaaS não tem
 * tokens semânticos (border, card, primary).
 *
 * Pré-requisito: keyframes `marquee-left` / `marquee-right` em globals.css.
 */

export interface PromptSuggestion {
  /** Texto que vai pro input quando clicado */
  text: string
  /** Texto curto exibido no chip (default = `text` truncado) */
  label?: string
  icon?: LucideIcon
  /** Cor do ícone — hex ou var. Default: cyan brand. */
  accent?: string
}

interface AnimatedPromptSuggestionsProps {
  /** Sugestões fluindo no fundo. Ideal ≥9 (3 por row × 3 rows). */
  suggestions: PromptSuggestion[]
  /** Conteúdo principal (input/textarea + ações) — fica em destaque embaixo. */
  children: ReactNode
  /** Callback quando user clica num chip — geralmente preenche o input. */
  onSuggestionClick?: (text: string) => void
  /** Velocidade marquee em segundos. Default 50 (mais alto = mais lento). */
  speed?: number
  /** Quantas rows visíveis. Default 3. Use 1 em popovers/drawers estreitos. */
  rows?: 1 | 2 | 3
  /** Modo compacto: chips menores, padding reduzido. Pra drawers/dialogs. */
  compact?: boolean
  className?: string
}

const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(' ')

export function AnimatedPromptSuggestions({
  suggestions,
  children,
  onSuggestionClick,
  speed = 50,
  rows: rowCount = 3,
  compact = false,
  className,
}: AnimatedPromptSuggestionsProps) {
  // Distribui em N rows alternando — items[i] vai pro row i%N. Resulta em
  // rows balanceadas mesmo quando suggestions.length não é múltiplo de N.
  const rows = useMemo(() => {
    const r: PromptSuggestion[][] = Array.from({ length: rowCount }, () => [])
    suggestions.forEach((s, i) => {
      r[i % rowCount]!.push(s)
    })
    return r
  }, [suggestions, rowCount])

  return (
    <div className={cx('group/aps relative flex flex-col', compact ? 'gap-2' : 'gap-3', className)}>
      {/* Carrossel — pause-on-hover global via group/aps */}
      <div className={cx('flex flex-col overflow-hidden', compact ? 'gap-1 py-0.5' : 'gap-2 py-1')}>
        {rows.map((row, i) => (
          <MarqueeRow
            key={i}
            items={row}
            direction={i % 2 === 0 ? 'left' : 'right'}
            speed={speed + i * 5}
            onClick={onSuggestionClick}
            compact={compact}
          />
        ))}
      </div>

      {/* Input em destaque */}
      <div className="relative">{children}</div>
    </div>
  )
}

function MarqueeRow({
  items,
  direction,
  speed,
  onClick,
  compact,
}: {
  items: PromptSuggestion[]
  direction: 'left' | 'right'
  speed: number
  onClick?: (text: string) => void
  compact: boolean
}) {
  if (items.length === 0) return null

  // Duplica os itens pra loop sem corte. translateX(-50%) move a 1ª metade
  // pra fora da view enquanto a 2ª entra — visualmente seamless.
  const doubled = [...items, ...items]

  return (
    <div className="flex overflow-hidden">
      <div
        className={cx(
          'flex shrink-0 pr-2',
          compact ? 'gap-1.5' : 'gap-2',
          direction === 'left' ? 'animate-marquee-left' : 'animate-marquee-right',
          'group-hover/aps:[animation-play-state:paused]',
        )}
        style={{ animationDuration: `${speed}s` }}
      >
        {doubled.map((item, i) => (
          <Chip key={i} item={item} onClick={onClick} compact={compact} />
        ))}
      </div>
    </div>
  )
}

function Chip({
  item,
  onClick,
  compact,
}: {
  item: PromptSuggestion
  onClick?: (text: string) => void
  compact: boolean
}) {
  const Icon = item.icon
  const accent = item.accent ?? '#00E5FF'
  const label = item.label ?? item.text

  return (
    <button
      type="button"
      onClick={() => onClick?.(item.text)}
      className={cx(
        'group/chip flex shrink-0 items-center rounded-full',
        'border border-zinc-800/70 bg-zinc-900/40 backdrop-blur-sm',
        compact ? 'gap-1 px-2 py-0.5 text-[10px]' : 'gap-1.5 px-3 py-1.5 text-xs',
        'whitespace-nowrap text-zinc-500',
        'transition-all duration-200',
        'hover:border-cyan-400/60 hover:bg-zinc-900 hover:text-zinc-100 hover:shadow-md',
        'focus:outline-none focus:ring-2 focus:ring-cyan-400/40',
      )}
      style={{ '--accent': accent } as CSSProperties}
    >
      {Icon && (
        <Icon
          className={cx(
            'shrink-0 opacity-60 transition-all group-hover/chip:opacity-100',
            compact ? 'h-2.5 w-2.5' : 'h-3 w-3',
          )}
          style={{ color: accent }}
        />
      )}
      <span className="truncate">{label}</span>
    </button>
  )
}
