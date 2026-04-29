'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import {
  Users, Phone, Mail, MessageCircle,
  CheckCircle2, AlertTriangle, XCircle, Crown, Ban,
  Sparkles, ScanLine, Send, Tag, Map, MoreHorizontal,
  Eye, Trash2, GitMerge, Megaphone, QrCode, Search, RotateCcw,
} from 'lucide-react'
import { DataTable } from '@/components/data-table'
import type { Column, RowAction, BulkAction, PanelSection } from '@/components/data-table'
import { ToastViewport, useToast, todoToast } from '@/hooks/useToast'
import { MaskedField } from '@/components/ui/masked-field'
import { usePreferences } from '@/hooks/usePreferences'
import { formatPii } from '@/lib/format'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// ── types ─────────────────────────────────────────────────────────────────────

type Customer = {
  id: string
  display_name: string | null
  ml_nickname: string | null
  phone: string | null
  email: string | null
  whatsapp_id: string | null
  ml_buyer_id: string | null
  cpf: string | null
  cnpj: string | null
  tags: string[] | null
  city: string | null
  state: string | null
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

type ListResp = { data: Customer[]; total: number; page: number; per_page: number }

type QF = 'all' | 'with_cpf' | 'with_wa' | 'vip' | 'pending' | 'blocked'

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

/** Treats display_name as a bare ML nickname when it has no whitespace.
 * Real names virtually always have at least a first + last name. */
function isLikelyNickname(name: string | null) {
  if (!name) return true
  return !/\s/.test(name)
}

function maskCpf(v: string | null) {
  if (!v) return null
  const d = v.replace(/\D/g, '')
  if (d.length === 11) return `${d.slice(0,3)}.***.***-${d.slice(-2)}`
  if (d.length === 14) return `${d.slice(0,2)}.${d.slice(2,5)}.***.****-**`
  return v
}

function fmtPhone(v: string | null) {
  if (!v) return null
  const d = v.replace(/\D/g, '')
  if (d.length < 10) return v
  const cc = d.length > 11 ? d.slice(0, 2) : '55'
  const rest = d.length > 11 ? d.slice(2) : d
  return `+${cc} (${rest.slice(0,2)}) ${rest.slice(2,7)}-${rest.slice(7)}`
}

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  pending: { label: 'Pendente', color: '#a1a1aa', bg: 'rgba(161,161,170,0.10)', icon: <AlertTriangle size={11} /> },
  partial: { label: 'Parcial',  color: '#facc15', bg: 'rgba(250,204,21,0.10)',  icon: <AlertTriangle size={11} /> },
  full:    { label: 'Validado', color: '#4ade80', bg: 'rgba(74,222,128,0.10)',  icon: <CheckCircle2 size={11} /> },
  failed:  { label: 'Falhou',   color: '#f87171', bg: 'rgba(248,113,113,0.10)', icon: <XCircle size={11} /> },
}

const PER_PAGE_KEY = 'eclick.clientes.perPage'
const QF_KEY       = 'eclick.clientes.qf'

// ── page ──────────────────────────────────────────────────────────────────────

