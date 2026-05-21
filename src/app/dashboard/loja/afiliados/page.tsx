'use client'

/**
 * Programa de Afiliados — dashboard do lojista.
 *
 * 3 abas:
 *  - Afiliados: lista com filtro por status, aprovar/rejeitar/suspender,
 *    ver detalhes (override de comissão, link copiar)
 *  - Comissões: fila pra pagamento (pending/approved/paid)
 *  - Configurações: % default, cookie days, refund window, modo aprovação
 */

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import {
  Users, Loader2, ChevronLeft, AlertCircle, Check, X, Power, PowerOff,
  DollarSign, Settings as SettingsIcon, Copy, Search, Save,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

interface Affiliate {
  id:                     string
  code:                   string
  name:                   string
  email:                  string
  phone:                  string | null
  doc:                    string | null
  custom_commission_pct:  number | null
  status:                 'pending' | 'approved' | 'rejected' | 'suspended'
  approved_at:            string | null
  rejected_reason:        string | null
  total_clicks:           number
  total_orders:           number
  total_earned_cents:     number
  total_paid_cents:       number
  last_login_at:          string | null
  created_at:             string
}

interface Commission {
  id:                string
  affiliate_id:      string
  affiliate_name?:   string
  affiliate_code?:   string
  order_id:          string
  order_total_cents: number
  commission_pct:    number
  amount_cents:      number
  status:            string
  approved_at:       string | null
  paid_at:           string | null
  created_at:        string
}

interface Settings {
  enabled:              boolean
  defaultCommissionPct: number
  cookieDays:           number
  refundWindowDays:     number
  approvalMode:         'open' | 'invite_only'
  minWithdrawCents:     number
  allowSelfPurchase:    boolean
}

const STATUS_LABEL: Record<string, string> = {
  pending:   'Aguardando',
  approved:  'Aprovado',
  rejected:  'Rejeitado',
  suspended: 'Suspenso',
}
const STATUS_COLOR: Record<string, string> = {
  pending:   '#f59e0b',
  approved:  '#22c55e',
  rejected:  '#ef4444',
  suspended: '#71717a',
}

const COMM_STATUS: Record<string, { label: string; color: string }> = {
  pending:  { label: 'Pendente (refund window)', color: '#f59e0b' },
  approved: { label: 'Aprovada (pagar)',          color: '#3b82f6' },
  paid:     { label: 'Paga',                       color: '#22c55e' },
  rejected: { label: 'Rejeitada',                  color: '#ef4444' },
  refunded: { label: 'Reembolsada',                color: '#71717a' },
}

const brl = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

type Tab = 'affiliates' | 'commissions' | 'settings'

export default function AfiliadosPage() {
  const [tab, setTab] = useState<Tab>('affiliates')

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-5">
      <div>
        <Link href="/dashboard/loja" className="text-xs text-zinc-500 hover:text-cyan-400 inline-flex items-center gap-1 mb-2">
          <ChevronLeft size={12} /> Voltar pro hub
        </Link>
        <h1 className="text-white text-3xl font-semibold flex items-center gap-2">
          <Users size={24} /> Programa de Afiliados
        </h1>
        <p className="text-xs text-zinc-500 mt-1">
          Pessoas indicam sua loja e ganham % por venda · inspirado em Shopee/TikTok/ML
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b" style={{ borderColor: '#27272a' }}>
        <TabButton active={tab === 'affiliates'}  onClick={() => setTab('affiliates')}  icon={<Users size={14} />}        label="Afiliados" />
        <TabButton active={tab === 'commissions'} onClick={() => setTab('commissions')} icon={<DollarSign size={14} />}   label="Comissões" />
        <TabButton active={tab === 'settings'}    onClick={() => setTab('settings')}    icon={<SettingsIcon size={14} />} label="Configurações" />
      </div>

      {tab === 'affiliates'  && <AffiliatesTab  />}
      {tab === 'commissions' && <CommissionsTab />}
      {tab === 'settings'    && <SettingsTab    />}
    </div>
  )
}

