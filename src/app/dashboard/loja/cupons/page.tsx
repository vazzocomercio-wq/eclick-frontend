'use client'

/**
 * Cupons da loja — admin UI (Fase D.1).
 *
 * CRUD simples: listar, criar, editar, ativar/desativar, remover.
 * Cada cupom: code + type (percentage|fixed|free_shipping) + value +
 * min_order + expires_at + usage_limit + active.
 */

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { Ticket, Plus, Loader2, AlertCircle, Trash2, X, Check, Power, PowerOff } from 'lucide-react'
import { useConfirm } from '@/components/ui/dialog-provider'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

type CouponType = 'percentage' | 'fixed' | 'free_shipping'

interface Coupon {
  id:                string
  code:              string
  type:              CouponType
  value:             number
  min_order_cents:   number
  usage_limit:       number | null
  used_count:        number
  expires_at:        string | null
  active:            boolean
  description:       string | null
  created_at:        string
}

const TYPE_LABELS: Record<CouponType, string> = {
  percentage:    'Desconto %',
  fixed:         'Desconto R$',
  free_shipping: 'Frete grátis',
}

export default function CuponsPage() {
  const [items, setItems]   = useState<Coupon[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const confirm = useConfirm()

  const fetchToken = useCallback(async () => {
    const supabase = createClient()
    const { data: session } = await supabase.auth.getSession()
    return session.session?.access_token
  }, [])

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const token = await fetchToken()
      const res = await fetch(`${BACKEND}/coupons`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setItems(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar cupons.')
    } finally {
      setLoading(false)
    }
  }, [fetchToken])

  useEffect(() => { void load() }, [load])

  const toggle = async (c: Coupon) => {
    const token = await fetchToken()
    await fetch(`${BACKEND}/coupons/${c.id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ active: !c.active }),
    })
    void load()
  }

  const remove = async (c: Coupon) => {
    const ok = await confirm({
      title:        'Remover cupom',
      message:      `O cupom "${c.code}" será excluído. Quem tentar usar daqui em diante vai receber "cupom inválido".`,
      confirmLabel: 'Remover',
      variant:      'danger',
    })
    if (!ok) return
    const token = await fetchToken()
    await fetch(`${BACKEND}/coupons/${c.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    void load()
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <Ticket size={20} className="text-cyan-400" /> Cupons de desconto
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Crie códigos promocionais pra sua loja. Aplicáveis no checkout.
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg"
          style={{ background: '#00E5FF', color: '#0a0a0e', minHeight: 44, cursor: 'pointer' }}>
          <Plus size={14} /> Novo cupom
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
          Nenhum cupom criado ainda. Clique em "Novo cupom" pra começar.
        </div>
      )}

      {items && items.length > 0 && (
        <div className="rounded-lg overflow-hidden" style={{ background: '#111114', border: '1px solid #27272a' }}>
          <table className="w-full text-sm" style={{ color: '#fafafa' }}>
            <thead style={{ background: '#0a0a0e', color: '#a1a1aa', fontSize: 12 }}>
              <tr>
                <th className="text-left p-3">Código</th>
                <th className="text-left p-3">Tipo</th>
                <th className="text-right p-3">Valor</th>
                <th className="text-right p-3">Usos</th>
                <th className="text-left p-3">Status</th>
                <th className="text-right p-3 w-32"></th>
              </tr>
            </thead>
            <tbody>
              {items.map(c => (
                <tr key={c.id} style={{ borderTop: '1px solid #27272a' }}>
                  <td className="p-3 font-mono font-medium">{c.code}</td>
                  <td className="p-3" style={{ color: '#a1a1aa' }}>{TYPE_LABELS[c.type]}</td>
                  <td className="p-3 text-right">
                    {c.type === 'percentage' && `${c.value}%`}
                    {c.type === 'fixed' && `R$ ${(c.value / 100).toFixed(2).replace('.', ',')}`}
                    {c.type === 'free_shipping' && '—'}
                  </td>
                  <td className="p-3 text-right" style={{ color: '#a1a1aa' }}>
                    {c.used_count}{c.usage_limit !== null ? ` / ${c.usage_limit}` : ''}
                  </td>
                  <td className="p-3">
                    <span style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 4,
                      background: c.active ? 'rgba(34,197,94,0.1)' : 'rgba(161,161,170,0.1)',
                      color: c.active ? '#4ade80' : '#a1a1aa',
                      border: `1px solid ${c.active ? 'rgba(34,197,94,0.3)' : 'rgba(161,161,170,0.3)'}`,
                    }}>
                      {c.active ? 'Ativo' : 'Pausado'}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <button onClick={() => toggle(c)} aria-label={c.active ? 'Pausar' : 'Ativar'}
                      style={iconBtn}>
                      {c.active ? <PowerOff size={14} /> : <Power size={14} />}
                    </button>
                    <button onClick={() => remove(c)} aria-label="Remover"
                      style={{ ...iconBtn, color: '#f87171' }}>
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
        <CreateCouponModal
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); void load() }}
          fetchToken={fetchToken}
        />
      )}
    </div>
  )
}

