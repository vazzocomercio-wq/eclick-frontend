'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import {
  Boxes, Sparkles, Loader2, Check, Pause, Play, Archive,
  AlertCircle, Tag, Plus,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface KitItem {
  product_id: string
  quantity:   number
  role:       string
}

interface ProductKit {
  id:               string
  name:             string
  description:      string | null
  cover_image_url:  string | null
  kit_type:         string
  items:            KitItem[]
  original_total:   number
  kit_price:        number
  discount_pct:     number | null
  savings_amount:   number | null
  margin_pct:       number | null
  ai_generated:     boolean
  ai_reasoning:     string | null
  ai_confidence:    number | null
  status:           'suggested' | 'approved' | 'active' | 'paused' | 'archived'
  views:            number
  sales:            number
  revenue:          number
  created_at:       string
}

const TYPE_LABEL: Record<string, string> = {
  kit: 'Kit', combo: 'Combo', cross_sell: 'Cross-sell', upsell: 'Upsell',
  buy_together: 'Comprado junto', by_room: 'Por ambiente',
  by_occasion: 'Por ocasião', clearance: 'Clearance',
}

const STATUS_COLOR: Record<string, string> = {
  suggested: '#f59e0b', approved: '#22c55e', active: '#22c55e',
  paused: '#71717a', archived: '#52525b',
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

export default function KitsPage() {
  const [kits, setKits] = useState<ProductKit[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [count, setCount] = useState(5)

  const refresh = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const data = await api<ProductKit[]>('/kits?limit=200')
      setKits(data)
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
      const r = await api<{ kits: ProductKit[]; cost_usd: number }>('/kits/generate', {
        method: 'POST', body: JSON.stringify({ count }),
      })
      alert(`${r.kits.length} kits gerados · custo $${r.cost_usd.toFixed(4)}`)
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  async function action(id: string, op: 'approve'|'activate'|'pause'|'archive') {
    try {
      await api(`/kits/${id}/${op}`, { method: 'POST' })
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
            <Boxes size={20} className="text-cyan-400" />
            Kits & Combos
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            A IA cruza catálogo + margem + complementaridade pra sugerir kits comerciais.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number" min={1} max={10}
            value={count}
            onChange={e => setCount(parseInt(e.target.value, 10) || 1)}
            className="w-16 bg-zinc-950 border border-zinc-800 rounded px-2 py-2 text-sm text-zinc-200 outline-none"
            title="Quantos kits gerar"
          />
          <button
            onClick={generate}
            disabled={generating}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-black text-xs font-medium"
          >
            {generating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            Gerar com IA
          </button>
        </div>
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

      {!loading && kits?.length === 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-8 text-center space-y-2">
          <Boxes size={28} className="mx-auto text-cyan-400 opacity-60" />
          <p className="text-sm text-zinc-300">Nenhum kit ainda</p>
          <p className="text-xs text-zinc-500">Clique em "Gerar com IA" e a Sonnet sugere kits comerciais com base nos seus produtos.</p>
        </div>
      )}

      {!loading && kits && kits.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {kits.map(k => (
            <KitCard key={k.id} kit={k} onAction={action} />
          ))}
        </div>
      )}
    </div>
  )
}

function KitCard({ kit, onAction }: { kit: ProductKit; onAction: (id: string, op: 'approve'|'activate'|'pause'|'archive') => Promise<void> }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 transition-colors p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wider text-cyan-400">{TYPE_LABEL[kit.kit_type] ?? kit.kit_type}</span>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] border whitespace-nowrap"
          style={{
            borderColor: `${STATUS_COLOR[kit.status]}40`,
            background:  `${STATUS_COLOR[kit.status]}10`,
            color:       STATUS_COLOR[kit.status],
          }}
        >{kit.status}</span>
      </div>

      <h3 className="text-sm font-semibold text-zinc-100">{kit.name}</h3>

      <div>
        <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">{kit.items.length} produtos</p>
        <div className="space-y-0.5 text-[11px] text-zinc-400">
          {kit.items.slice(0, 4).map((i, idx) => (
            <div key={idx} className="flex justify-between gap-2">
              <span className="font-mono truncate">{i.product_id.slice(0, 8)}…</span>
              <span className="text-zinc-500">{i.quantity}× · {i.role}</span>
            </div>
          ))}
          {kit.items.length > 4 && (
            <p className="text-zinc-600 italic">+ {kit.items.length - 4} produtos</p>
          )}
        </div>
      </div>

      <div className="border-t border-zinc-800/60 pt-2 space-y-1 text-[12px]">
        <div className="flex items-center justify-between text-zinc-400">
          <span>Soma individual</span>
          <span className="line-through">R$ {Number(kit.original_total).toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between text-zinc-200 font-medium">
          <span>Preço do kit</span>
          <span>R$ {Number(kit.kit_price).toFixed(2)}</span>
        </div>
        {kit.savings_amount != null && (
          <div className="flex items-center justify-between text-emerald-300">
            <span>Economiza</span>
            <span>R$ {Number(kit.savings_amount).toFixed(2)}{kit.discount_pct != null && ` (${kit.discount_pct}%)`}</span>
          </div>
        )}
        {kit.margin_pct != null && (
          <div className="flex items-center justify-between text-cyan-300">
            <span>Margem</span>
            <span>{kit.margin_pct.toFixed(1)}%</span>
          </div>
        )}
      </div>

      {kit.ai_reasoning && (
        <div className="rounded bg-zinc-950/60 border border-zinc-800/60 px-2 py-1.5">
          <p className="text-[10px] text-cyan-300/80 leading-relaxed">
            <Tag size={9} className="inline mr-1" />
            {kit.ai_reasoning}
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-1 pt-1">
        {kit.status === 'suggested' && (
          <>
            <button
              onClick={() => onAction(kit.id, 'approve')}
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-400 hover:bg-emerald-300 text-black text-[11px] font-medium"
            >
              <Check size={10} /> Aprovar
            </button>
            <button
              onClick={() => onAction(kit.id, 'archive')}
              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-zinc-700 hover:border-red-400/40 text-zinc-400 hover:text-red-300 text-[11px]"
            >
              <Archive size={10} /> Descartar
            </button>
          </>
        )}
        {(kit.status === 'approved' || kit.status === 'paused') && (
          <button
            onClick={() => onAction(kit.id, 'activate')}
            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-cyan-400 hover:bg-cyan-300 text-black text-[11px] font-medium"
          >
            <Plus size={10} /> Publicar
          </button>
        )}
        {kit.status === 'active' && (
          <button
            onClick={() => onAction(kit.id, 'pause')}
            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-amber-400/40 hover:bg-amber-400/10 text-amber-300 text-[11px]"
          >
            <Pause size={10} /> Pausar
          </button>
        )}
        {kit.status === 'paused' && (
          <button
            onClick={() => onAction(kit.id, 'activate')}
            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-emerald-400/40 hover:bg-emerald-400/10 text-emerald-300 text-[11px]"
          >
            <Play size={10} /> Retomar
          </button>
        )}
      </div>
    </div>
  )
}
