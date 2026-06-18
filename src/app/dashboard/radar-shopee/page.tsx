'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import {
  Flame, RefreshCw, ShoppingCart, X, ExternalLink, Sparkles,
  Star, Percent, Tag, Link2, Loader2, BarChart3, Activity, Trophy, DollarSign, Info,
  FolderTree, ChevronRight, Check,
} from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'
const SHOPEE = '#EE4D2D'
const NICHES = ['Iluminação', 'Casa e Decoração', 'Cozinha', 'Organização', 'Eletrônicos', 'Beleza', 'Pet', 'Fitness', 'Bebê', 'Ferramentas']

type BuyDecision = 'comprar' | 'observar' | 'ignorar'

interface Offer {
  item_id:         number
  shop_id:         number | null
  name:            string
  price_cents:     number | null
  commission_rate: number | null
  rating:          number | null
  sales_volume:    number | null
  discount_pct:    number | null
  champion_score:  number | null
  opportunity_score: number | null
  buy_decision:    BuyDecision | null
  ai_rationale:    string | null
  product_link:    string | null
  offer_link:      string | null
  image_url:       string | null
  watched:         boolean
}

async function token(): Promise<string | null> {
  const sb = createClient()
  const { data } = await sb.auth.getSession()
  return data.session?.access_token ?? null
}
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const t = await token()
  const res = await fetch(`${BACKEND}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}), ...(init?.headers ?? {}) } })
  if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`)
  return res.json() as Promise<T>
}

