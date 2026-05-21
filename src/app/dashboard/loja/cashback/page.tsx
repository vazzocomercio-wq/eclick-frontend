'use client'

/**
 * Cashback inteligente — admin UI.
 *
 * Configura earnPct, validade, regras de resgate. Mostra stats em tempo
 * real (total em circulação, clientes ativos, total resgatado).
 *
 * Endpoints:
 *   GET   /cashback/settings
 *   PATCH /cashback/settings
 *   GET   /cashback/stats
 *   GET   /cashback/balance/:email  (consulta admin)
 *   POST  /cashback/adjust          (ajuste manual +/-)
 */

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import {
  BarChart3, Loader2, Save, ChevronLeft, Eye, Wallet, TrendingUp, Users, Search, Plus, Minus,
} from 'lucide-react'
import Link from 'next/link'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

interface CashbackSettings {
  enabled:                  boolean
  earnPct:                  number
  expirationDays:           number
  minBalanceToUseCents:     number
  maxRedemptionPctPerOrder: number
  earnDelay:                'immediate' | 'after_delivery' | 'after_7_days'
}

interface Stats {
  totalInCirculationCents: number
  totalEarnedCents:        number
  totalRedeemedCents:      number
  activeCustomers:         number
}

const DEFAULT: CashbackSettings = {
  enabled:                  false,
  earnPct:                  3,
  expirationDays:           90,
  minBalanceToUseCents:     500,
  maxRedemptionPctPerOrder: 50,
  earnDelay:                'immediate',
}

