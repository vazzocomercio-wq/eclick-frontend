'use client'

/**
 * Frete da loja — admin UI (Fase D.2).
 *
 * Lista regras de frete + modal de criar/editar.
 * Kinds: fixed, free, percentage, cep_range, weight_based, melhor_envio.
 */

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { Truck, Plus, Loader2, AlertCircle, Trash2, X, Check, Power, PowerOff } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

type ShippingKind = 'fixed' | 'free' | 'percentage' | 'cep_range' | 'weight_based' | 'melhor_envio'

interface ShippingRule {
  id:                  string
  kind:                ShippingKind
  name:                string
  priority:            number
  active:              boolean
  price_cents:         number
  percent_value:       number | null
  price_per_kg_cents:  number | null
  cep_from:            string | null
  cep_to:              string | null
  min_subtotal_cents:  number | null
  delivery_min_days:   number | null
  delivery_max_days:   number | null
}

const KIND_LABELS: Record<ShippingKind, string> = {
  fixed:         'Valor fixo',
  free:          'Grátis',
  percentage:    'Percentual do pedido',
  cep_range:     'Faixa de CEP',
  weight_based:  'Por peso (R$/kg)',
  melhor_envio:  'Melhor Envio (API)',
}

export default function FretePage() {
  const [items, setItems]       = useState<ShippingRule[] | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error,   setError]     = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const fetchToken = useCallback(async () => {
    const supabase = createClient()
    const { data: session } = await supabase.auth.getSession()
    return session.session?.access_token
  }, [])

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const token = await fetchToken()
      const res = await fetch(`${BACKEND}/shipping-rules`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setItems(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar regras.')
    } finally {
      setLoading(false)
    }
  }, [fetchToken])

  useEffect(() => { void load() }, [load])

  const toggle = async (r: ShippingRule) => {
    const token = await fetchToken()
    await fetch(`${BACKEND}/shipping-rules/${r.id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ active: !r.active }),
    })
    void load()
  }

  const remove = async (r: ShippingRule) => {
    if (!confirm(`Remover regra "${r.name}"?`)) return
    const token = await fetchToken()
    await fetch(`${BACKEND}/shipping-rules/${r.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    void load()
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <Truck size={20} className="text-cyan-400" /> Frete da loja
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Regras de cálculo de frete — aplicadas na ordem de prioridade.
          </p>
        </div>
        <button onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg"
          style={{ background: '#00E5FF', color: '#0a0a0e', minHeight: 44, cursor: 'pointer' }}>
          <Plus size={14} /> Nova regra
        </button>
      </div>

      {error && (
        <div className="rounded-lg border px-4 py-3 text-sm flex items-center gap-2"
          style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', borderColor: 'rgba(239,68,68,0.3)' }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm" style={{ color: '#a1a1aa' }}>
          <Loader2 size={14} className="animate-spin" /> Carregando…
        </div>
      )}

      {items && items.length === 0 && (
        <div className="rounded-lg p-10 text-center" style={{ background: '#111114', color: '#a1a1aa' }}>
          Nenhuma regra de frete cadastrada. Clique em "Nova regra" pra começar.
        </div>
      )}

      {items && items.length > 0 && (
        <div className="rounded-lg overflow-hidden" style={{ background: '#111114', border: '1px solid #27272a' }}>
          <table className="w-full text-sm" style={{ color: '#fafafa' }}>
            <thead style={{ background: '#0a0a0e', color: '#a1a1aa', fontSize: 12 }}>
              <tr>
                <th className="text-left p-3">Prioridade</th>
                <th className="text-left p-3">Nome</th>
                <th className="text-left p-3">Tipo</th>
                <th className="text-right p-3">Valor</th>
                <th className="text-left p-3">Status</th>
                <th className="text-right p-3 w-32"></th>
              </tr>
            </thead>
            <tbody>
              {items.map(r => (
                <tr key={r.id} style={{ borderTop: '1px solid #27272a' }}>
                  <td className="p-3 text-center" style={{ color: '#a1a1aa' }}>{r.priority}</td>
                  <td className="p-3 font-medium">{r.name}</td>
                  <td className="p-3" style={{ color: '#a1a1aa' }}>{KIND_LABELS[r.kind]}</td>
                  <td className="p-3 text-right">{describeValue(r)}</td>
                  <td className="p-3">
                    <span style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 4,
                      background: r.active ? 'rgba(34,197,94,0.1)' : 'rgba(161,161,170,0.1)',
                      color: r.active ? '#4ade80' : '#a1a1aa',
                      border: `1px solid ${r.active ? 'rgba(34,197,94,0.3)' : 'rgba(161,161,170,0.3)'}`,
                    }}>
                      {r.active ? 'Ativa' : 'Pausada'}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <button onClick={() => toggle(r)} aria-label={r.active ? 'Pausar' : 'Ativar'} style={iconBtn}>
                      {r.active ? <PowerOff size={14} /> : <Power size={14} />}
                    </button>
                    <button onClick={() => remove(r)} aria-label="Remover" style={{ ...iconBtn, color: '#f87171' }}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <CreateRuleModal
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); void load() }}
          fetchToken={fetchToken}
        />
      )}
    </div>
  )
}

