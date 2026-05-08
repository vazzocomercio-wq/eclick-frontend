'use client'

import { useEffect, useState, useCallback, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Loader2, ExternalLink, Sparkles, Clock, ChevronRight,
  Zap, LogOut, AlertTriangle, CheckCircle2, RefreshCw,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import AccountSelector, { useMlAccount, getStoredSellerId } from '@/components/ml/AccountSelector'
import { CopyButton } from '@/components/ui/copy-button'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

interface Campaign {
  id:                          string
  ml_campaign_id:              string
  ml_promotion_type:           string
  name:                        string | null
  start_date:                  string | null
  finish_date:                 string | null
  deadline_date:               string | null
  status:                      string
  candidate_count:             number
  pending_count:               number
  started_count:               number
  has_subsidy_items:           boolean
  items_with_subsidy_count:    number
  avg_meli_subsidy_pct:        number | null
  seller_id:                   number
}

interface Item {
  id:                          string
  ml_item_id:                  string
  status:                      string
  original_price:              number | null
  current_price:               number | null
  suggested_discounted_price:  number | null
  min_discounted_price:        number | null
  max_discounted_price:        number | null
  meli_percentage:             number | null
  seller_percentage:           number | null
  has_meli_subsidy:            boolean
  meli_subsidy_amount:         number | null
  estimated_margin_brl:        number | null
  estimated_margin_pct:        number | null
  health_status:               string | null
  health_warnings:             Array<{ code: string; message: string }>
  product_id:                  string | null
  thumbnail_url:               string | null
  title:                       string | null
  permalink:                   string | null
  listing_status:              string | null
  catalog_listing:             boolean
  seller_sku:                  string | null
}

interface RecoSlim {
  id:               string
  campaign_item_id: string
  status:           string
}

async function getToken(): Promise<string | null> {
  const sb = createClient()
  const { data } = await sb.auth.getSession()
  return data.session?.access_token ?? null
}

function brl(v: number | null) {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { selected: selectedSellerId } = useMlAccount()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [items, setItems]       = useState<Item[]>([])
  const [total, setTotal]       = useState(0)
  const [statusFilter, setStatusFilter] = useState<'candidate' | 'started' | ''>('candidate')
  const [listingFilter, setListingFilter] = useState<'' | 'active' | 'paused' | 'catalog'>('')
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [syncing, setSyncing]   = useState(false)
  const [toast, setToast]       = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [leaving, setLeaving]   = useState<string | null>(null)
  const [recoMap, setRecoMap]   = useState<Map<string, string>>(new Map()) // campaign_item_id → recommendation_id
  const [generatingItem, setGeneratingItem] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const t = await getToken()
      const sid = getStoredSellerId()
      const sidQ = sid != null ? `?seller_id=${sid}` : ''
      const sidQAmp = sid != null ? `&seller_id=${sid}` : ''

      // listingFilter='catalog' vira ?catalog=true; demais viram ?listing_status=...
      const listingQ = listingFilter === 'catalog'
        ? '&catalog=true'
        : listingFilter
          ? `&listing_status=${listingFilter}`
          : ''
      const [cRes, iRes, rRes] = await Promise.all([
        fetch(`${BACKEND}/ml-campaigns/${id}${sidQ}`, { headers: { Authorization: `Bearer ${t}` } }),
        fetch(`${BACKEND}/ml-campaigns/${id}/items?limit=100${sidQAmp}${statusFilter ? `&status=${statusFilter}` : ''}${listingQ}`, {
          headers: { Authorization: `Bearer ${t}` },
        }),
        // Recomendações dessa campanha (qualquer status) pra mapear item → reco
        fetch(`${BACKEND}/ml-campaigns/recommendations?campaign_id=${id}&status=&limit=200${sidQAmp}`, {
          headers: { Authorization: `Bearer ${t}` },
        }),
      ])
      if (!cRes.ok) throw new Error(`HTTP ${cRes.status}`)
      const text = await cRes.text()
      setCampaign(text ? JSON.parse(text) : null)

      if (iRes.ok) {
        const body = await iRes.json()
        setItems(body.items ?? [])
        setTotal(body.total ?? 0)
      }

      if (rRes.ok) {
        const body = await rRes.json() as { recommendations?: RecoSlim[] }
        const map = new Map<string, string>()
        for (const r of body.recommendations ?? []) {
          // Prioriza pending — se tiver várias pra mesmo item, fica com a ativa
          if (!map.has(r.campaign_item_id) || r.status === 'pending') {
            map.set(r.campaign_item_id, r.id)
          }
        }
        setRecoMap(map)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [id, statusFilter, listingFilter])

  useEffect(() => { void load() }, [load, selectedSellerId])

  // Fire-and-forget enrich quando os items carregam: se algum sem thumbnail,
  // pede pro backend buscar do ML em background. Re-load 8s depois pra pegar
  // o que já enriqueceu.
  useEffect(() => {
    if (items.length === 0) return
    const missing = items.some(i => !i.thumbnail_url)
    if (!missing) return
    void (async () => {
      try {
        const t = await getToken()
        const sid = getStoredSellerId() ?? campaign?.seller_id
        if (sid == null) return
        const res = await fetch(`${BACKEND}/ml-campaigns/sync/enrich-metadata?seller_id=${sid}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${t}` },
        })
        if (!res.ok) return
        const data = await res.json().catch(() => ({} as { started?: boolean }))
        if (data.started) setTimeout(() => void load(), 8000)
      } catch { /* silent */ }
    })()
    // só dispara 1x quando items mudam de [] pra preenchido — evita loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, campaign?.seller_id])

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  /** Atualiza dados em 2 fases:
   *  1) Recompute health_status (sincronizo, ~5s) — instantaneamente
   *     reflete custos/impostos atualizados no catalogo
   *  2) Sync ML completo (fire-and-forget, 1-3min) — pega novos items
   *     da campanha + subsidios novos
   *  Reload imediato apos #1, depois 90s pro #2. */
  async function resync() {
    if (!campaign) return
    setSyncing(true)
    try {
      const t = await getToken()
      const sid = getStoredSellerId() ?? campaign.seller_id

      // Fase 1: recompute health (rápido, síncrono)
      const recRes = await fetch(`${BACKEND}/ml-campaigns/sync/recompute-health?seller_id=${sid}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}` },
      })
      if (!recRes.ok) {
        const body = await recRes.json().catch(() => ({} as { message?: string }))
        throw new Error(body.message ?? `HTTP ${recRes.status}`)
      }
      const rec = await recRes.json() as {
        total: number; updated: number; moved_to_ready: number;
        by_status: Record<string, number>; auto_linked?: number;
      }

      // Fase 2: dispara sync ML em background (não espera)
      void fetch(`${BACKEND}/ml-campaigns/sync?seller_id=${sid}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}` },
      }).catch(() => { /* ignore */ })

      // Toast informativo (varia conforme houve auto-link ou não)
      const linkedNote = (rec.auto_linked ?? 0) > 0
        ? `🔗 ${rec.auto_linked} items linkados a produtos via SKU. `
        : ''
      const movedMsg = rec.moved_to_ready > 0
        ? `✅ ${rec.moved_to_ready} item${rec.moved_to_ready === 1 ? '' : 's'} viraram READY`
        : `✅ ${rec.updated}/${rec.total} health recalculados`
      showToast(`${linkedNote}${movedMsg}. Sync ML rodando em background…`, 'success')

      // Reload imediato pra refletir health novo
      void load()
      // Reload tardio pra pegar sync ML
      setTimeout(() => { void load() }, 90_000)
    } catch (e) {
      showToast(`❌ ${(e as Error).message}`, 'error')
    } finally {
      setSyncing(false)
    }
  }

  async function generateRecommendations() {
    if (!campaign) return
    setGenerating(true)
    try {
      const t = await getToken()
      const sid = getStoredSellerId() ?? campaign.seller_id
      const res = await fetch(`${BACKEND}/ml-campaigns/recommendations/generate?seller_id=${sid}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}` },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({} as { message?: string }))
        throw new Error(body.message ?? `HTTP ${res.status}`)
      }
      const data = await res.json().catch(() => ({} as { generated?: number }))
      const n = data.generated ?? 0
      showToast(`✨ ${n} recomendações geradas — redirecionando…`, 'success')
      setTimeout(() => {
        router.push(`/dashboard/ml-campaigns/recommendations?campaign_id=${id}`)
      }, 1200)
    } catch (e) {
      showToast(`❌ ${(e as Error).message}`, 'error')
    } finally {
      setGenerating(false)
    }
  }

  /** Atalho item-a-item: se já tem recomendação, abre o editor.
   *  Se não, gera só pra esse item (mais rápido que gerar pra org toda),
   *  depois redireciona pro editor. */
  async function openItemEditor(campaignItemId: string) {
    const existing = recoMap.get(campaignItemId)
    if (existing) {
      router.push(`/dashboard/ml-campaigns/recommendations/${existing}`)
      return
    }
    setGeneratingItem(campaignItemId)
    try {
      const t = await getToken()
      const res = await fetch(`${BACKEND}/ml-campaigns/recommendations/generate-item/${campaignItemId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}` },
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({} as { message?: string }))
        throw new Error(errBody.message ?? `HTTP ${res.status}`)
      }
      const data = await res.json() as { id?: string }
      if (data.id) {
        router.push(`/dashboard/ml-campaigns/recommendations/${data.id}`)
      } else {
        showToast('Recomendação gerada, mas sem id retornado', 'error')
      }
    } catch (e) {
      showToast(`❌ ${(e as Error).message}`, 'error')
    } finally {
      setGeneratingItem(null)
    }
  }

  async function leaveCampaign(campaignItemId: string) {
    if (!campaign) return
    if (!confirm('Sair da campanha pra esse anúncio? O item volta a Candidato.')) return
    setLeaving(campaignItemId)
    try {
      const t = await getToken()
      const sid = getStoredSellerId() ?? campaign.seller_id
      const res = await fetch(`${BACKEND}/ml-campaigns/leave/single`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_item_id: campaignItemId, seller_id: sid }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({} as { message?: string }))
        throw new Error(body.message ?? `HTTP ${res.status}`)
      }
      showToast('✅ Item removido da campanha', 'success')
      void load()
    } catch (e) {
      showToast(`❌ ${(e as Error).message}`, 'error')
    } finally {
      setLeaving(null)
    }
  }

  if (loading && !campaign) {
    return (
      <div className="p-6 max-w-6xl mx-auto" style={{ background: 'var(--background)', minHeight: '100vh', color: 'var(--text)' }}>
        <div className="flex items-center gap-2 text-zinc-500 text-sm">
          <Loader2 size={14} className="animate-spin" /> Carregando…
        </div>
      </div>
    )
  }

  if (error || !campaign) {
    return (
      <div className="p-6 max-w-6xl mx-auto" style={{ background: 'var(--background)', minHeight: '100vh', color: 'var(--text)' }}>
        <Link href="/dashboard/ml-campaigns/list" className="inline-flex items-center gap-1 text-cyan-400 text-xs mb-3">
          <ArrowLeft size={12} /> Voltar
        </Link>
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {error || 'Campanha não encontrada.'}
        </div>
      </div>
    )
  }

  const totalItems = campaign.candidate_count + campaign.pending_count + campaign.started_count

  return (
    <div className="p-6 space-y-4 max-w-6xl mx-auto" style={{ background: 'var(--background)', minHeight: '100vh', color: 'var(--text)' }}>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Link href="/dashboard/ml-campaigns" className="hover:text-cyan-400">Campaign Center</Link>
        <span>/</span>
        <Link href="/dashboard/ml-campaigns/list" className="hover:text-cyan-400">Campanhas</Link>
        <span>/</span>
        <span className="text-zinc-300 font-mono">{campaign.ml_campaign_id}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <CampaignTypeBadge type={campaign.ml_promotion_type} />
            <StatusBadge status={campaign.status} />
            {campaign.has_subsidy_items && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold"
                style={{ background: 'rgba(0,229,255,0.1)', color: '#67e8f9', border: '1px solid rgba(0,229,255,0.3)' }}>
                <Sparkles size={10} />
                ML subsidia ~{campaign.avg_meli_subsidy_pct?.toFixed(1) ?? '?'}%
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold">
            {campaign.name ?? `${campaign.ml_promotion_type} ${campaign.ml_campaign_id}`}
          </h1>
          <div className="flex items-center gap-4 text-[11px] text-zinc-500 mt-1 flex-wrap">
            <span className="font-mono">{campaign.ml_campaign_id}</span>
            <span>seller {campaign.seller_id}</span>
            {campaign.deadline_date && (
              <span className="flex items-center gap-1 text-amber-400">
                <Clock size={10} /> Aderir até {new Date(campaign.deadline_date).toLocaleDateString('pt-BR')}
              </span>
            )}
            {campaign.finish_date && (
              <span>Encerra em {new Date(campaign.finish_date).toLocaleDateString('pt-BR')}</span>
            )}
          </div>
        </div>
        <AccountSelector compact hideWhenEmpty />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Counter label="Candidatos"   value={campaign.candidate_count} color="#00E5FF" />
        <Counter label="Programados"  value={campaign.pending_count}   color="#a78bfa" />
        <Counter label="Participando" value={campaign.started_count}   color="#22c55e" />
        <Counter label="Total"        value={totalItems}                color="#fafafa" />
      </div>

      {/* Action panel — fluxo de adesão */}
      <div className="rounded-xl p-4 flex items-start gap-3 flex-wrap"
        style={{ background: 'linear-gradient(135deg, rgba(0,229,255,0.08), rgba(167,139,250,0.06))', border: '1px solid rgba(0,229,255,0.25)' }}>
        <div className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(0,229,255,0.15)' }}>
          <Sparkles size={16} className="text-cyan-300" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-100">Como participar dessa campanha</p>
          <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
            <strong className="text-cyan-300">1)</strong> Gere recomendações IA (analisa margem + subsídio ML por item) ·{' '}
            <strong className="text-cyan-300">2)</strong> Aprove/edite as sugestões ·{' '}
            <strong className="text-cyan-300">3)</strong> Aplique e o item entra na campanha.
          </p>
          {campaign.candidate_count === 0 && campaign.started_count === 0 && (
            <p className="text-[11px] text-amber-300 mt-2">Nenhum item candidato — clique "Atualizar dados" pra sincronizar com ML.</p>
          )}
          {campaign.candidate_count > 0 && items.some(i => i.health_status && i.health_status !== 'ready') && (
            <p className="text-[11px] text-amber-300 mt-2">
              ⚠ Items <strong>INCOMPLETE</strong>: a IA pula esses até você cadastrar custo + imposto no produto interno e rodar <strong>"Atualizar dados"</strong>.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={resync} disabled={syncing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
            style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}
            title="Re-sincroniza com ML — recomputa health_status com seus custos atualizados">
            {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {syncing ? 'Sincronizando…' : 'Atualizar dados'}
          </button>
          {campaign.candidate_count > 0 && (
            <button onClick={generateRecommendations} disabled={generating}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
              style={{ background: '#00E5FF', color: '#000', border: '1px solid #00E5FF' }}>
              {generating ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
              {generating ? 'Gerando…' : `Gerar Recomendações IA (${campaign.candidate_count})`}
            </button>
          )}
          <Link href={`/dashboard/ml-campaigns/recommendations?campaign_id=${id}`}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
            style={{ background: 'rgba(167,139,250,0.15)', color: '#c4b5fd', border: '1px solid rgba(167,139,250,0.35)' }}>
            <Sparkles size={12} /> Ver Recomendações
            <ChevronRight size={11} />
          </Link>
        </div>
      </div>

      {/* Items toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2 mt-4">
        <h2 className="text-sm font-semibold">Anúncios</h2>
        <div className="flex items-center gap-1 text-xs">
          {[
            { v: '',           label: 'Todos' },
            { v: 'candidate',  label: `Candidatos (${campaign.candidate_count})` },
            { v: 'started',    label: `Participando (${campaign.started_count})` },
          ].map(opt => (
            <button key={opt.v}
              onClick={() => setStatusFilter(opt.v as any)}
              className="px-2.5 py-1 rounded-lg transition-all"
              style={{
                background: statusFilter === opt.v ? 'rgba(0,229,255,0.15)' : '#0c0c10',
                border: `1px solid ${statusFilter === opt.v ? 'rgba(0,229,255,0.4)' : '#1a1a1f'}`,
                color: statusFilter === opt.v ? '#67e8f9' : '#a1a1aa',
              }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Listing status filter (ativo/pausado/catalogo) */}
      <div className="flex items-center gap-1 text-[11px] flex-wrap">
        <span className="text-zinc-500 mr-1">Anúncio:</span>
        {[
          { v: '',         label: 'Todos',     color: '#a1a1aa' },
          { v: 'active',   label: 'Ativos',    color: '#22c55e' },
          { v: 'paused',   label: 'Pausados',  color: '#fbbf24' },
          { v: 'catalog',  label: 'Catálogo',  color: '#a78bfa' },
        ].map(opt => (
          <button key={opt.v}
            onClick={() => setListingFilter(opt.v as any)}
            className="px-2 py-0.5 rounded transition-all font-medium"
            style={{
              background: listingFilter === opt.v ? `${opt.color}20` : '#0c0c10',
              border: `1px solid ${listingFilter === opt.v ? `${opt.color}60` : '#1a1a1f'}`,
              color: listingFilter === opt.v ? opt.color : '#71717a',
            }}>
            {opt.label}
          </button>
        ))}
      </div>

      {/* Items list */}
      {items.length === 0 && !loading && (
        <div className="rounded-xl p-6 text-center text-xs text-zinc-500"
          style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
          Nenhum anúncio nesse status.
        </div>
      )}

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map(item => (
            <ItemRow
              key={item.id}
              item={item}
              campaignId={id}
              recoId={recoMap.get(item.id) ?? null}
              onOpenEditor={() => openItemEditor(item.id)}
              onLeave={() => leaveCampaign(item.id)}
              leaving={leaving === item.id}
              generating={generatingItem === item.id}
            />
          ))}
          {total > items.length && (
            <p className="text-[11px] text-zinc-500 text-center pt-2">
              Mostrando {items.length} de {total}
            </p>
          )}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-xl"
          style={{
            background: toast.type === 'success' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
            color:      toast.type === 'success' ? '#4ade80' : '#f87171',
            border:     `1px solid ${toast.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
            backdropFilter: 'blur(8px)',
          }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}

function ItemRow({ item, campaignId, recoId, onOpenEditor, onLeave, leaving, generating }: {
  item: Item
  campaignId: string
  recoId: string | null
  onOpenEditor: () => void
  onLeave: () => void
  leaving: boolean
  generating: boolean
}) {
  const showcasePrice = item.current_price ?? item.suggested_discounted_price
  const discount = (item.original_price && showcasePrice)
    ? Math.round(((item.original_price - showcasePrice) / item.original_price) * 100)
    : null

  const isStarted    = item.status === 'started'
  const isCandidate  = item.status === 'candidate'
  const isIncomplete = item.health_status && item.health_status !== 'ready'

  const permalink = item.permalink ?? `https://www.mercadolivre.com.br/${item.ml_item_id}`

  return (
    <div className="rounded-lg p-3" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
      <div className="flex items-start gap-3 flex-wrap">
        {/* Thumbnail */}
        <a href={permalink} target="_blank" rel="noreferrer"
          className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-zinc-900 flex items-center justify-center"
          style={{ border: '1px solid #1a1a1f' }}
          title={item.title ?? item.ml_item_id}>
          {item.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.thumbnail_url} alt={item.title ?? item.ml_item_id}
              className="w-full h-full object-cover"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
          ) : (
            <Loader2 size={14} className="text-zinc-700 animate-spin" />
          )}
        </a>

        {/* MLB ID + título + SKU + status */}
        <div className="flex-shrink-0 w-44 min-w-0">
          <div className="flex items-center gap-0.5">
            <span className="font-mono text-[10px] text-zinc-400 truncate">{item.ml_item_id}</span>
            <CopyButton value={item.ml_item_id} size={9} />
            <a href={permalink} target="_blank" rel="noreferrer"
              className="text-cyan-400 hover:underline flex-shrink-0 ml-0.5">
              <ExternalLink size={10} />
            </a>
          </div>
          {item.title && (
            <div className="flex items-start gap-0.5 mt-0.5">
              <p className="text-[11px] text-zinc-200 leading-tight line-clamp-2 flex-1" title={item.title}>
                {item.title}
              </p>
              <CopyButton value={item.title} size={9} />
            </div>
          )}
          <div className="flex items-center gap-0.5 mt-0.5" title={item.seller_sku ? `SKU: ${item.seller_sku}` : 'SKU não cadastrado no anúncio ML'}>
            <span className="text-[9px] uppercase tracking-wider text-zinc-500">SKU:</span>
            {item.seller_sku ? (
              <>
                <span className="font-mono text-[10px] text-zinc-300 truncate">{item.seller_sku}</span>
                <CopyButton value={item.seller_sku} size={9} />
              </>
            ) : (
              <span className="text-[10px] text-zinc-600 italic">— sem SKU no ML</span>
            )}
          </div>
          <div className="flex items-center gap-1 flex-wrap mt-0.5">
            <ItemStatusBadge status={item.status} />
            <ListingStatusBadge listingStatus={item.listing_status} catalog={item.catalog_listing} />
          </div>
        </div>

        {/* Preços */}
        <div className="flex-1 min-w-0 grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
          <div>
            <p className="text-[9px] uppercase tracking-wider text-zinc-500">Preço original</p>
            <p className="text-zinc-300 font-medium">{brl(item.original_price)}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wider text-zinc-500">
              {isStarted ? 'Preço promocional' : 'Sugerido ML'}
            </p>
            <p className="font-medium" style={{ color: discount && discount > 0 ? '#22c55e' : '#fafafa' }}>
              {brl(showcasePrice)}
              {discount && discount > 0 && (
                <span className="ml-1 text-[10px] text-emerald-400">−{discount}%</span>
              )}
            </p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wider text-zinc-500">Mínimo aceito</p>
            <p className="text-zinc-300 font-medium">{brl(item.min_discounted_price)}</p>
          </div>
        </div>

        {/* Subsídio */}
        {item.has_meli_subsidy && (
          <div className="flex-shrink-0 px-2 py-1.5 rounded text-right"
            style={{ background: 'rgba(0,229,255,0.06)', border: '1px solid rgba(0,229,255,0.2)' }}>
            <p className="text-[9px] uppercase tracking-wider text-cyan-300">ML reduz</p>
            <p className="text-cyan-400 font-bold text-sm">
              {item.meli_subsidy_amount ? brl(item.meli_subsidy_amount) : `${item.meli_percentage?.toFixed(1)}%`}
            </p>
          </div>
        )}

        {/* M.C. */}
        {item.estimated_margin_pct != null && (
          <div className="flex-shrink-0 px-2 py-1.5 rounded text-right"
            style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}>
            <p className="text-[9px] uppercase tracking-wider text-emerald-300">M.C.</p>
            <p className="text-emerald-400 font-bold text-sm">{item.estimated_margin_pct.toFixed(1)}%</p>
          </div>
        )}

        {/* Health warning (compact) */}
        {isIncomplete && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider"
            style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}
            title="Faltam dados (custo, margem, etc) — sync precisa enriquecer esse item">
            <AlertTriangle size={9} />
            INCOMPLETE
          </span>
        )}

        {/* Action buttons por linha */}
        <div className="flex-shrink-0 flex items-center gap-1.5">
          {isCandidate && (
            <>
              <button onClick={onOpenEditor} disabled={generating}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-[10px] font-semibold transition-all disabled:opacity-50"
                style={{
                  background: recoId ? '#00E5FF' : 'rgba(0,229,255,0.1)',
                  color:      recoId ? '#000'    : '#67e8f9',
                  border: '1px solid rgba(0,229,255,0.4)',
                }}
                title={recoId ? 'Definir preço e aderir (atalho — pula a lista)' : 'Gerar recomendação IA + abrir editor'}>
                {generating ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                {generating ? 'Gerando…' : recoId ? '💰 Definir preço' : 'Gerar IA'}
              </button>
              <Link href={`/dashboard/ml-campaigns/recommendations?campaign_id=${campaignId}`}
                className="text-[10px] text-zinc-500 hover:text-cyan-300 underline-offset-2 hover:underline transition-colors"
                title="Abrir lista completa de recomendações dessa campanha">
                lista
              </Link>
            </>
          )}
          {isStarted && (
            <button onClick={onLeave} disabled={leaving}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-[10px] font-semibold transition-all disabled:opacity-50"
              style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}
              title="Sair da campanha pra esse item">
              {leaving ? <Loader2 size={10} className="animate-spin" /> : <LogOut size={10} />}
              {leaving ? 'Saindo…' : 'Sair'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Counter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: '#0c0c10', border: `1px solid ${color}30` }}>
      <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
    </div>
  )
}