export default function ClientesPage() {
  const supabase = useMemo(() => createClient(), [])
  const router   = useRouter()
  const search   = useSearchParams()
  const toast    = useToast()
  const { maskExport } = usePreferences()

  const initialQF = (search.get('qf') as QF | null) ?? (typeof window !== 'undefined' ? localStorage.getItem(QF_KEY) as QF | null : null) ?? 'all'
  const initialPP = Number(search.get('per_page') ?? (typeof window !== 'undefined' ? localStorage.getItem(PER_PAGE_KEY) : null) ?? 25)

  const [qf, setQf]               = useState<QF>(initialQF)
  const [page, setPage]           = useState<number>(Number(search.get('page') ?? '1') || 1)
  const [perPage, setPerPage]     = useState<number>([10,25,50,100].includes(initialPP) ? initialPP : 25)
  const [searchStr, setSearchStr] = useState<string>(search.get('search') ?? '')
  const [list, setList]           = useState<Customer[]>([])
  const [total, setTotal]         = useState(0)
  const [loading, setLoading]     = useState(true)
  const [selected, setSelected]   = useState<string[]>([])
  const [busy, setBusy]           = useState<'enrich' | 'ml' | null>(null)
  const [mlPending, setMlPending] = useState<number | null>(null)
  const [orphans,   setOrphans]   = useState<number | null>(null)
  const [resetting, setResetting] = useState(false)

  const getHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return {
      Authorization: `Bearer ${session?.access_token ?? ''}`,
      'Content-Type': 'application/json',
    }
  }, [supabase])

  // ── persist QF + perPage to localStorage; mirror to URL ────────────────────
  useEffect(() => { try { localStorage.setItem(QF_KEY, qf) } catch {} }, [qf])
  useEffect(() => { try { localStorage.setItem(PER_PAGE_KEY, String(perPage)) } catch {} }, [perPage])

  const urlSync = useRef<NodeJS.Timeout | null>(null)
  useEffect(() => {
    if (urlSync.current) clearTimeout(urlSync.current)
    urlSync.current = setTimeout(() => {
      const qs = new URLSearchParams()
      if (qf !== 'all')   qs.set('qf', qf)
      if (page > 1)       qs.set('page', String(page))
      if (perPage !== 25) qs.set('per_page', String(perPage))
      if (searchStr)      qs.set('search', searchStr)
      const next = qs.toString() ? `?${qs.toString()}` : ''
      router.replace(`/dashboard/crm/clientes${next}`, { scroll: false })
    }, 300)
    return () => { if (urlSync.current) clearTimeout(urlSync.current) }
  }, [qf, page, perPage, searchStr, router])

  // ── load list ──────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const headers = await getHeaders()
      const qs = new URLSearchParams({ page: String(page), per_page: String(perPage) })
      if (searchStr.trim()) qs.set('search', searchStr.trim())
      switch (qf) {
        case 'with_cpf': qs.set('has_cpf', '1'); break
        case 'with_wa':  qs.set('has_whatsapp', '1'); break
        case 'vip':      qs.set('is_vip', '1'); break
        case 'pending':  qs.set('enrichment_status', 'pending'); break
        case 'blocked':  qs.set('is_blocked', '1'); break
      }
      const res = await fetch(`${BACKEND}/customers?${qs}`, { headers })
      const body = await res.json().catch(() => null) as ListResp | null
      if (body && Array.isArray(body.data)) {
        setList(body.data); setTotal(body.total ?? body.data.length)
      } else {
        setList([]); setTotal(0)
      }
    } finally { setLoading(false) }
  }, [getHeaders, page, perPage, searchStr, qf])
  useEffect(() => { load() }, [load])

  // ── ML billing pending count ───────────────────────────────────────────────
  const loadMlPending = useCallback(async () => {
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/ml/orders/billing-pending-count`, { headers })
      const body = await res.json().catch(() => null) as { count?: number } | null
      setMlPending(typeof body?.count === 'number' ? body.count : 0)
    } catch { setMlPending(0) }
  }, [getHeaders])
  useEffect(() => { loadMlPending() }, [loadMlPending])

  // ── Orphans count (orders with billing_fetched_at but NULL doc_number) ────
  const loadOrphans = useCallback(async () => {
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/ml/orders/orphans-count`, { headers })
      const body = await res.json().catch(() => null) as { count?: number } | null
      setOrphans(typeof body?.count === 'number' ? body.count : 0)
    } catch { setOrphans(0) }
  }, [getHeaders])
  useEffect(() => { loadOrphans() }, [loadOrphans])

  const resetOrphans = useCallback(async () => {
    if (resetting || !orphans) return
    if (!confirm(`Isso vai marcar ${orphans} pedidos para reprocessar o billing_info. Continuar?`)) return
    setResetting(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/ml/orders/reset-billing-fetched`, {
        method: 'POST', headers, body: JSON.stringify({}),
      })
      const body = await res.json().catch(() => null) as { reset?: number; message?: string } | null
      if (!res.ok || !body || typeof body.reset !== 'number') {
        toast({ tone: 'error', message: body?.message ?? 'Falha ao resetar' })
      } else {
        toast({ tone: 'success', message: `✓ ${body.reset} pedidos resetados. Clique em "Buscar CPFs no ML" para reprocessar.` })
      }
      await Promise.all([loadOrphans(), loadMlPending()])
    } catch {
      toast({ tone: 'error', message: 'Erro de rede ao resetar' })
    } finally {
      setResetting(false)
    }
  }, [resetting, orphans, getHeaders, toast, loadOrphans, loadMlPending])

  // ── KPIs (agregados via /customers/stats — banco inteiro, não página) ──
  type StatsAgg = {
    total: number; with_cpf: number; with_phone: number; with_whatsapp: number
    with_email: number; with_address: number; vip: number; blocked: number
    pending: number; gmv_total: number; ltv_average: number
  }
  const [statsAgg, setStatsAgg] = useState<StatsAgg | null>(null)
  const loadStats = useCallback(async () => {
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/customers/stats`, { headers })
      if (res.ok) setStatsAgg(await res.json() as StatsAgg)
    } catch { /* silent — stats são best-effort */ }
  }, [getHeaders])
  useEffect(() => {
    loadStats()
    const id = setInterval(loadStats, 5 * 60_000) // refresh a cada 5min
    return () => clearInterval(id)
  }, [loadStats])

  // GMV/revenue da página atual (mostrado como "GMV pág."), separado do total
  const pageRevenue = useMemo(
    () => list.reduce((s, c) => s + Number(c.total_purchases ?? 0), 0),
    [list],
  )

  /** Contadores reais do banco (preferência) ou fallback pra page-derived
   * enquanto stats não carregaram. with_wa = customers com validated_whatsapp=true. */
  const totals = useMemo(() => ({
    total:     statsAgg?.total     ?? total,
    with_cpf:  statsAgg?.with_cpf  ?? list.filter(c => c.cpf).length,
    with_wa:   statsAgg?.with_whatsapp ?? list.filter(c => c.whatsapp_id || c.validated_whatsapp).length,
    with_mail: statsAgg?.with_email ?? list.filter(c => c.email).length,
    revenue:   pageRevenue,
    gmv_total: statsAgg?.gmv_total ?? null,
    ltv_avg:   statsAgg?.ltv_average ?? null,
    pending:   statsAgg?.pending ?? list.filter(c => (c.enrichment_status ?? 'pending') === 'pending' && (c.cpf || c.phone || c.whatsapp_id)).length,
    vip:       statsAgg?.vip     ?? list.filter(c => (c.tags ?? []).includes('vip')).length,
    blocked:   statsAgg?.blocked ?? list.filter(c => (c.tags ?? []).includes('blocked')).length,
  }), [statsAgg, list, total, pageRevenue])

  // ── actions ────────────────────────────────────────────────────────────────
  const enrichOne = useCallback(async (c: Customer) => {
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/enrichment/customer/${c.id}`, { method: 'POST', headers })
      const body = await res.json().catch(() => null) as { status?: string; fields_filled?: number } | null
      if (!res.ok || !body) toast({ tone: 'error', message: 'Falha ao enriquecer' })
      else toast({ tone: body.status === 'full' ? 'success' : body.status === 'failed' ? 'warn' : 'info',
        message: `${c.display_name ?? 'Cliente'}: ${body.status} — ${body.fields_filled ?? 0} campos preenchidos` })
      await load()
    } catch { toast({ tone: 'error', message: 'Erro de rede' }) }
  }, [getHeaders, toast, load])

  const enrichBatch = useCallback(async () => {
    if (busy) return
    setBusy('enrich')
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/enrichment/batch`, {
        method: 'POST', headers, body: JSON.stringify({ limit: 25 }),
      })
      const body = await res.json().catch(() => null) as { processed: number; full: number; partial: number; failed: number } | null
      if (!res.ok || !body) toast({ tone: 'error', message: 'Falha — verifique provedores em Configurações' })
      else if (body.processed === 0) toast({ tone: 'info', message: 'Nenhum pendente para enriquecer' })
      else toast({ tone: 'success', message: `${body.processed} processados — ${body.full} validados, ${body.partial} parciais, ${body.failed} falharam` })
      await load()
    } finally { setBusy(null) }
  }, [busy, getHeaders, toast, load])

  const fetchMlBilling = useCallback(async () => {
    if (busy || !mlPending) return
    setBusy('ml')
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/ml/orders/fetch-billing`, {
        method: 'POST', headers, body: JSON.stringify({ limit: 200 }),
      })
      const body = await res.json().catch(() => null) as { processed: number; with_cpf: number; with_email: number; with_phone: number; errors: number } | null
      if (!res.ok || !body) toast({ tone: 'error', message: 'Falha ao consultar ML' })
      else if (body.processed === 0) toast({ tone: 'info', message: 'Nenhum pedido pendente' })
      else toast({ tone: 'success', message: `${body.processed} consultados — ${body.with_cpf} CPFs, ${body.with_email} emails, ${body.with_phone} telefones` })
      await Promise.all([load(), loadMlPending()])
    } finally { setBusy(null) }
  }, [busy, mlPending, getHeaders, toast, load, loadMlPending])

  const toggleTag = useCallback(async (c: Customer, tag: 'vip' | 'blocked') => {
    const has = (c.tags ?? []).includes(tag)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/customers/${c.id}/tags/${tag}`, {
        method: has ? 'DELETE' : 'POST', headers,
      })
      if (!res.ok) toast({ tone: 'error', message: `Falha ao ${has ? 'remover' : 'aplicar'} ${tag}` })
      else toast({ tone: 'success', message: `${tag === 'vip' ? '👑 VIP' : '🚫 Bloqueio'} ${has ? 'removido' : 'aplicado'} em ${c.display_name ?? 'cliente'}` })
      await load()
    } catch { toast({ tone: 'error', message: 'Erro de rede' }) }
  }, [getHeaders, toast, load])

  const removeOne = useCallback(async (c: Customer) => {
    if (!confirm(`Excluir ${c.display_name ?? 'este cliente'}? Esta ação não pode ser desfeita.`)) return
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/customers/${c.id}`, { method: 'DELETE', headers })
      if (!res.ok) toast({ tone: 'error', message: 'Falha ao excluir' })
      else toast({ tone: 'success', message: 'Cliente excluído' })
      setSelected(s => s.filter(x => x !== c.id))
      await load()
    } catch { toast({ tone: 'error', message: 'Erro de rede' }) }
  }, [getHeaders, toast, load])

  const exportCsv = useCallback((rows: Customer[]) => {
    const cols = ['display_name','cpf','phone','email','whatsapp_id','enrichment_status','total_purchases','last_contact_at']
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    // Honor mask_export preference (default false — exports are offline use)
    const maskValue = (key: string, raw: unknown): unknown => {
      if (!maskExport || raw == null) return raw
      const s = String(raw)
      if (key === 'cpf')   return formatPii('cpf',   s, true)
      if (key === 'phone') return formatPii('phone', s, true)
      if (key === 'email') return formatPii('email', s, true)
      return raw
    }
    const csv = [cols.join(',')]
      .concat(rows.map(r => cols.map(k => esc(maskValue(k, (r as unknown as Record<string,unknown>)[k]))).join(',')))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `clientes-${new Date().toISOString().slice(0,10)}${maskExport ? '-masked' : ''}.csv`; a.click()
    URL.revokeObjectURL(url)
    toast({ tone: 'success', message: `${rows.length} clientes exportados${maskExport ? ' (mascarado)' : ''}` })
  }, [toast, maskExport])

  // ── bulk action handlers (chamados pela barra de seleção) ──────────────────
  const [waModal,    setWaModal]    = useState<{ rows: Customer[] } | null>(null)
  const [segModal,   setSegModal]   = useState<{ rows: Customer[] } | null>(null)
  const [mergeModal, setMergeModal] = useState<{ rows: Customer[] } | null>(null)
  const [segments,   setSegments]   = useState<Array<{ id: string; name: string; customer_count?: number }>>([])
  const [confirmModal, setConfirmModal] = useState<{
    open:          boolean
    title:         string
    message:       string
    onConfirm:     () => void
    confirmLabel?: string
    confirmColor?: string
  } | null>(null)

  const enrichBulk = useCallback(async (rows: Customer[]) => {
    if (!rows.length) return
    const ids = rows.map(r => r.id)
    toast({ tone: 'info', message: `Enriquecendo ${ids.length} cliente${ids.length === 1 ? '' : 's'}…` })
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/enrichment/batch`, {
        method: 'POST', headers, body: JSON.stringify({ customer_ids: ids, limit: ids.length }),
      })
      const body = await res.json().catch(() => null) as { processed: number; full: number; partial: number; failed: number } | null
      if (!res.ok || !body) toast({ tone: 'error', message: 'Falha — verifique provedores em Configurações' })
      else toast({ tone: 'success', message: `${body.processed} processados — ${body.full} validados, ${body.partial} parciais, ${body.failed} falharam` })
      setTimeout(() => { void load() }, 3000)
    } catch { toast({ tone: 'error', message: 'Erro de rede' }) }
  }, [getHeaders, toast, load])

  const sendWaBulk = useCallback(async (rows: Customer[], message: string) => {
    if (!rows.length || !message.trim()) return
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/messaging/send-bulk`, {
        method: 'POST', headers, body: JSON.stringify({ customer_ids: rows.map(r => r.id), message }),
      })
      const body = await res.json().catch(() => null) as { success?: boolean; message?: string } | null
      // Stub retorna { success: true, message: 'Em breve' } → toast amarelo
      if (body?.message === 'Em breve') toast({ tone: 'warn', message: 'Funcionalidade em desenvolvimento' })
      else if (res.ok && body?.success) toast({ tone: 'success', message: 'Mensagem enviada' })
      else toast({ tone: 'error', message: 'Falha ao enviar' })
    } catch { toast({ tone: 'error', message: 'Erro de rede' }) }
    finally { setWaModal(null) }
  }, [getHeaders, toast])

  const pvBulk = useCallback((rows: Customer[]) => {
    if (!rows.length) return
    setConfirmModal({
      open:          true,
      title:         'Iniciar jornada pós-venda',
      message:       `Iniciar jornada pós-venda para ${rows.length} cliente${rows.length === 1 ? '' : 's'}?`,
      confirmLabel:  'Iniciar',
      confirmColor:  '#00E5FF',
      onConfirm: async () => {
        setConfirmModal(null)
        try {
          const headers = await getHeaders()
          const res = await fetch(`${BACKEND}/messaging/journeys/start-bulk`, {
            method: 'POST', headers,
            body: JSON.stringify({ customer_ids: rows.map(r => r.id), journey_type: 'pos_venda' }),
          })
          const body = await res.json().catch(() => null) as { success?: boolean; message?: string } | null
          if (body?.message === 'Em breve') toast({ tone: 'warn', message: 'Funcionalidade em desenvolvimento' })
          else if (res.ok && body?.success) toast({ tone: 'success', message: 'Jornada iniciada' })
          else toast({ tone: 'error', message: 'Falha ao iniciar jornada' })
        } catch { toast({ tone: 'error', message: 'Erro de rede' }) }
      },
    })
  }, [getHeaders, toast])

  const openSegModal = useCallback(async (rows: Customer[]) => {
    setSegModal({ rows })
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/customer-hub/segments`, { headers })
      const body = await res.json().catch(() => null) as Array<{ id: string; name: string; customer_count?: number }> | null
      setSegments(Array.isArray(body) ? body : [])
    } catch { setSegments([]) }
  }, [getHeaders])

  const segmentBulk = useCallback(async (rows: Customer[], segmentId: string) => {
    if (!rows.length || !segmentId) return
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/customers/segments/bulk-add`, {
        method: 'POST', headers,
        body: JSON.stringify({ customer_ids: rows.map(r => r.id), segment_id: segmentId }),
      })
      const body = await res.json().catch(() => null) as { success?: boolean; message?: string } | null
      if (body?.message === 'Em breve') toast({ tone: 'warn', message: 'Funcionalidade em desenvolvimento' })
      else if (res.ok && body?.success) toast({ tone: 'success', message: `${rows.length} cliente${rows.length === 1 ? '' : 's'} adicionado${rows.length === 1 ? '' : 's'} ao segmento` })
      else toast({ tone: 'error', message: 'Falha ao adicionar' })
    } catch { toast({ tone: 'error', message: 'Erro de rede' }) }
    finally { setSegModal(null) }
  }, [getHeaders, toast])

  const vipBulk = useCallback(async (rows: Customer[]) => {
    if (!rows.length) return
    if (!confirm(`Marcar ${rows.length} cliente${rows.length === 1 ? '' : 's'} como VIP?`)) return
    const ids = new Set(rows.map(r => r.id))
    // Optimistic — adiciona tag vip imediatamente nas linhas selecionadas
    setList(prev => prev.map(c => ids.has(c.id)
      ? { ...c, tags: Array.from(new Set([...(c.tags ?? []), 'vip'])) }
      : c))
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/customers/bulk`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ customer_ids: [...ids], is_vip: true }),
      })
      const body = await res.json().catch(() => null) as { updated?: number; total?: number } | null
      if (!res.ok || !body) {
        toast({ tone: 'error', message: 'Falha ao marcar VIP' })
        await load() // rollback do optimistic
      } else {
        toast({ tone: 'success', message: `${body.updated ?? 0} cliente${body.updated === 1 ? '' : 's'} marcado${body.updated === 1 ? '' : 's'} como VIP` })
        await load()
      }
    } catch {
      toast({ tone: 'error', message: 'Erro de rede' })
      await load()
    }
  }, [getHeaders, toast, load])

  const blockBulk = useCallback((rows: Customer[]) => {
    if (!rows.length) return
    setConfirmModal({
      open:          true,
      title:         'Bloquear clientes',
      message:       `Bloquear ${rows.length} cliente${rows.length === 1 ? '' : 's'} selecionado${rows.length === 1 ? '' : 's'}? Eles não receberão comunicações automáticas.`,
      confirmLabel:  'Bloquear',
      confirmColor:  '#ef4444',
      onConfirm: async () => {
        setConfirmModal(null)
        const ids = new Set(rows.map(r => r.id))
        setList(prev => prev.map(c => ids.has(c.id)
          ? { ...c, tags: Array.from(new Set([...(c.tags ?? []), 'blocked'])) }
          : c))
        try {
          const headers = await getHeaders()
          const res = await fetch(`${BACKEND}/customers/bulk`, {
            method: 'PATCH', headers,
            body: JSON.stringify({ customer_ids: [...ids], is_blocked: true }),
          })
          const body = await res.json().catch(() => null) as { updated?: number } | null
          if (!res.ok || !body) {
            toast({ tone: 'error', message: 'Falha ao bloquear' })
            await load()
          } else {
            toast({ tone: 'success', message: `${body.updated ?? 0} cliente${body.updated === 1 ? '' : 's'} bloqueado${body.updated === 1 ? '' : 's'}` })
            await load()
          }
        } catch {
          toast({ tone: 'error', message: 'Erro de rede' })
          await load()
        }
      },
    })
  }, [getHeaders, toast, load])

  const mergeBulk = useCallback((rows: Customer[]) => {
    if (rows.length !== 2) {
      toast({ tone: 'warn', message: 'Selecione exatamente 2 clientes para mesclar' })
      return
    }
    setMergeModal({ rows })
  }, [toast])

  const confirmMerge = useCallback(async (keepId: string, discardId: string) => {
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/customers/merge`, {
        method: 'POST', headers,
        body: JSON.stringify({ keep_id: keepId, discard_id: discardId }),
      })
      if (!res.ok) toast({ tone: 'error', message: 'Falha ao mesclar' })
      else toast({ tone: 'success', message: 'Clientes mesclados' })
      setSelected([])
      await load()
    } catch { toast({ tone: 'error', message: 'Erro de rede' }) }
    finally { setMergeModal(null) }
  }, [getHeaders, toast, load])

  const exportBulk = useCallback(async (rows: Customer[]) => {
    if (!rows.length) return
    try {
      const headers = await getHeaders()
      const ids = rows.map(r => r.id).join(',')
      const res = await fetch(`${BACKEND}/customers/export?ids=${encodeURIComponent(ids)}`, { headers })
      if (!res.ok) { toast({ tone: 'error', message: 'Falha ao exportar' }); return }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url
      a.download = `clientes-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast({ tone: 'success', message: `${rows.length} cliente${rows.length === 1 ? '' : 's'} exportado${rows.length === 1 ? '' : 's'}` })
    } catch { toast({ tone: 'error', message: 'Erro de rede' }) }
  }, [getHeaders, toast])

  // ── columns ────────────────────────────────────────────────────────────────
  const columns: Column<Customer>[] = useMemo(() => [
    {
      key: 'name', label: 'Cliente',
      render: c => {
        const hasRealName = !isLikelyNickname(c.display_name)
        // Linha 1: nome real se houver, caso contrário @nickname (ou @display_name se for o nick).
        const primary = hasRealName
          ? c.display_name
          : c.ml_nickname
            ? `@${c.ml_nickname}`
            : c.display_name
              ? `@${c.display_name}`
              : '(sem nome)'
        // Linha 2: @nickname · ML #buyer_id (· ⚠️ pendente quando faltam dados)
        const secondaryParts: React.ReactNode[] = []
        if (hasRealName && c.ml_nickname) secondaryParts.push(<span key="nick" className="font-mono">@{c.ml_nickname}</span>)
        if (c.ml_buyer_id)                secondaryParts.push(<span key="buy"  className="font-mono">ML #{c.ml_buyer_id}</span>)
        if (!hasRealName)                 secondaryParts.push(<span key="warn" style={{ color: '#facc15' }}>⚠️ Aguardando enriquecimento</span>)

        return (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
              style={{ background: '#1a1a1f', color: '#a1a1aa' }}>{initials(hasRealName ? c.display_name : c.ml_nickname ?? c.display_name)}</div>
            <div className="min-w-0">
              <p className="text-zinc-100 text-xs font-medium truncate max-w-[220px]">
                {primary}
                {(c.tags ?? []).includes('vip')     && <Crown size={10} className="inline ml-1" style={{ color: '#facc15' }} />}
                {(c.tags ?? []).includes('blocked') && <Ban   size={10} className="inline ml-1" style={{ color: '#f87171' }} />}
              </p>
              <p className="text-[10px] text-zinc-500 truncate max-w-[260px]">
                {secondaryParts.map((node, i) => (
                  <span key={i}>{i > 0 && <span> · </span>}{node}</span>
                ))}
              </p>
            </div>
          </div>
        )
      },
    },
    { key: 'cpf', label: 'CPF', width: '130px',
      render: c => (
        <span className="text-zinc-400 text-[11px]">
          <MaskedField type="cpf" value={c.cpf} customerId={c.id} copyable={!!c.cpf} hideToggle={!c.cpf} />
        </span>
      ) },
    { key: 'contatos', label: 'Contatos', width: '200px',
      render: c => (
        <div className="flex items-center gap-1.5 flex-wrap">
          {c.phone && (
            <span className="text-[10px] inline-flex items-center gap-1 px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(96,165,250,0.10)', color: '#60a5fa' }}>
              <Phone size={9} />
              <MaskedField type="phone" value={c.phone} customerId={c.id} copyable={false} />
            </span>
          )}
          {c.whatsapp_id && (
            <span className="text-[10px] inline-flex items-center gap-1 px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(37,211,102,0.10)', color: '#25D366' }}>
              <MessageCircle size={9} /> WA
            </span>
          )}
          {c.email && (
            <span className="text-[10px] inline-flex items-center gap-1 px-1.5 py-0.5 rounded max-w-[200px] truncate"
              style={{ background: 'rgba(167,139,250,0.10)', color: '#a78bfa' }}>
              <Mail size={9} />
              <MaskedField type="email" value={c.email} customerId={c.id} copyable={false} />
            </span>
          )}
          {!c.phone && !c.whatsapp_id && !c.email && <span className="text-[10px] text-zinc-700">—</span>}
        </div>
      ),
    },
    { key: 'cidade_uf', label: 'Cidade/UF', width: '100px', className: 'hidden lg:table-cell',
      render: c => {
        if (!c.city && !c.state) return <span className="text-zinc-700 text-[11px]">—</span>
        const uf = (c.state ?? '').slice(0, 2).toUpperCase()
        const city = c.city ?? '—'
        const full = `${city}${uf ? ` / ${uf}` : ''}`
        return (
          <div className="flex items-center gap-1 max-w-[110px]" title={full}>
            <span className="text-[11px] text-zinc-300 truncate">{city}</span>
            {uf && <span className="text-[11px] text-zinc-500 shrink-0">/ {uf}</span>}
          </div>
        )
      },
    },
    { key: 'status', label: 'Status', width: '100px',
      render: c => {
        const m = STATUS_META[c.enrichment_status ?? 'pending'] ?? STATUS_META.pending
        return (
          <span className="text-[10px] font-semibold inline-flex items-center gap-1 px-2 py-0.5 rounded"
            style={{ color: m.color, background: m.bg }}>
            {m.icon} {m.label}
          </span>
        )
      },
    },
    { key: 'compras', label: 'Compras', align: 'right', width: '100px', className: 'hidden xl:table-cell',
      render: c => (
        <div className="text-right">
          <p className="text-zinc-100 text-xs font-semibold tabular-nums">{brl(Number(c.total_purchases ?? 0))}</p>
          <p className="text-[10px] text-zinc-600">{c.total_conversations} conv.</p>
        </div>
      ),
    },
    { key: 'last_contact_at', label: 'Última', align: 'right', sortable: true, width: '90px', className: 'hidden 2xl:table-cell',
      render: c => <span className="text-[11px] text-zinc-500">{relTime(c.last_contact_at)}</span> },
  ], [])

  // ── row actions ────────────────────────────────────────────────────────────
  const rowActions = useCallback((c: Customer): RowAction<Customer>[] => {
    const isVip     = (c.tags ?? []).includes('vip')
    const isBlocked = (c.tags ?? []).includes('blocked')
    return [
      { key: 'enrich',   label: 'Enriquecer dados',   icon: <Sparkles size={12} />,    onClick: () => enrichOne(c) },
      { key: 'wa',       label: 'Disparar WhatsApp',  icon: <Send size={12} />,        onClick: () => todoToast('Disparo WhatsApp') },
      { key: 'posvenda', label: 'Adicionar a campanha pós-venda', icon: <Megaphone size={12} />, onClick: () => todoToast('Campanha pós-venda') },
      { key: 'qr',       label: 'Gerar QR Lead Bridge', icon: <QrCode size={12} />,    onClick: () => todoToast('QR Lead Bridge para cliente') },
      { key: 'segmento', label: 'Criar segmento',     icon: <Tag size={12} />,         onClick: () => todoToast('Segmentação') },
      { key: 'vip',      label: isVip ? 'Remover VIP' : 'Marcar como VIP', icon: <Crown size={12} />, tone: isVip ? 'warn' : 'success', onClick: () => toggleTag(c, 'vip') },
      { key: 'block',    label: isBlocked ? 'Desbloquear' : 'Bloquear', icon: <Ban size={12} />, tone: isBlocked ? 'success' : 'warn', onClick: () => toggleTag(c, 'blocked') },
      { key: 'merge',    label: 'Mesclar duplicado',  icon: <GitMerge size={12} />,    onClick: () => todoToast('Detecção de duplicados') },
      { key: 'view',     label: 'Ver detalhes',       icon: <Eye size={12} />,         onClick: () => router.push(`/dashboard/crm/clientes/${c.id}`) },
      { key: 'delete',   label: 'Excluir',            icon: <Trash2 size={12} />,      tone: 'danger',  onClick: () => removeOne(c) },
    ]
  }, [enrichOne, toggleTag, removeOne, router])

  // ── bulk actions ───────────────────────────────────────────────────────────
  const bulkActions: BulkAction<Customer>[] = useMemo(() => [
    { key: 'enrich-bulk', label: 'Enriquecer',   icon: <Sparkles size={11} />, onClick: rows => enrichBulk(rows) },
    { key: 'wa-bulk',     label: 'WhatsApp',     icon: <Send size={11} />,     onClick: rows => setWaModal({ rows }) },
    { key: 'pv-bulk',     label: 'Pós-venda',    icon: <Megaphone size={11} />, onClick: rows => pvBulk(rows) },
    { key: 'seg-bulk',    label: 'Segmento',     icon: <Tag size={11} />,      onClick: rows => openSegModal(rows) },
    { key: 'vip-bulk',    label: 'VIP',          icon: <Crown size={11} />,    onClick: rows => vipBulk(rows) },
    { key: 'block-bulk',  label: 'Bloquear',     icon: <Ban size={11} />,      tone: 'warn',   onClick: rows => blockBulk(rows) },
    { key: 'merge-bulk',  label: 'Mesclar',      icon: <GitMerge size={11} />, onClick: rows => mergeBulk(rows) },
    { key: 'export',      label: 'Exportar CSV', icon: <Map size={11} />,      onClick: rows => exportBulk(rows) },
  ], [enrichBulk, pvBulk, openSegModal, vipBulk, blockBulk, mergeBulk, exportBulk])

  // ── right panel ────────────────────────────────────────────────────────────
  const rightPanelSections: PanelSection[] = useMemo(() => {
    const ltvAvg = totals.ltv_avg ?? (totals.total ? totals.revenue / totals.total : 0)
    const gmvTotal = totals.gmv_total
    return [
      { title: 'Ferramentas', items: [
        { label: 'Buscar CPFs no ML', icon: <ScanLine size={12} />, badge: mlPending ?? undefined,
          tone: 'accent', disabled: !mlPending,
          loading: busy === 'ml',
          onClick: fetchMlBilling },
        { label: 'Enriquecer pendentes', icon: <Sparkles size={12} />, badge: totals.pending || undefined,
          tone: 'accent', disabled: !totals.pending,
          loading: busy === 'enrich',
          onClick: enrichBatch },
        { label: 'Resetar pedidos sem CPF',
          icon: <RotateCcw size={12} />,
          badge: orphans ? `${orphans} órfão${orphans === 1 ? '' : 's'}` : undefined,
          tone: 'warn',
          disabled: !orphans,
          loading: resetting,
          onClick: resetOrphans },
        { label: 'Detectar duplicados', icon: <GitMerge size={12} />, onClick: () => todoToast('Detecção de duplicados') },
        { label: 'Exportar lista atual', icon: <Map size={12} />, onClick: () => exportCsv(list) },
      ]},
      { title: 'Informações', items: [
        { label: 'Total',       value: totals.total.toLocaleString('pt-BR') },
        { label: 'Com CPF',     value: totals.with_cpf.toLocaleString('pt-BR') },
        { label: 'WhatsApp',    value: totals.with_wa.toLocaleString('pt-BR') },
        { label: 'Email',       value: totals.with_mail.toLocaleString('pt-BR') },
        { label: 'VIP',         value: totals.vip.toLocaleString('pt-BR'), tone: 'warn' },
        { label: 'Bloqueados',  value: totals.blocked.toLocaleString('pt-BR'), tone: 'danger' },
        ...(gmvTotal != null ? [{ label: 'GMV total',  value: brl(gmvTotal),       tone: 'success' as const }] : []),
        { label: 'GMV pág.',   value: brl(totals.revenue) },
        { label: 'LTV médio',   value: brl(ltvAvg) },
      ]},
    ]
  }, [totals, mlPending, orphans, busy, resetting, fetchMlBilling, enrichBatch, resetOrphans, exportCsv, list])

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <>
      <ToastViewport />

      {/* KPI strip — kept above DataTable for at-a-glance glance */}
      <div className="px-6 pt-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Kpi label="Total"     value={totals.total.toLocaleString('pt-BR')}      color="#00E5FF" />
          <Kpi label="Com CPF"   value={totals.with_cpf.toLocaleString('pt-BR')}   color="#a78bfa" />
          <Kpi label="WhatsApp"  value={totals.with_wa.toLocaleString('pt-BR')}    color="#25D366" />
          <Kpi label="Email"     value={totals.with_mail.toLocaleString('pt-BR')}  color="#60a5fa" />
          <Kpi label="GMV pág."  value={brl(totals.revenue)}                       color="#4ade80" />
        </div>
      </div>

      <DataTable<Customer>
        title="Clientes"
        breadcrumb={['CRM']}
        quickFilter={{
          label: 'Filtro', value: qf,
          options: [
            { value: 'all',      label: 'Todos' },
            { value: 'with_cpf', label: 'Com CPF' },
            { value: 'with_wa',  label: 'Com WhatsApp' },
            { value: 'vip',      label: 'VIP' },
            { value: 'pending',  label: 'Pendentes' },
            { value: 'blocked',  label: 'Bloqueados' },
          ],
          onChange: v => { setQf(v as QF); setPage(1); setSelected([]) },
        }}
        onIncluir={() => todoToast('Cadastro manual de cliente')}
        incluirLabel="Incluir cliente"

        search={{ value: searchStr, placeholder: 'Buscar por nome, telefone, email ou CPF…',
          onChange: v => { setSearchStr(v); setPage(1) } }}

        columns={columns}
        data={list}
        totalCount={total}
        loading={loading}
        getRowId={c => c.id}

        pagination={{
          page, perPage,
          onPageChange: setPage,
          onPerPageChange: pp => { setPerPage(pp); setPage(1) },
        }}

        selection={{ mode: 'multi', selected, onChange: setSelected }}
        bulkActions={bulkActions}
        rowActions={rowActions}

        rightPanel={{ title: 'Painel', sections: rightPanelSections }}

        emptyState={{
          icon: <Search size={20} />, title: 'Nenhum cliente encontrado',
          description: 'Tente limpar os filtros ou aguardar a próxima sincronização de pedidos.',
        }}
      />

      {waModal && (
        <WaSendModal rows={waModal.rows}
          onClose={() => setWaModal(null)}
          onSend={msg => sendWaBulk(waModal.rows, msg)} />
      )}

      {segModal && (
        <SegmentSelectModal rows={segModal.rows} segments={segments}
          onClose={() => setSegModal(null)}
          onPick={id => segmentBulk(segModal.rows, id)} />
      )}

      {mergeModal && mergeModal.rows.length === 2 && (
        <MergeModal rows={mergeModal.rows as [Customer, Customer]}
          onClose={() => setMergeModal(null)}
          onConfirm={(keep, discard) => {
            const keepRow    = mergeModal.rows.find(r => r.id === keep)
            const discardRow = mergeModal.rows.find(r => r.id === discard)
            setMergeModal(null)
            // Confirmação destrutiva final — backend agora soft-deleta + migra
            // FK em 5 tabelas, mas mesmo assim a UI não tem "desmesclar".
            setConfirmModal({
              open:         true,
              title:        'Confirmar mesclagem',
              message:      `Tem certeza? Os dados de "${discardRow?.display_name ?? 'cliente descartado'}" serão mesclados em "${keepRow?.display_name ?? 'cliente mantido'}" permanentemente. Esta ação não pode ser desfeita.`,
              confirmLabel: 'Sim, mesclar',
              confirmColor: '#ef4444',
              onConfirm: () => {
                setConfirmModal(null)
                void confirmMerge(keep, discard)
              },
            })
          }} />
      )}

      {confirmModal && (
        <ConfirmModal
          open={confirmModal.open}
          title={confirmModal.title}
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
          confirmLabel={confirmModal.confirmLabel}
          confirmColor={confirmModal.confirmColor}
        />
      )}
    </>
  )
}

