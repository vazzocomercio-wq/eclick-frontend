'use client'

import { useState, useEffect, useRef } from 'react'
import { Sparkles, ChevronDown } from 'lucide-react'
import { AI_PROVIDERS, getAIPreference, setAIPreference } from '@/lib/ai/config'

interface AISelectorProps {
  onSelect: (provider: string, model: string) => void
  compact?: boolean
}

export function AISelector({ onSelect, compact = false }: AISelectorProps) {
  const [open, setOpen]                   = useState(false)
  const [selectedProvider, setSelectedProvider] = useState('anthropic')
  const [selectedModel,    setSelectedModel]    = useState('claude-haiku-4-5-20251001')
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  useEffect(() => {
    const pref = getAIPreference()
    setSelectedProvider(pref.provider)
    setSelectedModel(pref.model)
    onSelectRef.current(pref.provider, pref.model)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSelect(provider: string, model: string) {
    setSelectedProvider(provider)
    setSelectedModel(model)
    setAIPreference(provider, model)
    onSelect(provider, model)
    setOpen(false)
  }

  const currentProvider = AI_PROVIDERS[selectedProvider as keyof typeof AI_PROVIDERS]
  const currentModel    = currentProvider?.models.find(m => m.id === selectedModel)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 rounded-xl transition-colors ${compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'}`}
        style={{ background: '#111114', border: '1px solid #1e1e24' }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(0,229,255,0.3)')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = '#1e1e24')}>
        <Sparkles size={compact ? 10 : 12} style={{ color: '#00E5FF' }} />
        <span className="font-medium text-white">{currentProvider?.name ?? selectedProvider}</span>
        <span className="text-zinc-600">·</span>
        <span className="text-zinc-400">{currentModel?.name ?? selectedModel}</span>
        <ChevronDown size={10} className="text-zinc-600 ml-0.5" style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 150ms' }} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full mt-1.5 right-0 z-50 w-72 rounded-2xl overflow-hidden shadow-2xl"
            style={{ background: '#111114', border: '1px solid #1e1e24' }}>
            {Object.entries(AI_PROVIDERS).map(([provId, prov]) => (
              <div key={provId}>
                <div className="px-4 py-2" style={{ background: '#0d0d10' }}>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">{prov.name}</span>
                </div>
                {prov.models.map(m => {
                  const active = selectedProvider === provId && selectedModel === m.id
                  return (
                    <button
                      key={m.id}
                      onClick={() => handleSelect(provId, m.id)}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors"
                      style={{
                        background:  active ? 'rgba(0,229,255,0.06)' : 'transparent',
                        borderLeft:  active ? '2px solid #00E5FF' : '2px solid transparent',
                      }}
                      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)' }}
                      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                      <div>
                        <p className="text-xs font-medium text-white">{m.name}</p>
                        <p className="text-[10px] text-zinc-500">{m.description}</p>
                      </div>
                      {active && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#00E5FF' }} />}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Usage badge shown after generation ───────────────────────────────────────

export function AIBadge({ provider, model }: { provider: string; model: string }) {
  const prov   = AI_PROVIDERS[provider as keyof typeof AI_PROVIDERS]
  const mdl    = prov?.models.find(m => m.id === model)
  const label  = provider === 'anthropic' ? '🤖 Claude' : '🧠 ChatGPT'
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full"
      style={{ background: '#1a1a1f', color: '#71717a' }}>
      {label} · {mdl?.name ?? model}
    </span>
  )
}