function CampaignTypeBadge({ type }: { type: string }) {
  return (
    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold"
      style={{ background: 'rgba(167,139,250,0.15)', color: '#c4b5fd', border: '1px solid rgba(167,139,250,0.4)' }}>
      {type}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    started:  { label: 'ATIVA',       color: '#22c55e' },
    pending:  { label: 'PROGRAMADA',  color: '#a78bfa' },
    finished: { label: 'ENCERRADA',   color: '#71717a' },
    paused:   { label: 'PAUSADA',     color: '#fbbf24' },
    expired:  { label: 'EXPIRADA',    color: '#ef4444' },
  }
  const m = map[status] ?? { label: status, color: '#71717a' }
  return (
    <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-bold"
      style={{ background: `${m.color}15`, color: m.color, border: `1px solid ${m.color}40` }}>
      {m.label}
    </span>
  )
}

function ItemStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    candidate: { label: 'Candidato',    color: '#00E5FF' },
    pending:   { label: 'Programado',   color: '#a78bfa' },
    started:   { label: 'Participando', color: '#22c55e' },
    finished:  { label: 'Encerrado',    color: '#71717a' },
  }
  const m = map[status] ?? { label: status, color: '#71717a' }
  return (
    <span className="text-[9px] inline-block px-1.5 py-0.5 rounded uppercase tracking-wider font-semibold"
      style={{ background: `${m.color}15`, color: m.color, border: `1px solid ${m.color}40` }}>
      {m.label}
    </span>
  )
}

/** Badge do status do anúncio na ML (ativo/pausado/fechado) + flag catálogo. */
function ListingStatusBadge({ listingStatus, catalog }: { listingStatus: string | null; catalog: boolean }) {
  if (catalog) {
    return (
      <span className="text-[9px] inline-block px-1.5 py-0.5 rounded uppercase tracking-wider font-semibold"
        style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.4)' }}>
        Catálogo
      </span>
    )
  }
  if (!listingStatus) return null
  const map: Record<string, { label: string; color: string }> = {
    active:       { label: 'Ativo',     color: '#22c55e' },
    paused:       { label: 'Pausado',   color: '#fbbf24' },
    closed:       { label: 'Fechado',   color: '#71717a' },
    under_review: { label: 'Em revisão', color: '#fb923c' },
  }
  const m = map[listingStatus] ?? { label: listingStatus, color: '#71717a' }
  return (
    <span className="text-[9px] inline-block px-1.5 py-0.5 rounded uppercase tracking-wider font-semibold"
      style={{ background: `${m.color}15`, color: m.color, border: `1px solid ${m.color}40` }}>
      {m.label}
    </span>
  )
}