// ── modais (extraídos pra arquivo separado seria overkill; ficam aqui) ────

function ModalShell({ title, onClose, children, maxWidth = 480 }: {
  title: string; onClose: () => void; children: React.ReactNode; maxWidth?: number
}) {
  // ESC fecha (assumido pela spec do ConfirmModal — fix retroativo, beneficia
  // todos os 4 modais que usam ModalShell).
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}>
      <div className="rounded-2xl w-full overflow-hidden"
        style={{ background: '#0c0c10', border: '1px solid #27272a', maxWidth }}
        onClick={e => e.stopPropagation()}>
        <header className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: '1px solid #1e1e24' }}>
          <span className="text-zinc-100 text-[13px] font-semibold">{title}</span>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 text-lg leading-none">×</button>
        </header>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}

function ConfirmModal({ open, title, message, onConfirm, onCancel, confirmLabel = 'Confirmar', confirmColor = '#ef4444' }: {
  open:          boolean
  title:         string
  message:       string
  onConfirm:     () => void
  onCancel:      () => void
  confirmLabel?: string
  confirmColor?: string
}) {
  if (!open) return null
  return (
    <ModalShell title={title} onClose={onCancel} maxWidth={420}>
      <p className="text-[12px] text-zinc-300 leading-relaxed">{message}</p>
      <div className="flex items-center justify-end gap-2 mt-4">
        <button onClick={onCancel}
          className="px-3 py-1.5 rounded-lg text-[12px] border border-zinc-800 text-zinc-300 hover:bg-zinc-900/50">
          Cancelar
        </button>
        <button onClick={onConfirm}
          className="px-3 py-1.5 rounded-lg text-[12px] font-semibold"
          style={{ background: `${confirmColor}1a`, color: confirmColor, border: `1px solid ${confirmColor}4d` }}>
          {confirmLabel}
        </button>
      </div>
    </ModalShell>
  )
}

