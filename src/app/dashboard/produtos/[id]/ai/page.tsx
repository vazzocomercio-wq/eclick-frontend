'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Sparkles, Loader2, AlertCircle, RefreshCw, Wand2, Check, X,
  Tag, Users, Lightbulb, ThumbsUp, ThumbsDown, Search, Calendar, FileText,
  Globe, GlobeLock, ExternalLink, Eye, Layers,
} from 'lucide-react'
import AiScoreBadge from '@/components/catalog/AiScoreBadge'
import { CatalogApi, type CatalogProductLight, SCORE_PART_LABELS, CATALOG_STATUS_LABELS } from '@/components/catalog/catalogApi'

export default function ProductAiEnrichmentPage() {
  const params = useParams<{ id: string }>()
  const productId = params.id

  const [product, setProduct]     = useState<CatalogProductLight | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [enriching, setEnriching] = useState(false)
  const [enrichErr, setEnrichErr] = useState<string | null>(null)
  const [recomputing, setRecomputing] = useState(false)
  const [landingBusy, setLandingBusy] = useState(false)
  const [landingPublished, setLandingPublished] = useState<boolean>(false)
  const [landingViews, setLandingViews] = useState<number>(0)

  useEffect(() => { void load() }, [productId])

  async function load() {
    setLoading(true); setError(null)
    try {
      const p = await CatalogApi.getProductWithAi(productId)
      setProduct(p)
      setLandingPublished(p.landing_published)
      setLandingViews(p.landing_views)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function toggleLanding() {
    if (!product) return
    const next = !landingPublished
    if (next && !product.ai_enriched_at) {
      if (!confirm('Este produto ainda não foi enriquecido. A landing page vai ficar incompleta. Publicar mesmo assim?')) return
    }
    setLandingBusy(true)
    try {
      const res = await CatalogApi.setLandingPublished(productId, next)
      setLandingPublished(res.landing_published)
    } catch (e: unknown) {
      alert((e as Error).message)
    } finally {
      setLandingBusy(false)
    }
  }

  async function enrich() {
    setEnrichErr(null); setEnriching(true)
    try {
      await CatalogApi.enrichProduct(productId)
      await load() // refetch pra pegar todos os campos atualizados
    } catch (e: unknown) {
      setEnrichErr((e as Error).message)
    } finally {
      setEnriching(false)
    }
  }

  async function recompute() {
    setRecomputing(true)
    try {
      await CatalogApi.recomputeScore(productId)
      await load()
    } catch (e: unknown) {
      alert((e as Error).message)
    } finally {
      setRecomputing(false)
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-zinc-950 flex items-center justify-center"><Loader2 className="animate-spin text-cyan-400" /></div>
  }
  if (error || !product) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 px-4 py-6">
        <Link href="/dashboard/produtos" className="inline-flex items-center gap-2 text-zinc-400 hover:text-zinc-100 mb-4">
          <ArrowLeft size={14} /> Voltar
        </Link>
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error ?? 'Produto não encontrado'}
        </div>
      </div>
    )
  }

  const enriched = !!product.ai_enriched_at
  const breakdown = product.ai_score_breakdown && 'has_name' in product.ai_score_breakdown
    ? product.ai_score_breakdown
    : undefined

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 px-4 sm:px-8 py-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3 min-w-0">
            <Link href={`/dashboard/produtos/${productId}/editar`} className="p-2 rounded-lg hover:bg-zinc-900 text-zinc-400">
              <ArrowLeft size={18} />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-cyan-400" />
                <h1 className="text-base font-semibold truncate" title={product.name}>{product.name}</h1>
              </div>
              <p className="text-[11px] text-zinc-500">Enriquecimento AI · {product.sku ?? 'sem SKU'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <CatalogStatusBadge status={product.catalog_status} />
            <AiScoreBadge score={product.ai_score} breakdown={breakdown} size="lg" />
            <button
              type="button"
              onClick={recompute}
              disabled={recomputing}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 text-[11px] disabled:opacity-50"
              title="Recalcula score sem chamar IA (gratis)"
            >
              {recomputing ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
              recalcular
            </button>
          </div>
        </header>

        {/* Multi-channel preview (Delta 1) */}
        {(Object.keys(product.channel_titles ?? {}).length > 0 || Object.keys(product.channel_descriptions ?? {}).length > 0) && (
          <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/[0.03] p-4 mb-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-cyan-100 mb-3">
              <Layers size={14} /> Preview multicanal
            </h2>
            <ChannelTabs
              titles={product.channel_titles ?? {}}
              descriptions={product.channel_descriptions ?? {}}
            />
          </div>
        )}

        {/* Score breakdown card */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 mb-6">
          <h2 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-3">Componentes do score</h2>
          {breakdown ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {(Object.keys(SCORE_PART_LABELS) as Array<keyof typeof SCORE_PART_LABELS>).map(key => {
                const part = breakdown[key] as { points: number; max: number } | undefined
                if (!part) return null
                const ok = part.points === part.max
                return (
                  <div
                    key={key}
                    className={[
                      'rounded-lg border px-2.5 py-1.5',
                      ok ? 'border-emerald-400/30 bg-emerald-400/5' : 'border-zinc-800 bg-zinc-950',
                    ].join(' ')}
                  >
                    <div className="flex items-center gap-1 mb-0.5">
                      {ok ? <Check size={10} className="text-emerald-400" /> : <X size={10} className="text-zinc-600" />}
                      <span className={`text-[10px] font-medium ${ok ? 'text-emerald-200' : 'text-zinc-400'}`}>
                        {SCORE_PART_LABELS[key]}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-500 font-mono">{part.points}/{part.max}</p>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-[11px] text-zinc-500">Score ainda não calculado. Clique &quot;recalcular&quot; pra computar agora.</p>
          )}
        </div>

        {/* Enrichment action */}
        <div className="rounded-xl border border-cyan-400/30 bg-gradient-to-br from-cyan-400/[0.04] to-zinc-900/50 p-4 mb-6">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-cyan-100 mb-1">Enriquecimento AI</h2>
              <p className="text-[11px] text-zinc-400">
                Sonnet lê os dados do produto e gera 9 campos: descrição curta/longa,
                keywords, público-alvo, casos de uso, prós/contras, SEO, sazonalidade.
              </p>
              {enriched && (
                <p className="text-[10px] text-zinc-500 mt-1">
                  Última execução: {new Date(product.ai_enriched_at!).toLocaleString('pt-BR')}
                  {' · '}custo total: ${Number(product.ai_enrichment_cost_usd).toFixed(4)}
                  {product.ai_enrichment_version && ` · ${product.ai_enrichment_version}`}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={enrich}
              disabled={enriching || product.ai_enrichment_pending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-black text-sm font-semibold shadow-[0_0_12px_rgba(0,229,255,0.25)] transition-all"
            >
              {(enriching || product.ai_enrichment_pending) ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
              {enriched ? 'Re-enriquecer' : 'Enriquecer com IA'}
            </button>
          </div>
          {enrichErr && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-200">
              <AlertCircle size={12} className="shrink-0 mt-0.5" />{enrichErr}
            </div>
          )}
        </div>

        {/* Landing page toggle (L2) */}
        <div className={[
          'rounded-xl border p-4 mb-6',
          landingPublished ? 'border-emerald-400/30 bg-emerald-400/5' : 'border-zinc-800 bg-zinc-900/30',
        ].join(' ')}>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0 flex-1">
              <h2 className={`flex items-center gap-2 text-sm font-semibold mb-1 ${landingPublished ? 'text-emerald-300' : 'text-zinc-200'}`}>
                {landingPublished ? <Globe size={14} /> : <GlobeLock size={14} />}
                Landing page pública
                {landingPublished && (
                  <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] bg-emerald-400/20 text-emerald-200 border border-emerald-400/30">
                    PUBLICADA
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-zinc-400">
                {landingPublished
                  ? `Página acessível em /p/${productId.slice(0, 8)}… · ${landingViews} visualizações`
                  : 'Quando ativado, gera uma landing page pública (sem auth) com os campos enriquecidos pela IA.'}
              </p>
              {landingPublished && (
                <a
                  href={`/p/${productId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-2 text-[11px] text-emerald-300 hover:text-emerald-100"
                >
                  <ExternalLink size={11} /> abrir em nova aba
                </a>
              )}
            </div>
            <button
              type="button"
              onClick={toggleLanding}
              disabled={landingBusy}
              className={[
                'flex items-center gap-1.5 px-4 py-2 rounded-lg disabled:opacity-50 text-xs font-semibold transition-all',
                landingPublished
                  ? 'bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-[0_0_12px_rgba(74,222,128,0.25)]',
              ].join(' ')}
            >
              {landingBusy
                ? <Loader2 size={12} className="animate-spin" />
                : landingPublished ? <GlobeLock size={12} /> : <Globe size={12} />}
              {landingPublished ? 'Despublicar' : 'Publicar landing'}
            </button>
          </div>
        </div>

        {/* Enriched fields */}
        {enriched ? (
          <div className="space-y-3">
            <FieldCard
              icon={<FileText size={12} />}
              title="Descrição curta"
              hint="Pra cards/preview (até 100 chars)"
              value={product.ai_short_description}
            />
            <FieldCard
              icon={<FileText size={12} />}
              title="Descrição longa"
              hint="Pra body de anúncio (200-500 chars)"
              value={product.ai_long_description}
              multiline
            />
            <ChipFieldCard
              icon={<Tag size={12} />}
              title="Keywords"
              hint="Busca interna do site (8-15 termos)"
              items={product.ai_keywords}
              tone="cyan"
            />
            <FieldCard
              icon={<Users size={12} />}
              title="Público-alvo"
              hint="Quem compra"
              value={product.ai_target_audience}
            />
            <ChipFieldCard
              icon={<Lightbulb size={12} />}
              title="Casos de uso"
              hint="Cenários concretos onde o produto é usado"
              items={product.ai_use_cases}
              tone="amber"
            />
            <ChipFieldCard
              icon={<ThumbsUp size={12} />}
              title="Prós"
              hint="Pontos fortes do produto"
              items={product.ai_pros}
              tone="emerald"
            />
            <ChipFieldCard
              icon={<ThumbsDown size={12} />}
              title="Contras / quando NÃO comprar"
              hint="Honestidade reduz devolução"
              items={product.ai_cons}
              tone="red"
            />
            <ChipFieldCard
              icon={<Search size={12} />}
              title="SEO keywords"
              hint="Pra Google/marketplace (long-tail OK)"
              items={product.ai_seo_keywords}
              tone="violet"
            />
            <FieldCard
              icon={<Calendar size={12} />}
              title="Sazonalidade"
              hint="Quando vende mais"
              value={product.ai_seasonality_hint}
            />
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center">
            <Wand2 size={28} className="text-zinc-600 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-zinc-300">Sem enriquecimento ainda</h3>
            <p className="text-xs text-zinc-500 mt-1 max-w-md mx-auto">
              Use o botão &quot;Enriquecer com IA&quot; acima. Custo médio: ~$0.01-0.03 por produto.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────

function CatalogStatusBadge({ status }: { status: CatalogProductLight['catalog_status'] }) {
  const c = CATALOG_STATUS_LABELS[status]
  if (!c) return null
  const tones: Record<string, { border: string; bg: string; text: string }> = {
    red:     { border: 'border-red-400/30',     bg: 'bg-red-400/10',     text: 'text-red-300' },
    amber:   { border: 'border-amber-400/30',   bg: 'bg-amber-400/10',   text: 'text-amber-300' },
    cyan:    { border: 'border-cyan-400/30',    bg: 'bg-cyan-400/10',    text: 'text-cyan-300' },
    emerald: { border: 'border-emerald-400/30', bg: 'bg-emerald-400/10', text: 'text-emerald-300' },
    zinc:    { border: 'border-zinc-700',       bg: 'bg-zinc-900',       text: 'text-zinc-400' },
  }
  const t = tones[c.tone] ?? tones.zinc
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] border font-medium ${t.border} ${t.bg} ${t.text}`}>
      {c.label}
    </span>
  )
}

function ChannelTabs({ titles, descriptions }: { titles: Record<string, string>; descriptions: Record<string, string> }) {
  const ALL_CHANNELS: Array<{ key: string; label: string; emoji: string; titleLimit: number }> = [
    { key: 'mercado_livre', label: 'Mercado Livre', emoji: '🟡', titleLimit: 60 },
    { key: 'shopee',        label: 'Shopee',        emoji: '🟠', titleLimit: 120 },
    { key: 'amazon',        label: 'Amazon',        emoji: '🟧', titleLimit: 200 },
    { key: 'magalu',        label: 'Magalu',        emoji: '🔵', titleLimit: 150 },
    { key: 'loja_propria',  label: 'Loja própria',  emoji: '🏪', titleLimit: 200 },
  ]
  const available = ALL_CHANNELS.filter(c => titles[c.key] || descriptions[c.key])
  const [active, setActive] = useState(available[0]?.key ?? '')
  const current = ALL_CHANNELS.find(c => c.key === active)
  const title = titles[active] ?? ''
  const description = descriptions[active] ?? ''

  if (available.length === 0) return null

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {available.map(c => (
          <button
            key={c.key}
            type="button"
            onClick={() => setActive(c.key)}
            className={[
              'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] transition-all',
              active === c.key
                ? 'bg-cyan-400 text-black font-semibold'
                : 'bg-zinc-950 text-zinc-400 border border-zinc-800',
            ].join(' ')}
          >
            <span>{c.emoji}</span>{c.label}
          </button>
        ))}
      </div>
      {current && (
        <div className="space-y-2">
          {title && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Título</p>
                <p className={`text-[10px] font-mono ${title.length > current.titleLimit ? 'text-red-400' : 'text-zinc-500'}`}>
                  {title.length}/{current.titleLimit}
                </p>
              </div>
              <p className="text-sm text-zinc-100 px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800">
                {title}
              </p>
            </div>
          )}
          {description && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Descrição</p>
              <p className="text-xs text-zinc-300 px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 whitespace-pre-line leading-relaxed max-h-48 overflow-y-auto">
                {description}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function FieldCard({
  icon, title, hint, value, multiline,
}: { icon: React.ReactNode; title: string; hint?: string; value: string | null; multiline?: boolean }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
      <header className="flex items-center gap-2 mb-1.5">
        <span className="text-cyan-400">{icon}</span>
        <h3 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">{title}</h3>
        {hint && <span className="text-[10px] text-zinc-600">— {hint}</span>}
      </header>
      {value ? (
        <p className={`text-xs text-zinc-200 ${multiline ? 'whitespace-pre-line leading-relaxed' : ''}`}>
          {value}
        </p>
      ) : (
        <p className="text-[11px] text-zinc-600 italic">— vazio —</p>
      )}
    </div>
  )
}

function ChipFieldCard({
  icon, title, hint, items, tone,
}: {
  icon: React.ReactNode
  title: string
  hint?: string
  items: string[]
  tone: 'cyan' | 'amber' | 'emerald' | 'red' | 'violet'
}) {
  const tones: Record<string, { border: string; bg: string; text: string }> = {
    cyan:    { border: 'border-cyan-400/30',    bg: 'bg-cyan-400/10',    text: 'text-cyan-200' },
    amber:   { border: 'border-amber-400/30',   bg: 'bg-amber-400/10',   text: 'text-amber-200' },
    emerald: { border: 'border-emerald-400/30', bg: 'bg-emerald-400/10', text: 'text-emerald-200' },
    red:     { border: 'border-red-400/30',     bg: 'bg-red-400/10',     text: 'text-red-200' },
    violet:  { border: 'border-violet-400/30',  bg: 'bg-violet-400/10',  text: 'text-violet-200' },
  }
  const c = tones[tone]
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
      <header className="flex items-center gap-2 mb-2">
        <span className="text-cyan-400">{icon}</span>
        <h3 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">{title}</h3>
        {hint && <span className="text-[10px] text-zinc-600">— {hint}</span>}
        <span className="ml-auto text-[10px] text-zinc-500">{items.length}</span>
      </header>
      {items.length === 0 ? (
        <p className="text-[11px] text-zinc-600 italic">— vazio —</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {items.map((item, i) => (
            <span key={i} className={`text-[11px] px-2 py-0.5 rounded-full border ${c.border} ${c.bg} ${c.text}`}>
              {item}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
