'use client'

/** Composição (Kits) — define que um SKU é composto de N unidades de outros
 *  produtos. Efeitos automáticos no backend:
 *  • venda do kit baixa o estoque dos COMPONENTES (não do kit);
 *  • estoque do kit vira derivado = mín(estoque componente ÷ qtd no kit),
 *    propagado pra todos os canais (ML/Shopee/TikTok/loja);
 *  • NF-e fatura os itens componentes (exploder pronto pro Faturador). */

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import {
  Boxes, Plus, X, Loader2, AlertTriangle, CheckCircle2, RefreshCw, Search, Trash2, Pencil,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

type Component = {
  component_product_id: string
  quantity: number
  name?: string | null
  sku?: string | null
  price?: number | null
  stock?: number | null
  thumbnail?: string | null
}

type Kit = {
  kit_product_id: string
  name: string | null
  sku: string | null
  stock: number | null
  thumbnail: string | null
  components: Component[]
}

type SearchHit = {
  id: string; name: string | null; sku: string | null; price: number | null
  stock: number | null; thumbnail: string | null; is_kit: boolean
}

export default function ComposicaoPage() {
  const [kits, setKits]       = useState<Kit[] | null>(null)
  const [error, setError]     = useState('')
  const [notice, setNotice]   = useState('')
  const [editing, setEditing] = useState<{ kit: SearchHit | null; components: Component[] } | null>(null)

  const load = useCallback(async () => {
    setError('')
    try {
      const h = await authHeaders()
      const res = await fetch(`${BACKEND}/composition`, { headers: h })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setKits(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar.')
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const openEdit = (k: Kit) => {
    setEditing({
      kit: { id: k.kit_product_id, name: k.name, sku: k.sku, price: null, stock: k.stock, thumbnail: k.thumbnail, is_kit: true },
      components: k.components.map(c => ({ ...c })),
    })
  }

  return (
    <div className="space-y-6 p-6">
      {/* header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'rgba(0,229,255,0.10)', border: '1px solid rgba(0,229,255,0.3)' }}>
          <Boxes size={18} className="text-cyan-400" />
        </div>
        <div>
          <h1 className="text-lg font-extrabold tracking-tight text-white">Composição (Kits)</h1>
          <p className="text-xs" style={{ color: '#a1a1aa' }}>
            SKU composto de outros produtos: a venda baixa os componentes e o estoque do kit é calculado automaticamente (mín. componente ÷ qtd).
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => void load()}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold"
            style={{ background: '#111114', border: '1px solid #27272a', color: '#a1a1aa' }}>
            <RefreshCw size={12} /> Atualizar
          </button>
          <button onClick={() => setEditing({ kit: null, components: [] })}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold"
            style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF' }}>
            <Plus size={12} /> Nova composição
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg p-3 text-sm" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
          <AlertTriangle size={14} className="shrink-0" /> <span className="whitespace-pre-line">{error}</span>
        </div>
      )}
      {notice && (
        <div className="flex items-center gap-2 rounded-lg p-3 text-sm" style={{ background: 'rgba(74,222,128,0.10)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}>
          <CheckCircle2 size={14} className="shrink-0" /> {notice}
          <button onClick={() => setNotice('')} className="ml-auto"><X size={13} /></button>
        </div>
      )}

      {/* lista de kits */}
      <section className="rounded-xl" style={{ background: '#111114', border: '1px solid #27272a' }}>
        <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: '#27272a' }}>
          <Boxes size={14} className="text-cyan-400" />
          <h2 className="text-sm font-bold text-white">Kits com composição</h2>
          <span className="text-xs" style={{ color: '#52525b' }}>{kits ? `${kits.length} kit(s)` : ''}</span>
        </div>
        {!kits ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm" style={{ color: '#a1a1aa' }}>
            <Loader2 size={16} className="animate-spin" /> Carregando…
          </div>
        ) : kits.length === 0 ? (
          <div className="p-10 text-center text-sm" style={{ color: '#52525b' }}>
            Nenhuma composição ainda — clique em “Nova composição” pra dizer que um SKU é um kit de outros produtos.
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#27272a' }}>
            {kits.map(k => (
              <div key={k.kit_product_id} className="flex items-start gap-3 px-4 py-3">
                {k.thumbnail
                  ? <img src={k.thumbnail} alt="" className="h-11 w-11 rounded-lg object-cover" style={{ border: '1px solid #27272a' }} />
                  : <div className="flex h-11 w-11 items-center justify-center rounded-lg text-[10px]" style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#52525b' }}>kit</div>}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{k.name ?? '(sem nome)'}</p>
                  <p className="text-[11px]" style={{ color: '#71717a' }}>
                    SKU {k.sku ?? '—'} · estoque do kit (derivado): <span style={{ color: '#a5f3fc' }}>{k.stock ?? 0}</span>
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {k.components.map(c => (
                      <span key={c.component_product_id} className="rounded px-1.5 py-0.5 text-[11px]"
                        style={{ background: 'rgba(0,229,255,0.07)', color: '#a5f3fc' }}>
                        {c.quantity}× {c.name ?? c.sku ?? c.component_product_id.slice(0, 8)}
                        <span style={{ color: '#52525b' }}> (estq {c.stock ?? 0})</span>
                      </span>
                    ))}
                  </div>
                </div>
                <button onClick={() => openEdit(k)}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
                  style={{ background: 'rgba(0,229,255,0.10)', border: '1px solid rgba(0,229,255,0.3)', color: '#00E5FF' }}>
                  <Pencil size={11} /> Editar
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {editing && (
        <EditModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={async (msg) => { setEditing(null); setNotice(msg); await load() }}
        />
      )}
    </div>
  )
}

// ── modal de edição/criação ──────────────────────────────────────────────────

function EditModal({ initial, onClose, onSaved }: {
  initial: { kit: SearchHit | null; components: Component[] }
  onClose: () => void
  onSaved: (msg: string) => Promise<void>
}) {
  const [kit, setKit]               = useState<SearchHit | null>(initial.kit)
  const [components, setComponents] = useState<Component[]>(initial.components)
  const [saving, setSaving]         = useState(false)
  const [removing, setRemoving]     = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [err, setErr]               = useState('')
  const isNew = !initial.kit

  const save = async () => {
    if (!kit) { setErr('Escolha o produto que é o kit.'); return }
    if (components.length === 0) { setErr('Adicione ao menos 1 componente (ou use “Remover composição”).'); return }
    setSaving(true); setErr('')
    try {
      const h = await authHeaders()
      const res = await fetch(`${BACKEND}/composition/${kit.id}`, {
        method: 'PUT', headers: h,
        body: JSON.stringify({
          items: components.map(c => ({ component_product_id: c.component_product_id, quantity: Number(c.quantity) })),
        }),
      })
      const out = await res.json()
      if (!res.ok) throw new Error(out?.message ?? `HTTP ${res.status}`)
      await onSaved(`Composição salva — estoque derivado do kit: ${out.derived_stock ?? 0}.`)
    } catch (e) { setErr(e instanceof Error ? e.message : 'Falha ao salvar.') }
    finally { setSaving(false) }
  }

  const removeAll = async () => {
    if (!kit) return
    if (!confirmRemove) { setConfirmRemove(true); return }
    setRemoving(true); setErr('')
    try {
      const h = await authHeaders()
      const res = await fetch(`${BACKEND}/composition/${kit.id}`, {
        method: 'PUT', headers: h, body: JSON.stringify({ items: [] }),
      })
      const out = await res.json()
      if (!res.ok) throw new Error(out?.message ?? `HTTP ${res.status}`)
      await onSaved('Composição removida — o produto volta a ter estoque próprio.')
    } catch (e) { setErr(e instanceof Error ? e.message : 'Falha ao remover.') }
    finally { setRemoving(false); setConfirmRemove(false) }
  }

  const setQty = (id: string, qty: number) => {
    setComponents(prev => prev.map(c => c.component_product_id === id ? { ...c, quantity: qty } : c))
  }

  const preview = components.length
    ? Math.max(0, Math.min(...components.map(c =>
        c.quantity > 0 ? Math.floor((Number(c.stock) || 0) / Number(c.quantity)) : 0)))
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl p-5" style={{ background: '#111114', border: '1px solid #27272a' }} onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center gap-2">
          <Boxes size={15} className="text-cyan-400" />
          <h3 className="text-sm font-bold text-white">{isNew ? 'Nova composição' : `Composição — ${kit?.name ?? ''}`}</h3>
          <button onClick={onClose} className="ml-auto" style={{ color: '#71717a' }}><X size={16} /></button>
        </div>

        {err && (
          <div className="mb-3 whitespace-pre-line rounded-lg p-3 text-sm" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>
        )}

        {/* escolha do kit (só na criação) */}
        {isNew && (
          <div className="mb-4">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#52525b' }}>1. Qual produto é o kit?</p>
            {kit ? (
              <SelectedProduct hit={kit} onClear={() => setKit(null)} />
            ) : (
              <ProductSearch
                placeholder="Buscar o produto-kit por nome ou SKU…"
                exclude={[]}
                onPick={h => {
                  if (h.is_kit) { setErr('Este produto já tem composição — edite pela lista.'); return }
                  setErr(''); setKit(h)
                }} />
            )}
          </div>
        )}

        {/* componentes */}
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#52525b' }}>
          {isNew ? '2. ' : ''}Componentes (o que sai do estoque a cada venda do kit)
        </p>
        <div className="space-y-2">
          {components.map(c => (
            <div key={c.component_product_id} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-white">{c.name ?? c.component_product_id}</p>
                <p className="text-[11px]" style={{ color: '#71717a' }}>SKU {c.sku ?? '—'} · estoque {c.stock ?? 0}</p>
              </div>
              <label className="flex items-center gap-1 text-[11px]" style={{ color: '#71717a' }}>
                qtd
                <input type="number" min={0.001} step="any" value={c.quantity}
                  onChange={e => setQty(c.component_product_id, Number(e.target.value))}
                  className="w-20 rounded px-2 py-1 text-right text-sm outline-none"
                  style={{ background: '#111114', border: '1px solid #27272a', color: '#fafafa' }} />
              </label>
              <button onClick={() => setComponents(prev => prev.filter(x => x.component_product_id !== c.component_product_id))}
                style={{ color: '#71717a' }}><Trash2 size={14} /></button>
            </div>
          ))}
          <ProductSearch
            placeholder="Adicionar componente (nome ou SKU)…"
            exclude={[...components.map(c => c.component_product_id), ...(kit ? [kit.id] : [])]}
            onPick={h => {
              if (h.is_kit) { setErr('Um kit não pode ser componente de outro kit (1 nível só).'); return }
              setErr('')
              setComponents(prev => [...prev, {
                component_product_id: h.id, quantity: 1,
                name: h.name, sku: h.sku, price: h.price, stock: h.stock, thumbnail: h.thumbnail,
              }])
            }} />
        </div>

        {preview != null && (
          <p className="mt-3 text-xs" style={{ color: '#a5f3fc' }}>
            Estoque do kit ficará: <b>{preview}</b> (menor “estoque componente ÷ qtd”)
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {!isNew && (
            <button onClick={() => void removeAll()} disabled={removing}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50"
              style={confirmRemove
                ? { background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#f87171' }
                : { background: '#0a0a0e', border: '1px solid #27272a', color: '#71717a' }}>
              {removing ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              {confirmRemove ? 'Confirmar remoção?' : 'Remover composição'}
            </button>
          )}
          <button onClick={() => void save()} disabled={saving}
            className="ml-auto flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold disabled:opacity-50"
            style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF' }}>
            {saving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
            Salvar composição
          </button>
        </div>
      </div>
    </div>
  )
}

function SelectedProduct({ hit, onClear }: { hit: SearchHit; onClear: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: '#0a0a0e', border: '1px solid rgba(0,229,255,0.3)' }}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-white">{hit.name}</p>
        <p className="text-[11px]" style={{ color: '#71717a' }}>SKU {hit.sku ?? '—'}</p>
      </div>
      <button onClick={onClear} style={{ color: '#71717a' }}><X size={14} /></button>
    </div>
  )
}

function ProductSearch({ placeholder, exclude, onPick }: {
  placeholder: string
  exclude: string[]
  onPick: (h: SearchHit) => void
}) {
  const [q, setQ]           = useState('')
  const [hits, setHits]     = useState<SearchHit[]>([])
  const [busy, setBusy]     = useState(false)
  const [open, setOpen]     = useState(false)

  const search = async () => {
    if (!q.trim()) { setHits([]); setOpen(false); return }
    setBusy(true)
    try {
      const h = await authHeaders()
      const res = await fetch(`${BACKEND}/composition/search-products?q=${encodeURIComponent(q.trim())}`, { headers: h })
      if (res.ok) { setHits(((await res.json()) as SearchHit[]).filter(x => !exclude.includes(x.id))); setOpen(true) }
    } finally { setBusy(false) }
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: '#0a0a0e', border: '1px dashed #27272a' }}>
        <Search size={13} style={{ color: '#52525b' }} />
        <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && void search()}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm outline-none" style={{ color: '#fafafa' }} />
        <button onClick={() => void search()} className="text-xs font-semibold" style={{ color: '#00E5FF' }}>
          {busy ? <Loader2 size={12} className="animate-spin" /> : 'Buscar'}
        </button>
      </div>
      {open && hits.length > 0 && (
        <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg" style={{ background: '#111114', border: '1px solid #27272a' }}>
          {hits.map(h => (
            <button key={h.id} onClick={() => { onPick(h); setOpen(false); setQ(''); setHits([]) }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-white">{h.name}</p>
                <p className="text-[11px]" style={{ color: '#71717a' }}>
                  SKU {h.sku ?? '—'} · estoque {h.stock ?? 0}{h.is_kit ? ' · já é kit' : ''}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

async function authHeaders(): Promise<Record<string, string>> {
  const sb = createClient()
  const { data: { session } } = await sb.auth.getSession()
  return {
    'Content-Type': 'application/json',
    Authorization:  `Bearer ${session?.access_token ?? ''}`,
  }
}