function WaSendModal({ rows, onClose, onSend }: {
  rows: Customer[]; onClose: () => void; onSend: (msg: string) => void
}) {
  const [msg, setMsg] = useState('')
  const ready = msg.trim().length > 0
  return (
    <ModalShell title={`Disparar WhatsApp para ${rows.length} contato${rows.length === 1 ? '' : 's'}`} onClose={onClose} maxWidth={520}>
      <p className="text-[11px] text-zinc-500 mb-2">
        Mensagem livre (sem template). Use {'{{first_name}}'} se quiser personalizar.
      </p>
      <textarea value={msg} onChange={e => setMsg(e.target.value)}
        rows={6} placeholder="Olá {{first_name}}, ..."
        className="w-full p-3 text-[12px] rounded-lg bg-[#070709] border border-[#27272a] text-zinc-200 outline-none focus:border-[#00E5FF] resize-none" />
      <div className="flex items-center justify-end gap-2 mt-3">
        <button onClick={onClose}
          className="px-3 py-1.5 rounded-lg text-[12px] border border-zinc-800 text-zinc-300 hover:bg-zinc-900/50">Cancelar</button>
        <button onClick={() => onSend(msg)} disabled={!ready}
          className="px-3 py-1.5 rounded-lg text-[12px] font-semibold disabled:opacity-40"
          style={{ background: 'rgba(37,211,102,0.10)', color: '#25D366', border: '1px solid rgba(37,211,102,0.30)' }}>
          Enviar para {rows.length} contato{rows.length === 1 ? '' : 's'}
        </button>
      </div>
    </ModalShell>
  )
}