const brl = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function CashbackPage() {
  const [settings, setSettings] = useState<CashbackSettings>(DEFAULT)
  const [stats,    setStats]    = useState<Stats | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [savedAt,  setSavedAt]  = useState<number | null>(null)
  const [error,    setError]    = useState<string | null>(null)

  const fetchToken = useCallback(async () => {
    const supabase = createClient()
    const { data: session } = await supabase.auth.getSession()
    return session.session?.access_token
  }, [])

  const load = useCallback(async () => {
    try {
      const token = await fetchToken()
      const headers = { Authorization: `Bearer ${token}` }
      const [sRes, stRes] = await Promise.all([
        fetch(`${BACKEND}/cashback/settings`, { headers }),
        fetch(`${BACKEND}/cashback/stats`,    { headers }),
      ])
      if (sRes.ok)  setSettings(await sRes.json())
      if (stRes.ok) setStats(await stRes.json())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [fetchToken])

  useEffect(() => { void load() }, [load])

  const handleSave = useCallback(async () => {
    setSaving(true)
    setError(null)
    try {
      const token = await fetchToken()
      const res = await fetch(`${BACKEND}/cashback/settings`, {
        method:  'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify(settings),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
      const next = await res.json()
      setSettings(next)
      setSavedAt(Date.now())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }, [fetchToken, settings])

  if (loading) {
    return (
      <div className="p-6 text-center" style={{ color: '#a1a1aa' }}>
        <Loader2 className="animate-spin inline-block mr-2" size={16} /> Carregando…
      </div>
    )
  }

  // Preview de cashback num pedido fictício de R$ 500
  const sampleOrderCents = 50000
  const sampleEarnCents  = Math.round((sampleOrderCents * settings.earnPct) / 100)

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      <div>
        <Link href="/dashboard/loja" className="text-xs text-zinc-500 hover:text-cyan-400 inline-flex items-center gap-1 mb-2">
          <ChevronLeft size={12} /> Voltar pro hub
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-white text-3xl font-semibold flex items-center gap-2">
              <Wallet size={24} /> Cashback inteligente
            </h1>
            <p className="text-xs text-zinc-500 mt-1">
              Cliente ganha % do valor pago de volta em saldo · pode usar em compras futuras
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
            style={{ background: '#00E5FF', color: '#0a0a0e', minHeight: 44 }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Salvar
          </button>
        </div>
        {savedAt && (
          <p className="text-xs mt-2" style={{ color: '#22c55e' }}>
            ✓ Salvo às {new Date(savedAt).toLocaleTimeString('pt-BR')}
          </p>
        )}
        {error && <p className="text-xs mt-2" style={{ color: '#ef4444' }}>✗ {error}</p>}
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <StatCard icon={<Wallet size={16} />} label="Em circulação"     value={brl(stats.totalInCirculationCents)} hint="Saldo disponível pra resgate" />
          <StatCard icon={<TrendingUp size={16} />} label="Total acumulado" value={brl(stats.totalEarnedCents)}      hint="Já distribuído" />
          <StatCard icon={<Minus size={16} />} label="Já resgatado"        value={brl(stats.totalRedeemedCents)}    hint="Usado em compras" />
          <StatCard icon={<Users size={16} />} label="Clientes com saldo"  value={String(stats.activeCustomers)}    hint={`${settings.enabled ? 'Ativo' : 'Desativado'}`} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* SETTINGS */}
        <div className="space-y-5">
          <Card title="Status do cashback">
            <Toggle
              label={settings.enabled ? 'Cashback ATIVO — clientes acumulam saldo' : 'Cashback DESATIVADO — nenhum acúmulo'}
              checked={settings.enabled}
              onChange={v => setSettings(s => ({ ...s, enabled: v }))}
            />
            {!settings.enabled && (
              <p className="text-xs text-zinc-500 mt-3">
                💡 Mesmo com cashback desativado, os saldos existentes ficam preservados. Ative pra começar a creditar nos próximos pedidos.
              </p>
            )}
          </Card>

          {settings.enabled && (
            <>
              <Card title="Acúmulo">
                <div className="space-y-4">
                  <Slider
                    label="% de cashback em cada pedido"
                    unit="%"
                    min={0} max={15} step={0.5}
                    value={settings.earnPct}
                    onChange={v => setSettings(s => ({ ...s, earnPct: v }))}
                  />
                  <Slider
                    label="Validade do saldo"
                    unit=" dias"
                    min={0} max={365}
                    value={settings.expirationDays}
                    onChange={v => setSettings(s => ({ ...s, expirationDays: v }))}
                    hint={settings.expirationDays === 0 ? 'Sem expiração' : `Saldo expira ${settings.expirationDays} dias após ganhar`}
                  />
                  <Field label="Quando creditar">
                    <select
                      value={settings.earnDelay}
                      onChange={e => setSettings(s => ({ ...s, earnDelay: e.target.value as CashbackSettings['earnDelay'] }))}
                      className="w-full text-sm px-3 py-2 rounded outline-none"
                      style={{ background: '#0a0a0e', color: '#fafafa', border: '1px solid #27272a', minHeight: 44 }}>
                      <option value="immediate">Imediato — assim que o pagamento confirma</option>
                      <option value="after_delivery" disabled>Após entrega (em breve)</option>
                      <option value="after_7_days" disabled>7 dias após pagamento (em breve)</option>
                    </select>
                  </Field>
                </div>
              </Card>

              <Card title="Regras de resgate">
                <div className="space-y-4">
                  <Slider
                    label="% máximo do pedido pagável com cashback"
                    unit="%"
                    min={0} max={100}
                    value={settings.maxRedemptionPctPerOrder}
                    onChange={v => setSettings(s => ({ ...s, maxRedemptionPctPerOrder: v }))}
                    hint={`Cliente pode usar até ${settings.maxRedemptionPctPerOrder}% do valor do pedido em cashback`}
                  />
                  <Field label="Saldo mínimo pra resgatar">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-500">R$</span>
                      <input
                        type="number" min="0" step="0.50"
                        value={(settings.minBalanceToUseCents / 100).toFixed(2)}
                        onChange={e => setSettings(s => ({ ...s, minBalanceToUseCents: Math.round(parseFloat(e.target.value || '0') * 100) }))}
                        className="flex-1 text-sm px-3 py-2 rounded outline-none"
                        style={{ background: '#0a0a0e', color: '#fafafa', border: '1px solid #27272a', minHeight: 44 }}
                      />
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-1">
                      Cliente só vê opção de usar cashback quando tem pelo menos esse valor.
                    </p>
                  </Field>
                </div>
              </Card>

              {/* Consulta + ajuste manual */}
              <CustomerLookup fetchToken={fetchToken} />
            </>
          )}
        </div>

        {/* PREVIEW */}
        <div className="space-y-4">
          <Card title={<><Eye size={14} className="inline mr-1" /> Preview ao vivo</>}>
            <p className="text-xs text-zinc-500 mb-3">
              Como aparece pro cliente em um pedido de <strong className="text-zinc-300">{brl(sampleOrderCents)}</strong>:
            </p>

            <div className="rounded-lg p-4 space-y-3" style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
              {settings.enabled ? (
                <>
                  <div>
                    <p className="text-xs text-zinc-500 mb-1">Cliente vai ganhar</p>
                    <p className="text-2xl font-bold" style={{ color: '#22c55e' }}>
                      {brl(sampleEarnCents)} <span className="text-xs font-normal text-zinc-500">de cashback</span>
                    </p>
                  </div>
                  {settings.expirationDays > 0 && (
                    <p className="text-[11px] text-zinc-500">
                      ⏳ Saldo expira em {settings.expirationDays} dias
                    </p>
                  )}
                  <div className="border-t pt-3" style={{ borderColor: '#27272a' }}>
                    <p className="text-[11px] text-zinc-500">No próximo pedido, ele poderá:</p>
                    <p className="text-xs text-zinc-300 mt-1">
                      Usar até <strong style={{ color: '#22c55e' }}>{settings.maxRedemptionPctPerOrder}%</strong> do valor em cashback
                      {settings.minBalanceToUseCents > 0 && (
                        <span className="text-zinc-500">{' '}· mínimo {brl(settings.minBalanceToUseCents)} de saldo</span>
                      )}
                    </p>
                  </div>
                </>
              ) : (
                <p className="text-sm text-zinc-500 text-center py-6">
                  Cashback desativado<br />
                  <span className="text-xs">Ative no toggle acima pra começar</span>
                </p>
              )}
            </div>

            <p className="text-xs text-zinc-500 mt-3">
              💡 Cliente que paga pelo gateway (MP/Stripe) recebe o cashback automaticamente ao confirmar pagamento.
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StatCard({ icon, label, value, hint }: {
  icon: React.ReactNode; label: string; value: string; hint?: string
}) {
  return (
    <div className="rounded-lg p-3" style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
      <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1.5">
        {icon} {label}
      </div>
      <p className="text-xl font-bold text-zinc-100 tabular-nums">{value}</p>
      {hint && <p className="text-[10px] text-zinc-600 mt-1">{hint}</p>}
    </div>
  )
}

function Card({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg p-5" style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
      <h2 className="text-sm font-medium text-zinc-100 mb-3">{title}</h2>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm text-zinc-200 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer" style={{ minHeight: 44 }}>
      <span className="text-sm text-zinc-200">{label}</span>
      <div
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{
          width: '44px', height: '24px', boxSizing: 'border-box',
          background: checked ? '#00E5FF' : '#3f3f46',
          borderRadius: '9999px', position: 'relative',
          flexShrink: 0, cursor: 'pointer',
          transition: 'background 150ms',
        }}>
        <div style={{
          position: 'absolute', top: 2, left: checked ? 22 : 2,
          width: 20, height: 20, background: '#fff',
          borderRadius: '50%', transition: 'left 150ms',
        }} />
      </div>
    </label>
  )
}

function Slider({ label, unit, min, max, step = 1, value, onChange, hint }: {
  label: string; unit: string
  min: number; max: number; step?: number; value: number
  onChange: (v: number) => void
  hint?: string
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-zinc-200">{label}</span>
        <span className="text-sm font-medium tabular-nums" style={{ color: '#00E5FF' }}>
          {value}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full"
        style={{ accentColor: '#00E5FF' }}
      />
      {hint && <p className="text-[11px] text-zinc-500 mt-1">{hint}</p>}
    </div>
  )
}

/** Lookup de cliente + ajuste manual de saldo. */
function CustomerLookup({ fetchToken }: { fetchToken: () => Promise<string | undefined> }) {
  const [email, setEmail] = useState('')
  const [balance, setBalance] = useState<{ balance_cents: number; total_earned_cents: number; total_redeemed_cents: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustReason, setAdjustReason] = useState('')

  const lookup = async () => {
    if (!email.trim()) return
    setLoading(true); setErr(null); setBalance(null)
    try {
      const token = await fetchToken()
      const res = await fetch(`${BACKEND}/cashback/balance/${encodeURIComponent(email.trim())}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setBalance(data ?? { balance_cents: 0, total_earned_cents: 0, total_redeemed_cents: 0 })
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const adjust = async (sign: 1 | -1) => {
    const amount = parseFloat(adjustAmount || '0')
    if (!amount || amount <= 0) return
    setLoading(true); setErr(null)
    try {
      const token = await fetchToken()
      const res = await fetch(`${BACKEND}/cashback/adjust`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          email:       email.trim(),
          amountCents: sign * Math.round(amount * 100),
          reason:      adjustReason.trim() || (sign > 0 ? 'Ajuste manual +' : 'Ajuste manual -'),
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
      const data = await res.json()
      setBalance(data.balance ?? null)
      setAdjustAmount('')
      setAdjustReason('')
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card title="Consultar saldo · ajustar manualmente">
      <div className="space-y-3">
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && lookup()}
            placeholder="email@cliente.com"
            className="flex-1 text-sm px-3 py-2 rounded outline-none"
            style={{ background: '#0a0a0e', color: '#fafafa', border: '1px solid #27272a', minHeight: 44 }}
          />
          <button
            onClick={lookup}
            disabled={!email.trim() || loading}
            className="text-sm px-4 py-2 rounded font-medium disabled:opacity-50 inline-flex items-center gap-2"
            style={{ background: '#18181b', color: '#fafafa', border: '1px solid #27272a', minHeight: 44 }}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Buscar
          </button>
        </div>

        {err && <p className="text-xs" style={{ color: '#ef4444' }}>{err}</p>}

        {balance && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Mini label="Saldo"     value={brl(balance.balance_cents)}        color="#22c55e" />
              <Mini label="Acumulado" value={brl(balance.total_earned_cents)}    color="#a1a1aa" />
              <Mini label="Resgatado" value={brl(balance.total_redeemed_cents)}  color="#a1a1aa" />
            </div>

            <div className="border-t pt-3 space-y-2" style={{ borderColor: '#27272a' }}>
              <p className="text-xs text-zinc-500">Ajuste manual de saldo:</p>
              <input
                type="number" min="0" step="0.50"
                value={adjustAmount}
                onChange={e => setAdjustAmount(e.target.value)}
                placeholder="Valor em R$"
                className="w-full text-sm px-3 py-2 rounded outline-none"
                style={{ background: '#0a0a0e', color: '#fafafa', border: '1px solid #27272a', minHeight: 44 }}
              />
              <input
                value={adjustReason}
                onChange={e => setAdjustReason(e.target.value)}
                placeholder="Motivo (opcional)"
                className="w-full text-sm px-3 py-2 rounded outline-none"
                style={{ background: '#0a0a0e', color: '#fafafa', border: '1px solid #27272a', minHeight: 44 }}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => adjust(1)}
                  disabled={!adjustAmount || loading}
                  className="flex-1 text-sm py-2 rounded font-medium disabled:opacity-50 inline-flex items-center justify-center gap-1"
                  style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', minHeight: 44 }}>
                  <Plus size={12} /> Adicionar
                </button>
                <button
                  onClick={() => adjust(-1)}
                  disabled={!adjustAmount || loading}
                  className="flex-1 text-sm py-2 rounded font-medium disabled:opacity-50 inline-flex items-center justify-center gap-1"
                  style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', minHeight: 44 }}>
                  <Minus size={12} /> Subtrair
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </Card>
  )
}

function Mini({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded p-2" style={{ background: '#09090b', border: '1px solid #18181b' }}>
      <p className="text-[10px] text-zinc-500">{label}</p>
      <p className="text-sm font-bold tabular-nums" style={{ color }}>{value}</p>
    </div>
  )
}
