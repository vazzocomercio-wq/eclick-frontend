'use client'

import { useCallback, useEffect, useState } from 'react'
import { X, Loader2, Plus, Box, Layers, Trash2 } from 'lucide-react'
import { fulfillmentApi, type PackagingType, type PackagingKit, type PackagingKind, type PackagingKitItem } from '../_lib/api'

const KINDS: Array<{ key: PackagingKind; label: string }> = [
  { key: 'caixa', label: 'Caixa' }, { key: 'envelope', label: 'Envelope' }, { key: 'sacola', label: 'Sacola' }, { key: 'outro', label: 'Outro' },
]

/** Controle de embalagens (Onda E): tipos (caixa/envelope/sacola) + kits (combo). */
export function PackagingSheet({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'types' | 'kits'>('types')
  const [types, setTypes] = useState<PackagingType[]>([])
  const [kits, setKits] = useState<PackagingKit[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [newType, setNewType] = useState('')
  const [newKit, setNewKit] = useState('')

  const reload = useCallback(async () => {
    setLoading(true)
    try { const [t, k] = await Promise.all([fulfillmentApi.packagingTypes(), fulfillmentApi.packagingKits()]); setTypes(t); setKits(k); setErr(null) }
    catch (e) { setErr((e as Error).message) } finally { setLoading(false) }
  }, [])
  useEffect(() => { void reload() }, [reload])

  async function addType() {
    if (!newType.trim()) return
    setBusy(true); setErr(null)
    try { await fulfillmentApi.createPackagingType({ name: newType.trim(), kind: 'caixa' }); setNewType(''); await reload() }
    catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  async function patchType(id: string, patch: Record<string, unknown>) {
    setTypes((p) => p.map((t) => t.id === id ? { ...t, ...patch } as PackagingType : t))
    try { await fulfillmentApi.updatePackagingType(id, patch) } catch (e) { setErr((e as Error).message) }
  }
  async function delType(id: string) { setBusy(true); try { await fulfillmentApi.removePackagingType(id); await reload() } catch (e) { setErr((e as Error).message) } finally { setBusy(false) } }

  async function addKit() {
    if (!newKit.trim()) return
    setBusy(true); setErr(null)
    try { await fulfillmentApi.createPackagingKit({ name: newKit.trim() }); setNewKit(''); await reload() }
    catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  async function setKitItems(id: string, items: PackagingKitItem[]) {
    setKits((p) => p.map((k) => k.id === id ? { ...k, items } : k))
    try { await fulfillmentApi.updatePackagingKit(id, { items }) } catch (e) { setErr((e as Error).message) }
  }
  async function delKit(id: string) { setBusy(true); try { await fulfillmentApi.removePackagingKit(id); await reload() } catch (e) { setErr((e as Error).message) } finally { setBusy(false) } }

  const numOrNull = (v: string) => v.trim() === '' ? null : Number(v.replace(',', '.'))

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl p-5" style={{ background: '#121214' }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Embalagens</h2>
          <button onClick={onClose} className="rounded-xl p-2" style={{ background: '#0c0c10' }}><X size={18} /></button>
        </div>

        <div className="mb-4 flex gap-2">
          <Tab active={tab === 'types'} onClick={() => setTab('types')} icon={<Box size={15} />} label="Tipos" />
          <Tab active={tab === 'kits'} onClick={() => setTab('kits')} icon={<Layers size={15} />} label="Kits" />
        </div>

        {err && <div className="mb-3 rounded-lg p-3 text-sm" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171' }}>{err}</div>}

        {loading ? (
          <div className="grid place-items-center py-10"><Loader2 size={24} className="animate-spin" color="#00E5FF" /></div>
        ) : tab === 'types' ? (
          <div className="flex flex-col gap-2">
            {types.map((t) => (
              <div key={t.id} className="rounded-2xl p-3" style={{ background: '#0c0c10', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="mb-2 flex items-center gap-2">
                  <input defaultValue={t.name} onBlur={(e) => e.target.value.trim() && e.target.value !== t.name && patchType(t.id, { name: e.target.value.trim() })}
                    className="flex-1 bg-transparent text-sm font-semibold outline-none" style={{ color: '#fafafa' }} />
                  <select value={t.kind} onChange={(e) => patchType(t.id, { kind: e.target.value })} className="rounded-lg px-2 py-1 text-xs outline-none" style={{ background: '#09090b', color: '#fafafa', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
                  </select>
                  <button onClick={() => delType(t.id)} disabled={busy} className="rounded-lg p-1.5" style={{ background: '#18181b' }} aria-label="Remover"><Trash2 size={14} color="#f87171" /></button>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  <Field label="Larg(cm)" def={t.width_cm} onBlur={(v) => patchType(t.id, { width_cm: numOrNull(v) })} />
                  <Field label="Alt(cm)" def={t.height_cm} onBlur={(v) => patchType(t.id, { height_cm: numOrNull(v) })} />
                  <Field label="Prof(cm)" def={t.depth_cm} onBlur={(v) => patchType(t.id, { depth_cm: numOrNull(v) })} />
                  <Field label="Peso(g)" def={t.weight_g} onBlur={(v) => patchType(t.id, { weight_g: numOrNull(v) })} />
                  <Field label="Custo(R$)" def={t.cost_cents != null ? t.cost_cents / 100 : null} onBlur={(v) => patchType(t.id, { cost_cents: v.trim() === '' ? null : Math.round(Number(v.replace(',', '.')) * 100) })} />
                  <Field label="Estoque" def={t.stock} onBlur={(v) => patchType(t.id, { stock: v.trim() === '' ? null : Math.round(Number(v)) })} />
                </div>
              </div>
            ))}
            <div className="flex gap-2">
              <input value={newType} onChange={(e) => setNewType(e.target.value)} placeholder="Nova embalagem (ex.: Caixa M)" className="flex-1 rounded-lg px-3 py-2.5 text-sm outline-none" style={{ background: '#09090b', color: '#fafafa', border: '1px solid rgba(255,255,255,0.08)' }} />
              <button onClick={addType} disabled={!newType.trim() || busy} className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold disabled:opacity-50" style={{ background: '#00E5FF', color: '#04222a' }}><Plus size={16} /> Add</button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {kits.length === 0 && <p className="text-sm" style={{ color: '#71717a' }}>Nenhum kit. Crie um combo de materiais (ex.: Kit Frágil).</p>}
            {kits.map((k) => (
              <div key={k.id} className="rounded-2xl p-3" style={{ background: '#0c0c10', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex-1 text-sm font-semibold">{k.name}</span>
                  <button onClick={() => delKit(k.id)} disabled={busy} className="rounded-lg p-1.5" style={{ background: '#18181b' }} aria-label="Remover"><Trash2 size={14} color="#f87171" /></button>
                </div>
                <div className="flex flex-col gap-1.5">
                  {types.filter((t) => t.is_active).map((t) => {
                    const cur = k.items.find((i) => i.packaging_type_id === t.id)?.qty ?? 0
                    return (
                      <div key={t.id} className="flex items-center gap-2 text-sm">
                        <span className="flex-1" style={{ color: cur > 0 ? '#fafafa' : '#52525b' }}>{t.name}</span>
                        <input type="number" min={0} defaultValue={cur || ''} placeholder="0"
                          onBlur={(e) => {
                            const qty = Math.max(0, Math.round(Number(e.target.value) || 0))
                            const items = k.items.filter((i) => i.packaging_type_id !== t.id)
                            if (qty > 0) items.push({ packaging_type_id: t.id, qty })
                            setKitItems(k.id, items)
                          }}
                          className="w-16 rounded-lg px-2 py-1 text-center text-sm outline-none" style={{ background: '#09090b', color: '#fafafa', border: '1px solid rgba(255,255,255,0.08)' }} />
                      </div>
                    )
                  })}
                  {types.length === 0 && <p className="text-xs" style={{ color: '#71717a' }}>Cadastre tipos de embalagem primeiro (aba Tipos).</p>}
                </div>
              </div>
            ))}
            <div className="flex gap-2">
              <input value={newKit} onChange={(e) => setNewKit(e.target.value)} placeholder="Novo kit (ex.: Kit Frágil)" className="flex-1 rounded-lg px-3 py-2.5 text-sm outline-none" style={{ background: '#09090b', color: '#fafafa', border: '1px solid rgba(255,255,255,0.08)' }} />
              <button onClick={addKit} disabled={!newKit.trim() || busy} className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold disabled:opacity-50" style={{ background: '#00E5FF', color: '#04222a' }}><Plus size={16} /> Add</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Tab({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold"
      style={{ background: active ? '#00E5FF22' : '#0c0c10', color: active ? '#00E5FF' : '#a1a1aa', border: `1px solid ${active ? '#00E5FF55' : 'rgba(255,255,255,0.08)'}` }}>
      {icon} {label}
    </button>
  )
}
function Field({ label, def, onBlur }: { label: string; def: number | null; onBlur: (v: string) => void }) {
  return (
    <div>
      <input defaultValue={def ?? ''} inputMode="decimal" onBlur={(e) => onBlur(e.target.value)}
        className="w-full rounded-lg px-2 py-1.5 text-center text-sm outline-none" style={{ background: '#09090b', color: '#fafafa', border: '1px solid rgba(255,255,255,0.08)' }} />
      <div className="mt-0.5 text-center text-[10px]" style={{ color: '#52525b' }}>{label}</div>
    </div>
  )
}