function SegmentSelectModal({ rows, segments, onClose, onPick }: {
  rows: Customer[]
  segments: Array<{ id: string; name: string; customer_count?: number }>
  onClose: () => void
  onPick: (segmentId: string) => void
}) {
  const [picked, setPicked] = useState<string>('')
  return (
    <ModalShell title={`Adicionar ${rows.length} cliente${rows.length === 1 ? '' : 's'} a um segmento`} onClose={onClose}>
      {segments.length === 0 ? (
        <p className="text-[12px] text-zinc-400">
          Nenhum segmento encontrado. Crie um em <span className="text-zinc-200">CRM &gt; Segmentos</span> primeiro.
        </p>
      ) : (
        <select value={picked} onChange={e => setPicked(e.target.value)}
          className="w-full px-3 py-2 text-[12px] rounded-lg bg-[#070709] border border-[#27272a] text-zinc-200 outline-none focus:border-[#00E5FF]">
          <option value="">Selecione um segmento…</option>
          {segments.map(s => (
            <option key={s.id} value={s.id}>
              {s.name}{typeof s.customer_count === 'number' ? ` (${s.customer_count})` : ''}
            </option>
          ))}
        </select>
      )}
      <div className="flex items-center justify-end gap-2 mt-3">
        <button onClick={onClose}
          className="px-3 py-1.5 rounded-lg text-[12px] border border-zinc-800 text-zinc-300 hover:bg-zinc-900/50">Cancelar</button>
        <button onClick={() => picked && onPick(picked)} disabled={!picked}
          className="px-3 py-1.5 rounded-lg text-[12px] font-semibold disabled:opacity-40"
          style={{ background: 'rgba(0,229,255,0.08)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.30)' }}>
          Adicionar ao segmento
        </button>
      </div>
    </ModalShell>
  )
}