function TabButton({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string
}) {
  return (
    <button onClick={onClick}
      className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all"
      style={{
        color: active ? '#00E5FF' : '#a1a1aa',
        borderBottom: `2px solid ${active ? '#00E5FF' : 'transparent'}`,
        marginBottom: -1,
        minHeight: 44,
      }}>
      {icon} {label}
    </button>
  )
}

// ── Aba Afiliados ────────────────────────────────────────────────────

function AffiliatesTab() {
  const [list, setList] = useState<Affiliate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('')

  const fetchToken = useCallback(async () => {
    const supabase = createClient()
    const { data: session } = await supabase.auth.getSession()
    return session.session?.access_token
  }, [])

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const token = await fetchToken()
      const params = new URLSearchParams({ limit: '100' })
      if (filter) params.set('status', filter)
      const res = await fetch(`${BACKEND}/affiliates?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { affiliates: Affiliate[]; total: number }
      setList(data.affiliates ?? [])
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }, [fetchToken, filter])

  useEffect(() => { void load() }, [load])

  const action = async (id: string, what: 'approve' | 'reject' | 'suspend') => {
    try {
      const token = await fetchToken()
      const res = await fetch(`${BACKEND}/affiliates/${id}/${what}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: what === 'reject' ? JSON.stringify({ reason: prompt('Motivo (opcional):') ?? '' }) : '{}',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await load()
    } catch (e) { setError((e as Error).message) }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <FilterChip label="Todos"      value=""          current={filter} onClick={setFilter} />
        <FilterChip label="Aguardando" value="pending"   current={filter} onClick={setFilter} />
        <FilterChip label="Aprovados"  value="approved"  current={filter} onClick={setFilter} />
        <FilterChip label="Rejeitados" value="rejected"  current={filter} onClick={setFilter} />
        <FilterChip label="Suspensos"  value="suspended" current={filter} onClick={setFilter} />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <div className="text-center py-12 text-zinc-500">
          <Loader2 className="animate-spin inline-block" size={20} />
        </div>
      ) : list.length === 0 ? (
        <div className="text-center py-12 rounded-lg" style={{ background: '#0a0a0e', border: '1px dashed #27272a' }}>
          <Users size={32} className="mx-auto text-zinc-700 mb-2" />
          <p className="text-sm text-zinc-500">
            {filter ? `Nenhum afiliado "${STATUS_LABEL[filter] ?? filter}"` : 'Nenhum afiliado cadastrado ainda'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map(a => (
            <AffiliateRow key={a.id} affiliate={a} onAction={action} />
          ))}
        </div>
      )}
    </div>
  )
}

function FilterChip({ label, value, current, onClick }: {
  label: string; value: string; current: string; onClick: (v: string) => void
}) {
  const active = current === value
  return (
    <button onClick={() => onClick(value)}
      className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
      style={{
        background: active ? '#00E5FF' : '#0a0a0e',
        color:      active ? '#0a0a0e' : '#fafafa',
        border:     `1px solid ${active ? '#00E5FF' : '#27272a'}`,
        minHeight: 36,
      }}>
      {label}
    </button>
  )
}

