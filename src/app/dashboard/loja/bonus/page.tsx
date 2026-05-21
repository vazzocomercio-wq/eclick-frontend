'use client'

/**
 * Bônus & Brindes — admin UI.
 *
 * 3 tipos de regra:
 *  - bogo               "Leve X pague Y" no mesmo produto
 *  - free_above_value   Brinde quando pedido >= valor mínimo
 *  - gift_with_product  Brinde quando comprou X de produto Y
 *
 * Endpoints:
 *   GET    /bonus-rules
 *   POST   /bonus-rules
 *   PATCH  /bonus-rules/:id
 *   DELETE /bonus-rules/:id
 */

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import {
  Gift, Loader2, ChevronLeft, Plus, X, Trash2, Power, PowerOff, Search,
  Tag, Package, DollarSign,
} from 'lucide-react'
import Link from 'next/link'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

type BonusType = 'bogo' | 'free_above_value' | 'gift_with_product'

interface BonusRule {
  id:                  string
  name:                string
  description:         string | null
  type:                BonusType
  trigger_product_id:  string | null
  trigger_qty:         number
  min_subtotal_cents:  number
  gift_product_id:     string | null
  gift_qty:            number
  active:              boolean
  starts_at:           string | null
  ends_at:             string | null
  applied_count:       number
}

interface ProductLite {
  id:    string
  name:  string
  sku:   string | null
  price: number
  photo_urls: string[] | null
}

const TYPE_LABELS: Record<BonusType, string> = {
  bogo:               'Leve X pague Y',
  free_above_value:   'Brinde acima de R$ X',
  gift_with_product:  'Brinde por produto',
}

const TYPE_DESCRIPTIONS: Record<BonusType, string> = {
  bogo:               'Cliente compra X qty do produto → ganha Y do mesmo de graça',
  free_above_value:   'Pedido com valor mínimo recebe produto de presente',
  gift_with_product:  'Comprou produto A → ganha produto B de graça',
}

const TYPE_ICONS: Record<BonusType, React.ReactNode> = {
  bogo:               <Package size={14} />,
  free_above_value:   <DollarSign size={14} />,
  gift_with_product:  <Gift size={14} />,
}

const brl = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function BonusPage() {
  const [rules, setRules] = useState<BonusRule[]>([])
  const [products, setProducts] = useState<ProductLite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [editing,  setEditing]  = useState<BonusRule | null>(null)

  const fetchToken = useCallback(async () => {
    const supabase = createClient()
    const { data: session } = await supabase.auth.getSession()
    return session.session?.access_token
  }, [])

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const supabase = createClient()
      const token = await fetchToken()
      const [{ data: prodData, error: prodErr }, rulesRes] = await Promise.all([
        supabase.from('products')
          .select('id, name, sku, price, photo_urls')
          .eq('storefront_visible', true)
          .order('name')
          .limit(500),
        fetch(`${BACKEND}/bonus-rules`, { headers: { Authorization: `Bearer ${token}` } }),
      ])
      if (prodErr) throw new Error(prodErr.message)
      if (!rulesRes.ok) throw new Error(`HTTP ${rulesRes.status}`)
      setProducts((prodData ?? []) as unknown as ProductLite[])
      setRules(await rulesRes.json())
    } catch (e) {
      setError((e as Error).message)
    } finally { setLoading(false) }
  }, [fetchToken])

  useEffect(() => { void load() }, [load])

  const toggleActive = async (rule: BonusRule) => {
    try {
      const token = await fetchToken()
      const res = await fetch(`${BACKEND}/bonus-rules/${rule.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !rule.active }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await load()
    } catch (e) { setError((e as Error).message) }
  }

  const removeRule = async (rule: BonusRule) => {
    if (!confirm(`Remover regra "${rule.name}"?`)) return
    try {
      const token = await fetchToken()
      const res = await fetch(`${BACKEND}/bonus-rules/${rule.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await load()
    } catch (e) { setError((e as Error).message) }
  }

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-5">
      <div>
        <Link href="/dashboard/loja" className="text-xs text-zinc-500 hover:text-cyan-400 inline-flex items-center gap-1 mb-2">
          <ChevronLeft size={12} /> Voltar pro hub
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-white text-3xl font-semibold flex items-center gap-2">
              <Gift size={24} /> Bônus & Brindes
            </h1>
            <p className="text-xs text-zinc-500 mt-1">
              Leve 2 pague 1 · brinde acima de R$ X · presente surpresa
            </p>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: '#00E5FF', color: '#0a0a0e', minHeight: 44 }}>
            <Plus size={14} /> Nova regra
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-zinc-500">
          <Loader2 className="animate-spin inline-block" size={20} />
        </div>
      ) : rules.length === 0 ? (
        <div className="text-center py-12 rounded-lg" style={{ background: '#0a0a0e', border: '1px dashed #27272a' }}>
          <Gift size={32} className="mx-auto text-zinc-700 mb-2" />
          <p className="text-sm text-zinc-500 mb-3">Nenhuma regra de bônus criada ainda</p>
          <button
            onClick={() => setCreating(true)}
            className="text-xs px-3 py-1.5 rounded font-medium inline-flex items-center gap-1"
            style={{ background: '#00E5FF', color: '#0a0a0e', minHeight: 36 }}>
            <Plus size={12} /> Criar primeira regra
          </button>
        </div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
          {rules.map(r => (
            <RuleCard
              key={r.id}
              rule={r}
              products={products}
              onEdit={() => setEditing(r)}
              onToggle={() => toggleActive(r)}
              onDelete={() => removeRule(r)}
            />
          ))}
        </div>
      )}

      {(creating || editing) && (
        <RuleModal
          rule={editing}
          products={products}
          onClose={() => { setCreating(false); setEditing(null) }}
          onSaved={() => { setCreating(false); setEditing(null); void load() }}
          fetchToken={fetchToken}
        />
      )}
    </div>
  )
}