const brl = (c: number | null) => c == null || c === 0 ? '—' : (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const DECISION: Record<BuyDecision, { label: string; color: string; bg: string; border: string }> = {
  comprar:  { label: 'Comprar',  color: '#4ade80', bg: 'rgba(74,222,128,0.10)',  border: 'rgba(74,222,128,0.30)' },
  observar: { label: 'Observar', color: '#fcd34d', bg: 'rgba(252,211,77,0.10)',  border: 'rgba(252,211,77,0.30)' },
  ignorar:  { label: 'Ignorar',  color: '#71717a', bg: 'rgba(113,113,122,0.10)', border: 'rgba(113,113,122,0.25)' },
}
const scoreColor = (s: number | null) => s == null ? '#52525b' : s >= 65 ? '#4ade80' : s >= 40 ? '#fcd34d' : '#71717a'

export default function RadarShopeePage() {
  const [items, setItems]       = useState<Offer[]>([])
  const [loading, setLoading]   = useState(true)
  const [ingesting, setIng]     = useState(false)
  const [connected, setConn]    = useState<boolean | null>(null)
  const [tab, setTab]           = useState<BuyDecision | 'all' | 'watched'>('all')
  const [keyword, setKeyword]   = useState('')
  const [analyzeId, setAnalyzeId] = useState<number | null>(null)
  const [auto, setAuto]         = useState(false)
  const [catOpen, setCatOpen]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [msg, setMsg]           = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const q = tab === 'all' ? '' : tab === 'watched' ? '?watched=true' : `?decision=${tab}`
      const r = await api<{ items: Offer[] }>(`/shopee-affiliate/radar${q}`)
      setItems(r.items)
    } catch (e) { setError(e instanceof Error ? e.message : 'Falha ao carregar') }
    finally { setLoading(false) }
  }, [tab])

  useEffect(() => { void load() }, [load])
  useEffect(() => { void api<{ connected: boolean }>('/shopee-affiliate/radar/status').then(s => setConn(s.connected)).catch(() => setConn(false)) }, [])
  useEffect(() => { void api<{ auto: boolean }>('/shopee-affiliate/radar/settings').then(s => setAuto(s.auto)).catch(() => {}) }, [])

  const ingest = async (kw?: string) => {
    const term = (kw ?? keyword).trim()
    setIng(true); setError(null); setMsg(null)
    if (kw != null) setKeyword(kw)
    try {
      const body = term ? { keywords: term.split(',').map(s => s.trim()).filter(Boolean), pages: 2 } : { pages: 2 }
      const r = await api<{ upserted: number; scored: number; errors: string[] }>('/shopee-affiliate/radar/ingest', { method: 'POST', body: JSON.stringify(body) })
      setMsg(`Busca concluída: ${r.upserted} produtos campeões trazidos.`)
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Falha na busca') }
    finally { setIng(false) }
  }

  const ingestCats = async (catIds: number[]) => {
    if (!catIds.length) return
    setIng(true); setError(null); setMsg(null)
    try {
      const r = await api<{ upserted: number }>('/shopee-affiliate/radar/ingest', { method: 'POST', body: JSON.stringify({ cat_ids: catIds, pages: 2 }) })
      setMsg(`Busca por categoria: ${r.upserted} produtos campeões trazidos.`)
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Falha na busca') }
    finally { setIng(false) }
  }

  const toggleAuto = async () => {
    const next = !auto
    setAuto(next)
    try { await api('/shopee-affiliate/radar/settings', { method: 'PATCH', body: JSON.stringify({ auto: next }) }) }
    catch { setAuto(!next) }
  }

  const setWatch = async (itemId: number, watched: boolean) => {
    setItems(its => its.map(i => i.item_id === itemId ? { ...i, watched } : i))
    try { await api(`/shopee-affiliate/radar/product/${itemId}/watch`, { method: 'POST', body: JSON.stringify({ watched }) }) }
    catch (e) { setError(e instanceof Error ? e.message : 'Falha'); setItems(its => its.map(i => i.item_id === itemId ? { ...i, watched: !watched } : i)) }
  }

  const counts = {
    comprar:  items.filter(i => i.buy_decision === 'comprar').length,
    observar: items.filter(i => i.buy_decision === 'observar').length,
    ignorar:  items.filter(i => i.buy_decision === 'ignorar').length,
  }

  return (
    <div className="min-h-screen p-6" style={{ background: '#09090b', color: '#fafafa' }}>
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: SHOPEE }}>
              <Flame size={13} /> Radar Shopee — Produtos Campeões
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">O que vende mais na Shopee</h1>
            <p className="text-sm mt-1" style={{ color: '#a1a1aa' }}>
              Produtos com <strong>vendas reais</strong>, nota e comissão — recomendação de compra. Valide a margem com o custo do fornecedor.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="palavras (ex: luminária, abajur)"
              className="px-3 py-2.5 rounded-lg text-sm outline-none w-56" style={{ background: '#0a0a0e', color: '#fafafa', border: '1px solid #27272a' }} />
            <button onClick={() => setCatOpen(true)} disabled={connected === false}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50" style={{ background: '#111114', color: '#fafafa', border: '1px solid #27272a' }}>
              <FolderTree size={15} style={{ color: SHOPEE }} /> Categorias
            </button>
            <button onClick={() => ingest()} disabled={ingesting || connected === false}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50" style={{ background: SHOPEE, color: '#fff' }}>
              <RefreshCw size={15} className={ingesting ? 'animate-spin' : ''} />
              {ingesting ? 'Buscando…' : 'Buscar campeões'}
            </button>
          </div>
        </div>

        {/* Nichos (atalhos de busca) + auto diário */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-xs" style={{ color: '#52525b' }}>Nichos:</span>
          {NICHES.map(n => (
            <button key={n} onClick={() => ingest(n)} disabled={ingesting || connected === false}
              className="px-2.5 py-1 rounded-full text-xs font-medium disabled:opacity-50"
              style={{ background: '#111114', color: '#d4d4d8', border: '1px solid #27272a' }}>{n}</button>
          ))}
          <button onClick={toggleAuto} className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold"
            style={auto ? { background: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' } : { background: '#111114', color: '#71717a', border: '1px solid #1e1e24' }}>
            <span className="w-2 h-2 rounded-full" style={{ background: auto ? '#4ade80' : '#3f3f46' }} />
            {auto ? 'Atualiza todo dia (5:30)' : 'Atualizar todo dia: off'}
          </button>
        </div>

        {connected === false && (
          <div className="rounded-lg p-3 text-sm mb-4" style={{ background: 'rgba(252,211,77,0.10)', color: '#fcd34d', border: '1px solid rgba(252,211,77,0.3)' }}>
            Shopee Affiliate API não conectada. Configure o App ID/Secret pra ativar o radar.
          </div>
        )}
        {error && <div className="rounded-lg p-3 text-sm mb-4" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{error}</div>}
        {msg && <div className="rounded-lg p-3 text-sm mb-4" style={{ background: 'rgba(74,222,128,0.10)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}>{msg}</div>}

        {/* Filtros */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {([['all', `Todos`], ['comprar', `Comprar (${counts.comprar})`], ['observar', `Observar (${counts.observar})`], ['ignorar', `Ignorar (${counts.ignorar})`], ['watched', '⭐ Observados']] as const).map(([k, lbl]) => (
            <button key={k} onClick={() => setTab(k as BuyDecision | 'all' | 'watched')} className="px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={tab === k ? { background: '#27272a', color: '#fafafa', border: '1px solid #3f3f46' } : { background: '#111114', color: '#a1a1aa', border: '1px solid #1e1e24' }}>{lbl}</button>
          ))}
        </div>

        {loading ? (
          <div className="text-sm py-20 text-center" style={{ color: '#52525b' }}>Carregando…</div>
        ) : items.length === 0 ? (
          <div className="rounded-xl p-10 text-center" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
            <Flame size={32} className="mx-auto mb-3" style={{ color: '#3f3f46' }} />
            {tab === 'watched'
              ? <p className="text-sm" style={{ color: '#a1a1aa' }}>Nenhum produto observado. Clique em <strong style={{ color: '#fcd34d' }}>⭐ Observar</strong> num produto pra monitorá-lo todo dia (o histórico de vendas dele passa a acumular).</p>
              : <p className="text-sm" style={{ color: '#a1a1aa' }}>Nenhum produto ainda. Clique em <strong style={{ color: SHOPEE }}>Buscar campeões</strong> (deixe a busca vazia pra trazer os mais vendidos gerais, ou digite palavras do seu nicho).</p>}
          </div>
        ) : (
          <div className="space-y-3">{items.map(o => <OfferRow key={o.item_id} o={o} onAnalyze={setAnalyzeId} onWatch={setWatch} />)}</div>
        )}
      </div>
      {analyzeId != null && <AnalyticsModal itemId={analyzeId} onClose={() => setAnalyzeId(null)} />}
      {catOpen && <CategoryPicker onClose={() => setCatOpen(false)} onSearch={async (ids) => { setCatOpen(false); await ingestCats(ids) }} />}
    </div>
  )
}

// ── Category picker (árvore Shopee drill-down) ──────────────────────────────────
interface ShopeeCat { id: string; name: string; isLeaf: boolean }
function CategoryPicker({ onClose, onSearch }: { onClose: () => void; onSearch: (catIds: number[]) => Promise<void> }) {
  const [path, setPath]   = useState<ShopeeCat[]>([])
  const [items, setItems] = useState<ShopeeCat[]>([])
  const [sel, setSel]     = useState<Set<string>>(new Set())
  const [loading, setLoad] = useState(true)

  const fetchLevel = useCallback(async (parent: string | null) => {
    setLoad(true)
    try { setItems(await api<ShopeeCat[]>(`/shopee-affiliate/radar/categories${parent ? `?parent=${parent}` : ''}`)) }
    catch { setItems([]) } finally { setLoad(false) }
  }, [])
  useEffect(() => { void fetchLevel(null) }, [fetchLevel])

  const drill = (c: ShopeeCat) => { setPath(p => [...p, c]); void fetchLevel(c.id) }
  const goTo  = (idx: number) => { const np = path.slice(0, idx); setPath(np); void fetchLevel(np.length ? np[np.length - 1].id : null) }
  const toggle = (id: string) => setSel(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col" style={{ background: '#0d0d10', border: '1px solid #27272a', maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid #1e1e24' }}>
          <div className="flex items-center gap-2 text-sm font-bold"><FolderTree size={16} style={{ color: SHOPEE }} /> Categorias da Shopee</div>
          <button onClick={onClose}><X size={18} style={{ color: '#71717a' }} /></button>
        </div>
        <div className="flex items-center gap-1 flex-wrap px-4 py-2 text-xs" style={{ borderBottom: '1px solid #1e1e24', color: '#a1a1aa' }}>
          <button onClick={() => goTo(0)} className="hover:underline" style={{ color: path.length ? SHOPEE : '#fafafa' }}>Todas</button>
          {path.map((c, i) => (
            <span key={c.id} className="flex items-center gap-1">
              <ChevronRight size={12} style={{ color: '#3f3f46' }} />
              <button onClick={() => goTo(i + 1)} className="hover:underline" style={{ color: i === path.length - 1 ? '#fafafa' : SHOPEE }}>{c.name}</button>
            </span>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? <div className="flex justify-center py-12" style={{ color: '#52525b' }}><Loader2 size={18} className="animate-spin" /></div>
          : items.length === 0 ? <p className="text-xs text-center py-12" style={{ color: '#52525b' }}>Sem subcategorias.</p>
          : items.map(c => (
            <div key={c.id} className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white/5">
              <button onClick={() => toggle(c.id)} className="w-5 h-5 rounded flex items-center justify-center shrink-0" style={sel.has(c.id) ? { background: SHOPEE } : { border: '1px solid #3f3f46' }}>
                {sel.has(c.id) && <Check size={13} style={{ color: '#fff' }} />}
              </button>
              <span className="flex-1 text-sm cursor-pointer" style={{ color: '#d4d4d8' }} onClick={() => toggle(c.id)}>{c.name}</span>
              {!c.isLeaf && <button onClick={() => drill(c)} className="flex items-center gap-1 text-xs px-2 py-1 rounded-md" style={{ color: '#71717a', border: '1px solid #1e1e24' }}>Abrir <ChevronRight size={12} /></button>}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between p-4" style={{ borderTop: '1px solid #1e1e24' }}>
          <span className="text-xs" style={{ color: '#a1a1aa' }}>{sel.size} selecionada(s)</span>
          <button onClick={() => onSearch([...sel].map(Number))} disabled={sel.size === 0}
            className="flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-lg disabled:opacity-50" style={{ background: SHOPEE, color: '#fff' }}>
            <RefreshCw size={14} /> Buscar campeões dessas categorias
          </button>
        </div>
      </div>
    </div>
  )
}

function OfferRow({ o, onAnalyze, onWatch }: { o: Offer; onAnalyze: (id: number) => void; onWatch: (id: number, w: boolean) => void }) {
  const dm = o.buy_decision ? DECISION[o.buy_decision] : null
  return (
    <div className="rounded-xl p-4 flex gap-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <div className="shrink-0 w-16 h-16 rounded-lg overflow-hidden flex items-center justify-center" style={{ background: '#0a0a0e' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {o.image_url ? <img src={o.image_url} alt="" className="w-full h-full object-cover" /> : <Flame size={20} style={{ color: '#3f3f46' }} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1" style={{ background: '#27272a', color: '#fda4af' }}><ShoppingCart size={10} />{(o.sales_volume ?? 0).toLocaleString('pt-BR')} vendas</span>
              {o.rating != null && <span className="text-[10px] flex items-center gap-0.5" style={{ color: '#fcd34d' }}><Star size={10} />{o.rating}</span>}
              {o.commission_rate != null && <span className="text-[10px] flex items-center gap-0.5" style={{ color: '#a5f3fc' }}><Percent size={10} />{Math.round(o.commission_rate * 100)}% com.</span>}
            </div>
            <p className="text-sm font-medium leading-snug truncate" style={{ color: '#fafafa' }}>{o.name}</p>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-sm font-bold" style={{ color: SHOPEE }}>{brl(o.price_cents)}</span>
              {o.discount_pct ? <span className="text-xs flex items-center gap-0.5" style={{ color: '#4ade80' }}><Tag size={11} />-{o.discount_pct}%</span> : null}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-2xl font-extrabold leading-none" style={{ color: scoreColor(o.champion_score) }}>{o.champion_score != null ? Math.round(o.champion_score) : '—'}</div>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: '#52525b' }}>champion</div>
            {dm && <span className="inline-block mt-1.5 text-[11px] font-bold px-2 py-0.5 rounded-md" style={{ background: dm.bg, color: dm.color, border: `1px solid ${dm.border}` }}>{dm.label}</span>}
          </div>
        </div>
        {o.ai_rationale && <div className="flex gap-1.5 mt-2 text-xs leading-relaxed" style={{ color: '#a1a1aa' }}><Sparkles size={13} className="shrink-0 mt-0.5" style={{ color: SHOPEE }} /><span>{o.ai_rationale}</span></div>}
        <div className="flex items-center gap-2 mt-3">
          <button onClick={() => onAnalyze(o.item_id)} className="text-[11px] flex items-center gap-1 px-2 py-1 rounded-md font-semibold" style={{ background: 'rgba(238,77,45,0.12)', color: SHOPEE, border: '1px solid rgba(238,77,45,0.3)' }}><BarChart3 size={12} /> Analisar</button>
          <button onClick={() => onWatch(o.item_id, !o.watched)} className="text-[11px] flex items-center gap-1 px-2 py-1 rounded-md font-semibold"
            style={o.watched ? { background: 'rgba(252,211,77,0.12)', color: '#fcd34d', border: '1px solid rgba(252,211,77,0.3)' } : { background: '#1e1e24', color: '#a1a1aa', border: '1px solid #27272a' }}>
            <Star size={12} fill={o.watched ? '#fcd34d' : 'none'} /> {o.watched ? 'Observando' : 'Observar'}
          </button>
          {o.product_link && <a href={o.product_link} target="_blank" rel="noopener noreferrer" className="text-[11px] flex items-center gap-1 px-2 py-1 rounded-md ml-auto" style={{ color: '#71717a' }}>Ver na Shopee <ExternalLink size={12} /></a>}
        </div>
      </div>
    </div>
  )
}

// ── Analytics modal ───────────────────────────────────────────────────────────
interface Series { date: string; value: number }
interface Analytics {
  offer: Offer & { shop_id: number | null }
  points: number
  salesVelocity: number | null
  series: { sales: Series[]; price: Series[]; discount: Series[]; rating: Series[]; score: Series[] }
  days: number
}
const fmtDay = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
const TT = { background: '#0a0a0e', border: '1px solid #27272a', borderRadius: 8, fontSize: 12, color: '#fafafa' } as const

function AnalyticsModal({ itemId, onClose }: { itemId: number; onClose: () => void }) {
  const [days, setDays] = useState(30)
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [affLink, setAffLink] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true; setLoading(true); setErr(null)
    api<Analytics>(`/shopee-affiliate/radar/product/${itemId}/analytics?days=${days}`)
      .then(d => { if (alive) setData(d) }).catch(e => { if (alive) setErr(e instanceof Error ? e.message : 'Falha') }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [itemId, days])

  const getAffLink = async () => {
    try { const r = await api<{ link: string | null }>(`/shopee-affiliate/radar/product/${itemId}/affiliate-link`); setAffLink(r.link) } catch { /* */ }
  }

  const o = data?.offer
  const dm = o?.buy_decision ? DECISION[o.buy_decision] : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-4xl rounded-2xl overflow-hidden flex flex-col" style={{ background: '#0d0d10', border: '1px solid #27272a', maxHeight: '92vh' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-3 p-4" style={{ borderBottom: '1px solid #1e1e24' }}>
          <div className="shrink-0 w-12 h-12 rounded-lg overflow-hidden flex items-center justify-center" style={{ background: '#0a0a0e' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {o?.image_url ? <img src={o.image_url} alt="" className="w-full h-full object-cover" /> : <BarChart3 size={18} style={{ color: '#3f3f46' }} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold" style={{ color: SHOPEE }}><BarChart3 size={12} /> Análise Shopee</div>
            <p className="text-sm font-semibold leading-snug truncate" style={{ color: '#fafafa' }}>{o?.name ?? 'Carregando…'}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {o?.product_link && <a href={o.product_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: '#1e1e24', color: SHOPEE, border: '1px solid #27272a' }}>Ver na Shopee <ExternalLink size={13} /></a>}
            <button onClick={onClose}><X size={18} style={{ color: '#71717a' }} /></button>
          </div>
        </div>

        <div className="flex items-center gap-2 px-4 py-2" style={{ borderBottom: '1px solid #1e1e24' }}>
          <span className="text-xs" style={{ color: '#52525b' }}>Período:</span>
          {[7, 30, 90].map(d => <button key={d} onClick={() => setDays(d)} className="px-2.5 py-1 rounded-md text-xs font-semibold" style={days === d ? { background: SHOPEE, color: '#fff' } : { background: '#1e1e24', color: '#a1a1aa' }}>{d} dias</button>)}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? <div className="flex items-center justify-center py-20" style={{ color: '#52525b' }}><Loader2 size={20} className="animate-spin" /></div>
          : err ? <div className="rounded-lg p-3 text-sm" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171' }}>{err}</div>
          : data && o ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
                <Kpi icon={<Trophy size={13} />} label="Champion" value={o.champion_score != null ? String(Math.round(o.champion_score)) : '—'} color={scoreColor(o.champion_score)} />
                <Kpi icon={<ShoppingCart size={13} />} label="Vendas" value={(o.sales_volume ?? 0).toLocaleString('pt-BR')} color="#fda4af" />
                <Kpi icon={<Activity size={13} />} label="Vendas/dia" value={data.salesVelocity != null ? `~${data.salesVelocity}` : '—'} color={SHOPEE} />
                <Kpi icon={<Star size={13} />} label="Nota" value={o.rating != null ? String(o.rating) : '—'} color="#fcd34d" />
                <Kpi icon={<DollarSign size={13} />} label="Preço" value={brl(o.price_cents)} color="#4ade80" />
              </div>

              {dm && <div className="rounded-lg p-3 mb-4 flex items-start gap-2" style={{ background: dm.bg, border: `1px solid ${dm.border}` }}>
                <span className="text-xs font-bold px-2 py-0.5 rounded shrink-0" style={{ background: dm.color, color: '#09090b' }}>{dm.label}</span>
                <span className="text-xs leading-relaxed" style={{ color: '#d4d4d8' }}>{o.ai_rationale ?? ''}</span>
              </div>}

              <ChartCard title="Vendas no tempo (real)" subtitle={data.points >= 2 ? `velocidade ~${data.salesVelocity}/dia` : 'histórico acumula a cada busca diária'}>
                {data.series.sales.length >= 2 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={data.series.sales}>
                      <defs><linearGradient id="gss" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={SHOPEE} stopOpacity={0.4} /><stop offset="100%" stopColor={SHOPEE} stopOpacity={0} /></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e1e24" vertical={false} />
                      <XAxis dataKey="date" tickFormatter={fmtDay} tick={{ fill: '#52525b', fontSize: 10 }} minTickGap={24} />
                      <YAxis tick={{ fill: '#52525b', fontSize: 10 }} width={44} />
                      <Tooltip contentStyle={TT} labelFormatter={(d) => fmtDay(String(d))} formatter={(v) => [v, 'vendas acum.']} />
                      <Area type="monotone" dataKey="value" stroke={SHOPEE} strokeWidth={2} fill="url(#gss)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <Empty text="Só 1 captura até agora. A busca diária acumula o histórico de vendas real." />}
              </ChartCard>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                <ChartCard title="Preço no tempo" subtitle={o.discount_pct ? `hoje -${o.discount_pct}%` : ''}>
                  {data.series.price.length >= 2 ? (
                    <ResponsiveContainer width="100%" height={160}>
                      <LineChart data={data.series.price}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e1e24" vertical={false} />
                        <XAxis dataKey="date" tickFormatter={fmtDay} tick={{ fill: '#52525b', fontSize: 10 }} minTickGap={24} />
                        <YAxis tick={{ fill: '#52525b', fontSize: 10 }} width={48} tickFormatter={(v: number) => `R$${Math.round(v / 100)}`} />
                        <Tooltip contentStyle={TT} labelFormatter={(d) => fmtDay(String(d))} formatter={(v) => [brl(Number(v)), 'preço']} />
                        <Line type="monotone" dataKey="value" stroke="#4ade80" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : <Empty text="Acumula a cada busca." />}
                </ChartCard>
                <ChartCard title="Champion Score no tempo">
                  {data.series.score.length >= 2 ? (
                    <ResponsiveContainer width="100%" height={160}>
                      <LineChart data={data.series.score}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e1e24" vertical={false} />
                        <XAxis dataKey="date" tickFormatter={fmtDay} tick={{ fill: '#52525b', fontSize: 10 }} minTickGap={24} />
                        <YAxis domain={[0, 100]} tick={{ fill: '#52525b', fontSize: 10 }} width={28} />
                        <Tooltip contentStyle={TT} labelFormatter={(d) => fmtDay(String(d))} formatter={(v) => [v, 'score']} />
                        <Line type="monotone" dataKey="value" stroke="#fcd34d" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : <Empty text="Acumula a cada busca." />}
                </ChartCard>
              </div>

              {/* monetização afiliado */}
              <div className="rounded-xl p-4 mt-4 flex items-center justify-between gap-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
                <div className="flex items-center gap-2 text-sm"><Link2 size={15} style={{ color: SHOPEE }} /><span style={{ color: '#a1a1aa' }}>Você é afiliado: gere um link e ganhe comissão divulgando.</span></div>
                {affLink ? <a href={affLink} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold underline truncate max-w-[40%]" style={{ color: SHOPEE }}>{affLink}</a>
                  : <button onClick={getAffLink} className="text-xs font-semibold px-3 py-1.5 rounded-lg shrink-0" style={{ background: 'rgba(238,77,45,0.12)', color: SHOPEE, border: '1px solid rgba(238,77,45,0.3)' }}>Gerar link de afiliado</button>}
              </div>

              <div className="flex items-start gap-2 mt-4 text-xs" style={{ color: '#52525b' }}>
                <Info size={13} className="shrink-0 mt-0.5" />
                <span>Vendas e nota vêm da Shopee Affiliate API (reais). O histórico de vendas/preço/score acumula a cada busca. Valide o custo do fornecedor antes de comprar pra revender.</span>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function Kpi({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg p-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider mb-1" style={{ color: '#52525b' }}>{icon}{label}</div>
      <div className="text-lg font-extrabold" style={{ color }}>{value}</div>
    </div>
  )
}
function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <div className="mb-2"><div className="text-sm font-bold" style={{ color: '#fafafa' }}>{title}</div>{subtitle && <div className="text-xs" style={{ color: '#52525b' }}>{subtitle}</div>}</div>
      {children}
    </div>
  )
}
function Empty({ text }: { text: string }) {
  return <div className="flex items-center justify-center text-center text-xs py-10 px-4" style={{ color: '#52525b' }}>{text}</div>
}