function AffiliateRow({ affiliate, onAction }: { affiliate: Affiliate; onAction: (id: string, what: 'approve' | 'reject' | 'suspend') => void }) {
  const color = STATUS_COLOR[affiliate.status] ?? '#71717a'

  return (
    <div className="rounded-lg p-3 grid gap-3 items-center"
      style={{ background: '#0a0a0e', border: `1px solid ${color}30`, gridTemplateColumns: 'auto 1fr auto auto' }}>
      <span className="text-[10px] font-semibold uppercase px-2 py-1 rounded whitespace-nowrap"
        style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}>
        {STATUS_LABEL[affiliate.status]}
      </span>
      <div className="min-w-0">
        <p className="text-sm text-zinc-100">
          <strong>{affiliate.name}</strong>
          <span className="text-zinc-500"> · {affiliate.email}</span>
        </p>
        <p className="text-[11px] text-zinc-500">
          Code: <strong className="text-cyan-400 font-mono">{affiliate.code}</strong>
          {affiliate.custom_commission_pct != null && <> · <span style={{ color: '#a78bfa' }}>{affiliate.custom_commission_pct}% custom</span></>}
          {' · '}
          <span style={{ color: '#22c55e' }}>{affiliate.total_clicks}</span> cliques · <span style={{ color: '#22c55e' }}>{affiliate.total_orders}</span> vendas · {brl(affiliate.total_earned_cents)} ganho
        </p>
        {affiliate.rejected_reason && (
          <p className="text-[10px] text-red-400 mt-1 italic">Motivo: {affiliate.rejected_reason}</p>
        )}
      </div>

      <div className="flex items-center gap-1">
        {affiliate.status === 'pending' && (
          <>
            <button onClick={() => onAction(affiliate.id, 'approve')}
              className="text-xs px-3 py-2 rounded font-semibold inline-flex items-center gap-1"
              style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', minHeight: 36 }}>
              <Check size={12} /> Aprovar
            </button>
            <button onClick={() => onAction(affiliate.id, 'reject')}
              className="text-xs px-3 py-2 rounded font-medium inline-flex items-center gap-1"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', minHeight: 36 }}>
              <X size={12} /> Rejeitar
            </button>
          </>
        )}
        {affiliate.status === 'approved' && (
          <button onClick={() => onAction(affiliate.id, 'suspend')}
            className="text-xs px-3 py-2 rounded font-medium inline-flex items-center gap-1"
            style={{ background: '#18181b', color: '#a1a1aa', border: '1px solid #27272a', minHeight: 36 }}>
            <PowerOff size={12} /> Suspender
          </button>
        )}
        {affiliate.status === 'suspended' && (
          <button onClick={() => onAction(affiliate.id, 'approve')}
            className="text-xs px-3 py-2 rounded font-medium inline-flex items-center gap-1"
            style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', minHeight: 36 }}>
            <Power size={12} /> Reativar
          </button>
        )}
      </div>
    </div>
  )
}

// ── Aba Comissões ────────────────────────────────────────────────────