function RuleCard({ rule, products, onEdit, onToggle, onDelete }: {
  rule: BonusRule
  products: ProductLite[]
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
}) {
  const trigger = rule.trigger_product_id ? products.find(p => p.id === rule.trigger_product_id) : null
  const gift    = rule.gift_product_id    ? products.find(p => p.id === rule.gift_product_id)    : null

  const summary = (() => {
    if (rule.type === 'bogo' && trigger) {
      return `Leve ${rule.trigger_qty + rule.gift_qty}, pague ${rule.trigger_qty} · ${trigger.name}`
    }
    if (rule.type === 'free_above_value' && gift) {
      return `Acima de ${brl(rule.min_subtotal_cents)}: ganha ${rule.gift_qty}× ${gift.name}`
    }
    if (rule.type === 'gift_with_product' && trigger && gift) {
      return `Compre ${rule.trigger_qty}× ${trigger.name} → ganha ${rule.gift_qty}× ${gift.name}`
    }
    return rule.name
  })()

  return (
    <div className="rounded-lg p-4 transition-all"
      style={{
        background: '#0a0a0e',
        border: `1px solid ${rule.active ? '#27272a' : '#1a1a1a'}`,
        opacity: rule.active ? 1 : 0.55,
      }}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#a78bfa' }}>
          {TYPE_ICONS[rule.type]} {TYPE_LABELS[rule.type]}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggle}
            title={rule.active ? 'Desativar' : 'Ativar'}
            className="p-1.5 rounded hover:bg-zinc-800"
            style={{ minHeight: 32, minWidth: 32 }}>
            {rule.active ? <Power size={14} style={{ color: '#22c55e' }} /> : <PowerOff size={14} style={{ color: '#71717a' }} />}
          </button>
          <button onClick={onDelete} title="Remover" className="p-1.5 rounded hover:bg-zinc-800"
            style={{ minHeight: 32, minWidth: 32 }}>
            <Trash2 size={14} style={{ color: '#ef4444' }} />
          </button>
        </div>
      </div>

      <h3 className="text-sm font-semibold text-zinc-100 mb-1">{rule.name}</h3>
      <p className="text-xs text-zinc-400 mb-3 line-clamp-2">{summary}</p>

      {rule.description && (
        <p className="text-[11px] text-zinc-500 mb-3 italic">"{rule.description}"</p>
      )}

      <div className="flex items-center gap-3 text-[11px] text-zinc-500 pt-3 border-t" style={{ borderColor: '#27272a' }}>
        <span>Aplicada {rule.applied_count}×</span>
        {rule.ends_at && (
          <span>· até {new Date(rule.ends_at).toLocaleDateString('pt-BR')}</span>
        )}
        <button onClick={onEdit} className="ml-auto text-cyan-400 hover:underline">
          Editar
        </button>
      </div>
    </div>
  )
}

