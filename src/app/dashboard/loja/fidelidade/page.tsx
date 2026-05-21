'use client'

/**
 * Programa de Fidelidade — admin UI.
 *
 * Gerencia níveis (bronze/prata/ouro/etc) e settings globais. Cliente
 * sobe automaticamente de nível conforme total gasto (recalculado via
 * hook em payments.service quando pedido vira 'paid').
 *
 * Endpoints:
 *   GET   /loyalty/settings           PATCH /loyalty/settings
 *   GET   /loyalty/tiers              POST  /loyalty/tiers
 *   PATCH /loyalty/tiers/:id          DELETE /loyalty/tiers/:id
 *   POST  /loyalty/seed-defaults
 *   GET   /loyalty/stats
 */

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import {
  Trophy, Loader2, ChevronLeft, Plus, Trash2, Save, X, Sparkles,
  Users, TrendingUp, Power, PowerOff, Edit3,
} from 'lucide-react'
import Link from 'next/link'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

interface LoyaltySettings {
  enabled:       boolean
  currencyLabel: string
  pointsPerReal: number
}

interface Tier {
  id:              string
  name:            string
  description:     string | null
  color:           string
  icon_emoji:      string | null
  min_spent_cents: number
  benefits:        Array<{ label: string; icon?: string }>
  display_order:   number
  active:          boolean
}

interface Stats {
  totalCustomers:  number
  totalSpentCents: number
  byTier:          Array<{ tierId: string | null; tierName: string; count: number; totalSpentCents: number }>
}

