'use client'

/**
 * Vínculos de Categoria (Cat-5b) — catálogo-produto.
 *
 * Mapeia a categoria do ML (nossa canônica) → categoria do marketplace de
 * destino. Por categoria, herdado pelos produtos. NÃO toca em category_ml_id.
 *
 * Hoje o destino ativo é Meta/Instagram (Google Product Taxonomy). Shopee/
 * TikTok/Amazon aparecem travados até o app conectar.
 */

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { Link2, Loader2, AlertCircle, Sparkles, Search, X, Check, Trash2, Lock } from 'lucide-react'
import { useConfirm } from '@/components/ui/dialog-provider'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

interface SourceCategory {
  id:       string
  name:     string
  path:     string
  products: number
  links:    Record<string, { target_category_id: string; target_path: string | null; status: string }>
}
interface CategoryLink {
  id:                 string
  source_category_id: string
  target_marketplace: string
  target_category_id: string
  target_path:        string | null
}
interface TargetNode { id: string; name: string; full_path: string | null; level: number; is_leaf: boolean }
interface Suggestion { target_category_id: string; target_path: string | null; confidence: number; reason: string }

const TARGETS = [
  { key: 'meta',   label: 'Instagram / Meta', active: true },
  { key: 'shopee', label: 'Shopee',           active: false },
  { key: 'tiktok', label: 'TikTok Shop',      active: false },
  { key: 'amazon', label: 'Amazon',           active: false },
]