function RuleModal({ rule, products, onClose, onSaved, fetchToken }: {
  rule: BonusRule | null
  products: ProductLite[]
  onClose: () => void
  onSaved: () => void
  fetchToken: () => Promise<string | undefined>
}) {
  const [type, setType] = useState<BonusType>(rule?.type ?? 'bogo')
  const [name, setName] = useState(rule?.name ?? '')
  const [description, setDescription] = useState(rule?.description ?? '')
  const [triggerProductId, setTriggerProductId] = useState<string | null>(rule?.trigger_product_id ?? null)
  const [triggerQty, setTriggerQty] = useState(rule?.trigger_qty ?? 2)
  const [minSubtotalCents, setMinSubtotalCents] = useState(rule?.min_subtotal_cents ?? 0)
  const [giftProductId, setGiftProductId] = useState<string | null>(rule?.gift_product_id ?? null)
  const [giftQty, setGiftQty] = useState(rule?.gift_qty ?? 1)
  const [endsAt, setEndsAt] = useState(rule?.ends_at ? rule.ends_at.slice(0, 16) : '')

  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const save = async () => {
    if (!name.trim()) { setErr('Nome obrigatório'); return }
    if (type === 'bogo' && !triggerProductId) { setErr('Selecione o produto'); return }
    if (type === 'free_above_value' && !giftProductId) { setErr('Selecione o brinde'); return }
    if (type === 'free_above_value' && minSubtotalCents <= 0) { setErr('Valor mínimo > 0'); return }
    if (type === 'gift_with_product' && (!triggerProductId || !giftProductId)) {
      setErr('Selecione produto e brinde'); return
    }

    setSaving(true); setErr(null)
    try {
      const token = await fetchToken()
      const body = {
        name:                name.trim(),
        description:         description.trim() || null,
        type,
        trigger_product_id:  type === 'free_above_value' ? null : triggerProductId,
        trigger_qty:         triggerQty,
        min_subtotal_cents:  type === 'free_above_value' ? minSubtotalCents : 0,
        gift_product_id:     type === 'bogo' ? null : giftProductId,
        gift_qty:            giftQty,
        ends_at:             endsAt ? new Date(endsAt).toISOString() : null,
      }
      const url    = rule ? `${BACKEND}/bonus-rules/${rule.id}` : `${BACKEND}/bonus-rules`
      const method = rule ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(await res.text())
      onSaved()
    } catch (e) {
      setErr((e as Error).message)
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-2xl rounded-lg p-5 max-h-[90vh] overflow-y-auto" style={{ background: '#09090b', border: '1px solid #27272a' }}>
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-semibold text-zinc-100">
            {rule ? 'Editar regra' : 'Nova regra de bônus'}
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-100"
            style={{ minHeight: 44, minWidth: 44 }}>
            <X size={20} />
          </button>
        </div>

        {err && (
          <div className="mb-4 p-2.5 rounded text-xs" style={{ background: 'rgba(239,68,68,0.1)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)' }}>
            {err}
          </div>
        )}

        {/* Tipo */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-zinc-400 mb-2">Tipo de regra</label>
          <div className="grid gap-2 md:grid-cols-3">
            {(Object.keys(TYPE_LABELS) as BonusType[]).map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                className="text-left p-3 rounded-lg transition-all"
                style={{
                  background: type === t ? 'rgba(0,229,255,0.08)' : '#0a0a0e',
                  border: `1px solid ${type === t ? '#00E5FF' : '#27272a'}`,
                  minHeight: 80,
                }}>
                <div className="flex items-center gap-1.5 text-xs font-semibold mb-1" style={{ color: type === t ? '#00E5FF' : '#a1a1aa' }}>
                  {TYPE_ICONS[t]} {TYPE_LABELS[t]}
                </div>
                <p className="text-[10px] text-zinc-500 leading-snug">{TYPE_DESCRIPTIONS[t]}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Nome + descrição */}
        <div className="mb-4 space-y-3">
          <Field label="Nome interno da regra">
            <input
              value={name} onChange={e => setName(e.target.value)}
              placeholder='Ex: "BLACK FRIDAY - lustres 2x1"'
              className="w-full text-sm px-3 py-2 rounded outline-none"
              style={{ background: '#0a0a0e', color: '#fafafa', border: '1px solid #27272a', minHeight: 44 }}
            />
          </Field>
          <Field label="Descrição (mostrada pro cliente — opcional)">
            <input
              value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Ex: Aproveite até domingo!"
              className="w-full text-sm px-3 py-2 rounded outline-none"
              style={{ background: '#0a0a0e', color: '#fafafa', border: '1px solid #27272a', minHeight: 44 }}
            />
          </Field>
        </div>

        {/* Campos condicionais */}
        {type === 'bogo' && (
          <div className="space-y-3 p-3 rounded-lg mb-4" style={{ background: 'rgba(167,139,250,0.05)', border: '1px solid rgba(167,139,250,0.2)' }}>
            <p className="text-[11px] text-purple-300 font-medium">Configuração — Leve X pague Y</p>
            <Field label="Produto da promoção">
              <ProductPicker value={triggerProductId} onChange={setTriggerProductId} products={products} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cliente paga">
                <input type="number" min="1" value={triggerQty}
                  onChange={e => setTriggerQty(Math.max(1, parseInt(e.target.value || '1', 10)))}
                  className="w-full text-sm px-3 py-2 rounded outline-none"
                  style={{ background: '#0a0a0e', color: '#fafafa', border: '1px solid #27272a', minHeight: 44 }} />
              </Field>
              <Field label="Ganha grátis">
                <input type="number" min="1" value={giftQty}
                  onChange={e => setGiftQty(Math.max(1, parseInt(e.target.value || '1', 10)))}
                  className="w-full text-sm px-3 py-2 rounded outline-none"
                  style={{ background: '#0a0a0e', color: '#fafafa', border: '1px solid #27272a', minHeight: 44 }} />
              </Field>
            </div>
            <p className="text-[11px] text-zinc-500">
              💡 Cliente leva <strong className="text-zinc-300">{triggerQty + giftQty}</strong> e paga só <strong className="text-zinc-300">{triggerQty}</strong>.
            </p>
          </div>
        )}

        {type === 'free_above_value' && (
          <div className="space-y-3 p-3 rounded-lg mb-4" style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)' }}>
            <p className="text-[11px] text-green-300 font-medium">Configuração — Brinde acima de valor</p>
            <Field label="Valor mínimo do pedido">
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">R$</span>
                <input
                  type="number" min="0" step="0.01"
                  value={(minSubtotalCents / 100).toFixed(2)}
                  onChange={e => setMinSubtotalCents(Math.round(parseFloat(e.target.value || '0') * 100))}
                  placeholder="500.00"
                  className="flex-1 text-sm px-3 py-2 rounded outline-none"
                  style={{ background: '#0a0a0e', color: '#fafafa', border: '1px solid #27272a', minHeight: 44 }} />
              </div>
            </Field>
            <Field label="Brinde">
              <ProductPicker value={giftProductId} onChange={setGiftProductId} products={products} />
            </Field>
            <Field label="Qty de brindes">
              <input type="number" min="1" value={giftQty}
                onChange={e => setGiftQty(Math.max(1, parseInt(e.target.value || '1', 10)))}
                className="w-full text-sm px-3 py-2 rounded outline-none"
                style={{ background: '#0a0a0e', color: '#fafafa', border: '1px solid #27272a', minHeight: 44 }} />
            </Field>
          </div>
        )}

        {type === 'gift_with_product' && (
          <div className="space-y-3 p-3 rounded-lg mb-4" style={{ background: 'rgba(251,146,60,0.05)', border: '1px solid rgba(251,146,60,0.2)' }}>
            <p className="text-[11px] text-orange-300 font-medium">Configuração — Brinde por produto</p>
            <Field label="Cliente compra">
              <ProductPicker value={triggerProductId} onChange={setTriggerProductId} products={products} />
            </Field>
            <Field label="Qty mínima de compra">
              <input type="number" min="1" value={triggerQty}
                onChange={e => setTriggerQty(Math.max(1, parseInt(e.target.value || '1', 10)))}
                className="w-full text-sm px-3 py-2 rounded outline-none"
                style={{ background: '#0a0a0e', color: '#fafafa', border: '1px solid #27272a', minHeight: 44 }} />
            </Field>
            <Field label="Brinde">
              <ProductPicker value={giftProductId} onChange={setGiftProductId} products={products} />
            </Field>
            <Field label="Qty de brindes">
              <input type="number" min="1" value={giftQty}
                onChange={e => setGiftQty(Math.max(1, parseInt(e.target.value || '1', 10)))}
                className="w-full text-sm px-3 py-2 rounded outline-none"
                style={{ background: '#0a0a0e', color: '#fafafa', border: '1px solid #27272a', minHeight: 44 }} />
            </Field>
          </div>
        )}

        {/* Validade */}
        <Field label="Termina em (opcional — sem prazo se vazio)">
          <input
            type="datetime-local"
            value={endsAt}
            onChange={e => setEndsAt(e.target.value)}
            className="w-full text-sm px-3 py-2 rounded outline-none"
            style={{ background: '#0a0a0e', color: '#fafafa', border: '1px solid #27272a', minHeight: 44 }}
          />
        </Field>

        <div className="flex gap-2 mt-5">
          <div className="flex-1" />
          <button
            onClick={onClose}
            disabled={saving}
            className="text-sm px-4 py-2 rounded font-medium disabled:opacity-50"
            style={{ background: '#18181b', color: '#a1a1aa', border: '1px solid #27272a', minHeight: 44 }}>
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="text-sm px-4 py-2 rounded font-semibold disabled:opacity-50 inline-flex items-center gap-2"
            style={{ background: '#00E5FF', color: '#0a0a0e', minHeight: 44 }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Tag size={14} />}
            {rule ? 'Salvar' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-400 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

/** Combobox simples — input com filtro + dropdown. */
function ProductPicker({ value, onChange, products }: {
  value: string | null
  onChange: (id: string | null) => void
  products: ProductLite[]
}) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const selected = products.find(p => p.id === value)
  const filtered = q.trim()
    ? products.filter(p => p.name.toLowerCase().includes(q.toLowerCase()) || p.sku?.toLowerCase().includes(q.toLowerCase()))
    : products.slice(0, 50)

  return (
    <div className="relative">
      {selected && !open ? (
        <button
          onClick={() => { setOpen(true); setQ('') }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded text-left text-sm"
          style={{ background: '#0a0a0e', color: '#fafafa', border: '1px solid #27272a', minHeight: 44 }}>
          {selected.photo_urls?.[0] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={selected.photo_urls[0]} alt="" style={{ width: 28, height: 28, borderRadius: 4, objectFit: 'cover' }} />
          )}
          <span className="flex-1 line-clamp-1">{selected.name}</span>
          <X size={14} className="text-zinc-500" onClick={e => { e.stopPropagation(); onChange(null) }} />
        </button>
      ) : (
        <>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              autoFocus={open}
              value={q}
              onChange={e => { setQ(e.target.value); setOpen(true) }}
              onFocus={() => setOpen(true)}
              placeholder="Buscar produto…"
              className="w-full text-sm pl-9 pr-3 py-2 rounded outline-none"
              style={{ background: '#0a0a0e', color: '#fafafa', border: '1px solid #27272a', minHeight: 44 }}
            />
          </div>
          {open && filtered.length > 0 && (
            <div className="absolute z-10 mt-1 w-full max-h-60 overflow-y-auto rounded shadow-lg"
              style={{ background: '#09090b', border: '1px solid #27272a' }}>
              {filtered.map(p => (
                <button
                  key={p.id}
                  onClick={() => { onChange(p.id); setOpen(false); setQ('') }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-800"
                  style={{ minHeight: 44 }}>
                  {p.photo_urls?.[0] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.photo_urls[0]} alt="" style={{ width: 28, height: 28, borderRadius: 4, objectFit: 'cover' }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-zinc-100 line-clamp-1">{p.name}</p>
                    {p.sku && <p className="text-[10px] text-zinc-600">SKU: {p.sku}</p>}
                  </div>
                  <span className="text-xs text-zinc-500">R$ {p.price.toFixed(2)}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