const brl = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function FidelidadePage() {
  const [settings, setSettings] = useState<LoyaltySettings>({ enabled: false, currencyLabel: 'pontos', pointsPerReal: 1 })
  const [tiers,    setTiers]    = useState<Tier[]>([])
  const [stats,    setStats]    = useState<Stats | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [editing,  setEditing]  = useState<Tier | null>(null)
  const [creating, setCreating] = useState(false)
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
      const [sRes, tRes, stRes] = await Promise.all([
        fetch(`${BACKEND}/loyalty/settings`, { headers }),
        fetch(`${BACKEND}/loyalty/tiers`,    { headers }),
        fetch(`${BACKEND}/loyalty/stats`,    { headers }),
      ])
      if (sRes.ok)  setSettings(await sRes.json())
      if (tRes.ok)  setTiers(await tRes.json())
      if (stRes.ok) setStats(await stRes.json())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [fetchToken])

  useEffect(() => { void load() }, [load])

  const saveSettings = async (next: LoyaltySettings) => {
    setSaving(true)
    try {
      const token = await fetchToken()
      const res = await fetch(`${BACKEND}/loyalty/settings`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setSettings(await res.json())
    } catch (e) { setError((e as Error).message) } finally { setSaving(false) }
  }

  const seedDefaults = async () => {
    if (!confirm('Criar 3 níveis padrão (Bronze, Prata, Ouro)?')) return
    setSaving(true)
    try {
      const token = await fetchToken()
      const res = await fetch(`${BACKEND}/loyalty/seed-defaults`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await load()
    } catch (e) { setError((e as Error).message) } finally { setSaving(false) }
  }

  const deleteTier = async (tier: Tier) => {
    if (!confirm(`Remover nível "${tier.name}"? Clientes nesse nível voltam pra Sem nível.`)) return
    try {
      const token = await fetchToken()
      const res = await fetch(`${BACKEND}/loyalty/tiers/${tier.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await load()
    } catch (e) { setError((e as Error).message) }
  }

  if (loading) {
    return (
      <div className="p-6 text-center" style={{ color: '#a1a1aa' }}>
        <Loader2 className="animate-spin inline-block mr-2" size={16} /> Carregando…
      </div>
    )
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
              <Trophy size={24} /> Programa de fidelidade
            </h1>
            <p className="text-xs text-zinc-500 mt-1">
              Cliente sobe de nível conforme gasta · benefícios escalonados
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Status toggle */}
      <div className="rounded-lg p-5" style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-zinc-100">
              {settings.enabled ? '⭐ Programa ATIVO' : 'Programa desativado'}
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              {settings.enabled
                ? 'Clientes sobem de nível automaticamente conforme compram'
                : 'Ative pra começar a categorizar clientes em níveis'}
            </p>
          </div>
          <Toggle checked={settings.enabled} onChange={v => saveSettings({ ...settings, enabled: v })} disabled={saving} />
        </div>
      </div>

      {/* Stats */}
      {stats && stats.totalCustomers > 0 && (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <StatCard icon={<Users size={16} />}      label="Clientes no programa" value={String(stats.totalCustomers)} />
          <StatCard icon={<TrendingUp size={16} />} label="Total gasto"          value={brl(stats.totalSpentCents)} />
          <StatCard icon={<Trophy size={16} />}     label="Tier topo"            value={stats.byTier.length > 0 ? stats.byTier[stats.byTier.length - 1].tierName : '—'} />
          <StatCard icon={<Sparkles size={16} />}   label="Ticket médio"         value={stats.totalCustomers > 0 ? brl(Math.round(stats.totalSpentCents / stats.totalCustomers)) : '—'} />
        </div>
      )}

      {/* Tiers */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-zinc-100">Níveis</h2>
          <div className="flex items-center gap-2">
            {tiers.length === 0 && (
              <button
                onClick={seedDefaults}
                disabled={saving}
                className="text-xs px-3 py-2 rounded font-medium inline-flex items-center gap-1 disabled:opacity-50"
                style={{ background: 'rgba(0,229,255,0.1)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.3)', minHeight: 36 }}>
                <Sparkles size={12} /> Criar 3 níveis padrão
              </button>
            )}
            <button
              onClick={() => setCreating(true)}
              className="text-xs px-3 py-2 rounded font-medium inline-flex items-center gap-1"
              style={{ background: '#00E5FF', color: '#0a0a0e', minHeight: 36 }}>
              <Plus size={12} /> Novo nível
            </button>
          </div>
        </div>

        {tiers.length === 0 ? (
          <div className="text-center py-12 rounded-lg" style={{ background: '#0a0a0e', border: '1px dashed #27272a' }}>
            <Trophy size={32} className="mx-auto text-zinc-700 mb-2" />
            <p className="text-sm text-zinc-500">Nenhum nível criado ainda</p>
            <p className="text-xs text-zinc-600 mt-1">Comece com os 3 níveis padrão ou crie do zero</p>
          </div>
        ) : (
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {tiers.map(t => (
              <TierCard
                key={t.id}
                tier={t}
                stats={stats?.byTier.find(b => b.tierId === t.id)}
                onEdit={() => setEditing(t)}
                onDelete={() => deleteTier(t)}
              />
            ))}
          </div>
        )}
      </div>

      {(editing || creating) && (
        <TierModal
          tier={editing}
          onClose={() => { setEditing(null); setCreating(false) }}
          onSaved={() => { setEditing(null); setCreating(false); void load() }}
          fetchToken={fetchToken}
        />
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg p-3" style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
      <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1.5">{icon} {label}</div>
      <p className="text-xl font-bold text-zinc-100 tabular-nums">{value}</p>
    </div>
  )
}

function TierCard({ tier, stats, onEdit, onDelete }: {
  tier:   Tier
  stats?: { count: number; totalSpentCents: number }
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="rounded-lg p-4 transition-all"
      style={{
        background: '#0a0a0e',
        border: `1px solid ${tier.active ? tier.color + '40' : '#1a1a1a'}`,
        opacity: tier.active ? 1 : 0.55,
      }}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 28 }}>{tier.icon_emoji ?? '⭐'}</span>
          <div>
            <h3 className="text-base font-semibold" style={{ color: tier.color }}>{tier.name}</h3>
            <p className="text-[10px] text-zinc-500">
              A partir de <strong>{brl(tier.min_spent_cents)}</strong>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onEdit} title="Editar" className="p-1.5 rounded hover:bg-zinc-800"
            style={{ minHeight: 32, minWidth: 32 }}>
            <Edit3 size={12} className="text-zinc-400" />
          </button>
          <button onClick={onDelete} title="Remover" className="p-1.5 rounded hover:bg-zinc-800"
            style={{ minHeight: 32, minWidth: 32 }}>
            <Trash2 size={12} className="text-red-400" />
          </button>
        </div>
      </div>

      {tier.description && (
        <p className="text-xs text-zinc-400 mb-3 italic">{tier.description}</p>
      )}

      {tier.benefits.length > 0 && (
        <ul className="space-y-1 mb-3">
          {tier.benefits.map((b, i) => (
            <li key={i} className="text-xs text-zinc-300 flex items-center gap-1.5">
              <span>{b.icon ?? '✓'}</span>{b.label}
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-2 border-t" style={{ borderColor: '#27272a' }}>
        <span>
          {stats ? `${stats.count} cliente${stats.count === 1 ? '' : 's'}` : '0 clientes'}
        </span>
        {stats && stats.totalSpentCents > 0 && (
          <span>{brl(stats.totalSpentCents)} acumulado</span>
        )}
      </div>
    </div>
  )
}

function TierModal({ tier, onClose, onSaved, fetchToken }: {
  tier:    Tier | null
  onClose: () => void
  onSaved: () => void
  fetchToken: () => Promise<string | undefined>
}) {
  const [name, setName] = useState(tier?.name ?? '')
  const [description, setDescription] = useState(tier?.description ?? '')
  const [icon, setIcon] = useState(tier?.icon_emoji ?? '⭐')
  const [color, setColor] = useState(tier?.color ?? '#a1a1aa')
  const [minSpent, setMinSpent] = useState(tier?.min_spent_cents ?? 0)
  const [order, setOrder] = useState(tier?.display_order ?? 0)
  const [active, setActive] = useState(tier?.active ?? true)
  const [benefits, setBenefits] = useState<Array<{ label: string; icon?: string }>>(tier?.benefits ?? [])
  const [newBenefit, setNewBenefit] = useState('')
  const [newBenefitIcon, setNewBenefitIcon] = useState('✓')

  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const save = async () => {
    if (!name.trim()) { setErr('Nome obrigatório'); return }
    setSaving(true); setErr(null)
    try {
      const token = await fetchToken()
      const body = {
        name:            name.trim(),
        description:     description.trim() || null,
        icon_emoji:      icon,
        color,
        min_spent_cents: minSpent,
        display_order:   order,
        active,
        benefits,
      }
      const url    = tier ? `${BACKEND}/loyalty/tiers/${tier.id}` : `${BACKEND}/loyalty/tiers`
      const method = tier ? 'PATCH' : 'POST'
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

  const addBenefit = () => {
    if (!newBenefit.trim()) return
    setBenefits([...benefits, { label: newBenefit.trim(), icon: newBenefitIcon }])
    setNewBenefit('')
    setNewBenefitIcon('✓')
  }

  const removeBenefit = (i: number) => {
    setBenefits(benefits.filter((_, idx) => idx !== i))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-lg rounded-lg p-5 max-h-[90vh] overflow-y-auto" style={{ background: '#09090b', border: '1px solid #27272a' }}>
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-semibold text-zinc-100">
            {tier ? 'Editar nível' : 'Novo nível'}
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

        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: '#0a0a0e', border: `2px solid ${color}30` }}>
            <span style={{ fontSize: 36 }}>{icon}</span>
            <div>
              <p className="text-sm font-semibold" style={{ color }}>{name || 'Nome do nível'}</p>
              <p className="text-[10px] text-zinc-500">A partir de {brl(minSpent)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Nome</label>
              <input
                value={name} onChange={e => setName(e.target.value)}
                placeholder="Ouro"
                className="w-full text-sm px-3 py-2 rounded outline-none"
                style={{ background: '#0a0a0e', color: '#fafafa', border: '1px solid #27272a', minHeight: 44 }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Emoji do badge</label>
              <input
                value={icon} onChange={e => setIcon(e.target.value)}
                placeholder="🥇" maxLength={4}
                className="w-full text-sm px-3 py-2 rounded outline-none text-center"
                style={{ background: '#0a0a0e', color: '#fafafa', border: '1px solid #27272a', minHeight: 44, fontSize: 24 }}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Descrição (opcional)</label>
            <input
              value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Clientes que mais compraram"
              className="w-full text-sm px-3 py-2 rounded outline-none"
              style={{ background: '#0a0a0e', color: '#fafafa', border: '1px solid #27272a', minHeight: 44 }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Total mínimo gasto (R$)</label>
              <input
                type="number" min="0" step="0.01"
                value={(minSpent / 100).toFixed(2)}
                onChange={e => setMinSpent(Math.round(parseFloat(e.target.value || '0') * 100))}
                className="w-full text-sm px-3 py-2 rounded outline-none"
                style={{ background: '#0a0a0e', color: '#fafafa', border: '1px solid #27272a', minHeight: 44 }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Cor do badge</label>
              <input
                type="color" value={color} onChange={e => setColor(e.target.value)}
                className="w-full text-sm px-3 py-2 rounded outline-none cursor-pointer"
                style={{ background: '#0a0a0e', border: '1px solid #27272a', minHeight: 44 }}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">Benefícios</label>
            {benefits.length > 0 && (
              <ul className="space-y-1.5 mb-2">
                {benefits.map((b, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-zinc-300 p-2 rounded" style={{ background: '#09090b', border: '1px solid #27272a' }}>
                    <span style={{ fontSize: 16 }}>{b.icon ?? '✓'}</span>
                    <span className="flex-1">{b.label}</span>
                    <button onClick={() => removeBenefit(i)} className="text-red-400">
                      <X size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <input
                value={newBenefitIcon}
                onChange={e => setNewBenefitIcon(e.target.value)}
                placeholder="✓"
                maxLength={4}
                className="w-12 text-sm px-2 py-2 rounded outline-none text-center"
                style={{ background: '#0a0a0e', color: '#fafafa', border: '1px solid #27272a', minHeight: 44 }}
              />
              <input
                value={newBenefit}
                onChange={e => setNewBenefit(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addBenefit())}
                placeholder="Ex: 10% off em todos os produtos"
                className="flex-1 text-sm px-3 py-2 rounded outline-none"
                style={{ background: '#0a0a0e', color: '#fafafa', border: '1px solid #27272a', minHeight: 44 }}
              />
              <button
                onClick={addBenefit}
                disabled={!newBenefit.trim()}
                className="text-xs px-3 py-2 rounded font-medium disabled:opacity-50"
                style={{ background: '#18181b', color: '#fafafa', border: '1px solid #27272a', minHeight: 44 }}>
                <Plus size={12} />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <label className="text-sm text-zinc-200">Nível ativo</label>
            <Toggle checked={active} onChange={setActive} />
          </div>
        </div>

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
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {tier ? 'Salvar' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      style={{
        width: '44px', height: '24px', boxSizing: 'border-box',
        background: checked ? '#00E5FF' : '#3f3f46',
        borderRadius: '9999px', position: 'relative',
        flexShrink: 0, cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 150ms',
        opacity: disabled ? 0.5 : 1,
      }}>
      <div style={{
        position: 'absolute', top: 2, left: checked ? 22 : 2,
        width: 20, height: 20, background: '#fff',
        borderRadius: '50%', transition: 'left 150ms',
      }} />
    </div>
  )
}
