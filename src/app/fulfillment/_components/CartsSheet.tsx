'use client'

import { useEffect, useState, useCallback } from 'react'
import { X, ShoppingCart, Ruler, Trash2, Check } from 'lucide-react'
import { fulfillmentApi, type Warehouse, type PickingCart, type ProductToMeasure } from '../_lib/api'

/**
 * Carrinhos de coleta (cubagem) + Medição de produtos — Fase A.
 * Carrinho: medidas internas L×C×A → volume útil (só volume, sem peso).
 * Medição: produtos na fila sem L×C×A → bipar/digitar pra alimentar a cubagem.
 */
export function CartsSheet({ warehouses, warehouseId, onClose }: { warehouses: Warehouse[]; warehouseId: string | null; onClose: () => void }) {
  const [wid, setWid] = useState<string | null>(warehouseId)
  const [carts, setCarts] = useState<PickingCart[]>([])
  const [toMeasure, setToMeasure] = useState<ProductToMeasure[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (id: string | null) => {
    setLoading(true)
    try {
      const [c, m] = await Promise.all([fulfillmentApi.carts(id ?? undefined), fulfillmentApi.productsToMeasure(id ?? undefined)])
      setCarts(c); setToMeasure(m); setErr(null)
    } catch (e) { setErr((e as Error).message) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load(wid) }, [load, wid])

  const [nc, setNc] = useState({ name: '', width_cm: 60, length_cm: 40, height_cm: 100, fill_factor: 75 })
  async function createCart() {
    if (!nc.name.trim()) { setErr('Dê um nome ao carrinho.'); return }
    setBusy(true); setMsg(null); setErr(null)
    try {
      await fulfillmentApi.createCart({ warehouseId: wid, name: nc.name.trim(), width_cm: nc.width_cm, length_cm: nc.length_cm, height_cm: nc.height_cm, fill_factor: nc.fill_factor / 100 })
      setNc({ ...nc, name: '' }); setMsg('Carrinho criado.'); load(wid)
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  async function removeCart(id: string) {
    setBusy(true)
    try { await fulfillmentApi.deleteCart(id); load(wid) } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl p-5" style={{ background: '#0b0b0e' }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2"><ShoppingCart size={20} color="#00E5FF" /><h2 className="text-lg font-bold">Carrinhos &amp; Medição</h2></div>
          <button onClick={onClose} className="rounded-lg p-2" style={{ background: '#18181b' }}><X size={18} /></button>
        </div>

        {warehouses.length > 1 && (
          <select value={wid ?? ''} onChange={(e) => setWid(e.target.value)} className="mb-3 w-full rounded-xl px-3 py-2 text-sm outline-none" style={{ background: '#0c0c10', color: '#fafafa', border: '1px solid rgba(255,255,255,0.08)' }}>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
          </select>
        )}

        {msg && <div className="mb-3 rounded-xl p-3 text-sm" style={{ background: 'rgba(74,222,128,0.10)', color: '#4ADE50', border: '1px solid rgba(74,222,128,0.3)' }}>{msg}</div>}
        {err && <div className="mb-3 rounded-xl p-3 text-sm" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>}

        {/* Carrinhos */}
        <section className="mb-3 rounded-2xl p-3" style={{ background: '#111114', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="mb-2 flex items-center gap-2"><ShoppingCart size={15} color="#00E5FF" /><h3 className="text-sm font-semibold">Carrinhos de coleta</h3></div>
          <p className="mb-2 text-[11px]" style={{ color: '#71717a' }}>Medidas internas (cm). O sistema calcula o espaço cúbico e quantos produtos cabem.</p>
          <div className="grid grid-cols-4 gap-1.5">
            <Num label="Larg." v={nc.width_cm} on={(v) => setNc({ ...nc, width_cm: v })} />
            <Num label="Comp." v={nc.length_cm} on={(v) => setNc({ ...nc, length_cm: v })} />
            <Num label="Alt." v={nc.height_cm} on={(v) => setNc({ ...nc, height_cm: v })} />
            <Num label="Aprov.%" v={nc.fill_factor} on={(v) => setNc({ ...nc, fill_factor: v })} />
          </div>
          <input value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} placeholder="Nome do carrinho (ex.: Carrinho azul)" className="mt-2 w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ background: '#0c0c10', color: '#fafafa', border: '1px solid rgba(255,255,255,0.08)' }} />
          <button onClick={createCart} disabled={busy} className="mt-2 w-full rounded-xl py-2.5 text-sm font-bold disabled:opacity-50" style={{ background: '#00E5FF', color: '#04222a' }}>Cadastrar carrinho</button>

          {loading ? <div className="mt-2 h-8 animate-pulse rounded-lg" style={{ background: '#0c0c10' }} />
            : carts.length === 0 ? <p className="mt-2 text-xs" style={{ color: '#52525b' }}>Nenhum carrinho ainda.</p>
            : (
              <ul className="mt-2 flex flex-col gap-1">
                {carts.map((c) => (
                  <li key={c.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-xs" style={{ background: '#0c0c10' }}>
                    <span><span className="font-semibold" style={{ color: '#fafafa' }}>{c.name}</span> <span style={{ color: '#71717a' }}>· {c.width_cm}×{c.length_cm}×{c.height_cm}cm · útil {(c.usable_volume_cm3 / 1000).toFixed(1)} L</span></span>
                    <button onClick={() => removeCart(c.id)} disabled={busy} aria-label="Remover"><Trash2 size={13} color="#f87171" /></button>
                  </li>
                ))}
              </ul>
            )}
        </section>

        {/* Medição */}
        <section className="rounded-2xl p-3" style={{ background: '#111114', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="mb-2 flex items-center gap-2"><Ruler size={15} color="#fcd34d" /><h3 className="text-sm font-semibold">Medição de produtos ({toMeasure.length} a medir)</h3></div>
          <p className="mb-2 text-[11px]" style={{ color: '#71717a' }}>Produtos na fila sem medida. Meça (L×C×A em cm) pra entrarem no cálculo do carrinho.</p>
          {loading ? <div className="h-8 animate-pulse rounded-lg" style={{ background: '#0c0c10' }} />
            : toMeasure.length === 0 ? <p className="text-xs" style={{ color: '#4ADE50' }}>Tudo medido ✓</p>
            : (
              <ul className="flex flex-col gap-2">
                {toMeasure.slice(0, 40).map((p) => (
                  <MeasureRow key={p.sku} p={p} onSaved={() => { setToMeasure((prev) => prev.filter((x) => x.sku !== p.sku)) }} setErr={setErr} />
                ))}
                {toMeasure.length > 40 && <li className="text-xs" style={{ color: '#52525b' }}>+{toMeasure.length - 40} produtos…</li>}
              </ul>
            )}
        </section>
      </div>
    </div>
  )
}

function MeasureRow({ p, onSaved, setErr }: { p: ProductToMeasure; onSaved: () => void; setErr: (s: string) => void }) {
  const [d, setD] = useState({ w: 0, l: 0, h: 0, kg: 0 })
  const [busy, setBusy] = useState(false)
  async function save() {
    if (!(d.w > 0 && d.l > 0 && d.h > 0)) { setErr('Informe L×C×A maiores que zero.'); return }
    setBusy(true)
    try { await fulfillmentApi.measureProduct({ productId: p.productId ?? undefined, sku: p.sku, width_cm: d.w, length_cm: d.l, height_cm: d.h, weight_kg: d.kg > 0 ? d.kg : undefined }); onSaved() }
    catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  const inp = 'w-full rounded-lg px-1.5 py-1 text-center text-sm outline-none tabular-nums'
  const st = { background: '#0c0c10', color: '#fafafa', border: '1px solid rgba(255,255,255,0.08)' } as const
  return (
    <li className="rounded-lg px-2 py-2" style={{ background: '#0c0c10' }}>
      <div className="mb-1.5 truncate text-xs"><span className="font-mono font-semibold" style={{ color: '#fafafa' }}>{p.sku}</span> <span style={{ color: '#71717a' }}>{p.title}</span></div>
      <div className="flex items-center gap-1.5">
        <input type="number" placeholder="L" min={0} onChange={(e) => setD({ ...d, w: Number(e.target.value) || 0 })} className={inp} style={st} />
        <span style={{ color: '#52525b' }}>×</span>
        <input type="number" placeholder="C" min={0} onChange={(e) => setD({ ...d, l: Number(e.target.value) || 0 })} className={inp} style={st} />
        <span style={{ color: '#52525b' }}>×</span>
        <input type="number" placeholder="A" min={0} onChange={(e) => setD({ ...d, h: Number(e.target.value) || 0 })} className={inp} style={st} />
        <span className="text-[11px]" style={{ color: '#52525b' }}>cm</span>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <input type="number" placeholder="peso" min={0} step="0.01" onChange={(e) => setD({ ...d, kg: Number(e.target.value) || 0 })} className={inp} style={{ ...st, maxWidth: 90 }} />
        <span className="text-[11px]" style={{ color: '#52525b' }}>kg (opcional)</span>
        <button onClick={save} disabled={busy} className="ml-auto flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-50" style={{ background: '#4ADE50', color: '#06210d' }}><Check size={14} /> Salvar</button>
      </div>
    </li>
  )
}

function Num({ label, v, on }: { label: string; v: number; on: (v: number) => void }) {
  return (
    <div>
      <div className="mb-1 text-[10px]" style={{ color: '#71717a' }}>{label}</div>
      <input type="number" min={1} value={v} onChange={(e) => on(Math.max(1, Number(e.target.value) || 1))} className="w-full rounded-lg px-2 py-1.5 text-center text-sm outline-none tabular-nums" style={{ background: '#0c0c10', color: '#fafafa', border: '1px solid rgba(255,255,255,0.08)' }} />
    </div>
  )
}
