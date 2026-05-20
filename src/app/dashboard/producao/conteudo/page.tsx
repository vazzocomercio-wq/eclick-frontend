'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase'
import { callAI } from '@/lib/ai/client'
import { PROMPTS } from '@/lib/ai/prompts'
import { isAIEnabled, setAIFeature, getAIPreference } from '@/lib/ai/config'
import { AISelector, AIBadge } from '@/components/ai/AISelector'
import {
  Sparkles, Copy, Check, Wand2, FileText, Tag, ChevronDown, ExternalLink, AlertTriangle, Loader2,
  Mic, Heart, Briefcase, Smile, Shield, Gem, DollarSign, Award, Gift, Zap, Clock, Search,
  Layers, Ruler,
} from 'lucide-react'
import Link from 'next/link'
import { AnimatedPromptSuggestions, type PromptSuggestion } from '@/components/ui/animated-prompt-suggestions'

// ── Context suggestions per tool — ícone/cor fixos; text/label via tradução ──

const DESCRICAO_SUGGESTION_ICONS: { icon: PromptSuggestion['icon']; accent: string }[] = [
  { icon: Mic,        accent: '#00E5FF' },
  { icon: Briefcase,  accent: '#a78bfa' },
  { icon: Smile,      accent: '#fbbf24' },
  { icon: Shield,     accent: '#34d399' },
  { icon: Gem,        accent: '#c084fc' },
  { icon: DollarSign, accent: '#22c55e' },
  { icon: Award,      accent: '#38bdf8' },
  { icon: Gift,       accent: '#fb7185' },
  { icon: Zap,        accent: '#f59e0b' },
  { icon: Clock,      accent: '#f87171' },
  { icon: Search,     accent: '#00E5FF' },
  { icon: Heart,      accent: '#f472b6' },
]

const BULLET_SUGGESTION_ICONS: { icon: PromptSuggestion['icon']; accent: string }[] = [
  { icon: Heart,      accent: '#00E5FF' },
  { icon: Layers,     accent: '#a78bfa' },
  { icon: Zap,        accent: '#34d399' },
  { icon: Ruler,      accent: '#fbbf24' },
  { icon: Shield,     accent: '#38bdf8' },
  { icon: Briefcase,  accent: '#c084fc' },
  { icon: Smile,      accent: '#f59e0b' },
  { icon: Mic,        accent: '#fb7185' },
  { icon: DollarSign, accent: '#22c55e' },
  { icon: Gem,        accent: '#f472b6' },
]

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

// ── Types ─────────────────────────────────────────────────────────────────────

type Product = { id: string; name: string; sku: string | null; price: number | null; ml_title: string | null; category: string | null }

type ToolKey = 'titulo' | 'descricao' | 'bullet'

// ── Tool config — ícone/feature estruturais; label/desc via tradução ────────

const TOOLS: { key: ToolKey; icon: React.ReactNode; feature: 'titulo_anuncio' | 'descricao_produto' }[] = [
  { key: 'titulo',    icon: <Tag size={16} />,      feature: 'titulo_anuncio' },
  { key: 'descricao', icon: <FileText size={16} />, feature: 'descricao_produto' },
  { key: 'bullet',    icon: <Wand2 size={16} />,    feature: 'descricao_produto' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getToken() {
  const { data } = await createClient().auth.getSession()
  return data.session?.access_token ?? null
}

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null)
  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    })
  }
  return { copied, copy }
}

// ── Product Picker ────────────────────────────────────────────────────────────

function ProductPicker({ products, selected, onSelect }: {
  products: Product[]
  selected: Product | null
  onSelect: (p: Product | null) => void
}) {
  const t = useTranslations('producao.conteudo')
  const [open, setOpen] = useState(false)
  const [q, setQ]       = useState('')

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(q.toLowerCase()) ||
    (p.sku ?? '').toLowerCase().includes(q.toLowerCase())
  )

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs transition-all"
        style={{ background: '#1c1c1f', border: '1px solid #3f3f46', color: selected ? '#e4e4e7' : '#71717a' }}>
        <span className="truncate">{selected ? selected.name : t('selectProduct')}</span>
        <ChevronDown size={12} className="shrink-0" style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 150ms' }} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-20 rounded-xl overflow-hidden shadow-xl"
          style={{ background: '#18181b', border: '1px solid #2e2e33' }}>
          <div className="p-2">
            <input autoFocus value={q} onChange={e => setQ(e.target.value)}
              placeholder={t('searchProductSku')}
              className="w-full rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
              style={{ background: '#111114', border: '1px solid #3f3f46' }} />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0
              ? <p className="px-3 py-2 text-xs text-zinc-600">{t('noProduct')}</p>
              : filtered.map(p => (
                  <button key={p.id} onClick={() => { onSelect(p); setOpen(false); setQ('') }}
                    className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-zinc-800 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-zinc-200 truncate">{p.name}</p>
                      {p.sku && <p className="text-[10px] text-zinc-600 font-mono">{p.sku}</p>}
                    </div>
                    {p.price && <span className="text-[10px] text-zinc-500 shrink-0">{p.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>}
                  </button>
                ))
            }
          </div>
        </div>
      )}
    </div>
  )
}

