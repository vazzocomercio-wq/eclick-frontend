'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import {
  TrendingUp, RefreshCw, Search, ShoppingCart, Eye, X, ExternalLink,
  ArrowUp, ArrowDown, Minus, Sparkles, Flame, ChevronRight, Check, FolderTree, Save, Loader2,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

// ── Types ─────────────────────────────────────────────────────────────────────

type BuyDecision = 'comprar' | 'observar' | 'ignorar'

interface RadarCard {
  product_id:          string
  name:                string
  category_id:         string | null
  category_name:       string | null
  price_ref_cents:     number | null
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
interface TrendsSettings { categories: string[]; target_margin_pct: number; auto_enabled: boolean }

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
          <div className="flex items-center gap-2 shrink-0">
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
                {cards.map(c => <ProductRow key={c.product_id} c={c} onWatch={setWatch} onUnwatch={unwatch} />)}
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

function ProductRow({ c, onWatch, onUnwatch }: {
  c: RadarCard
  onWatch: (id: string, dec: string) => void
  onUnwatch: (id: string) => void
}) {
  const dm = c.buy_decision ? DECISION_META[c.buy_decision] : null

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
            <p className="text-sm font-bold mt-0.5" style={{ color: '#00E5FF' }}>{brl(c.price_ref_cents)}</p>
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