const iconBtn: React.CSSProperties = {
  minHeight: 36, minWidth: 36, padding: 6,
  background: 'transparent', color: '#a1a1aa',
  border: 'none', borderRadius: 4, cursor: 'pointer',
}

function CreateCouponModal({ onClose, onCreated, fetchToken }: {
  onClose:    () => void
  onCreated:  () => void
  fetchToken: () => Promise<string | undefined>
}) {
  const [code, setCode] = useState('')
  const [type, setType] = useState<CouponType>('percentage')
  const [value, setValue] = useState('10')
  const [minOrder, setMinOrder] = useState('0')
  const [expiresAt, setExpiresAt] = useState('')
  const [usageLimit, setUsageLimit] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setBusy(true); setError(null)
    try {
      const token = await fetchToken()
      const valueNum = parseFloat(value) || 0
      const minOrderCents = Math.round((parseFloat(minOrder) || 0) * 100)
      const body: Record<string, unknown> = {
        code, type,
        value: type === 'fixed' ? Math.round(valueNum * 100) : valueNum,  // fixed → centavos
        min_order_cents: minOrderCents,
        description:     description || null,
        expires_at:      expiresAt ? new Date(expiresAt).toISOString() : null,
        usage_limit:     usageLimit ? parseInt(usageLimit) : null,
        active:          true,
      }
      const res = await fetch(`${BACKEND}/coupons`, {
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
        style={{ background: '#0d0d10', border: '1px solid #27272a', borderRadius: 12, width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column' }}>
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: '#27272a' }}>
          <h2 className="text-sm font-medium" style={{ color: '#fafafa' }}>Novo cupom</h2>
          <button onClick={onClose} disabled={busy} aria-label="Fechar"
            style={{ background: 'transparent', border: 'none', color: '#a1a1aa', cursor: 'pointer', minHeight: 44, minWidth: 44 }}>
            <X size={16} />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <FormField label="Código" hint="Ex: VAZZO10, FRETEGRATIS. Convertido pra maiúsculas.">
            <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="VAZZO10"
              style={fieldStyle} maxLength={32} />
          </FormField>
          <FormField label="Tipo">
            <select value={type} onChange={e => setType(e.target.value as CouponType)} style={fieldStyle}>
              <option value="percentage">Desconto %</option>
              <option value="fixed">Desconto R$ fixo</option>
              <option value="free_shipping">Frete grátis</option>
            </select>
          </FormField>
          {type !== 'free_shipping' && (
            <FormField label={type === 'percentage' ? 'Percentual (1-100)' : 'Valor R$'}>
              <input type="number" value={value} onChange={e => setValue(e.target.value)}
                min={type === 'percentage' ? 1 : 0} max={type === 'percentage' ? 100 : undefined}
                step={type === 'percentage' ? 1 : 0.01}
                style={fieldStyle} />
            </FormField>
          )}
          <FormField label="Pedido mínimo R$ (0 = sem mínimo)">
            <input type="number" value={minOrder} onChange={e => setMinOrder(e.target.value)} min={0} step={0.01} style={fieldStyle} />
          </FormField>
          <FormField label="Expira em (opcional)">
            <input type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} style={fieldStyle} />
          </FormField>
          <FormField label="Limite de usos (opcional)">
            <input type="number" value={usageLimit} onChange={e => setUsageLimit(e.target.value)} min={1} placeholder="Ilimitado" style={fieldStyle} />
          </FormField>
          <FormField label="Descrição interna (opcional)">
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Black Friday 2026" style={fieldStyle} />
          </FormField>
          {error && <div className="text-sm" style={{ color: '#f87171' }}>{error}</div>}
        </div>
        <div className="flex items-center justify-end gap-2 p-4 border-t" style={{ borderColor: '#27272a' }}>
          <button onClick={onClose} disabled={busy}
            style={{ padding: '10px 16px', minHeight: 44, background: 'transparent', color: '#a1a1aa', border: '1px solid #27272a', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
            Cancelar
          </button>
          <button onClick={submit} disabled={busy || code.length < 3}
            className="flex items-center gap-2"
            style={{ padding: '10px 20px', minHeight: 44, background: code.length < 3 ? '#1e1e24' : '#00E5FF', color: code.length < 3 ? '#52525b' : '#0a0a0e', border: 'none', borderRadius: 6, cursor: busy ? 'wait' : (code.length < 3 ? 'not-allowed' : 'pointer'), fontSize: 13, fontWeight: 500 }}>
            {busy ? <><Loader2 size={14} className="animate-spin" /> Criando…</> : <><Check size={14} /> Criar cupom</>}
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
