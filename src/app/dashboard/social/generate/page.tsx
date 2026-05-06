'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Sparkles, Loader2, Search, Check, ArrowLeft, ArrowRight,
  Package, AlertCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { SocialContentApi } from '@/components/social/socialContentApi'
import SocialChannelSelector from '@/components/social/SocialChannelSelector'
import { ChannelBadge } from '@/components/social/SocialBadges'
import type { SocialChannel, SocialContent } from '@/components/social/types'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface ProductLite {
  id:                string
  name:              string
  brand?:            string | null
  category?:         string | null
  price?:            number | null
  short_description?: string | null
  ai_score?:         number | null
}

const STYLES = [
  { key: 'engaging',   label: 'Engajante',           hint: 'Storytelling, foco em conexão' },
  { key: 'direct',     label: 'Direto',              hint: 'Sem rodeios, foco em conversão' },
  { key: 'educational', label: 'Educativo',          hint: 'Explica como o produto resolve' },
  { key: 'promotional', label: 'Promocional',        hint: 'Oferta, escassez, urgência' },
  { key: 'lifestyle',  label: 'Lifestyle',           hint: 'Estilo de vida, aspiração' },
  { key: 'humor',      label: 'Bem-humorado',        hint: 'Leve, descontraído' },
]

export default function GenerateWizardPage() {
  const router = useRouter()

  // Step state
  const [step, setStep] = useState<1 | 2 | 3>(1)

  // Data state
  const [products, setProducts]   = useState<ProductLite[] | null>(null)
  const [search, setSearch]       = useState('')
  const [selected, setSelected]   = useState<string[]>([])
  const [channels, setChannels]   = useState<SocialChannel[]>([])
  const [styleKey, setStyleKey]   = useState<string>('engaging')
  const [customStyle, setCustomStyle] = useState('')

  // Generation state
  const [generating, setGenerating] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [result, setResult]         = useState<{ items: SocialContent[]; cost_usd: number; failed?: number } | null>(null)

  // Load products
  useEffect(() => {
    void (async () => {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      if (!session?.access_token) { setError('Não autenticado'); return }
      try {
        const res = await fetch(`${BACKEND}/products`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        setProducts(Array.isArray(data) ? data : [])
      } catch (e) {
        setError((e as Error).message)
      }
    })()
  }, [])

  const filtered = useMemo(() => {
    if (!products) return []
    if (!search.trim()) return products.slice(0, 100)
    const q = search.toLowerCase()
    return products.filter(p =>
      p.name?.toLowerCase().includes(q) ||
      p.brand?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q),
    ).slice(0, 100)
  }, [products, search])

  const toggleProduct = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id])
  }

  const styleStr = useMemo(() => {
    if (customStyle.trim()) return customStyle.trim()
    const def = STYLES.find(s => s.key === styleKey)
    if (!def) return undefined
    return `${def.label} — ${def.hint}`
  }, [styleKey, customStyle])

  async function generate() {
    setGenerating(true); setError(null)
    try {
      if (selected.length === 1) {
        const res = await SocialContentApi.generateForProduct(selected[0], {
          channels,
          style: styleStr,
        })
        setResult({ items: res.items, cost_usd: res.cost_usd })
      } else {
        const res = await SocialContentApi.generateBatch({
          productIds: selected,
          channels,
          style:      styleStr,
        })
        setResult({ items: res.items, cost_usd: res.cost_usd, failed: res.failed })
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  const canStep2 = selected.length > 0
  const canStep3 = canStep2 && channels.length > 0
  const canGen   = canStep3

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-zinc-500 hover:text-zinc-300">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <Sparkles size={20} className="text-cyan-400" />
            Gerar Conteúdo Social
          </h1>
          <p className="text-xs text-zinc-500 mt-1">3 passos: produtos → canais → estilo → IA gera tudo</p>
        </div>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2 text-[11px]">
        {[1, 2, 3].map(n => (
          <div key={n} className="flex items-center gap-2">
            <span className={[
              'w-6 h-6 rounded-full flex items-center justify-center font-mono',
              step === n
                ? 'bg-cyan-400 text-black'
                : step > n
                ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/40'
                : 'bg-zinc-900 text-zinc-500 border border-zinc-800',
            ].join(' ')}>{step > n ? <Check size={11} /> : n}</span>
            <span className={step === n ? 'text-cyan-300' : 'text-zinc-500'}>
              {n === 1 ? 'Produtos' : n === 2 ? 'Canais' : 'Estilo'}
            </span>
            {n < 3 && <span className="text-zinc-700 mx-1">→</span>}
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300 flex items-center gap-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* Step 1 — Products */}
      {step === 1 && (
        <div className="space-y-3">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 flex items-center gap-2">
            <Search size={14} className="text-zinc-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar produto por nome, marca, categoria…"
              className="flex-1 bg-transparent text-sm text-zinc-200 outline-none placeholder:text-zinc-600"
            />
            {selected.length > 0 && (
              <span className="text-[11px] text-cyan-400 shrink-0">
                {selected.length} selecionado{selected.length > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {!products ? (
            <div className="flex items-center gap-2 text-zinc-500 text-sm">
              <Loader2 size={14} className="animate-spin" /> carregando produtos…
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-zinc-500">Nenhum produto encontrado.</p>
          ) : (
            <div className="space-y-1 max-h-[60vh] overflow-y-auto rounded-lg border border-zinc-800">
              {filtered.map(p => {
                const sel = selected.includes(p.id)
                return (
                  <button
                    key={p.id}
                    onClick={() => toggleProduct(p.id)}
                    className={[
                      'w-full text-left px-3 py-2 flex items-center gap-3 transition-colors',
                      sel ? 'bg-cyan-400/10' : 'hover:bg-zinc-900/60',
                    ].join(' ')}
                  >
                    <span className={[
                      'w-4 h-4 rounded flex items-center justify-center shrink-0 border',
                      sel ? 'bg-cyan-400 border-cyan-400' : 'border-zinc-700',
                    ].join(' ')}>
                      {sel && <Check size={10} className="text-black" strokeWidth={3} />}
                    </span>
                    <Package size={14} className="text-zinc-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-200 truncate">{p.name}</p>
                      <p className="text-[10px] text-zinc-500 truncate">
                        {[p.brand, p.category].filter(Boolean).join(' · ') || '—'}
                        {p.price != null && ` · R$ ${Number(p.price).toFixed(2)}`}
                      </p>
                    </div>
                    {p.ai_score != null && (
                      <span className="text-[10px] font-mono text-cyan-300 shrink-0">{p.ai_score}/100</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          <div className="flex justify-end pt-3">
            <button
              onClick={() => setStep(2)}
              disabled={!canStep2}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 disabled:cursor-not-allowed text-black text-sm font-medium"
            >
              Próximo <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Step 2 — Channels */}
      {step === 2 && (
        <div className="space-y-3">
          <p className="text-xs text-zinc-400">
            Escolha os canais. A IA gera o conteúdo otimizado para cada um em uma única passagem.
          </p>
          <SocialChannelSelector value={channels} onChange={setChannels} disabled={generating} />

          <div className="flex justify-between pt-3">
            <button
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-800 hover:border-zinc-700 text-zinc-300 text-sm"
            >
              <ArrowLeft size={14} /> Voltar
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!canStep3}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 disabled:cursor-not-allowed text-black text-sm font-medium"
            >
              Próximo <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Style + Generate */}
      {step === 3 && !result && (
        <div className="space-y-3">
          <p className="text-xs text-zinc-400">Escolha um tom (ou descreva à mão).</p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {STYLES.map(s => (
              <button
                key={s.key}
                onClick={() => { setStyleKey(s.key); setCustomStyle('') }}
                disabled={generating}
                className={[
                  'rounded-lg border px-3 py-2 text-left transition-colors disabled:opacity-50',
                  styleKey === s.key && !customStyle
                    ? 'border-cyan-400/60 bg-cyan-400/5'
                    : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700',
                ].join(' ')}
              >
                <p className="text-sm text-zinc-200">{s.label}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">{s.hint}</p>
              </button>
            ))}
          </div>

          <textarea
            value={customStyle}
            onChange={e => setCustomStyle(e.target.value)}
            disabled={generating}
            placeholder="Ou descreva o tom em palavras suas (opcional)…"
            rows={2}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-cyan-400/60 resize-none"
          />

          {/* Recap */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 space-y-2 text-[11px]">
            <p className="text-zinc-500 uppercase tracking-wider">Resumo</p>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-zinc-300">{selected.length} produto{selected.length > 1 ? 's' : ''}</span>
              <span className="text-zinc-700">×</span>
              {channels.map(c => <ChannelBadge key={c} channel={c} size="xs" />)}
            </div>
            <p className="text-zinc-500">
              Custo estimado: ~${(0.025 * selected.length).toFixed(3)} USD
            </p>
          </div>

          <div className="flex justify-between pt-3">
            <button
              onClick={() => setStep(2)}
              disabled={generating}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-800 hover:border-zinc-700 text-zinc-300 text-sm disabled:opacity-50"
            >
              <ArrowLeft size={14} /> Voltar
            </button>
            <button
              onClick={generate}
              disabled={!canGen || generating}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 disabled:cursor-not-allowed text-black text-sm font-medium"
            >
              {generating ? <><Loader2 size={14} className="animate-spin" /> Gerando…</> : <><Sparkles size={14} /> Gerar conteúdo</>}
            </button>
          </div>
        </div>
      )}

      {/* Result */}
      {step === 3 && result && (
        <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/[0.05] p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-400/20 flex items-center justify-center">
              <Check size={18} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-100">Conteúdo gerado!</p>
              <p className="text-xs text-zinc-400">
                {result.items.length} peça{result.items.length > 1 ? 's' : ''} criada{result.items.length > 1 ? 's' : ''}
                {result.failed ? ` · ${result.failed} falharam` : ''}
                {' · '}
                custo: ${result.cost_usd.toFixed(4)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[40vh] overflow-y-auto">
            {result.items.map(it => (
              <a
                key={it.id}
                href={`/dashboard/social/content/${it.id}`}
                className="rounded border border-zinc-800 bg-zinc-900/60 hover:border-cyan-400/40 px-3 py-2 transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <ChannelBadge channel={it.channel} size="xs" />
                </div>
                <p className="text-[11px] text-zinc-400 line-clamp-2">
                  {(it.content as { caption?: string; main_caption?: string; message?: string; subject?: string }).caption
                    ?? (it.content as { main_caption?: string }).main_caption
                    ?? (it.content as { message?: string }).message
                    ?? (it.content as { subject?: string }).subject
                    ?? '(preview indisponível)'}
                </p>
              </a>
            ))}
          </div>

          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setResult(null); setStep(1); setSelected([]); setChannels([]) }}
              className="px-4 py-2 rounded-lg border border-zinc-800 hover:border-zinc-700 text-zinc-300 text-sm"
            >
              Gerar mais
            </button>
            <a
              href="/dashboard/social"
              className="px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black text-sm font-medium"
            >
              Ver feed completo
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