export default function CategoryLinksPage() {
  const [sources, setSources] = useState<SourceCategory[] | null>(null)
  const [linkIds, setLinkIds] = useState<Map<string, string>>(new Map()) // sourceCategoryId -> link id (p/ remover)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [target,  setTarget]  = useState('meta')
  const [picker,  setPicker]  = useState<SourceCategory | null>(null)
  const confirm = useConfirm()

  const fetchToken = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token
  }, [])

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const token = await fetchToken()
      const headers = { Authorization: `Bearer ${token}` }
      const [srcRes, linkRes] = await Promise.all([
        fetch(`${BACKEND}/category-links/sources`, { headers }),
        fetch(`${BACKEND}/category-links?target=${target}`, { headers }),
      ])
      if (!srcRes.ok) throw new Error(`HTTP ${srcRes.status}`)
      setSources(await srcRes.json())
      const links = (linkRes.ok ? await linkRes.json() : []) as CategoryLink[]
      setLinkIds(new Map(links.map(l => [l.source_category_id, l.id])))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar categorias.')
    } finally {
      setLoading(false)
    }
  }, [fetchToken, target])

  useEffect(() => { void load() }, [load])

  async function removeLink(src: SourceCategory) {
    const id = linkIds.get(src.id)
    if (!id) return
    const ok = await confirm({
      title: 'Remover vínculo?',
      message: `O produto dessa categoria deixa de ter destino em ${TARGETS.find(t => t.key === target)?.label}.`,
      confirmLabel: 'Remover', variant: 'danger',
    })
    if (!ok) return
    const token = await fetchToken()
    await fetch(`${BACKEND}/category-links/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    void load()
  }

  const activeTarget = TARGETS.find(t => t.key === target)
  const linked   = (sources ?? []).filter(s => s.links[target])
  const unlinked = (sources ?? []).filter(s => !s.links[target])

  return (
    <div className="space-y-5 p-1">
      <header className="flex items-start gap-3">
        <div className="rounded-lg p-2" style={{ background: 'rgba(99,102,241,0.12)', color: '#a5b4fc' }}>
          <Link2 size={20} />
        </div>
        <div>
          <h1 className="text-xl font-semibold" style={{ color: '#fafafa' }}>Vínculos de Categoria</h1>
          <p className="text-sm mt-0.5" style={{ color: '#a1a1aa' }}>
            Mapeie a categoria do Mercado Livre para a categoria equivalente em cada marketplace.
            O produto herda o vínculo — sem mexer na categoria do ML.
          </p>
        </div>
      </header>

      {/* Seletor de marketplace de destino */}
      <div className="flex flex-wrap gap-2">
        {TARGETS.map(t => (
          <button key={t.key} type="button" disabled={!t.active} onClick={() => t.active && setTarget(t.key)}
            className="px-3.5 py-1.5 text-sm font-medium rounded-full inline-flex items-center gap-1.5 transition-colors disabled:cursor-not-allowed"
            style={{
              border: `1px solid ${target === t.key ? '#6366f1' : '#27272a'}`,
              background: target === t.key ? 'rgba(99,102,241,0.15)' : 'transparent',
              color: !t.active ? '#52525b' : target === t.key ? '#c7d2fe' : '#a1a1aa',
            }}>
            {!t.active && <Lock size={11} />}{t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border px-4 py-3 text-sm flex items-center gap-2"
          style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', borderColor: 'rgba(239,68,68,0.3)' }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {!activeTarget?.active ? (
        <div className="rounded-lg p-10 text-center text-sm" style={{ background: '#111114', color: '#a1a1aa' }}>
          <Lock size={20} className="mx-auto mb-2" style={{ opacity: 0.6 }} />
          Conecte o app do {activeTarget?.label} primeiro. Quando a loja estiver autorizada,
          puxamos a árvore de categorias dele e o vínculo libera aqui.
        </div>
      ) : loading ? (
        <div className="flex items-center gap-2 text-sm" style={{ color: '#a1a1aa' }}>
          <Loader2 size={14} className="animate-spin" /> Carregando…
        </div>
      ) : (sources && sources.length === 0) ? (
        <div className="rounded-lg p-10 text-center" style={{ background: '#111114', color: '#a1a1aa' }}>
          Nenhum produto com categoria do ML ainda.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Resumo */}
          <div className="text-xs" style={{ color: '#a1a1aa' }}>
            {linked.length} vinculada{linked.length === 1 ? '' : 's'} · {unlinked.length} pendente{unlinked.length === 1 ? '' : 's'}
          </div>

          <div className="rounded-lg overflow-hidden" style={{ background: '#111114', border: '1px solid #27272a' }}>
            <table className="w-full text-sm" style={{ color: '#fafafa' }}>
              <thead style={{ background: '#0a0a0e', color: '#a1a1aa', fontSize: 12 }}>
                <tr>
                  <th className="text-left p-3">Categoria (Mercado Livre)</th>
                  <th className="text-right p-3 w-20">Produtos</th>
                  <th className="text-left p-3">Vínculo {activeTarget.label}</th>
                  <th className="text-right p-3 w-44"></th>
                </tr>
              </thead>
              <tbody>
                {[...linked, ...unlinked].map(s => {
                  const link = s.links[target]
                  return (
                    <tr key={s.id} style={{ borderTop: '1px solid #27272a' }}>
                      <td className="p-3">
                        <div className="font-medium">{s.name}</div>
                        {s.path && <div className="text-[11px]" style={{ color: '#71717a' }}>{s.path}</div>}
                      </td>
                      <td className="p-3 text-right" style={{ color: '#a1a1aa' }}>{s.products}</td>
                      <td className="p-3">
                        {link ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Check size={13} style={{ color: '#4ade80' }} />
                            <span style={{ color: '#d4d4d8' }}>{link.target_path ?? link.target_category_id}</span>
                          </span>
                        ) : (
                          <span style={{ color: '#71717a' }}>— não vinculada</span>
                        )}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <button onClick={() => setPicker(s)}
                          className="text-xs px-2.5 py-1 rounded inline-flex items-center gap-1 transition-colors"
                          style={{ border: '1px solid #3f3f46', color: '#c7d2fe' }}>
                          {link ? 'Editar' : 'Vincular'}
                        </button>
                        {link && (
                          <button onClick={() => removeLink(s)} aria-label="Remover vínculo"
                            className="ml-1 p-1.5 rounded transition-colors" style={{ color: '#f87171' }}>
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {picker && (
        <LinkPicker
          source={picker}
          target={target}
          targetLabel={activeTarget?.label ?? target}
          fetchToken={fetchToken}
          onClose={() => setPicker(null)}
          onSaved={() => { setPicker(null); void load() }}
        />
      )}
    </div>
  )
}

function LinkPicker({ source, target, targetLabel, fetchToken, onClose, onSaved }: {
  source: SourceCategory
  target: string
  targetLabel: string
  fetchToken: () => Promise<string | undefined>
  onClose: () => void
  onSaved: () => void
}) {
  const [query, setQuery]   = useState('')
  const [results, setResults] = useState<TargetNode[]>([])
  const [searching, setSearching] = useState(false)
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null)
  const [suggesting, setSuggesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function doSearch() {
    const q = query.trim()
    if (q.length < 2) return
    setSearching(true); setErr(null)
    try {
      const token = await fetchToken()
      const res = await fetch(`${BACKEND}/category-links/target/${target}/search?q=${encodeURIComponent(q)}`,
        { headers: { Authorization: `Bearer ${token}` } })
      setResults(res.ok ? await res.json() : [])
    } catch { setErr('Falha na busca.') } finally { setSearching(false) }
  }

  async function doSuggest() {
    setSuggesting(true); setErr(null); setSuggestion(null)
    try {
      const token = await fetchToken()
      const res = await fetch(`${BACKEND}/category-links/suggest`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceCategoryId: source.id, targetMarketplace: target }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as Suggestion | null
      if (!data) setErr('A IA não achou uma categoria correspondente.')
      else setSuggestion(data)
    } catch (e) { setErr(e instanceof Error ? e.message : 'Falha na sugestão.') } finally { setSuggesting(false) }
  }

  async function save(targetCategoryId: string) {
    setSaving(true); setErr(null)
    try {
      const token = await fetchToken()
      const res = await fetch(`${BACKEND}/category-links`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceCategoryId: source.id, targetMarketplace: target, targetCategoryId, status: 'confirmed' }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      onSaved()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Falha ao salvar.'); setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl overflow-hidden" style={{ background: '#161619', border: '1px solid #27272a' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid #27272a' }}>
          <div>
            <div className="text-sm font-semibold" style={{ color: '#fafafa' }}>Vincular categoria</div>
            <div className="text-[11px]" style={{ color: '#a1a1aa' }}>{source.path || source.name} → {targetLabel}</div>
          </div>
          <button onClick={onClose} style={{ color: '#a1a1aa' }}><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Sugestão IA */}
          <div>
            <button onClick={doSuggest} disabled={suggesting}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: 'linear-gradient(90deg,#6366f1,#8b5cf6)', color: '#fff' }}>
              {suggesting ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              Sugerir com IA
            </button>
            {suggestion && (
              <div className="mt-3 rounded-lg p-3" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.3)' }}>
                <div className="text-sm" style={{ color: '#e4e4e7' }}>{suggestion.target_path ?? suggestion.target_category_id}</div>
                {suggestion.reason && <div className="text-[11px] mt-1" style={{ color: '#a1a1aa' }}>{suggestion.reason} · confiança {Math.round(suggestion.confidence * 100)}%</div>}
                <button onClick={() => save(suggestion.target_category_id)} disabled={saving}
                  className="mt-2 text-xs px-3 py-1.5 rounded inline-flex items-center gap-1 font-medium disabled:opacity-50"
                  style={{ background: '#22c55e', color: '#0a0a0e' }}>
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Usar esta
                </button>
              </div>
            )}
          </div>

          {/* Busca manual */}
          <div>
            <div className="text-[11px] uppercase tracking-wider mb-1.5" style={{ color: '#71717a' }}>Ou buscar manualmente</div>
            <div className="flex gap-2">
              <input value={query} onChange={e => setQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void doSearch() } }}
                placeholder="Ex: iluminação, torneira…"
                className="flex-1 px-3 py-2 text-sm rounded-lg outline-none"
                style={{ background: '#0a0a0e', color: '#fafafa', border: '1px solid #27272a' }} />
              <button onClick={() => void doSearch()} disabled={searching || query.trim().length < 2}
                className="px-3 rounded-lg inline-flex items-center disabled:opacity-40"
                style={{ border: '1px solid #27272a', color: '#a1a1aa' }}>
                {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              </button>
            </div>
            {results.length > 0 && (
              <ul className="mt-2 max-h-56 overflow-y-auto rounded-lg" style={{ border: '1px solid #27272a' }}>
                {results.map(r => (
                  <li key={r.id}>
                    <button onClick={() => save(r.id)} disabled={saving}
                      className="w-full text-left px-3 py-2 text-sm transition-colors hover:opacity-80 disabled:opacity-50"
                      style={{ color: '#d4d4d8', borderBottom: '1px solid #1f1f23' }}>
                      {r.full_path ?? r.name} {r.is_leaf && <span className="text-[10px]" style={{ color: '#71717a' }}>· folha</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {err && (
            <p className="text-[11px] flex items-center gap-1" style={{ color: '#f87171' }}>
              <AlertCircle size={12} /> {err}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
