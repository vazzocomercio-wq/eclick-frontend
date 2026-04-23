'use client'

import { isAIEnabled } from '@/lib/ai/config'
import type { AIFeature } from '@/lib/ai/config'

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3l1.88 5.12L19 10l-5.12 1.88L12 17l-1.88-5.12L5 10l5.12-1.88L12 3z" />
      <path d="M5 3l.94 2.56L8.5 6.5l-2.56.94L5 10l-.94-2.56L1.5 6.5l2.56-.94L5 3z" strokeWidth={1.5} />
      <path d="M19 14l.94 2.56L22.5 17.5l-2.56.94L19 21l-.94-2.56L15.5 17.5l2.56-.94L19 14z" strokeWidth={1.5} />
    </svg>
  )
}

interface AIBadgeProps {
  feature: AIFeature
  children: React.ReactNode
  className?: string
}

export function AIBadge({ feature, children, className = '' }: AIBadgeProps) {
  const ativo = isAIEnabled(feature)

  if (!ativo) {
    return (
      <div
        className={`flex items-center gap-1.5 opacity-40 cursor-not-allowed select-none ${className}`}
        title="IA não ativada — acesse Configurações → IA para ativar"
      >
        <SparklesIcon className="text-gray-500 flex-shrink-0" />
        {children}
        <span className="text-[10px] text-gray-500 border border-gray-700 px-1.5 py-0.5 rounded-full">
          Em breve
        </span>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <SparklesIcon className="text-[#00E5FF] flex-shrink-0 animate-pulse" />
      {children}
      <span className="text-[10px] text-[#00E5FF] border border-[#00E5FF33] px-1.5 py-0.5 rounded-full">
        IA ativa
      </span>
    </div>
  )
}
