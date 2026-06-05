'use client'

/**
 * Tela escopada "Incluir em campanha" — aberta pelo card do funil "Anúncios ML"
 * (action_link). Dado um PRODUTO do catálogo, mostra as campanhas disponíveis
 * pra cada anúncio dele no ML e deixa PARTICIPAR direto (sem recomendação).
 * Se um anúncio não tem campanha disponível, oferece criar a própria promoção.
 *
 * Backend:
 *   GET  /ml-campaigns/listing/:productId/promotions
 *   POST /ml-campaigns/listing/join { campaign_item_id, offer_price }
 */

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Loader2, Megaphone, Tag, Clock, CheckCircle2, X,
  ExternalLink, Sparkles, AlertTriangle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

async function getToken(): Promise<string | null> {
  const sb = createClient()
  const { data } = await sb.auth.getSession()
  return data.session?.access_token ?? null
}

interface PromoOption {
  campaign_item_id: string
  ml_item_id:       string
  ml_campaign_id:   string
  promotion_type:   string
  campaign_name:    string | null
  campaign_status:  string | null
  start_date:       string | null
  finish_date:      string | null
  deadline_date:    string | null
  item_status:      string
  original_price:   number | null
  suggested_price:  number | null
  min_price:        number | null
  max_price:        number | null
  current_price:    number | null
  ml_offer_id:      string | null
  meli_percentage:  number | null
  has_meli_subsidy: boolean
  health_status:    string | null
}
interface Anuncio {
  ml_item_id:    string
  seller_id:     number
  title:         string | null
  thumbnail_url: string | null
  permalink:     string | null
  listing_status: string | null
  available:     PromoOption[]
  participating: PromoOption[]
}
interface Result {
  product:  { id: string; sku: string | null; name: string }
  anuncios: Anuncio[]
  has_any_available: boolean
}

function brl(v: number | null | undefined): string {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}
function discountInfo(original: number | null, final: number | null): { pct: number; brl: number } | null {
  if (original == null || final == null || original <= 0) return null
  const off = original - final
  if (off <= 0) return null
  return { pct: Math.round((off / original) * 100), brl: Math.round(off * 100) / 100 }
}

