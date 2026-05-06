'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Megaphone, Loader2, ArrowLeft, ArrowRight, Check, Search, Package,
  AlertCircle, Sparkles,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { AdsCampaignsApi, type AdsPlatform, type AdsObjective } from '@/components/ads-campaigns/adsCampaignsApi'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface ProductLite {
  id:          string
  name:        string
  brand?:      string | null
  category?:   string | null
  price?:      number | null
  ai_score?:   number | null
  photo_urls?: string[] | null
  images?:     Array<{ url?: string }> | null
}

const PLATFORMS: Array<{ key: AdsPlatform; label: string; hint: string; color: string }> = [
  { key: 'meta',              label: 'Meta Ads',     hint: 'Facebook + Instagram',           color: '#0866FF' },
  { key: 'google',            label: 'Google Ads',   hint: 'Search + Shopping + PMax',        color: '#4285F4' },
  { key: 'tiktok',            label: 'TikTok Ads',   hint: 'Vídeo nativo TikTok',             color: '#FF0050' },
  { key: 'mercado_livre_ads', label: 'ML Ads',       hint: 'Boost de anúncios MercadoLivre',  color: '#FFE600' },
]

const OBJECTIVES: Array<{ key: AdsObjective; label: string; hint: string }> = [
  { key: 'traffic',       label: 'Tráfego',         hint: 'Mandar pessoas pra landing/loja' },
  { key: 'conversions',   label: 'Conversões',      hint: 'Vendas / compras' },
  { key: 'catalog_sales', label: 'Catálogo',        hint: 'Dynamic Ads do catálogo' },
  { key: 'engagement',    label: 'Engajamento',     hint: 'Likes / comentários' },
  { key: 'awareness',     label: 'Reconhecimento',  hint: 'Branding e alcance' },
  { key: 'leads',         label: 'Leads',           hint: 'Captura de contato' },
]

