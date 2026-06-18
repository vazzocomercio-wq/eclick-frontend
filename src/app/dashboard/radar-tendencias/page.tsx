'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import {
  TrendingUp, RefreshCw, Search, ShoppingCart, Eye, X, ExternalLink,
  ArrowUp, ArrowDown, Minus, Sparkles, Flame, ChevronRight, Check, FolderTree, Save, Loader2,
  BarChart3, Activity, DollarSign, Trophy, Info, Copy, AlertTriangle,
} from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

// ── Types ─────────────────────────────────────────────────────────────────────

type BuyDecision = 'comprar' | 'observar' | 'ignorar'

interface RadarCard {
  product_id:          string
  name:                string
  category_id:         string | null
  category_name:       string | null
  price_ref_cents:     number | null
  visits_per_day:      number | null
  status:              string | null
  thumbnail:           string | null
  url:                 string | null
  trend_score:         number | null
  momentum:            number | null
  best_seller_rank:    number | null
  rank_delta:          number | null
  buy_decision:        BuyDecision | null
  confidence:          number | null
  ai_rationale:        string | null
  in_watchlist:        boolean
  watch_decision:      string | null
}

interface RisingSearch {
  term:          string
  position:      number
  category_name: string | null
}

interface MlCat { id: string; name: string }
interface TrendsSettings { categories: string[]; target_margin_pct: number; est_conversion_pct: number; auto_enabled: boolean }

// ── HTTP helpers ────────────────────────────────────────────────────────────

async function token(): Promise<string | null> {
  const sb = createClient()
  const { data } = await sb.auth.getSession()
  return data.session?.access_token ?? null
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const t = await token()
  const res = await fetch(`${BACKEND}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}), ...(init?.headers ?? {}) },
  })
  if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`)
  return res.json() as Promise<T>
}

// ── UI helpers ────────────────────────────────────────────────────────────────