function MergeModal({ rows, onClose, onConfirm }: {
  rows: [Customer, Customer]; onClose: () => void; onConfirm: (keepId: string, discardId: string) => void
}) {
  const [keep, setKeep] = useState<string>(rows[0].id)
  const discard = rows.find(r => r.id !== keep)?.id ?? rows[1].id
  return (
    <ModalShell title="Mesclar 2 clientes" onClose={onClose} maxWidth={680}>
      <p className="text-[11px] text-zinc-500 mb-3">
        Escolha qual cliente manter. O outro será apagado e seus dados/conversas migrados.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {rows.map(c => {
          const isKeep = keep === c.id
          return (
            <button key={c.id} onClick={() => setKeep(c.id)}
              className="rounded-xl p-3 text-left transition-colors"
              style={{
                background: isKeep ? 'rgba(74,222,128,0.06)' : '#070709',
                border: `1px solid ${isKeep ? 'rgba(74,222,128,0.40)' : '#27272a'}`,
              }}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-zinc-100 text-[12px] font-semibold truncate">{c.display_name ?? '(sem nome)'}</span>
                {isKeep && <span className="text-[10px] font-bold text-green-400">MANTER</span>}
              </div>
              <p className="text-[10px] text-zinc-500 truncate">CPF: {c.cpf ?? '—'}</p>
              <p className="text-[10px] text-zinc-500 truncate">Tel: {c.phone ?? '—'}</p>
              <p className="text-[10px] text-zinc-500 truncate">Email: {c.email ?? '—'}</p>
              <p className="text-[10px] text-zinc-500 truncate">{c.total_purchases ?? 0} compra{c.total_purchases === 1 ? '' : 's'}</p>
            </button>
          )
        })}
      </div>
      <div className="flex items-center justify-end gap-2 mt-4">
        <button onClick={onClose}
          className="px-3 py-1.5 rounded-lg text-[12px] border border-zinc-800 text-zinc-300 hover:bg-zinc-900/50">Cancelar</button>
        <button onClick={() => onConfirm(keep, discard)}
          className="px-3 py-1.5 rounded-lg text-[12px] font-semibold"
          style={{ background: 'rgba(0,229,255,0.08)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.30)' }}>
          Mesclar
        </button>
      </div>
    </ModalShell>
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

function _MoreIcon() { return <MoreHorizontal size={12} /> }