export default function NewCampaignWizard() {
  const router = useRouter()

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [products, setProducts] = useState<ProductLite[] | null>(null)
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState<ProductLite | null>(null)
  const [platform, setPlatform] = useState<AdsPlatform | null>(null)
  const [objective, setObjective] = useState<AdsObjective>('conversions')

  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ id: string; name: string; cost_usd: number } | null>(null)

  useEffect(() => {
    void (async () => {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      if (!session?.access_token) { setError('Não autenticado'); return }
      try {
        const res = await fetch(`${BACKEND}/products`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
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

  async function generate() {
    if (!picked || !platform) return
    setGenerating(true); setError(null)
    try {
      const r = await AdsCampaignsApi.generateForProduct(picked.id, { platform, objective })
      setResult({ id: r.campaign.id, name: r.campaign.name, cost_usd: r.cost_usd })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-zinc-500 hover:text-zinc-300">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <Megaphone size={18} className="text-cyan-400" />
            Nova campanha
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">3 passos: produto → plataforma → objetivo → IA gera tudo</p>
        </div>
      </div>

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
              {n === 1 ? 'Produto' : n === 2 ? 'Plataforma' : 'Objetivo'}
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

      {/* Step 1 — Product */}
      {step === 1 && (
        <div className="space-y-3">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 flex items-center gap-2">
            <Search size={14} className="text-zinc-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar produto…"
              className="flex-1 bg-transparent text-sm text-zinc-200 outline-none placeholder:text-zinc-600"
            />
          </div>
          {!products ? (
            <div className="flex items-center gap-2 text-zinc-500 text-sm">
              <Loader2 size={14} className="animate-spin" /> carregando produtos…
            </div>
          ) : (
            <div className="space-y-1 max-h-[60vh] overflow-y-auto rounded-lg border border-zinc-800">
              {filtered.map(p => {
                const thumb = p.photo_urls?.[0] ?? p.images?.[0]?.url ?? null
                return (
                <button
                  key={p.id}
                  onClick={() => setPicked(p)}
                  className={[
                    'w-full text-left px-3 py-2 flex items-center gap-3 transition-colors',
                    picked?.id === p.id ? 'bg-cyan-400/10' : 'hover:bg-zinc-900/60',
                  ].join(' ')}
                >
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumb}
                      alt={p.name}
                      loading="lazy"
                      className="w-12 h-12 rounded object-cover shrink-0 bg-zinc-900 border border-zinc-800"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                    />
                  ) : (
                    <div className="w-12 h-12 rounded shrink-0 bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                      <Package size={16} className="text-zinc-600" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-200 truncate">{p.name}</p>
                    <p className="text-[10px] text-zinc-500 truncate">
                      {[p.brand, p.category].filter(Boolean).join(' · ') || '—'}
                      {p.price != null && ` · R$ ${Number(p.price).toFixed(2)}`}
                    </p>
                  </div>
                  {picked?.id === p.id && <Check size={14} className="text-cyan-400" />}
                </button>
                )
              })}
            </div>
          )}
          <div className="flex justify-end">
            <button
              onClick={() => setStep(2)}
              disabled={!picked}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 disabled:cursor-not-allowed text-black text-sm font-medium"
            >
              Próximo <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Step 2 — Platform */}
      {step === 2 && (
        <div className="space-y-3">
          <p className="text-xs text-zinc-400">Em qual plataforma vamos rodar?</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PLATFORMS.map(p => (
              <button
                key={p.key}
                onClick={() => setPlatform(p.key)}
                className={[
                  'rounded-lg border p-3 text-left transition-colors',
                  platform === p.key
                    ? 'border-cyan-400/60 bg-cyan-400/5'
                    : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700',
                ].join(' ')}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-4 rounded-sm" style={{ background: p.color }} />
                  <p className="text-sm font-medium text-zinc-200">{p.label}</p>
                </div>
                <p className="text-[11px] text-zinc-500">{p.hint}</p>
              </button>
            ))}
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="px-4 py-2 rounded-lg border border-zinc-800 hover:border-zinc-700 text-zinc-300 text-sm flex items-center gap-2">
              <ArrowLeft size={14} /> Voltar
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!platform}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 disabled:cursor-not-allowed text-black text-sm font-medium"
            >
              Próximo <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Objective + Generate */}
      {step === 3 && !result && (
        <div className="space-y-3">
          <p className="text-xs text-zinc-400">Qual o objetivo da campanha?</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {OBJECTIVES.map(o => (
              <button
                key={o.key}
                onClick={() => setObjective(o.key)}
                disabled={generating}
                className={[
                  'rounded-lg border p-3 text-left transition-colors disabled:opacity-50',
                  objective === o.key
                    ? 'border-cyan-400/60 bg-cyan-400/5'
                    : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700',
                ].join(' ')}
              >
                <p className="text-sm font-medium text-zinc-200">{o.label}</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">{o.hint}</p>
              </button>
            ))}
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 space-y-1 text-[11px]">
            <p className="text-zinc-500 uppercase tracking-wider">Resumo</p>
            <p className="text-zinc-300">{picked?.name}</p>
            <p className="text-zinc-400">
              {PLATFORMS.find(p => p.key === platform)?.label} · objetivo {objective}
            </p>
            <p className="text-zinc-500">Custo estimado: ~$0.025 USD por campanha gerada</p>
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setStep(2)}
              disabled={generating}
              className="px-4 py-2 rounded-lg border border-zinc-800 hover:border-zinc-700 text-zinc-300 text-sm flex items-center gap-2 disabled:opacity-50"
            >
              <ArrowLeft size={14} /> Voltar
            </button>
            <button
              onClick={generate}
              disabled={generating}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 disabled:cursor-not-allowed text-black text-sm font-medium"
            >
              {generating ? <><Loader2 size={14} className="animate-spin" /> Gerando…</> : <><Sparkles size={14} /> Gerar com IA</>}
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
              <p className="text-sm font-medium text-zinc-100">Campanha gerada!</p>
              <p className="text-xs text-zinc-400">{result.name} · custo ${result.cost_usd.toFixed(4)}</p>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setResult(null); setStep(1); setPicked(null); setPlatform(null) }}
              className="px-4 py-2 rounded-lg border border-zinc-800 hover:border-zinc-700 text-zinc-300 text-sm"
            >
              Gerar mais uma
            </button>
            <a
              href={`/dashboard/ads-campaigns/${result.id}`}
              className="px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black text-sm font-medium"
            >
              Ver e revisar
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