// ── Result block ──────────────────────────────────────────────────────────────

function ResultBlock({ text, copyKey, onApply }: { text: string; copyKey: string; onApply?: () => void }) {
  const t = useTranslations('producao.conteudo')
  const { copied, copy } = useCopy()
  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: '#0a0a0d', border: '1px solid #1e1e24' }}>
      <pre className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed font-sans">{text}</pre>
      <div className="flex items-center gap-2 pt-1">
        <button onClick={() => copy(text, copyKey)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
          style={{ background: copied === copyKey ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)', color: copied === copyKey ? '#22c55e' : '#a1a1aa' }}>
          {copied === copyKey ? <Check size={11} /> : <Copy size={11} />}
          {copied === copyKey ? t('copied') : t('copy')}
        </button>
        {onApply && (
          <button onClick={onApply}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
            style={{ background: 'rgba(0,229,255,0.1)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.2)' }}>
            <Sparkles size={11} /> {t('applyToProduct')}
          </button>
        )}
      </div>
    </div>
  )
}

// ── AI Disabled Banner ────────────────────────────────────────────────────────

function AIDisabledBanner({ feature }: { feature: 'titulo_anuncio' | 'descricao_produto' }) {
  const t = useTranslations('producao.conteudo')
  const [enabled, setEnabled] = useState(false)

  function enable() {
    setAIFeature('titulo_anuncio', true)
    setAIFeature('descricao_produto', true)
    // enable master too via localStorage
    localStorage.setItem('ai_enabled', 'true')
    setEnabled(true)
    window.location.reload()
  }

  return (
    <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl"
      style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
      <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
      <div className="space-y-2 flex-1">
        <p className="text-xs text-amber-300 font-medium">{t('aiDisabledTitle')}</p>
        <p className="text-[11px] text-zinc-500">{t('aiDisabledHint')}</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={enable}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
            style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
            <Sparkles size={11} /> {t('enableAiNow')}
          </button>
          <Link href="/dashboard/configuracoes/ia"
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors">
            {t('aiSettings')} <ExternalLink size={10} />
          </Link>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ConteudoPage() {
  const t = useTranslations('producao.conteudo')
  const [tool,     setTool]     = useState<ToolKey>('titulo')
  const [products, setProducts] = useState<Product[]>([])
  const [selected, setSelected] = useState<Product | null>(null)
  const [extra,    setExtra]    = useState('')   // custom context / override text
  const [result,   setResult]   = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [aiReady,    setAiReady]    = useState(false)
  const [aiProvider, setAiProvider] = useState(() => getAIPreference().provider)
  const [aiModel,    setAiModel]    = useState(() => getAIPreference().model)
  const [aiBadge,    setAiBadge]    = useState<{ provider: string; model: string } | null>(null)
  const [applying,   setApplying]   = useState(false)
  const [applied,    setApplied]    = useState(false)

  const toolDef = TOOLS.find(td => td.key === tool)!

  const descricaoSuggestions = useMemo<PromptSuggestion[]>(
    () => DESCRICAO_SUGGESTION_ICONS.map((s, i) => ({
      ...s, text: t(`descricaoSuggestions.${i}.text`), label: t(`descricaoSuggestions.${i}.label`),
    })),
    [t],
  )
  const bulletSuggestions = useMemo<PromptSuggestion[]>(
    () => BULLET_SUGGESTION_ICONS.map((s, i) => ({
      ...s, text: t(`bulletSuggestions.${i}.text`), label: t(`bulletSuggestions.${i}.label`),
    })),
    [t],
  )
  const tips = useMemo(
    () => ([
      { icon: '🏷️', key: 'titles' },
      { icon: '📝', key: 'descriptions' },
      { icon: '✅', key: 'bullets' },
      { icon: '🔄', key: 'iteration' },
    ] as const),
    [],
  )

  // Check AI state client-side (isAIEnabled reads localStorage)
  useEffect(() => {
    setAiReady(isAIEnabled(toolDef.feature))
  }, [tool, toolDef.feature])

  // Load products
  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token) return
      const res = await fetch(`${BACKEND}/products`, { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) setProducts(await res.json())
    }
    load()
  }, [])

  // Reset result on tool/product change
  useEffect(() => { setResult(null); setError(null) }, [tool, selected])

  const generate = useCallback(async () => {
    if (!aiReady) return
    setLoading(true); setError(null); setResult(null); setApplied(false)

    try {
      let prompt = ''
      if (tool === 'titulo') {
        const titulo = extra.trim() || selected?.ml_title || selected?.name || ''
        const cat    = selected?.category ?? 'Geral'
        if (!titulo) { setError(t('errorNeedTitle')); setLoading(false); return }
        prompt = PROMPTS.otimizar_titulo(titulo, cat)
      } else if (tool === 'descricao') {
        if (!selected && !extra.trim()) { setError(t('errorNeedProduct')); setLoading(false); return }
        prompt = PROMPTS.gerar_descricao({
          nome:  extra.trim() || selected?.name,
          sku:   selected?.sku ?? undefined,
          preco: selected?.price ?? undefined,
        })
      } else {
        if (!selected && !extra.trim()) { setError(t('errorNeedProduct')); setLoading(false); return }
        prompt = `Crie 5 bullet points concisos e persuasivos para destacar os diferenciais do produto:
Nome: ${extra.trim() || selected?.name}
SKU: ${selected?.sku ?? ''}
Preço: ${selected?.price?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? ''}
Cada bullet com 1 linha. Use ícone ✓ no início. Em português.`
      }

      const res = await callAI(toolDef.feature, prompt, undefined, aiProvider, aiModel)
      if (!res) throw new Error(t('errorNoResult'))
      setResult(res.content)
      if (res.provider && res.model) setAiBadge({ provider: res.provider, model: res.model })
    } catch (e: any) {
      setError(e.message ?? t('errorGenerate'))
    } finally {
      setLoading(false)
    }
  }, [tool, toolDef.feature, selected, extra, aiReady, aiProvider, aiModel, t])

  async function applyTitle() {
    if (!selected || !result || tool !== 'titulo') return
    setApplying(true)
    try {
      const token = await getToken()
      await fetch(`${BACKEND}/products/${selected.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ml_title: result.trim() }),
      })
      setApplied(true)
    } finally {
      setApplying(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-5 min-h-full" style={{ background: 'var(--background)' }}>

      {/* Header */}
      <div>
        <p className="text-zinc-500 text-xs">{t('eyebrow')}</p>
        <h2 className="text-white text-lg font-semibold mt-0.5">{t('title')}</h2>
        <p className="text-zinc-500 text-xs mt-1">{t('subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Left: tool + form */}
        <div className="xl:col-span-2 space-y-4">

          {/* Tool tabs */}
          <div className="flex gap-2 flex-wrap">
            {TOOLS.map(td => (
              <button key={td.key} onClick={() => setTool(td.key)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background: tool === td.key ? 'rgba(0,229,255,0.12)' : '#111114',
                  color: tool === td.key ? '#00E5FF' : '#71717a',
                  border: `1px solid ${tool === td.key ? 'rgba(0,229,255,0.3)' : '#1e1e24'}`,
                }}>
                {td.icon} {t(`tools.${td.key}.label`)}
              </button>
            ))}
          </div>

          {/* Form card */}
          <div className="rounded-2xl p-5 space-y-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
            <div>
              <p className="text-sm font-semibold text-white">{t(`tools.${toolDef.key}.label`)}</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">{t(`tools.${toolDef.key}.desc`)}</p>
            </div>

            {!aiReady && <AIDisabledBanner feature={toolDef.feature} />}

            {/* Product picker */}
            <div>
              <label className="block text-[10px] font-medium text-zinc-500 mb-1.5">{t('productOptional')}</label>
              <ProductPicker products={products} selected={selected} onSelect={p => { setSelected(p); setExtra('') }} />
            </div>

            {/* Extra / override field */}
            <div>
              <label className="block text-[10px] font-medium text-zinc-500 mb-1.5">
                {tool === 'titulo' ? t('currentTitleLabel') : t('extraContextLabel')}
              </label>
              {tool === 'titulo' ? (
                <textarea
                  value={extra}
                  onChange={e => setExtra(e.target.value)}
                  rows={2}
                  placeholder={selected?.ml_title ?? selected?.name ?? t('titlePlaceholder')}
                  className="w-full rounded-xl px-3 py-2.5 text-xs text-white outline-none resize-none transition-all"
                  style={{ background: '#1c1c1f', border: '1px solid #3f3f46' }}
                  onFocus={e => (e.target.style.borderColor = '#00E5FF')}
                  onBlur={e => (e.target.style.borderColor  = '#3f3f46')}
                />
              ) : (
                <AnimatedPromptSuggestions
                  suggestions={tool === 'descricao' ? descricaoSuggestions : bulletSuggestions}
                  onSuggestionClick={(text) => setExtra((prev) => (prev.trim() ? `${prev.trim()}\n${text}` : text))}
                  rows={2}
                  speed={55}
                >
                  <textarea
                    value={extra}
                    onChange={e => setExtra(e.target.value)}
                    rows={3}
                    placeholder={
                      tool === 'descricao'
                        ? t('descricaoPlaceholder')
                        : t('bulletPlaceholder')
                    }
                    className="w-full rounded-xl px-3 py-2.5 text-xs text-white outline-none resize-none transition-all"
                    style={{
                      background: '#1c1c1f',
                      border: '1px solid rgba(0,229,255,0.2)',
                      boxShadow: '0 0 0 1px rgba(0,229,255,0.05), 0 4px 16px -4px rgba(0,229,255,0.15)',
                    }}
                    onFocus={e => (e.target.style.borderColor = '#00E5FF')}
                    onBlur={e => (e.target.style.borderColor  = 'rgba(0,229,255,0.2)')}
                  />
                </AnimatedPromptSuggestions>
              )}
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <div className="flex items-center gap-2">
              <button onClick={generate} disabled={loading || !aiReady}
                className="glow-rainbow flex items-center justify-center gap-2 flex-1 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #00E5FF, #7C3AED)', color: '#fff' }}>
                {loading
                  ? <><Loader2 size={15} className="animate-spin" /> {t('generating')}</>
                  : <><Sparkles size={15} /> {t('generateAi')}</>
                }
              </button>
              {aiReady && <AISelector compact onSelect={(p, m) => { setAiProvider(p); setAiModel(m) }} />}
            </div>
          </div>

          {/* Result */}
          {result && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xs font-semibold text-zinc-400">{t('result')}</p>
                {aiBadge && <AIBadge provider={aiBadge.provider} model={aiBadge.model} />}
                {applied && (
                  <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                    <Check size={10} /> {t('appliedToProduct')}
                  </span>
                )}
              </div>
              <ResultBlock
                text={result}
                copyKey="result"
                onApply={tool === 'titulo' && selected && !applied ? (applying ? undefined : applyTitle) : undefined}
              />
              {tool === 'titulo' && selected && !applied && (
                <p className="text-[10px] text-zinc-600">
                  {t.rich('applyTitleNote', { strong: (chunks) => <strong className="text-zinc-500">{chunks}</strong> })}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Right: tips + recent */}
        <div className="space-y-4">
          <div className="rounded-2xl p-5 space-y-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
            <div className="flex items-center gap-2">
              <Sparkles size={13} style={{ color: '#a78bfa' }} />
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-600">{t('tipsTitle')}</h3>
            </div>
            <ul className="space-y-3">
              {tips.map(tip => (
                <li key={tip.key} className="space-y-0.5">
                  <p className="text-[11px] font-semibold" style={{ color: '#a1a1aa' }}>{tip.icon} {t(`tips.${tip.key}.title`)}</p>
                  <p className="text-[10px] text-zinc-600 leading-relaxed">{t(`tips.${tip.key}.text`)}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl p-5 space-y-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-600">{t('availableResources')}</h3>
            <div className="space-y-2">
              {TOOLS.map(td => {
                const on = isAIEnabled(td.feature)
                return (
                  <div key={td.key} className="flex items-center justify-between">
                    <span className="text-[11px] text-zinc-400">{t(`tools.${td.key}.label`)}</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                      style={{ background: on ? 'rgba(34,197,94,0.1)' : 'rgba(113,113,122,0.15)', color: on ? '#4ade80' : '#71717a' }}>
                      {on ? t('active') : t('inactive')}
                    </span>
                  </div>
                )
              })}
              <Link href="/dashboard/configuracoes/ia"
                className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors mt-1">
                {t('manageAiResources')} <ExternalLink size={9} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