export default function AnuncioPromotionsPage() {
  const params = useParams<{ productId: string }>()
  const productId = params.productId

  const [data, setData]       = useState<Result | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [toast, setToast]     = useState<string | null>(null)
  // modal de participação
  const [joinOpt, setJoinOpt] = useState<{ opt: PromoOption; anuncio: Anuncio } | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const tk = await getToken()
      if (!tk) throw new Error('Sessão expirada — recarregue a página.')
      const r = await fetch(`${BACKEND}/ml-campaigns/listing/${productId}/promotions`, {
        headers: { Authorization: `Bearer ${tk}` },
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text().catch(() => '')}`)
      setData(await r.json() as Result)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [productId])

  useEffect(() => { void load() }, [load])

  function onJoined(msg: string) {
    setJoinOpt(null)
    setToast(msg)
    void load()
    setTimeout(() => setToast(null), 6000)
  }

  return (
    <div className="min-h-screen p-6 max-w-5xl mx-auto" style={{ background: '#0a0a0c', color: '#e4e4e7' }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <Link href="/dashboard/produtos/operacao-cadastro" className="p-2 rounded-lg hover:bg-zinc-900 text-zinc-400">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex items-center gap-2 min-w-0">
          <Megaphone size={18} className="text-cyan-400 shrink-0" />
          <h1 className="text-lg font-semibold truncate">Incluir em campanha</h1>
        </div>
      </div>
      {data?.product && (
        <p className="text-xs text-zinc-500 mb-5 ml-12">
          {data.product.name}
          {data.product.sku && <span className="font-mono text-zinc-600"> · {data.product.sku}</span>}
        </p>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200 flex items-start gap-2">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" /> <span>{error}</span>
        </div>
      )}

      {loading && !data && (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-zinc-500">
          <Loader2 size={16} className="animate-spin" /> Carregando campanhas do anúncio…
        </div>
      )}

      {data && data.anuncios.length === 0 && !loading && (
        <div className="rounded-2xl p-8 text-center" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
          <Megaphone size={40} className="mx-auto text-zinc-700 mb-3" />
          <p className="text-zinc-300 font-medium">Nenhum anúncio deste produto no Mercado Livre ainda.</p>
          <p className="text-xs text-zinc-500 mt-2 max-w-md mx-auto">
            Publique o anúncio no ML primeiro. Depois que ele sincronizar, as campanhas
            disponíveis aparecem aqui pra você participar.
          </p>
        </div>
      )}

      {/* Anúncios */}
      <div className="space-y-6">
        {data?.anuncios.map(an => (
          <AnuncioSection key={an.ml_item_id} anuncio={an} onParticipar={(opt) => setJoinOpt({ opt, anuncio: an })} />
        ))}
      </div>

      {/* Modal participar */}
      {joinOpt && (
        <JoinModal
          opt={joinOpt.opt}
          anuncio={joinOpt.anuncio}
          onClose={() => setJoinOpt(null)}
          onJoined={onJoined}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md rounded-xl px-4 py-3 text-sm shadow-2xl flex items-center gap-2"
          style={{ background: '#0d140d', border: '1px solid rgba(52,211,153,0.35)', color: '#34d399' }}>
          <CheckCircle2 size={16} className="shrink-0" /> {toast}
        </div>
      )}
    </div>
  )
}

function AnuncioSection({ anuncio, onParticipar }: { anuncio: Anuncio; onParticipar: (o: PromoOption) => void }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
      {/* Cabeçalho do anúncio */}
      <div className="flex items-center gap-3 p-4 border-b" style={{ borderColor: '#1a1a1f' }}>
        {anuncio.thumbnail_url
          ? <img src={anuncio.thumbnail_url} alt="" className="h-12 w-12 rounded-lg object-cover bg-zinc-900 border border-zinc-800" />
          : <div className="h-12 w-12 rounded-lg bg-zinc-900 border border-zinc-800" />}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{anuncio.title ?? anuncio.ml_item_id}</p>
          <div className="flex items-center gap-2 text-[11px] text-zinc-500">
            <span className="font-mono">{anuncio.ml_item_id}</span>
            {anuncio.permalink && (
              <a href={anuncio.permalink} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-cyan-400 hover:text-cyan-300">
                ver no ML <ExternalLink size={10} />
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Participando */}
        {anuncio.participating.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-2">Já participando</p>
            <div className="flex flex-wrap gap-2">
              {anuncio.participating.map(o => (
                <span key={o.campaign_item_id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px]"
                  style={{ background: 'rgba(52,211,153,0.10)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }}>
                  <CheckCircle2 size={11} /> {o.campaign_name ?? o.ml_campaign_id}
                  {o.current_price != null && <span className="text-emerald-300/70">· {brl(o.current_price)}</span>}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Disponíveis */}
        {anuncio.available.length > 0 ? (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-2">
              Campanhas disponíveis ({anuncio.available.length})
            </p>
            <div className="space-y-2">
              {anuncio.available.map(o => (
                <PromoCard key={o.campaign_item_id} opt={o} onParticipar={() => onParticipar(o)} />
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-lg p-4 text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed #27272a' }}>
            <p className="text-xs text-zinc-400">Nenhuma campanha do ML disponível pra este anúncio agora.</p>
            <a href={anuncio.permalink ?? 'https://www.mercadolivre.com.br/anuncios/promocoes'}
              target="_blank" rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: 'rgba(0,229,255,0.10)', color: '#67e8f9', border: '1px solid rgba(0,229,255,0.3)' }}>
              <Sparkles size={12} /> Criar promoção própria no ML <ExternalLink size={11} />
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

function PromoCard({ opt, onParticipar }: { opt: PromoOption; onParticipar: () => void }) {
  const disc = discountInfo(opt.original_price, opt.suggested_price)
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg p-3"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #1a1a1f' }}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{opt.campaign_name ?? opt.ml_campaign_id}</span>
          <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded text-zinc-400"
            style={{ background: '#18181b', border: '1px solid #27272a' }}>{opt.promotion_type}</span>
          {opt.has_meli_subsidy && (
            <span className="text-[9px] px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(167,139,250,0.12)', color: '#c4b5fd', border: '1px solid rgba(167,139,250,0.3)' }}>
              MELI+ paga parte
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 text-[11px] text-zinc-500 flex-wrap">
          <span className="inline-flex items-center gap-1"><Clock size={11} /> {fmtDate(opt.start_date)} – {fmtDate(opt.finish_date)}</span>
          {disc && (
            <span className="inline-flex items-center gap-1 text-amber-300">
              <Tag size={11} /> -{disc.pct}% ({brl(disc.brl)})
            </span>
          )}
          {opt.suggested_price != null && (
            <span>final <strong className="text-zinc-300">{brl(opt.suggested_price)}</strong></span>
          )}
        </div>
      </div>
      <button onClick={onParticipar}
        className="shrink-0 px-3 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black text-xs font-semibold transition-all">
        Participar
      </button>
    </div>
  )
}

function JoinModal({
  opt, anuncio, onClose, onJoined,
}: {
  opt: PromoOption
  anuncio: Anuncio
  onClose: () => void
  onJoined: (msg: string) => void
}) {
  const original = opt.original_price ?? 0
  const min = opt.min_price ?? 0
  const max = opt.max_price ?? original
  const [price, setPrice]     = useState<number>(opt.suggested_price ?? max)
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr]         = useState<string | null>(null)

  const disc = discountInfo(original, price)
  const outOfRange = price < min || price > max

  async function confirm() {
    setErr(null)
    if (outOfRange) { setErr(`Preço deve ficar entre ${brl(min)} e ${brl(max)}.`); return }
    setSubmitting(true)
    try {
      const tk = await getToken()
      if (!tk) throw new Error('Sessão expirada — recarregue a página.')
      const r = await fetch(`${BACKEND}/ml-campaigns/listing/join`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${tk}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ campaign_item_id: opt.campaign_item_id, offer_price: price }),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(body?.message || `HTTP ${r.status}`)
      onJoined(`Anúncio incluído na campanha "${opt.campaign_name ?? opt.ml_campaign_id}" por ${brl(price)}.`)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl p-5" style={{ background: '#0d0d10', border: '1px solid #27272a' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h2 className="text-base font-bold">Confirmar participação</h2>
            <p className="text-xs text-zinc-500 mt-0.5 truncate">
              {opt.campaign_name ?? opt.ml_campaign_id} · {fmtDate(opt.start_date)}–{fmtDate(opt.finish_date)}
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 shrink-0"><X size={18} /></button>
        </div>

        <div className="rounded-lg p-3 mb-3 flex items-center gap-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #1a1a1f' }}>
          {anuncio.thumbnail_url
            ? <img src={anuncio.thumbnail_url} alt="" className="h-10 w-10 rounded object-cover bg-zinc-900 border border-zinc-800" />
            : <div className="h-10 w-10 rounded bg-zinc-900 border border-zinc-800" />}
          <p className="text-xs text-zinc-300 truncate">{anuncio.title ?? anuncio.ml_item_id}</p>
        </div>

        <div className="space-y-3">
          <Row label="Preço original" value={brl(original)} />

          <div>
            <label className="block text-[11px] text-zinc-400 mb-1">Preço final na promoção</label>
            <div className="flex items-center gap-2">
              <span className="text-zinc-500 text-sm">R$</span>
              <input
                type="number" step="0.01" min={min} max={max}
                value={Number.isFinite(price) ? price : ''}
                onChange={e => setPrice(parseFloat(e.target.value))}
                className="flex-1 bg-zinc-950 border rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-cyan-400"
                style={{ borderColor: outOfRange ? 'rgba(248,113,113,0.5)' : '#27272a' }}
              />
            </div>
            <p className="mt-1 text-[10px] text-zinc-600">
              Faixa permitida pela campanha: {brl(min)} – {brl(max)}
            </p>
          </div>

          <div className="rounded-lg p-3 space-y-1.5" style={{ background: 'rgba(0,229,255,0.04)', border: '1px solid rgba(0,229,255,0.15)' }}>
            <Row label="Desconto" value={disc ? `-${disc.pct}%  (${brl(disc.brl)})` : '—'} accent />
            <Row label="Preço final" value={brl(price)} accent strong />
          </div>

          {opt.has_meli_subsidy && (
            <p className="text-[11px] text-violet-300/90 flex items-center gap-1.5">
              <Sparkles size={12} /> O Mercado Livre subsidia parte do desconto nesta campanha.
            </p>
          )}

          {err && (
            <div className="rounded-lg p-2.5 text-xs" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
              {err}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 mt-5">
          <button onClick={onClose} disabled={submitting}
            className="px-4 py-2 rounded-lg text-sm border" style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
            Cancelar
          </button>
          <button onClick={confirm} disabled={submitting || outOfRange}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 disabled:cursor-not-allowed text-black flex items-center gap-1.5">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Participar
          </button>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, accent, strong }: { label: string; value: string; accent?: boolean; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-zinc-500 text-xs">{label}</span>
      <span className={[
        strong ? 'font-bold text-base' : 'font-medium',
        accent ? 'text-cyan-300' : 'text-zinc-200',
      ].join(' ')}>{value}</span>
    </div>
  )
}
