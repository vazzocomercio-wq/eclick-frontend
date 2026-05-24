'use client'

import { useEffect, useState } from 'react'
import { X, Loader2, Check } from 'lucide-react'
import { fulfillmentApi, type FulfillmentSettings, type Warehouse } from '../_lib/api'

const SOURCES: Array<{ key: string; label: string }> = [
  { key: 'marketplace', label: 'Marketplace (ML)' },
  { key: 'storefront', label: 'Loja Própria' },
  { key: 'b2b', label: 'B2B / Revenda' },
]

/** Painel de configurações do CD (supervisor). Auto-ingestão + IA + regra de foto. */
export function SettingsSheet({ warehouses, onClose }: { warehouses: Warehouse[]; onClose: () => void }) {
  const [s, setS] = useState<FulfillmentSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    fulfillmentApi.getSettings().then(setS).catch((e) => setErr((e as Error).message))
  }, [])

  function patch(p: Partial<FulfillmentSettings>) {
    setS((prev) => (prev ? { ...prev, ...p } : prev))
    setSaved(false)
  }

  function toggleSource(key: string) {
    if (!s) return
    const has = s.auto_ingest_sources.includes(key)
    patch({ auto_ingest_sources: has ? s.auto_ingest_sources.filter((x) => x !== key) : [...s.auto_ingest_sources, key] })
  }

  async function save() {
    if (!s) return
    setSaving(true); setErr(null)
    try {
      await fulfillmentApi.updateSettings({
        auto_ingest_enabled: s.auto_ingest_enabled,
        auto_ingest_sources: s.auto_ingest_sources,
        default_warehouse_id: s.default_warehouse_id,
        ai_damage_triage_enabled: s.ai_damage_triage_enabled,
        ai_pack_verification_enabled: s.ai_pack_verification_enabled,
        ai_smart_queue_enabled: s.ai_smart_queue_enabled,
        photo_required_always: s.photo_required_always,
        photo_required_above_cents: s.photo_required_above_cents,
      })
      setSaved(true)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl p-5" style={{ background: '#121214' }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Configurações do CD</h2>
          <button onClick={onClose} className="rounded-xl p-2" style={{ background: '#0c0c10' }}><X size={18} /></button>
        </div>

        {err && <div className="mb-3 rounded-lg p-3 text-sm" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171' }}>{err}</div>}

        {!s ? (
          <div className="grid place-items-center py-10"><Loader2 size={24} className="animate-spin" color="#00E5FF" /></div>
        ) : (
          <div className="flex flex-col gap-5">
            {/* Auto-ingestão */}
            <Section title="Ingestão automática" hint="Pedido pago vira fila de separação sozinho.">
              <Toggle label="Ativar auto-ingestão" checked={s.auto_ingest_enabled} onChange={(v) => patch({ auto_ingest_enabled: v })} />
              {s.auto_ingest_enabled && (
                <>
                  <div className="mt-2">
                    <p className="mb-1 text-xs" style={{ color: '#71717a' }}>Origens</p>
                    <div className="flex flex-wrap gap-2">
                      {SOURCES.map((src) => {
                        const on = s.auto_ingest_sources.includes(src.key)
                        return (
                          <button key={src.key} onClick={() => toggleSource(src.key)} className="rounded-full px-3 py-1.5 text-sm font-semibold"
                            style={{ background: on ? '#00E5FF22' : '#0c0c10', color: on ? '#00E5FF' : '#a1a1aa', border: `1px solid ${on ? '#00E5FF55' : 'rgba(255,255,255,0.08)'}` }}>
                            {src.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  {warehouses.length > 0 && (
                    <div className="mt-3">
                      <p className="mb-1 text-xs" style={{ color: '#71717a' }}>CD de destino</p>
                      <select value={s.default_warehouse_id ?? ''} onChange={(e) => patch({ default_warehouse_id: e.target.value || null })}
                        className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={{ background: '#0c0c10', color: '#fafafa', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <option value="">Primeiro CD ativo</option>
                        {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
                      </select>
                    </div>
                  )}
                </>
              )}
            </Section>

            {/* IA */}
            <Section title="Inteligência artificial" hint="Recursos assistivos (opcionais).">
              <Toggle label="Triagem de avaria por foto" checked={s.ai_damage_triage_enabled} onChange={(v) => patch({ ai_damage_triage_enabled: v })} />
              <Toggle label="Conferência de pacote por foto" checked={s.ai_pack_verification_enabled} onChange={(v) => patch({ ai_pack_verification_enabled: v })} />
              <Toggle label="Fila de separação inteligente" checked={s.ai_smart_queue_enabled} onChange={(v) => patch({ ai_smart_queue_enabled: v })} />
            </Section>

            {/* Foto */}
            <Section title="Foto na expedição">
              <Toggle label="Sempre exigir foto" checked={s.photo_required_always} onChange={(v) => patch({ photo_required_always: v })} />
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-sm" style={{ color: '#a1a1aa' }}>Exigir foto acima de (R$)</span>
                <input type="number" inputMode="numeric" value={Math.round(s.photo_required_above_cents / 100)}
                  onChange={(e) => patch({ photo_required_above_cents: Math.max(0, Number(e.target.value) || 0) * 100 })}
                  className="w-24 rounded-lg px-3 py-2 text-right text-sm outline-none" style={{ background: '#0c0c10', color: '#fafafa', border: '1px solid rgba(255,255,255,0.08)' }} />
              </div>
            </Section>

            <button onClick={save} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl py-4 text-base font-bold disabled:opacity-50"
              style={{ background: saved ? '#4ADE50' : '#00E5FF', color: saved ? '#06210d' : '#04222a' }}>
              {saving ? <Loader2 size={18} className="animate-spin" /> : saved ? <Check size={18} /> : null}
              {saving ? 'Salvando…' : saved ? 'Salvo' : 'Salvar configurações'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-sm font-bold">{title}</h3>
      {hint && <p className="mb-2 text-xs" style={{ color: '#71717a' }}>{hint}</p>}
      <div className="rounded-2xl p-3" style={{ background: '#0c0c10', border: '1px solid rgba(255,255,255,0.08)' }}>{children}</div>
    </section>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} className="flex w-full items-center justify-between py-2 text-left">
      <span className="text-sm" style={{ color: '#fafafa' }}>{label}</span>
      <span className="relative h-6 w-11 rounded-full transition-colors" style={{ background: checked ? '#00E5FF' : '#3f3f46' }}>
        <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all" style={{ left: checked ? '22px' : '2px' }} />
      </span>
    </button>
  )
}