function describeValue(r: ShippingRule): string {
  switch (r.kind) {
    case 'fixed':        return `R$ ${(r.price_cents / 100).toFixed(2).replace('.', ',')}`
    case 'free':         return 'Grátis'
    case 'percentage':   return `${r.percent_value ?? 0}%`
    case 'cep_range':    return `R$ ${(r.price_cents / 100).toFixed(2).replace('.', ',')} (${r.cep_from ?? '?'}–${r.cep_to ?? '?'})`
    case 'weight_based': return `R$ ${((r.price_per_kg_cents ?? 0) / 100).toFixed(2).replace('.', ',')}/kg`
    case 'melhor_envio': return 'API externa'
  }
}

const iconBtn: React.CSSProperties = {
  minHeight: 36, minWidth: 36, padding: 6,
  background: 'transparent', color: '#a1a1aa',
  border: 'none', borderRadius: 4, cursor: 'pointer',
}

function CreateRuleModal({ onClose, onCreated, fetchToken }: {
  onClose:    () => void
  onCreated:  () => void
  fetchToken: () => Promise<string | undefined>
}) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<ShippingKind>('fixed')
  const [priority, setPriority] = useState('100')
  const [priceReais, setPriceReais] = useState('15')
  const [percent, setPercent] = useState('5')
  const [pricePerKgReais, setPricePerKgReais] = useState('10')
  const [cepFrom, setCepFrom] = useState('')
  const [cepTo, setCepTo] = useState('')
  const [minSubtotalReais, setMinSubtotalReais] = useState('')
  const [minDays, setMinDays] = useState('')
  const [maxDays, setMaxDays] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setBusy(true); setError(null)
    try {
      const token = await fetchToken()
      const body: Record<string, unknown> = {
        kind, name, priority: parseInt(priority) || 100, active: true,
        price_cents: 0,
        percent_value: null,
        price_per_kg_cents: null,
        cep_from: null,
        cep_to: null,
        min_subtotal_cents: minSubtotalReais ? Math.round(parseFloat(minSubtotalReais) * 100) : null,
        delivery_min_days: minDays ? parseInt(minDays) : null,
        delivery_max_days: maxDays ? parseInt(maxDays) : null,
      }
      if (kind === 'fixed' || kind === 'cep_range') body.price_cents = Math.round(parseFloat(priceReais) * 100)
      if (kind === 'percentage') body.percent_value = parseFloat(percent)
      if (kind === 'weight_based') body.price_per_kg_cents = Math.round(parseFloat(pricePerKgReais) * 100)
      if (kind === 'cep_range') { body.cep_from = cepFrom; body.cep_to = cepTo }

      const res = await fetch(`${BACKEND}/shipping-rules`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.message ?? `HTTP ${res.status}`)
      }
      onCreated()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao criar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div onClick={() => !busy && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: '#0d0d10', border: '1px solid #27272a', borderRadius: 12, width: '100%', maxWidth: 520, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: '#27272a' }}>
          <h2 className="text-sm font-medium" style={{ color: '#fafafa' }}>Nova regra de frete</h2>
          <button onClick={onClose} disabled={busy} aria-label="Fechar"
            style={{ background: 'transparent', border: 'none', color: '#a1a1aa', cursor: 'pointer', minHeight: 44, minWidth: 44 }}>
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto p-4 space-y-3">
          <FormField label="Nome da regra"><input value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: SEDEX, PAC, Frete grátis SP" style={fieldStyle} /></FormField>
          <FormField label="Tipo">
            <select value={kind} onChange={e => setKind(e.target.value as ShippingKind)} style={fieldStyle}>
              <option value="fixed">Valor fixo</option>
              <option value="free">Grátis</option>
              <option value="percentage">Percentual do pedido</option>
              <option value="cep_range">Faixa de CEP (valor fixo)</option>
              <option value="weight_based">Por peso (R$/kg)</option>
              <option value="melhor_envio">Melhor Envio (API — em breve)</option>
            </select>
          </FormField>
          <FormField label="Prioridade" hint="Menor número = mais alta. Regras de mesma prioridade aparecem em paralelo no checkout.">
            <input type="number" value={priority} onChange={e => setPriority(e.target.value)} style={fieldStyle} />
          </FormField>
          {(kind === 'fixed' || kind === 'cep_range') && (
            <FormField label="Valor R$"><input type="number" value={priceReais} onChange={e => setPriceReais(e.target.value)} step={0.01} min={0} style={fieldStyle} /></FormField>
          )}
          {kind === 'percentage' && (
            <FormField label="Percentual sobre o pedido (%)"><input type="number" value={percent} onChange={e => setPercent(e.target.value)} step={0.1} min={0} max={100} style={fieldStyle} /></FormField>
          )}
          {kind === 'weight_based' && (
            <FormField label="R$ por kg"><input type="number" value={pricePerKgReais} onChange={e => setPricePerKgReais(e.target.value)} step={0.01} min={0} style={fieldStyle} /></FormField>
          )}
          {kind === 'cep_range' && (
            <>
              <FormField label="CEP de"><input value={cepFrom} onChange={e => setCepFrom(e.target.value)} placeholder="01000-000" style={fieldStyle} /></FormField>
              <FormField label="CEP até"><input value={cepTo} onChange={e => setCepTo(e.target.value)} placeholder="19999-999" style={fieldStyle} /></FormField>
            </>
          )}
          <FormField label="Pedido mínimo R$ (opcional)" hint="Útil pra 'Frete grátis acima de R$ X'">
            <input type="number" value={minSubtotalReais} onChange={e => setMinSubtotalReais(e.target.value)} step={0.01} min={0} style={fieldStyle} />
          </FormField>
          <div className="flex gap-2">
            <div className="flex-1">
              <FormField label="Prazo mín. (dias)"><input type="number" value={minDays} onChange={e => setMinDays(e.target.value)} min={0} style={fieldStyle} /></FormField>
            </div>
            <div className="flex-1">
              <FormField label="Prazo máx. (dias)"><input type="number" value={maxDays} onChange={e => setMaxDays(e.target.value)} min={0} style={fieldStyle} /></FormField>
            </div>
          </div>
          {error && <div className="text-sm" style={{ color: '#f87171' }}>{error}</div>}
        </div>
        <div className="flex items-center justify-end gap-2 p-4 border-t" style={{ borderColor: '#27272a' }}>
          <button onClick={onClose} disabled={busy}
            style={{ padding: '10px 16px', minHeight: 44, background: 'transparent', color: '#a1a1aa', border: '1px solid #27272a', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
            Cancelar
          </button>
          <button onClick={submit} disabled={busy || name.length < 2 || kind === 'melhor_envio'}
            className="flex items-center gap-2"
            style={{ padding: '10px 20px', minHeight: 44, background: kind === 'melhor_envio' || name.length < 2 ? '#1e1e24' : '#00E5FF', color: kind === 'melhor_envio' || name.length < 2 ? '#52525b' : '#0a0a0e', border: 'none', borderRadius: 6, cursor: busy ? 'wait' : (name.length < 2 ? 'not-allowed' : 'pointer'), fontSize: 13, fontWeight: 500 }}>
            {busy ? <><Loader2 size={14} className="animate-spin" /> Criando…</> : <><Check size={14} /> Criar regra</>}
          </button>
        </div>
      </div>
    </div>
  )
}

const fieldStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', minHeight: 44,
  background: '#0a0a0e', color: '#fafafa',
  border: '1px solid #27272a', borderRadius: 6, fontSize: 14,
}

function FormField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs mb-1.5" style={{ color: '#a1a1aa' }}>{label}</label>
      {children}
      {hint && <div className="text-[11px] mt-1" style={{ color: '#52525b' }}>{hint}</div>}
    </div>
  )
}