const brl = (cents: number | null) =>
  cents == null || cents === 0 ? '—' : (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const DECISION_META: Record<BuyDecision, { label: string; color: string; bg: string; border: string }> = {
  comprar:  { label: 'Comprar',  color: '#4ade80', bg: 'rgba(74,222,128,0.10)',  border: 'rgba(74,222,128,0.30)' },
  observar: { label: 'Observar', color: '#fcd34d', bg: 'rgba(252,211,77,0.10)',  border: 'rgba(252,211,77,0.30)' },
  ignorar:  { label: 'Ignorar',  color: '#71717a', bg: 'rgba(113,113,122,0.10)', border: 'rgba(113,113,122,0.25)' },
}

function scoreColor(s: number | null): string {
  if (s == null) return '#52525b'
  if (s >= 65) return '#4ade80'
  if (s >= 40) return '#fcd34d'
  return '#71717a'
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function RadarTendenciasPage() {
  const [cards, setCards]       = useState<RadarCard[]>([])
  const [rising, setRising]     = useState<RisingSearch[]>([])
  const [loading, setLoading]   = useState(true)
  const [collecting, setColl]   = useState(false)
  const [decision, setDecision] = useState<BuyDecision | 'all'>('all')
  const [category, setCategory] = useState<string>('all')   // filtro da lista por categoria
  const [settings, setSettings] = useState<TrendsSettings | null>(null)
  const [pickerOpen, setPicker] = useState(false)
  const [keyword, setKeyword]   = useState('')
  const [analyzeId, setAnalyzeId] = useState<string | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const [msg, setMsg]           = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams()
      if (decision !== 'all') params.set('decision', decision)
      if (category !== 'all') params.set('category', category)
      const qs = params.toString() ? `?${params}` : ''
      const [radar, rs] = await Promise.all([
        api<{ items: RadarCard[]; total: number }>(`/trends/radar${qs}`),
        api<RisingSearch[]>(`/trends/rising-searches${category !== 'all' ? `?category=${category}` : ''}`),
      ])
      setCards(radar.items)
      setRising(rs)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar o radar')
    } finally {
      setLoading(false)
    }
  }, [decision, category])

  useEffect(() => { void load() }, [load])
  useEffect(() => { void api<TrendsSettings>('/trends/settings').then(setSettings).catch(() => {}) }, [])

  const saveCategories = async (ids: string[]) => {
    try {
      const s = await api<TrendsSettings>('/trends/settings', { method: 'PATCH', body: JSON.stringify({ categories: ids }) })
      setSettings(s)
      setMsg(`${ids.length} categoria(s) selecionada(s). Clique em "Atualizar agora" pra escanear.`)
    } catch (e) { setError(e instanceof Error ? e.message : 'Falha ao salvar categorias') }
  }

  const collectNow = async () => {
    setColl(true); setError(null); setMsg(null)
    try {
      const r = await api<{ bestSellers: number; resolved: number; scored: number; errors: string[] }>(
        `/trends/collect`, { method: 'POST', body: '{}' },
      )
      setMsg(`Coleta concluída: ${r.resolved} produtos resolvidos, ${r.scored} pontuados.`)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha na coleta')
    } finally {
      setColl(false)
    }
  }

  const searchNow = async () => {
    const kw = keyword.trim()
    if (!kw) return
    setColl(true); setError(null); setMsg(null)
    try {
      const r = await api<{ resolved: number; scored: number }>('/trends/search', { method: 'POST', body: JSON.stringify({ keyword: kw }) })
      setMsg(`Busca "${kw}": ${r.resolved} produtos encontrados.`)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha na busca')
    } finally {
      setColl(false)
    }
  }

  const setWatch = async (productId: string, dec: string) => {
    try {
      await api(`/trends/watchlist`, { method: 'POST', body: JSON.stringify({ product_id: productId, decision: dec }) })
      setCards(cs => cs.map(c => c.product_id === productId ? { ...c, in_watchlist: true, watch_decision: dec } : c))
    } catch (e) { setError(e instanceof Error ? e.message : 'Falha') }
  }
  const unwatch = async (productId: string) => {
    try {
      await api(`/trends/watchlist/${productId}`, { method: 'DELETE' })
      setCards(cs => cs.map(c => c.product_id === productId ? { ...c, in_watchlist: false, watch_decision: null } : c))
    } catch (e) { setError(e instanceof Error ? e.message : 'Falha') }
  }

  const counts = {
    comprar:  cards.filter(c => c.buy_decision === 'comprar').length,
    observar: cards.filter(c => c.buy_decision === 'observar').length,
    ignorar:  cards.filter(c => c.buy_decision === 'ignorar').length,
  }
  // categorias presentes nos cards (pro filtro da lista)
  const catOptions = Array.from(
    new Map(cards.filter(c => c.category_id).map(c => [c.category_id as string, c.category_name ?? c.category_id as string])).entries(),
  )

  return (
    <div className="min-h-screen p-6" style={{ background: '#09090b', color: '#fafafa' }}>
      <div className="max-w-[1400px] mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#00E5FF' }}>
              <Flame size={13} /> Radar de Tendências
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">O que comprar agora</h1>
            <p className="text-sm mt-1" style={{ color: '#a1a1aa' }}>
              Produtos em alta no Mercado Livre, com recomendação de compra. A margem deve ser validada com o custo do fornecedor.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            <div className="flex items-center">
              <input value={keyword} onChange={e => setKeyword(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void searchNow() }}
                placeholder="buscar produto (ex: fone bluetooth)"
                className="px-3 py-2.5 rounded-l-lg text-sm outline-none w-56" style={{ background: '#0a0a0e', color: '#fafafa', border: '1px solid #27272a' }} />
              <button onClick={searchNow} disabled={collecting || !keyword.trim()}
                className="flex items-center gap-1 px-3 py-2.5 rounded-r-lg text-sm font-semibold disabled:opacity-50"
                style={{ background: '#1e1e24', color: '#00E5FF', border: '1px solid #27272a', borderLeft: 'none' }}>
                <Search size={15} /> Buscar
              </button>
            </div>
            <button
              onClick={() => setPicker(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition"
              style={{ background: '#111114', color: '#fafafa', border: '1px solid #27272a' }}
            >
              <FolderTree size={15} style={{ color: '#00E5FF' }} />
              Categorias{settings && settings.categories.length > 0 ? ` (${settings.categories.length})` : ''}
            </button>
            <button
              onClick={collectNow}
              disabled={collecting}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-50"
              style={{ background: '#00E5FF', color: '#09090b' }}
            >
              <RefreshCw size={15} className={collecting ? 'animate-spin' : ''} />
              {collecting ? 'Buscando tendências…' : 'Atualizar agora'}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg p-3 text-sm mb-4" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{error}</div>
        )}
        {msg && (
          <div className="rounded-lg p-3 text-sm mb-4" style={{ background: 'rgba(74,222,128,0.10)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}>{msg}</div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">

          {/* Coluna principal — produtos */}
          <div>
            {/* Filtros */}
            <div className="flex items-center gap-2 mb-4">
              {([
                ['all', `Todos (${cards.length})`],
                ['comprar', `Comprar (${counts.comprar})`],
                ['observar', `Observar (${counts.observar})`],
                ['ignorar', `Ignorar (${counts.ignorar})`],
              ] as const).map(([k, lbl]) => (
                <button
                  key={k}
                  onClick={() => setDecision(k as BuyDecision | 'all')}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                  style={decision === k
                    ? { background: '#27272a', color: '#fafafa', border: '1px solid #3f3f46' }
                    : { background: '#111114', color: '#a1a1aa', border: '1px solid #1e1e24' }}
                >{lbl}</button>
              ))}

              {catOptions.length > 0 && (
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="ml-auto px-3 py-1.5 rounded-lg text-xs font-semibold outline-none"
                  style={{ background: '#111114', color: '#a1a1aa', border: '1px solid #1e1e24' }}
                >
                  <option value="all">Todas as categorias</option>
                  {catOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                </select>
              )}
            </div>

            {loading ? (
              <div className="text-sm py-20 text-center" style={{ color: '#52525b' }}>Carregando radar…</div>
            ) : cards.length === 0 ? (
              <div className="rounded-xl p-10 text-center" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
                <TrendingUp size={32} className="mx-auto mb-3" style={{ color: '#3f3f46' }} />
                <p className="text-sm" style={{ color: '#a1a1aa' }}>Nenhum produto ainda. Clique em <strong style={{ color: '#00E5FF' }}>Atualizar agora</strong> pra buscar as tendências do Mercado Livre.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cards.map(c => <ProductRow key={c.product_id} c={c} conv={settings?.est_conversion_pct ?? 1.5} onWatch={setWatch} onUnwatch={unwatch} onAnalyze={setAnalyzeId} />)}
              </div>
            )}
          </div>

          {/* Coluna lateral — em alta na busca */}
          <aside>
            <div className="rounded-xl p-4 sticky top-6" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
              <div className="flex items-center gap-2 text-sm font-bold mb-3">
                <Search size={15} style={{ color: '#00E5FF' }} /> Em alta na busca
              </div>
              <p className="text-xs mb-3" style={{ color: '#52525b' }}>Termos mais buscados no ML (demanda).</p>
              {rising.length === 0 ? (
                <p className="text-xs" style={{ color: '#52525b' }}>Sem dados ainda.</p>
              ) : (
                <ol className="space-y-1.5">
                  {rising.slice(0, 25).map((r, i) => (
                    <li key={`${r.term}-${i}`} className="flex items-center gap-2 text-xs">
                      <span className="w-5 text-right font-mono" style={{ color: '#3f3f46' }}>{i + 1}</span>
                      <span style={{ color: '#d4d4d8' }} className="truncate">{r.term}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </aside>
        </div>
      </div>

      {pickerOpen && (
        <CategoryPicker
          initial={settings?.categories ?? []}
          onClose={() => setPicker(false)}
          onSave={async (ids) => { await saveCategories(ids); setPicker(false) }}
        />
      )}

      {analyzeId && <AnalyticsModal productId={analyzeId} onClose={() => setAnalyzeId(null)} />}
    </div>
  )
}

// ── Category picker (árvore drill-down ML) ──────────────────────────────────────

function CategoryPicker({ initial, onClose, onSave }: {
  initial: string[]
  onClose: () => void
  onSave: (ids: string[]) => Promise<void>
}) {
  const [path, setPath]       = useState<MlCat[]>([])         // breadcrumb (vazio = raiz)
  const [items, setItems]     = useState<MlCat[]>([])
  const [selected, setSel]    = useState<Set<string>>(new Set(initial))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)

  const fetchLevel = useCallback(async (parent: string | null) => {
    setLoading(true)
    try {
      const data = await api<MlCat[]>(`/trends/ml-categories${parent ? `?parent=${parent}` : ''}`)
      setItems(data)
    } catch { setItems([]) } finally { setLoading(false) }
  }, [])

  useEffect(() => { void fetchLevel(null) }, [fetchLevel])

  const drill = (c: MlCat) => { setPath(p => [...p, c]); void fetchLevel(c.id) }
  const goTo  = (idx: number) => {
    const np = path.slice(0, idx)
    setPath(np)
    void fetchLevel(np.length ? np[np.length - 1].id : null)
  }
  const toggle = (c: MlCat) => setSel(s => {
    const n = new Set(s)
    if (n.has(c.id)) n.delete(c.id); else n.add(c.id)
    return n
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col" style={{ background: '#0d0d10', border: '1px solid #27272a', maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>
        {/* header */}
        <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid #1e1e24' }}>
          <div className="flex items-center gap-2 text-sm font-bold"><FolderTree size={16} style={{ color: '#00E5FF' }} /> Categorias pra escanear</div>
          <button onClick={onClose}><X size={18} style={{ color: '#71717a' }} /></button>
        </div>

        {/* breadcrumb */}
        <div className="flex items-center gap-1 flex-wrap px-4 py-2 text-xs" style={{ borderBottom: '1px solid #1e1e24', color: '#a1a1aa' }}>
          <button onClick={() => goTo(0)} className="hover:underline" style={{ color: path.length ? '#00E5FF' : '#fafafa' }}>Todas</button>
          {path.map((c, i) => (
            <span key={c.id} className="flex items-center gap-1">
              <ChevronRight size={12} style={{ color: '#3f3f46' }} />
              <button onClick={() => goTo(i + 1)} className="hover:underline" style={{ color: i === path.length - 1 ? '#fafafa' : '#00E5FF' }}>{c.name}</button>
            </span>
          ))}
        </div>

        {/* lista */}
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex items-center justify-center py-12" style={{ color: '#52525b' }}><Loader2 size={18} className="animate-spin" /></div>
          ) : items.length === 0 ? (
            <p className="text-xs text-center py-12" style={{ color: '#52525b' }}>Sem subcategorias — selecione no nível acima.</p>
          ) : items.map(c => (
            <div key={c.id} className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white/5">
              <button onClick={() => toggle(c)} className="w-5 h-5 rounded flex items-center justify-center shrink-0"
                style={selected.has(c.id) ? { background: '#00E5FF' } : { border: '1px solid #3f3f46' }}>
                {selected.has(c.id) && <Check size={13} style={{ color: '#09090b' }} />}
              </button>
              <span className="flex-1 text-sm cursor-pointer" style={{ color: '#d4d4d8' }} onClick={() => toggle(c)}>{c.name}</span>
              <button onClick={() => drill(c)} className="flex items-center gap-1 text-xs px-2 py-1 rounded-md" style={{ color: '#71717a', border: '1px solid #1e1e24' }}>
                Abrir <ChevronRight size={12} />
              </button>
            </div>
          ))}
        </div>

        {/* footer */}
        <div className="flex items-center justify-between p-4" style={{ borderTop: '1px solid #1e1e24' }}>
          <span className="text-xs" style={{ color: '#a1a1aa' }}>{selected.size} selecionada(s)</span>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="text-sm px-3 py-2 rounded-lg" style={{ color: '#a1a1aa' }}>Cancelar</button>
            <button
              onClick={async () => { setSaving(true); await onSave([...selected]); setSaving(false) }}
              disabled={saving}
              className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50"
              style={{ background: '#00E5FF', color: '#09090b' }}
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Product row ───────────────────────────────────────────────────────────────

function ProductRow({ c, conv, onWatch, onUnwatch, onAnalyze }: {
  c: RadarCard
  conv: number
  onWatch: (id: string, dec: string) => void
  onUnwatch: (id: string) => void
  onAnalyze: (id: string) => void
}) {
  const dm = c.buy_decision ? DECISION_META[c.buy_decision] : null
  const estSalesDay = c.visits_per_day != null ? Math.round(c.visits_per_day * conv / 100 * 10) / 10 : null

  return (
    <div className="rounded-xl p-4 flex gap-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      {/* thumb */}
      <div className="shrink-0 w-16 h-16 rounded-lg overflow-hidden flex items-center justify-center" style={{ background: '#0a0a0e' }}>
        {c.thumbnail
          ? // eslint-disable-next-line @next/next/no-img-element
            <img src={c.thumbnail} alt="" className="w-full h-full object-cover" />
          : <TrendingUp size={20} style={{ color: '#3f3f46' }} />}
      </div>

      {/* info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              {c.best_seller_rank != null && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#27272a', color: '#a5f3fc' }}>
                  #{c.best_seller_rank} vendas
                </span>
              )}
              <RankDelta delta={c.rank_delta} />
              <span className="text-xs" style={{ color: '#52525b' }}>{c.category_name ?? ''}</span>
            </div>
            <p className="text-sm font-medium leading-snug truncate" style={{ color: '#fafafa' }}>{c.name}</p>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-sm font-bold" style={{ color: '#00E5FF' }}>{brl(c.price_ref_cents)}</span>
              {estSalesDay != null && (
                <span className="text-xs" style={{ color: '#71717a' }} title="Estimativa: visitas/dia × conversão">
                  ~{estSalesDay}/dia vendas <span style={{ color: '#52525b' }}>(est.)</span>
                </span>
              )}
            </div>
          </div>

          {/* score + decisão */}
          <div className="shrink-0 text-right">
            <div className="text-2xl font-extrabold leading-none" style={{ color: scoreColor(c.trend_score) }}>
              {c.trend_score != null ? Math.round(c.trend_score) : '—'}
            </div>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: '#52525b' }}>score</div>
            {dm && (
              <span className="inline-block mt-1.5 text-[11px] font-bold px-2 py-0.5 rounded-md"
                style={{ background: dm.bg, color: dm.color, border: `1px solid ${dm.border}` }}>
                {dm.label}
              </span>
            )}
          </div>
        </div>

        {/* racional IA */}
        {c.ai_rationale && (
          <div className="flex gap-1.5 mt-2 text-xs leading-relaxed" style={{ color: '#a1a1aa' }}>
            <Sparkles size={13} className="shrink-0 mt-0.5" style={{ color: '#00E5FF' }} />
            <span>{c.ai_rationale}</span>
          </div>
        )}

        {/* ações */}
        <div className="flex items-center gap-2 mt-3">
          {c.in_watchlist ? (
            <>
              <span className="text-[11px] px-2 py-1 rounded-md font-semibold" style={{ background: 'rgba(0,229,255,0.10)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.25)' }}>
                Na lista: {c.watch_decision}
              </span>
              <button onClick={() => onUnwatch(c.product_id)} className="text-[11px] flex items-center gap-1 px-2 py-1 rounded-md" style={{ color: '#71717a', border: '1px solid #1e1e24' }}>
                <X size={12} /> Remover
              </button>
            </>
          ) : (
            <>
              <button onClick={() => onWatch(c.product_id, 'comprando')} className="text-[11px] flex items-center gap-1 px-2 py-1 rounded-md font-semibold" style={{ background: 'rgba(74,222,128,0.10)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.25)' }}>
                <ShoppingCart size={12} /> Vou comprar
              </button>
              <button onClick={() => onWatch(c.product_id, 'observando')} className="text-[11px] flex items-center gap-1 px-2 py-1 rounded-md font-semibold" style={{ background: '#1e1e24', color: '#a1a1aa', border: '1px solid #27272a' }}>
                <Eye size={12} /> Observar
              </button>
            </>
          )}
          <button onClick={() => onAnalyze(c.product_id)} className="text-[11px] flex items-center gap-1 px-2 py-1 rounded-md font-semibold" style={{ background: 'rgba(0,229,255,0.10)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.25)' }}>
            <BarChart3 size={12} /> Analisar
          </button>
          {c.url && (
            <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-[11px] flex items-center gap-1 px-2 py-1 rounded-md ml-auto" style={{ color: '#71717a' }}>
              Ver no ML <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

function RankDelta({ delta }: { delta: number | null }) {
  if (delta == null) return null
  if (delta > 0) return <span className="text-[10px] flex items-center gap-0.5 font-bold" style={{ color: '#4ade80' }}><ArrowUp size={11} />{delta}</span>
  if (delta < 0) return <span className="text-[10px] flex items-center gap-0.5 font-bold" style={{ color: '#f87171' }}><ArrowDown size={11} />{Math.abs(delta)}</span>
  return <span className="text-[10px] flex items-center gap-0.5" style={{ color: '#52525b' }}><Minus size={11} /></span>
}

// ── Analytics modal ─────────────────────────────────────────────────────────

interface Series { date: string; value: number }
interface PricePoint { date: string; value: number; orig: number | null; discountPct: number | null }
interface AnalyticsData {
  product: { external_id: string; name: string; category_name: string | null; url: string | null; thumbnail: string | null; current_price_cents: number | null; current_orig_price_cents: number | null; current_discount_pct: number | null }
  score: { trend_score: number; momentum: number; volume_score: number; breadth_score: number; best_seller_rank: number | null; rank_delta: number | null; buy_decision: BuyDecision; ai_rationale: string | null; confidence: number } | null
  visits: { available: boolean; series: { date: string; total: number }[]; total: number; avgPerDay: number; peak: { date: string; total: number } | null }
  salesEstimate: { available: boolean; conversionPct: number; series: Series[]; total: number; perDay: number }
  price: { series: PricePoint[]; min: number | null; max: number | null; avg: number | null; points: number }
  rank: { series: Series[]; best: number | null; points: number }
  scoreHistory: { series: Series[]; points: number }
  salesReal: boolean
  days: number
}

const fmtDay = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`

function AnalyticsModal({ productId, onClose }: { productId: string; onClose: () => void }) {
  const [days, setDays]       = useState(30)
  const [data, setData]       = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr]         = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [cloneOpen, setCloneOpen] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true); setErr(null)
    api<AnalyticsData>(`/trends/product/${productId}/analytics?days=${days}`)
      .then(d => { if (alive) setData(d) })
      .catch(e => { if (alive) setErr(e instanceof Error ? e.message : 'Falha') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [productId, days, reloadKey])

  const saveConv = async (pct: number) => {
    try {
      await api('/trends/settings', { method: 'PATCH', body: JSON.stringify({ est_conversion_pct: pct }) })
      setReloadKey(k => k + 1)
    } catch { /* ignora */ }
  }

  const dm = data?.score?.buy_decision ? DECISION_META[data.score.buy_decision] : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-4xl rounded-2xl overflow-hidden flex flex-col" style={{ background: '#0d0d10', border: '1px solid #27272a', maxHeight: '92vh' }} onClick={e => e.stopPropagation()}>

        {/* header */}
        <div className="flex items-start gap-3 p-4" style={{ borderBottom: '1px solid #1e1e24' }}>
          <div className="shrink-0 w-12 h-12 rounded-lg overflow-hidden flex items-center justify-center" style={{ background: '#0a0a0e' }}>
            {data?.product.thumbnail
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={data.product.thumbnail} alt="" className="w-full h-full object-cover" />
              : <BarChart3 size={18} style={{ color: '#3f3f46' }} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold" style={{ color: '#00E5FF' }}>
              <BarChart3 size={12} /> Análise do produto
            </div>
            <p className="text-sm font-semibold leading-snug truncate" style={{ color: '#fafafa' }}>{data?.product.name ?? 'Carregando…'}</p>
            <p className="text-xs" style={{ color: '#52525b' }}>{data?.product.category_name ?? ''}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {data?.product && (
              <button
                onClick={() => setCloneOpen(true)}
                className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ background: '#00E5FF', color: '#09090b' }}
              >
                <Copy size={13} /> Copiar p/ minha conta
              </button>
            )}
            {data?.product && (
              <a
                href={data.product.url ?? `https://www.mercadolivre.com.br/p/${data.product.external_id}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ background: '#1e1e24', color: '#00E5FF', border: '1px solid #27272a' }}
              >
                Ver anúncio <ExternalLink size={13} />
              </a>
            )}
            <button onClick={onClose}><X size={18} style={{ color: '#71717a' }} /></button>
          </div>
        </div>

        {cloneOpen && data && (
          <CloneModal
            productId={productId}
            productName={data.product.name}
            defaultPriceCents={data.product.current_price_cents}
            onClose={() => setCloneOpen(false)}
          />
        )}

        {/* filtro de período */}
        <div className="flex items-center gap-2 px-4 py-2" style={{ borderBottom: '1px solid #1e1e24' }}>
          <span className="text-xs" style={{ color: '#52525b' }}>Período:</span>
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => setDays(d)} className="px-2.5 py-1 rounded-md text-xs font-semibold transition"
              style={days === d ? { background: '#00E5FF', color: '#09090b' } : { background: '#1e1e24', color: '#a1a1aa' }}>
              {d} dias
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-20" style={{ color: '#52525b' }}><Loader2 size={20} className="animate-spin" /></div>
          ) : err ? (
            <div className="rounded-lg p-3 text-sm" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171' }}>{err}</div>
          ) : data ? (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
                <Kpi icon={<TrendingUp size={13} />} label="Trend Score" value={data.score ? String(Math.round(data.score.trend_score)) : '—'} color={scoreColor(data.score?.trend_score ?? null)} />
                <Kpi icon={<Trophy size={13} />} label="Rank vendas" value={data.score?.best_seller_rank != null ? `#${data.score.best_seller_rank}` : '—'} color="#a5f3fc" />
                <Kpi icon={<Activity size={13} />} label={`Visitas ${days}d`} value={data.visits.available ? data.visits.total.toLocaleString('pt-BR') : '—'} color="#00E5FF" />
                <Kpi icon={<ShoppingCart size={13} />} label="Vendas/dia (est.)" value={data.salesEstimate.available ? `~${data.salesEstimate.perDay}` : '—'} color="#fcd34d" />
                <Kpi icon={<DollarSign size={13} />} label="Preço atual" value={brl(data.product.current_price_cents)} color="#4ade80" />
              </div>

              {/* decisão + IA */}
              {dm && (
                <div className="rounded-lg p-3 mb-4 flex items-start gap-2" style={{ background: dm.bg, border: `1px solid ${dm.border}` }}>
                  <span className="text-xs font-bold px-2 py-0.5 rounded shrink-0" style={{ background: dm.color, color: '#09090b' }}>{dm.label}</span>
                  <span className="text-xs leading-relaxed" style={{ color: '#d4d4d8' }}>{data.score?.ai_rationale ?? ''}</span>
                </div>
              )}

              {/* Visitas — headline */}
              <ChartCard title="Visitas no tempo" subtitle={data.visits.available ? `${data.visits.avgPerDay}/dia · pico ${data.visits.peak?.total ?? 0}` : 'indisponível pra este item'}>
                {data.visits.available && data.visits.series.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={data.visits.series}>
                      <defs><linearGradient id="gv" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#00E5FF" stopOpacity={0.4} /><stop offset="100%" stopColor="#00E5FF" stopOpacity={0} /></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e1e24" vertical={false} />
                      <XAxis dataKey="date" tickFormatter={fmtDay} tick={{ fill: '#52525b', fontSize: 10 }} minTickGap={24} />
                      <YAxis tick={{ fill: '#52525b', fontSize: 10 }} width={36} />
                      <Tooltip content={(p) => <VisitsTooltip p={p as unknown as TipProps} conv={data.salesEstimate.conversionPct} />} />
                      <Area type="monotone" dataKey="total" stroke="#00E5FF" strokeWidth={2} fill="url(#gv)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <Empty text="Sem dados de visitas pra este produto." />}
              </ChartCard>

              {/* Vendas estimadas */}
              <div className="mt-3">
                <ChartCard
                  title="Vendas estimadas / dia"
                  subtitle={data.salesEstimate.available ? `~${data.salesEstimate.total} no período · visitas × conversão` : 'indisponível'}
                >
                  <div className="flex items-center gap-2 mb-2 text-xs" style={{ color: '#a1a1aa' }}>
                    <span>Conversão:</span>
                    {[1, 1.5, 2, 3].map(p => (
                      <button key={p} onClick={() => saveConv(p)} className="px-2 py-0.5 rounded-md font-semibold"
                        style={Math.abs(data.salesEstimate.conversionPct - p) < 0.01
                          ? { background: '#fcd34d', color: '#09090b' }
                          : { background: '#1e1e24', color: '#a1a1aa' }}>
                        {p}%
                      </button>
                    ))}
                    <span style={{ color: '#52525b' }}>(visitas × conversão = estimativa)</span>
                  </div>
                  {data.salesEstimate.available && data.salesEstimate.series.length > 0 ? (
                    <ResponsiveContainer width="100%" height={170}>
                      <AreaChart data={data.salesEstimate.series}>
                        <defs><linearGradient id="gs" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fcd34d" stopOpacity={0.35} /><stop offset="100%" stopColor="#fcd34d" stopOpacity={0} /></linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e1e24" vertical={false} />
                        <XAxis dataKey="date" tickFormatter={fmtDay} tick={{ fill: '#52525b', fontSize: 10 }} minTickGap={24} />
                        <YAxis tick={{ fill: '#52525b', fontSize: 10 }} width={32} />
                        <Tooltip contentStyle={TT} labelFormatter={(d) => fmtDay(String(d))} formatter={(v) => [v, 'vendas est.']} />
                        <Area type="monotone" dataKey="value" stroke="#fcd34d" strokeWidth={2} fill="url(#gs)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : <Empty text="Sem base de visitas pra estimar." />}
                </ChartCard>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                {/* Preço */}
                <ChartCard
                  title="Preço praticado"
                  subtitle={
                    data.product.current_discount_pct != null
                      ? `hoje ${brl(data.product.current_price_cents)} · de ${brl(data.product.current_orig_price_cents)} (-${data.product.current_discount_pct}%)`
                      : data.price.points >= 2 ? `mín ${brl(data.price.min)} · máx ${brl(data.price.max)}` : 'histórico acumula a cada atualização'
                  }
                >
                  {data.price.points >= 2 ? (
                    <ResponsiveContainer width="100%" height={170}>
                      <LineChart data={data.price.series}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e1e24" vertical={false} />
                        <XAxis dataKey="date" tickFormatter={fmtDay} tick={{ fill: '#52525b', fontSize: 10 }} minTickGap={24} />
                        <YAxis tick={{ fill: '#52525b', fontSize: 10 }} width={48} tickFormatter={(v: number) => `R$${Math.round(v / 100)}`} />
                        <Tooltip content={(p) => <PriceTooltip p={p as unknown as TipProps} />} />
                        {data.price.series.some(s => s.orig != null) && (
                          <Line type="monotone" dataKey="orig" stroke="#71717a" strokeWidth={1} strokeDasharray="4 3" dot={false} connectNulls name="cheio" />
                        )}
                        <Line type="monotone" dataKey="value" stroke="#4ade80" strokeWidth={2} dot={false} name="final" />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : <Empty text="Só 1 ponto até agora. A cada 'Atualizar' o histórico cresce." />}
                </ChartCard>

                {/* Ranking */}
                <ChartCard title="Posição no ranking de vendas" subtitle={data.rank.points >= 2 ? `melhor: #${data.rank.best}` : 'histórico acumula a cada atualização'}>
                  {data.rank.points >= 2 ? (
                    <ResponsiveContainer width="100%" height={170}>
                      <LineChart data={data.rank.series}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e1e24" vertical={false} />
                        <XAxis dataKey="date" tickFormatter={fmtDay} tick={{ fill: '#52525b', fontSize: 10 }} minTickGap={24} />
                        <YAxis reversed allowDecimals={false} tick={{ fill: '#52525b', fontSize: 10 }} width={28} />
                        <Tooltip contentStyle={TT} labelFormatter={(d) => fmtDay(String(d))} formatter={(v) => [`#${v}`, 'posição']} />
                        <Line type="monotone" dataKey="value" stroke="#a5f3fc" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : <Empty text="Só 1 ponto até agora. A cada 'Atualizar' o histórico cresce." />}
                </ChartCard>
              </div>

              {/* nota vendas */}
              <div className="flex items-start gap-2 mt-4 text-xs" style={{ color: '#52525b' }}>
                <Info size={13} className="shrink-0 mt-0.5" />
                <span>Vendas e conversão de concorrentes não são divulgadas pelo Mercado Livre (privacidade). As <strong>visitas</strong> são o indicador público de demanda. Preço, ranking e score acumulam histórico a cada atualização do radar.</span>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

// ── Clone modal (copiar p/ contas ML via anúncio de catálogo) ───────────────────

interface MlAccount { seller_id: number; nickname: string | null }
interface CloneResult { seller_id: number; ok: boolean; item_id?: string; permalink?: string; error?: string }

function CloneModal({ productId, productName, defaultPriceCents, onClose }: {
  productId: string
  productName: string
  defaultPriceCents: number | null
  onClose: () => void
}) {
  const [accounts, setAccounts] = useState<MlAccount[]>([])
  const [sel, setSel]           = useState<Set<number>>(new Set())
  const [priceReais, setPrice]  = useState<string>(defaultPriceCents != null ? (defaultPriceCents / 100).toFixed(2) : '')
  const [stock, setStock]       = useState<string>('1')
  const [loading, setLoading]   = useState(true)
  const [publishing, setPub]    = useState(false)
  const [results, setResults]   = useState<CloneResult[] | null>(null)
  const [err, setErr]           = useState<string | null>(null)

  useEffect(() => {
    api<MlAccount[]>('/trends/ml-accounts')
      .then(a => { setAccounts(a); setSel(new Set(a.map(x => x.seller_id))) })  // default: todas
      .catch(e => setErr(e instanceof Error ? e.message : 'Falha ao listar contas'))
      .finally(() => setLoading(false))
  }, [])

  const toggle = (id: number) => setSel(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  const publish = async () => {
    setPub(true); setErr(null)
    try {
      const cents = Math.round(parseFloat(priceReais.replace(',', '.')) * 100)
      if (!Number.isFinite(cents) || cents <= 0) throw new Error('Informe um preço válido.')
      const r = await api<{ results: CloneResult[] }>(`/trends/product/${productId}/clone`, {
        method: 'POST',
        body: JSON.stringify({ seller_ids: [...sel], price_cents: cents, stock: Math.max(1, parseInt(stock) || 1) }),
      })
      setResults(r.results)
    } catch (e) { setErr(e instanceof Error ? e.message : 'Falha ao publicar') }
    finally { setPub(false) }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden flex flex-col" style={{ background: '#0d0d10', border: '1px solid #27272a', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid #1e1e24' }}>
          <div className="flex items-center gap-2 text-sm font-bold"><Copy size={16} style={{ color: '#00E5FF' }} /> Copiar para minha conta</div>
          <button onClick={onClose}><X size={18} style={{ color: '#71717a' }} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {results ? (
            <div className="space-y-2">
              {results.map(r => {
                const acc = accounts.find(a => a.seller_id === r.seller_id)
                return (
                  <div key={r.seller_id} className="rounded-lg p-3 text-xs" style={{ background: '#111114', border: `1px solid ${r.ok ? 'rgba(74,222,128,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
                    <div className="font-semibold" style={{ color: r.ok ? '#4ade80' : '#f87171' }}>
                      {r.ok ? '✓ Publicado' : '✗ Falhou'} — {acc?.nickname ?? r.seller_id}
                    </div>
                    {r.ok && r.permalink && <a href={r.permalink} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: '#00E5FF' }}>Abrir anúncio</a>}
                    {!r.ok && <div style={{ color: '#a1a1aa' }}>{r.error}</div>}
                  </div>
                )
              })}
              <button onClick={onClose} className="w-full mt-2 py-2 rounded-lg text-sm font-semibold" style={{ background: '#1e1e24', color: '#fafafa' }}>Fechar</button>
            </div>
          ) : (
            <>
              <p className="text-xs mb-3 leading-relaxed" style={{ color: '#a1a1aa' }}>
                Cria um <strong>anúncio de catálogo</strong> vinculado a <span style={{ color: '#d4d4d8' }}>{productName.slice(0, 50)}…</span> — título, fotos e ficha vêm do catálogo do ML automaticamente. Você define preço e estoque.
              </p>

              <label className="text-xs font-semibold" style={{ color: '#a1a1aa' }}>Contas</label>
              {loading ? (
                <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin" style={{ color: '#52525b' }} /></div>
              ) : accounts.length === 0 ? (
                <p className="text-xs py-2" style={{ color: '#52525b' }}>Nenhuma conta ML integrada.</p>
              ) : (
                <div className="space-y-1 mt-1 mb-3">
                  {accounts.map(a => (
                    <button key={a.seller_id} onClick={() => toggle(a.seller_id)} className="w-full flex items-center gap-2 px-2 py-2 rounded-lg" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
                      <span className="w-4 h-4 rounded flex items-center justify-center shrink-0" style={sel.has(a.seller_id) ? { background: '#00E5FF' } : { border: '1px solid #3f3f46' }}>
                        {sel.has(a.seller_id) && <Check size={11} style={{ color: '#09090b' }} />}
                      </span>
                      <span className="text-sm" style={{ color: '#d4d4d8' }}>{a.nickname ?? a.seller_id}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <label className="text-xs font-semibold" style={{ color: '#a1a1aa' }}>Preço de venda (R$)</label>
                  <input value={priceReais} onChange={e => setPrice(e.target.value)} inputMode="decimal"
                    className="w-full mt-1 px-2 py-1.5 rounded-lg text-sm outline-none" style={{ background: '#0a0a0e', color: '#fafafa', border: '1px solid #27272a' }} />
                </div>
                <div>
                  <label className="text-xs font-semibold" style={{ color: '#a1a1aa' }}>Estoque</label>
                  <input value={stock} onChange={e => setStock(e.target.value)} inputMode="numeric"
                    className="w-full mt-1 px-2 py-1.5 rounded-lg text-sm outline-none" style={{ background: '#0a0a0e', color: '#fafafa', border: '1px solid #27272a' }} />
                </div>
              </div>

              <div className="flex items-start gap-1.5 text-[11px] mb-3 rounded-lg p-2" style={{ background: 'rgba(252,211,77,0.08)', color: '#fcd34d' }}>
                <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                <span>Isto <strong>publica anúncios reais</strong> à venda nas contas escolhidas. Revise preço e estoque antes de confirmar.</span>
              </div>

              {err && <div className="rounded-lg p-2 text-xs mb-3" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171' }}>{err}</div>}

              <button onClick={publish} disabled={publishing || sel.size === 0}
                className="w-full py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: '#00E5FF', color: '#09090b' }}>
                {publishing ? <Loader2 size={15} className="animate-spin" /> : <Copy size={15} />}
                Publicar em {sel.size} conta(s)
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const TT = { background: '#0a0a0e', border: '1px solid #27272a', borderRadius: 8, fontSize: 12, color: '#fafafa' } as const
const TIP_BOX = 'rounded-lg px-3 py-2 text-xs' as const
const tipStyle = { background: '#0a0a0e', border: '1px solid #27272a' } as const

interface TipProps { active?: boolean; payload?: { value?: number; payload?: Record<string, unknown> }[]; label?: string }

/** Tooltip de visitas: mostra visitas + venda/dia estimada (visitas × conversão). */
function VisitsTooltip({ p, conv }: { p: TipProps; conv: number }) {
  if (!p.active || !p.payload?.length) return null
  const visits = Number(p.payload[0].value) || 0
  const sales = Math.round(visits * conv / 100 * 10) / 10
  return (
    <div className={TIP_BOX} style={tipStyle}>
      <div style={{ color: '#fafafa' }}>{fmtDay(String(p.label ?? ''))}</div>
      <div style={{ color: '#00E5FF' }}>visitas: {visits.toLocaleString('pt-BR')}</div>
      <div style={{ color: '#fcd34d' }}>venda/dia (est): ~{sales}</div>
    </div>
  )
}

/** Tooltip de preço: final + cheio (de) + % desconto do dia. */
function PriceTooltip({ p }: { p: TipProps }) {
  if (!p.active || !p.payload?.length) return null
  const row = p.payload[0].payload as { value?: number; orig?: number | null; discountPct?: number | null }
  const final = row?.value != null ? brl(Math.round(row.value)) : '—'
  return (
    <div className={TIP_BOX} style={tipStyle}>
      <div style={{ color: '#fafafa' }}>{fmtDay(String(p.label ?? ''))}</div>
      <div style={{ color: '#4ade80' }}>preço: {final}</div>
      {row?.orig != null && (
        <>
          <div style={{ color: '#71717a', textDecoration: 'line-through' }}>de: {brl(Math.round(row.orig))}</div>
          {row.discountPct != null && <div style={{ color: '#fcd34d' }}>desconto: {row.discountPct}%</div>}
        </>
      )}
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
      <div className="mb-2">
        <div className="text-sm font-bold" style={{ color: '#fafafa' }}>{title}</div>
        {subtitle && <div className="text-xs" style={{ color: '#52525b' }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="flex items-center justify-center text-center text-xs py-12 px-4" style={{ color: '#52525b' }}>{text}</div>
}