function CommissionsTab() {
  const [list, setList] = useState<Commission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('approved')  // default: a pagar
  const [busy, setBusy] = useState<string | null>(null)

  const fetchToken = useCallback(async () => {
    const supabase = createClient()
    const { data: session } = await supabase.auth.getSession()
    return session.session?.access_token
  }, [])

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const token = await fetchToken()
      const params = new URLSearchParams({ limit: '100' })
      if (filter) params.set('status', filter)
      const res = await fetch(`${BACKEND}/affiliates/commissions?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { commissions: Commission[]; total: number }
      setList(data.commissions ?? [])
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }, [fetchToken, filter])

  useEffect(() => { void load() }, [load])

  const markPaid = async (id: string) => {
    const notes = prompt('Notas/comprovante (opcional):') ?? ''
    setBusy(id)
    try {
      const token = await fetchToken()
      const res = await fetch(`${BACKEND}/affiliates/commissions/${id}/mark-paid`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await load()
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(null) }
  }

  // Soma total das aprovadas (a pagar)
  const totalToPay = list.filter(c => c.status === 'approved').reduce((s, c) => s + c.amount_cents, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <FilterChip label="A pagar (aprovadas)" value="approved" current={filter} onClick={setFilter} />
        <FilterChip label="Pendentes (refund window)" value="pending"  current={filter} onClick={setFilter} />
        <FilterChip label="Pagas"     value="paid"     current={filter} onClick={setFilter} />
        <FilterChip label="Rejeitadas" value="rejected" current={filter} onClick={setFilter} />
        <FilterChip label="Reembolsadas" value="refunded" current={filter} onClick={setFilter} />
        <FilterChip label="Todas" value="" current={filter} onClick={setFilter} />
        {filter === 'approved' && totalToPay > 0 && (
          <span className="text-sm font-bold ml-auto px-3 py-1.5 rounded" style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>
            Total a pagar: {brl(totalToPay)}
          </span>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <div className="text-center py-12 text-zinc-500">
          <Loader2 className="animate-spin inline-block" size={20} />
        </div>
      ) : list.length === 0 ? (
        <div className="text-center py-12 rounded-lg" style={{ background: '#0a0a0e', border: '1px dashed #27272a' }}>
          <DollarSign size={32} className="mx-auto text-zinc-700 mb-2" />
          <p className="text-sm text-zinc-500">Nenhuma comissão nesta categoria</p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map(c => {
            const meta = COMM_STATUS[c.status] ?? { label: c.status, color: '#71717a' }
            return (
              <div key={c.id} className="rounded-lg p-3 grid gap-3 items-center"
                style={{ background: '#0a0a0e', border: `1px solid ${meta.color}30`, gridTemplateColumns: 'auto 1fr auto auto' }}>
                <span className="text-[10px] font-semibold uppercase px-2 py-1 rounded whitespace-nowrap"
                  style={{ background: `${meta.color}20`, color: meta.color, border: `1px solid ${meta.color}40` }}>
                  {meta.label}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-zinc-100">
                    <strong>{c.affiliate_name ?? '?'}</strong>
                    <span className="text-zinc-500"> · code: {c.affiliate_code ?? '?'}</span>
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    Pedido #{c.order_id.slice(0, 8)}{' · '}
                    {brl(c.order_total_cents)} × {c.commission_pct}% = <strong style={{ color: '#22c55e' }}>{brl(c.amount_cents)}</strong>
                    {' · '}
                    {new Date(c.created_at).toLocaleDateString('pt-BR')}
                    {c.paid_at && <> · pago em {new Date(c.paid_at).toLocaleDateString('pt-BR')}</>}
                  </p>
                </div>
                {c.status === 'approved' && (
                  <button onClick={() => markPaid(c.id)} disabled={busy === c.id}
                    className="text-xs px-3 py-2 rounded font-semibold inline-flex items-center gap-1 disabled:opacity-50"
                    style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', minHeight: 36 }}>
                    {busy === c.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                    Marcar pago
                  </button>
                )}
                <span className="text-sm font-bold text-right" style={{ color: meta.color, minWidth: 80 }}>
                  {brl(c.amount_cents)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Aba Settings ────────────────────────────────────────────────────

function SettingsTab() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const fetchToken = useCallback(async () => {
    const supabase = createClient()
    const { data: session } = await supabase.auth.getSession()
    return session.session?.access_token
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        const token = await fetchToken()
        const res = await fetch(`${BACKEND}/affiliates/settings`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        setSettings(await res.json())
      } catch (e) { setError((e as Error).message) }
      finally { setLoading(false) }
    })()
  }, [fetchToken])

  const save = async () => {
    if (!settings) return
    setSaving(true); setError(null)
    try {
      const token = await fetchToken()
      const res = await fetch(`${BACKEND}/affiliates/settings`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setSettings(await res.json())
      setSavedAt(Date.now())
    } catch (e) { setError((e as Error).message) }
    finally { setSaving(false) }
  }

  if (loading || !settings) {
    return <div className="text-center py-12 text-zinc-500"><Loader2 className="animate-spin inline-block" size={20} /></div>
  }

  return (
    <div className="space-y-5 max-w-2xl">
      {error && (
        <div className="p-3 rounded text-sm text-red-400" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
          {error}
        </div>
      )}
      {savedAt && <p className="text-xs" style={{ color: '#22c55e' }}>✓ Salvo às {new Date(savedAt).toLocaleTimeString('pt-BR')}</p>}

      <Card title="Status do programa">
        <Toggle
          label={settings.enabled ? 'Programa ATIVO — afiliados podem se cadastrar e ganhar comissão' : 'Programa desativado'}
          checked={settings.enabled}
          onChange={v => setSettings({ ...settings, enabled: v })}
        />
      </Card>

      {settings.enabled && (
        <>
          <Card title="Comissão padrão">
            <Slider label="% sobre o valor do pedido" unit="%" min={0} max={50}
              value={settings.defaultCommissionPct}
              onChange={v => setSettings({ ...settings, defaultCommissionPct: v })} />
            <p className="text-[11px] text-zinc-500 mt-1">
              Esse % vale pra todos os afiliados. Cada afiliado pode ter % custom override.
            </p>
          </Card>

          <Card title="Janelas">
            <div className="space-y-4">
              <Slider label="Cookie de atribuição" unit=" dias" min={1} max={90}
                value={settings.cookieDays}
                onChange={v => setSettings({ ...settings, cookieDays: v })}
                hint="Cliente clica no link do afiliado → tem N dias pra comprar e ainda contar" />
              <Slider label="Refund window (até comissão virar paga)" unit=" dias" min={0} max={90}
                value={settings.refundWindowDays}
                onChange={v => setSettings({ ...settings, refundWindowDays: v })}
                hint="Tempo de proteção contra cancelamento. Após esse período, comissão aprovada pra pagamento" />
            </div>
          </Card>

          <Card title="Cadastro">
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Modo de aprovação</label>
                <select
                  value={settings.approvalMode}
                  onChange={e => setSettings({ ...settings, approvalMode: e.target.value as 'open' | 'invite_only' })}
                  className="w-full text-sm px-3 py-2 rounded outline-none"
                  style={{ background: '#0a0a0e', color: '#fafafa', border: '1px solid #27272a', minHeight: 44 }}>
                  <option value="open">Aberto — qualquer um se cadastra (você aprova depois)</option>
                  <option value="invite_only">Apenas convidados — só você cria afiliados</option>
                </select>
              </div>

              <Toggle
                label="Permitir afiliado comprar pelo próprio link (auto-compra)"
                checked={settings.allowSelfPurchase}
                onChange={v => setSettings({ ...settings, allowSelfPurchase: v })}
              />
            </div>
          </Card>

          <Card title="Pagamentos">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Saque mínimo (R$)</label>
              <input type="number" min="0" step="0.50"
                value={(settings.minWithdrawCents / 100).toFixed(2)}
                onChange={e => setSettings({ ...settings, minWithdrawCents: Math.round(parseFloat(e.target.value || '0') * 100) })}
                className="w-full text-sm px-3 py-2 rounded outline-none"
                style={{ background: '#0a0a0e', color: '#fafafa', border: '1px solid #27272a', minHeight: 44 }} />
              <p className="text-[11px] text-zinc-500 mt-1">
                Afiliado só pode solicitar saque a partir desse valor acumulado em comissões aprovadas
              </p>
            </div>
          </Card>
        </>
      )}

      <button onClick={save} disabled={saving}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold disabled:opacity-50"
        style={{ background: '#00E5FF', color: '#0a0a0e', minHeight: 44 }}>
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        Salvar configurações
      </button>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg p-5" style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
      <h2 className="text-sm font-medium text-zinc-100 mb-3">{title}</h2>
      {children}
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer" style={{ minHeight: 44 }}>
      <span className="text-sm text-zinc-200">{label}</span>
      <div role="switch" aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{
          width: '44px', height: '24px', boxSizing: 'border-box',
          background: checked ? '#00E5FF' : '#3f3f46',
          borderRadius: '9999px', position: 'relative',
          flexShrink: 0, cursor: 'pointer', transition: 'background 150ms',
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

function Slider({ label, unit, min, max, value, onChange, hint }: {
  label: string; unit: string; min: number; max: number; value: number;
  onChange: (v: number) => void; hint?: string
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-zinc-200">{label}</span>
        <span className="text-sm font-medium tabular-nums" style={{ color: '#00E5FF' }}>{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={1} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full" style={{ accentColor: '#00E5FF' }} />
      {hint && <p className="text-[11px] text-zinc-500 mt-1">{hint}</p>}
    </div>
  )
}
