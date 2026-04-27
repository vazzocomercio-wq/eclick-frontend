'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import {
  Search, RefreshCw, Users, CheckCircle2, AlertTriangle, XCircle,
  Phone, Mail, MessageCircle, Sparkles, ScanLine,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// ── types ─────────────────────────────────────────────────────────────────────

type Customer = {
  id: string
  display_name: string | null
  phone: string | null
  email: string | null
  whatsapp_id: string | null
  ml_buyer_id: string | null
  cpf: string | null
  cnpj: string | null
  total_purchases: number
  total_conversations: number
  first_contact_at: string
  last_contact_at: string
  last_channel: string | null
  enrichment_status: string | null
  enriched_at: string | null
  validated_phone: boolean
  validated_whatsapp: boolean
  validated_email: boolean
}

type Filters = {
  search:            string
  has_cpf:           boolean
  has_phone:         boolean
  has_whatsapp:      boolean
  has_email:         boolean
  enrichment_status: string
}

const DEFAULT_FILTERS: Filters = {
  search: '', has_cpf: false, has_phone: false, has_whatsapp: false, has_email: false, enrichment_status: '',
}

// ── helpers ───────────────────────────────────────────────────────────────────

function relTime(iso: string | null) {
  if (!iso) return '—'
  const d = Date.now() - new Date(iso).getTime()
  const days = Math.floor(d / 86400000)
  if (days === 0) return 'Hoje'
  if (days === 1) return 'Ontem'
  if (days < 30)  return `${days}d`
  if (days < 365) return `${Math.floor(days / 30)}m`
  return `${Math.floor(days / 365)}a`
}

function initials(name: string | null) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function maskCpf(v: string | null) {
  if (!v) return null
  const d = v.replace(/\D/g, '')
  if (d.length !== 11) return v
  return `${d.slice(0, 3)}.***.***-${d.slice(-2)}`
}

