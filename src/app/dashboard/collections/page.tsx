'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import {
  Layers, Sparkles, Loader2, Check, X, AlertCircle, Plus,
  Eye, Archive, Edit3,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface ProductCollection {
  id:                   string
  name:                 string
  slug:                 string
  description:          string | null
  collection_type:      string
  product_ids:          string[]
  sort_order:           string
  status:               'draft' | 'active' | 'scheduled' | 'expired' | 'archived'
  cover_image_url:      string | null
  active_from:          string | null
  active_until:         string | null
  created_at:           string
}

const STATUS_COLOR: Record<string, string> = {
  draft: '#71717a', active: '#22c55e', scheduled: '#00E5FF',
  expired: '#52525b', archived: '#52525b',
}

const TYPE_LABEL: Record<string, string> = {
  manual:       'Manual',
  ai_generated: '🤖 IA',
  rule_based:   'Regras',
  seasonal:     '📅 Sazonal',
}

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
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(`[${res.status}] ${(body as { message?: string }).message ?? 'erro'}`)
  }
  return (await res.json()) as T
}

export default function CollectionsPage() {
  const [items, setItems] = useState<ProductCollection[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const data = await api<ProductCollection[]>('/collections')
      setItems(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  async function generate() {
    setGenerating(true); setError(null)
    try {
      const r = await api<{ collections: ProductCollection[]; cost_usd: number }>('/collections/generate', {
        method: 'POST', body: JSON.stringify({ count: 5 }),
      })
      alert(`${r.collections.length} coleções geradas · custo $${r.cost_usd.toFixed(4)}`)
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  async function toggleActivate(c: ProductCollection) {
    try {
      const next = c.status === 'active' ? 'archived' : 'active'
      await api(`/collections/${c.id}`, { method: 'PATCH', body: JSON.stringify({ status: next }) })
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function remove(id: string) {
    if (!confirm('Remover coleção?')) return
    try {
      await api(`/collections/${id}`, { method: 'DELETE' })
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <Layers size={20} className="text-cyan-400" />
            Coleções
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Agrupamentos temáticos do catálogo. IA sugere coleções por ocasião/categoria/tema.
          </p>
        </div>
        <button
          onClick={generate}
          disabled={generating}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-black text-xs font-medium"
        >
          {generating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          Gerar com IA
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300 flex items-center gap-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-zinc-500 text-sm">
          <Loader2 size={14} className="animate-spin" /> carregando…
        </div>
      )}

      {!loading && items?.length === 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-8 text-center space-y-2">
          <Layers size={28} className="mx-auto text-cyan-400 opacity-60" />
          <p className="text-sm text-zinc-300">Nenhuma coleção ainda</p>
          <p className="text-xs text-zinc-500">Gere com IA ou crie manualmente.</p>
        </div>
      )}

      {!loading && items && items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map(c => (
            <div key={c.id} className="rounded-lg border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase tracking-wider text-cyan-400">{TYPE_LABEL[c.collection_type] ?? c.collection_type}</span>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] border"
                  style={{
                    borderColor: `${STATUS_COLOR[c.status]}40`,
                    background:  `${STATUS_COLOR[c.status]}10`,
                    color:       STATUS_COLOR[c.status],
                  }}
                >{c.status}</span>
              </div>
              <h3 className="text-sm font-semibold text-zinc-100">{c.name}</h3>
              {c.description && (
                <p className="text-[11px] text-zinc-400 line-clamp-2">{c.description}</p>
              )}
              <p className="text-[10px] text-zinc-500 font-mono">/{c.slug}</p>
              <p className="text-[11px] text-cyan-300">{c.product_ids.length} produtos · ordem: {c.sort_order.replace('_', ' ')}</p>
              <div className="flex flex-wrap gap-1 pt-2 border-t border-zinc-800/60">
                <button
                  onClick={() => toggleActivate(c)}
                  className={[
                    'inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium',
                    c.status === 'active'
                      ? 'border border-amber-400/40 text-amber-300 hover:bg-amber-400/10'
                      : 'bg-emerald-400 hover:bg-emerald-300 text-black',
                  ].join(' ')}
                >
                  {c.status === 'active' ? <><Archive size={10} /> Arquivar</> : <><Check size={10} /> Ativar</>}
                </button>
                <button
                  onClick={() => alert('Editor visual em sprint futura. Use PATCH na API por ora.')}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded border border-zinc-700 hover:border-cyan-400/60 text-zinc-400 hover:text-cyan-300 text-[11px]"
                >
                  <Edit3 size={10} />
                </button>
                <button
                  onClick={() => remove(c.id)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded border border-zinc-800 hover:border-red-400/40 text-zinc-500 hover:text-red-300 text-[11px]"
                >
                  <X size={10} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
