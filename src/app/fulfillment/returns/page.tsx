'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, RotateCcw, Check, PackageX, Trash2 } from 'lucide-react'
import { fulfillmentApi, ApiError, type FulfillmentReturn, type ReturnCondition } from '../_lib/api'
import { feedbackOk, feedbackError } from '../_lib/feedback'

const WID_KEY = 'eclick_fulfillment_wid'
const COND: Array<{ key: ReturnCondition; label: string; color: string }> = [
  { key: 'restock', label: 'Reestocar', color: '#4ADE50' },
  { key: 'damaged', label: 'Avariado', color: '#fcd34d' },
  { key: 'discard', label: 'Descartar', color: '#f87171' },
]
const statusLabel = (s: string) => ({ registered: 'Registrada', inspecting: 'Em conferência', resolved: 'Resolvida', cancelled: 'Cancelada' }[s] ?? s)
const statusColor = (s: string) => s === 'resolved' ? '#4ADE50' : s === 'cancelled' ? '#52525b' : '#fcd34d'

export default function ReturnsPage() {
  const [list, setList] = useState<FulfillmentReturn[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [active, setActive] = useState<FulfillmentReturn | null>(null)
  const wid = typeof window !== 'undefined' ? localStorage.getItem(WID_KEY) : null

  const load = useCallback(async () => {
    setLoading(true)
    try { setList(await fulfillmentApi.returns(wid ?? undefined)); setErr(null) }
    catch (e) { setErr((e as Error).message) }
    finally { setLoading(false) }
  }, [wid])
  useEffect(() => { load() }, [load])

  if (active) return <ResolveView ret={active} onExit={() => { setActive(null); load() }} />
  if (showForm) return <RegisterForm warehouseId={wid} onDone={() => { setShowForm(false); load() }} />

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-3 pt-1">
        <Link href="/fulfillment" className="rounded-xl p-2.5" style={{ background: '#18181b' }}><ArrowLeft size={20} /></Link>
        <h1 className="flex-1 text-xl font-bold">Devoluções</h1>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-bold" style={{ background: '#00E5FF', color: '#04222a' }}>
          <Plus size={16} /> Registrar
        </button>
      </header>

      {err && <div className="rounded-xl p-3 text-sm" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171' }}>{err}</div>}
      {loading && <div className="flex flex-col gap-2">{[0, 1].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl" style={{ background: '#0c0c10' }} />)}</div>}
      {!loading && list.length === 0 && !err && (
        <div className="rounded-2xl p-8 text-center" style={{ background: '#0c0c10', border: '1px solid rgba(255,255,255,0.08)' }}>
          <RotateCcw size={28} className="mx-auto mb-2" color="#52525b" />
          <p className="text-sm" style={{ color: '#a1a1aa' }}>Nenhuma devolução registrada.</p>
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {list.map((r) => {
          const pend = r.items.filter((i) => i.condition === 'pending').length
          return (
            <li key={r.id}>
              <button onClick={() => setActive(r)} className="flex w-full items-center gap-3 rounded-2xl p-4 text-left active:scale-[0.99] transition-transform" style={{ background: '#0c0c10', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">#{r.reference ?? r.id.slice(0, 8)}</span>
                    <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `${statusColor(r.status)}1a`, color: statusColor(r.status) }}>{statusLabel(r.status)}</span>
                  </div>
                  <div className="text-sm" style={{ color: '#a1a1aa' }}>{r.customer?.name || 'Cliente'} · {r.items.length} {r.items.length === 1 ? 'item' : 'itens'}{r.reason ? ` · ${r.reason}` : ''}</div>
                </div>
                {pend > 0 && <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: '#fcd34d22', color: '#fcd34d' }}>{pend} a conferir</span>}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function ResolveView({ ret, onExit }: { ret: FulfillmentReturn; onExit: () => void }) {
  const [conds, setConds] = useState<Record<string, ReturnCondition>>(() =>
    Object.fromEntries(ret.items.map((i) => [i.sku, i.condition !== 'pending' ? i.condition : 'restock'])))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function confirm() {
    setBusy(true); setMsg(null)
    try {
      const r = await fulfillmentApi.resolveReturn(ret.id, ret.items.map((i) => ({ sku: i.sku, condition: conds[i.sku] })))
      feedbackOk(); setMsg(`Conferência salva. ${r.restocked} item(ns) reestocado(s).`)
      setTimeout(onExit, 900)
    } catch (e) { feedbackError(); setMsg(e instanceof ApiError ? e.message : (e as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-3 pt-1">
        <button onClick={onExit} className="rounded-xl p-2.5" style={{ background: '#18181b' }}><ArrowLeft size={20} /></button>
        <h1 className="text-lg font-bold">#{ret.reference ?? ret.id.slice(0, 8)}</h1>
      </header>

      <p className="text-sm" style={{ color: '#71717a' }}>Confira cada item devolvido:</p>
      <ul className="flex flex-col gap-2">
        {ret.items.map((it) => (
          <li key={it.sku} className="rounded-2xl p-4" style={{ background: '#0c0c10', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-sm font-bold">{it.qty}x {it.sku}</span>
              {it.restocked && <span className="text-xs font-semibold" style={{ color: '#4ADE50' }}>✓ reestocado</span>}
            </div>
            {it.title && <div className="mb-2 text-xs" style={{ color: '#71717a' }}>{it.title}</div>}
            <div className="grid grid-cols-3 gap-2">
              {COND.map((c) => {
                const on = conds[it.sku] === c.key
                const disabled = it.restocked && c.key !== 'restock'
                return (
                  <button key={c.key} disabled={disabled} onClick={() => setConds((p) => ({ ...p, [it.sku]: c.key }))} className="rounded-xl py-2.5 text-sm font-semibold disabled:opacity-40"
                    style={{ background: on ? `${c.color}22` : '#18181b', color: on ? c.color : '#a1a1aa', border: `1px solid ${on ? c.color + '55' : 'transparent'}` }}>
                    {c.label}
                  </button>
                )
              })}
            </div>
            {conds[it.sku] === 'restock' && !it.product_id && (
              <p className="mt-2 text-xs" style={{ color: '#fcd34d' }}>⚠ Sem vínculo de produto — não vai reestocar automático.</p>
            )}
          </li>
        ))}
      </ul>

      {msg && <div className="rounded-xl p-3 text-center text-sm font-semibold" style={{ background: 'rgba(74,222,80,0.10)', color: '#4ADE50' }}>{msg}</div>}
      <button onClick={confirm} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl py-4 text-base font-bold disabled:opacity-50" style={{ background: '#4ADE50', color: '#06210d' }}>
        <Check size={20} /> Confirmar conferência
      </button>
    </div>
  )
}

function RegisterForm({ warehouseId, onDone }: { warehouseId: string | null; onDone: () => void }) {
  const [reference, setReference] = useState('')
  const [reason, setReason] = useState('')
  const [customer, setCustomer] = useState('')
  const [items, setItems] = useState<Array<{ sku: string; qty: number }>>([{ sku: '', qty: 1 }])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit() {
    const valid = items.filter((i) => i.sku.trim())
    if (valid.length === 0) { setErr('Adicione pelo menos um item (SKU).'); return }
    setBusy(true); setErr(null)
    try {
      await fulfillmentApi.registerReturn({
        warehouseId: warehouseId ?? undefined,
        reference: reference.trim() || undefined,
        reason: reason.trim() || undefined,
        customer: customer.trim() ? { name: customer.trim() } : undefined,
        items: valid.map((i) => ({ sku: i.sku.trim(), qty: Math.max(1, Number(i.qty) || 1) })),
      })
      feedbackOk(); onDone()
    } catch (e) { feedbackError(); setErr((e as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-3 pt-1">
        <button onClick={onDone} className="rounded-xl p-2.5" style={{ background: '#18181b' }}><ArrowLeft size={20} /></button>
        <h1 className="text-lg font-bold">Registrar devolução</h1>
      </header>

      <Field label="Referência (pedido / RMA)"><input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="ex: 2000016..." className="w-full rounded-xl px-3 py-3 outline-none" style={inp} /></Field>
      <Field label="Cliente"><input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="nome do cliente" className="w-full rounded-xl px-3 py-3 outline-none" style={inp} /></Field>
      <Field label="Motivo"><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="ex: produto com defeito" className="w-full rounded-xl px-3 py-3 outline-none" style={inp} /></Field>

      <div>
        <p className="mb-2 text-xs font-semibold" style={{ color: '#71717a' }}>ITENS DEVOLVIDOS</p>
        <div className="flex flex-col gap-2">
          {items.map((it, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input value={it.sku} onChange={(e) => setItems((p) => p.map((x, i) => i === idx ? { ...x, sku: e.target.value } : x))} placeholder="SKU" className="flex-1 rounded-xl px-3 py-3 font-mono outline-none" style={inp} />
              <input type="number" inputMode="numeric" value={it.qty} onChange={(e) => setItems((p) => p.map((x, i) => i === idx ? { ...x, qty: Number(e.target.value) || 1 } : x))} className="w-16 rounded-xl px-3 py-3 text-center outline-none" style={inp} />
              {items.length > 1 && <button onClick={() => setItems((p) => p.filter((_, i) => i !== idx))} className="rounded-xl p-3" style={{ background: '#18181b' }}><Trash2 size={16} color="#f87171" /></button>}
            </div>
          ))}
          <button onClick={() => setItems((p) => [...p, { sku: '', qty: 1 }])} className="flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold" style={{ background: '#18181b', color: '#00E5FF' }}>
            <Plus size={15} /> Adicionar item
          </button>
        </div>
      </div>

      {err && <div className="rounded-xl p-3 text-sm" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171' }}>{err}</div>}
      <button onClick={submit} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl py-4 text-base font-bold disabled:opacity-50" style={{ background: '#00E5FF', color: '#04222a' }}>
        <PackageX size={20} /> Registrar devolução
      </button>
    </div>
  )
}

const inp: React.CSSProperties = { background: '#0c0c10', color: '#fafafa', border: '1px solid rgba(255,255,255,0.08)' }
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1 block text-xs" style={{ color: '#71717a' }}>{label}</label>{children}</div>
}