function fmtPhone(v: string | null) {
  if (!v) return null
  const d = v.replace(/\D/g, '')
  if (d.length < 10) return v
  const cc = d.length > 11 ? d.slice(0, 2) : '55'
  const rest = d.length > 11 ? d.slice(2) : d
  const ddd = rest.slice(0, 2)
  const num = rest.slice(2)
  return `+${cc} (${ddd}) ${num.slice(0, 5)}-${num.slice(5)}`
}

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  pending: { label: 'Pendente', color: '#a1a1aa', bg: 'rgba(161,161,170,0.10)', icon: <AlertTriangle size={11} /> },
  partial: { label: 'Parcial',  color: '#facc15', bg: 'rgba(250,204,21,0.10)',  icon: <AlertTriangle size={11} /> },
  full:    { label: 'Validado', color: '#4ade80', bg: 'rgba(74,222,128,0.10)',  icon: <CheckCircle2 size={11} /> },
  failed:  { label: 'Falhou',   color: '#f87171', bg: 'rgba(248,113,113,0.10)', icon: <XCircle size={11} /> },
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function ClientesPage() {
  const supabase = useMemo(() => createClient(), [])
  const [list, setList] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [enriching, setEnriching] = useState(false)
  const [batchMsg, setBatchMsg] = useState<string | null>(null)
  const [mlPending, setMlPending] = useState<number | null>(null)
  const [mlFetching, setMlFetching] = useState(false)
  const [mlMsg, setMlMsg] = useState<string | null>(null)

  const getHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return {
      Authorization: `Bearer ${session?.access_token ?? ''}`,
      'Content-Type': 'application/json',
    }
  }, [supabase])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const headers = await getHeaders()
      const qs = new URLSearchParams({ limit: '500' })
      if (filters.search.trim())     qs.set('search', filters.search.trim())
      if (filters.has_cpf)           qs.set('has_cpf', '1')
      if (filters.has_phone)         qs.set('has_phone', '1')
      if (filters.has_whatsapp)      qs.set('has_whatsapp', '1')
      if (filters.has_email)         qs.set('has_email', '1')
      if (filters.enrichment_status) qs.set('enrichment_status', filters.enrichment_status)
      const res = await fetch(`${BACKEND}/customers?${qs}`, { headers })
      if (res.ok) {
        const v = await res.json()
        setList(Array.isArray(v) ? v : [])
      }
    } finally { setLoading(false) }
  }, [getHeaders, filters])
  useEffect(() => { load() }, [load])

  const loadMlPending = useCallback(async () => {
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/ml/orders/billing-pending-count`, { headers })
      const body = await res.json().catch(() => null) as { count?: number } | null
      setMlPending(typeof body?.count === 'number' ? body.count : 0)
    } catch { setMlPending(0) }
  }, [getHeaders])
  useEffect(() => { loadMlPending() }, [loadMlPending])

  const fetchMlBilling = useCallback(async () => {
    if (mlFetching || !mlPending) return
    setMlFetching(true)
    setMlMsg(`Buscando até 200 pedidos no ML…`)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/ml/orders/fetch-billing`, {
        method: 'POST', headers, body: JSON.stringify({ limit: 200 }),
      })
      const body = await res.json().catch(() => null) as
        | { processed: number; with_cpf: number; with_email: number; with_phone: number; no_data: number; errors: number }
        | null
      if (!res.ok || !body) {
        setMlMsg('Falha ao consultar ML — verifique a conexão em Configurações → Integrações')
      } else if (body.processed === 0) {
        setMlMsg('Nenhum pedido pendente para consultar')
      } else {
        setMlMsg(
          `✓ ${body.processed} consultados — ${body.with_cpf} CPFs, ${body.with_email} emails, ${body.with_phone} telefones (${body.errors} falhas)`,
        )
      }
      await Promise.all([load(), loadMlPending()])
    } catch {
      setMlMsg('Erro de rede ao consultar ML')
    } finally {
      setMlFetching(false)
      setTimeout(() => setMlMsg(null), 8000)
    }
  }, [mlFetching, mlPending, getHeaders, load, loadMlPending])

  const enrichPending = useCallback(async () => {
    if (enriching) return
    setEnriching(true)
    setBatchMsg('Enriquecendo clientes pendentes…')
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/enrichment/batch`, {
        method: 'POST', headers, body: JSON.stringify({ limit: 25 }),
      })
      const body = await res.json().catch(() => null) as
        | { processed: number; full: number; partial: number; failed: number; skipped: number }
        | null
      if (!res.ok || !body) {
        setBatchMsg('Falha ao enriquecer — verifique provedores em Configurações → Enriquecimento')
      } else if (body.processed === 0) {
        setBatchMsg('Nenhum cliente pendente para enriquecer')
      } else {
        setBatchMsg(`✓ ${body.processed} processados — ${body.full} validados, ${body.partial} parciais, ${body.failed} falharam`)
      }
      await load()
    } catch {
      setBatchMsg('Erro de rede ao enriquecer')
    } finally {
      setEnriching(false)
      setTimeout(() => setBatchMsg(null), 6000)
    }
  }, [enriching, getHeaders, load])

  const totals = useMemo(() => ({
    total:     list.length,
    with_cpf:  list.filter(c => c.cpf).length,
    with_wa:   list.filter(c => c.whatsapp_id || c.validated_whatsapp).length,
    with_mail: list.filter(c => c.email).length,
    revenue:   list.reduce((s, c) => s + Number(c.total_purchases ?? 0), 0),
    pending:   list.filter(c => (c.enrichment_status ?? 'pending') === 'pending' && (c.cpf || c.phone || c.whatsapp_id)).length,
  }), [list])

  return (
    <div className="p-6 space-y-5 min-h-full" style={{ background: '#09090b' }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-zinc-500 text-xs font-medium uppercase tracking-widest">CRM</p>
          <h1 className="text-white text-xl font-semibold flex items-center gap-2"><Users size={18} /> Clientes</h1>
          <p className="text-zinc-500 text-xs mt-0.5">Perfis unificados a partir de pedidos ML, WhatsApp, widget e enriquecimento</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchMlBilling} disabled={mlFetching || !mlPending}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: '#1a1a1f', color: '#FFE600', border: '1px solid #FFE60040' }}>
            <ScanLine size={12} className={mlFetching ? 'animate-pulse' : ''} />
            {mlFetching
              ? 'Buscando…'
              : `Buscar CPFs no ML${mlPending != null ? ` (${mlPending.toLocaleString('pt-BR')} pendentes)` : ''}`}
          </button>
          {totals.pending > 0 && (
            <button onClick={enrichPending} disabled={enriching}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold transition-all disabled:opacity-60"
              style={{ background: 'linear-gradient(90deg,#a78bfa,#00E5FF)', color: '#000' }}>
              <Sparkles size={12} className={enriching ? 'animate-pulse' : ''} />
              {enriching ? 'Enriquecendo…' : `Enriquecer ${Math.min(totals.pending, 25)} pendentes`}
            </button>
          )}
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold transition-all disabled:opacity-60"
            style={{ background: '#111114', color: '#a1a1aa', border: '1px solid #27272a' }}>
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>
      </div>

      {(batchMsg || mlMsg) && (
        <div className="space-y-2">
          {mlMsg && (
            <div className="rounded-xl px-3 py-2 text-[11px]"
              style={{ background: '#111114', border: '1px solid #27272a', color: '#d4d4d8' }}>
              {mlMsg}
            </div>
          )}
          {batchMsg && (
            <div className="rounded-xl px-3 py-2 text-[11px]"
              style={{ background: '#111114', border: '1px solid #27272a', color: '#d4d4d8' }}>
              {batchMsg}
            </div>
          )}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="Total"     value={totals.total.toLocaleString('pt-BR')}      color="#00E5FF" />
        <Kpi label="Com CPF"   value={totals.with_cpf.toLocaleString('pt-BR')}   color="#a78bfa" />
        <Kpi label="WhatsApp"  value={totals.with_wa.toLocaleString('pt-BR')}    color="#25D366" />
        <Kpi label="Email"     value={totals.with_mail.toLocaleString('pt-BR')}  color="#60a5fa" />
        <Kpi label="GMV"       value={brl(totals.revenue)}                       color="#4ade80" />
      </div>

      {/* Filters */}
      <div className="rounded-2xl p-4 flex items-center gap-2 flex-wrap" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <div className="relative flex-1 min-w-[240px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })}
            placeholder="Buscar por nome, telefone, email ou CPF..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-[#0c0c10] border border-[#27272a] text-zinc-200 outline-none focus:border-[#00E5FF]" />
        </div>
        <FilterPill label="Com CPF"      active={filters.has_cpf}      onClick={() => setFilters({ ...filters, has_cpf:      !filters.has_cpf })} />
        <FilterPill label="Com Telefone" active={filters.has_phone}    onClick={() => setFilters({ ...filters, has_phone:    !filters.has_phone })} />
        <FilterPill label="Com WhatsApp" active={filters.has_whatsapp} onClick={() => setFilters({ ...filters, has_whatsapp: !filters.has_whatsapp })} />
        <FilterPill label="Com Email"    active={filters.has_email}    onClick={() => setFilters({ ...filters, has_email:    !filters.has_email })} />
        <select value={filters.enrichment_status} onChange={e => setFilters({ ...filters, enrichment_status: e.target.value })}
          className="text-[11px] bg-[#0c0c10] border border-[#27272a] text-zinc-300 rounded-lg px-2 py-1.5">
          <option value="">Qualquer status</option>
          <option value="pending">Pendentes</option>
          <option value="partial">Parciais</option>
          <option value="full">Validados</option>
          <option value="failed">Falharam</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wide text-zinc-600" style={{ borderBottom: '1px solid #1a1a1f' }}>
                <th className="px-3 py-2 font-semibold">Cliente</th>
                <th className="px-3 py-2 font-semibold">CPF</th>
                <th className="px-3 py-2 font-semibold">Contatos</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold text-right">Compras</th>
                <th className="px-3 py-2 font-semibold text-right">Última</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-xs text-zinc-600">Carregando…</td></tr>
              ) : list.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-xs text-zinc-600 italic">
                  Nenhum cliente encontrado. {filters.has_cpf || filters.enrichment_status ? 'Tente limpar os filtros.' : ''}
                </td></tr>
              ) : list.map(c => {
                const status = STATUS_META[c.enrichment_status ?? 'pending'] ?? STATUS_META.pending
                return (
                  <tr key={c.id} className="hover:bg-[#161618] transition-colors">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                          style={{ background: '#1a1a1f', color: '#a1a1aa' }}>
                          {initials(c.display_name)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-zinc-200 text-xs font-medium truncate max-w-[200px]">{c.display_name ?? '(sem nome)'}</p>
                          <p className="text-[10px] text-zinc-600">
                            {c.last_channel ?? '—'}
                            {c.ml_buyer_id && <span className="ml-1 font-mono">· ML #{c.ml_buyer_id}</span>}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-zinc-400 font-mono">{maskCpf(c.cpf) ?? '—'}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {c.phone && (
                          <span className="text-[10px] inline-flex items-center gap-1 px-1.5 py-0.5 rounded" style={{ background: 'rgba(96,165,250,0.10)', color: '#60a5fa' }}>
                            <Phone size={9} /> {fmtPhone(c.phone)}
                          </span>
                        )}
                        {c.whatsapp_id && (
                          <span className="text-[10px] inline-flex items-center gap-1 px-1.5 py-0.5 rounded" style={{ background: 'rgba(37,211,102,0.10)', color: '#25D366' }}>
                            <MessageCircle size={9} /> WA
                          </span>
                        )}
                        {c.email && (
                          <span className="text-[10px] inline-flex items-center gap-1 px-1.5 py-0.5 rounded max-w-[180px] truncate" style={{ background: 'rgba(167,139,250,0.10)', color: '#a78bfa' }}>
                            <Mail size={9} /> {c.email}
                          </span>
                        )}
                        {!c.phone && !c.whatsapp_id && !c.email && <span className="text-[10px] text-zinc-700">—</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-[10px] font-semibold inline-flex items-center gap-1 px-2 py-0.5 rounded"
                        style={{ color: status.color, background: status.bg }}>
                        {status.icon} {status.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <p className="text-xs font-semibold text-zinc-200 tabular-nums">{brl(Number(c.total_purchases ?? 0))}</p>
                      <p className="text-[10px] text-zinc-600">{c.total_conversations} conv.</p>
                    </td>
                    <td className="px-3 py-2.5 text-right text-[11px] text-zinc-500">{relTime(c.last_contact_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Kpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-1.5 min-h-[90px] justify-between"
      style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">{label}</span>
      <p className="text-xl font-bold tabular-nums" style={{ color }}>{value}</p>
    </div>
  )
}

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="text-[11px] px-3 py-1.5 rounded-lg font-medium transition-colors"
      style={{
        background: active ? '#00E5FF' : '#0c0c10',
        color:      active ? '#000'    : '#a1a1aa',
        border: '1px solid ' + (active ? '#00E5FF' : '#27272a'),
      }}>
      {label}
    </button>
  )
}
