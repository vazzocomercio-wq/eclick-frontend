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

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const totals = useMemo(() => ({
    total,
    with_cpf:    list.filter(c => c.cpf).length,
    with_wa:     list.filter(c => c.whatsapp_id || c.validated_whatsapp).length,
    with_mail:   list.filter(c => c.email).length,
    revenue:     list.reduce((s, c) => s + Number(c.total_purchases ?? 0), 0),
    pending:     list.filter(c => (c.enrichment_status ?? 'pending') === 'pending' && (c.cpf || c.phone || c.whatsapp_id)).length,
    vip:         list.filter(c => (c.tags ?? []).includes('vip')).length,
    blocked:     list.filter(c => (c.tags ?? []).includes('blocked')).length,
  }), [list, total])

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
    { key: 'cpf', label: 'CPF',
      render: c => (
        <span className="text-zinc-400 text-[11px]">
          <MaskedField type="cpf" value={c.cpf} customerId={c.id} copyable={!!c.cpf} hideToggle={!c.cpf} />
        </span>
      ) },
    { key: 'contatos', label: 'Contatos',
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
    { key: 'status', label: 'Status',
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
    { key: 'compras', label: 'Compras', align: 'right',
      render: c => (
        <div className="text-right">
          <p className="text-zinc-100 text-xs font-semibold tabular-nums">{brl(Number(c.total_purchases ?? 0))}</p>
          <p className="text-[10px] text-zinc-600">{c.total_conversations} conv.</p>
        </div>
      ),
    },
    { key: 'last_contact_at', label: 'Última', align: 'right', sortable: true,
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
    { key: 'enrich-bulk', label: 'Enriquecer',   icon: <Sparkles size={11} />, onClick: () => enrichBatch() },
    { key: 'wa-bulk',     label: 'WhatsApp',     icon: <Send size={11} />,     onClick: () => todoToast('WhatsApp em massa') },
    { key: 'pv-bulk',     label: 'Pós-venda',    icon: <Megaphone size={11} />, onClick: () => todoToast('Campanha pós-venda em massa') },
    { key: 'seg-bulk',    label: 'Segmento',     icon: <Tag size={11} />,      onClick: rows => todoToast(`Criar segmento com ${rows.length}`) },
    { key: 'vip-bulk',    label: 'VIP',          icon: <Crown size={11} />,    onClick: rows => rows.forEach(r => toggleTag(r, 'vip')) },
    { key: 'block-bulk',  label: 'Bloquear',     icon: <Ban size={11} />,      tone: 'warn', onClick: rows => rows.forEach(r => toggleTag(r, 'blocked')) },
    { key: 'merge-bulk',  label: 'Mesclar',      icon: <GitMerge size={11} />, onClick: () => todoToast('Detecção de duplicados') },
    { key: 'export',      label: 'Exportar CSV', icon: <Map size={11} />,      onClick: rows => exportCsv(rows) },
  ], [enrichBatch, exportCsv, toggleTag])

  // ── right panel ────────────────────────────────────────────────────────────
  const rightPanelSections: PanelSection[] = useMemo(() => {
    const ltvAvg = totals.total ? totals.revenue / totals.total : 0
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
        { label: 'Total',        value: total.toLocaleString('pt-BR') },
        { label: 'Com CPF',      value: totals.with_cpf.toLocaleString('pt-BR') },
        { label: 'WhatsApp',     value: totals.with_wa.toLocaleString('pt-BR') },
        { label: 'Email',        value: totals.with_mail.toLocaleString('pt-BR') },
        { label: 'VIP',          value: totals.vip.toLocaleString('pt-BR'), tone: 'warn' },
        { label: 'Bloqueados',   value: totals.blocked.toLocaleString('pt-BR'), tone: 'danger' },
        { label: 'GMV (página)', value: brl(totals.revenue),  tone: 'success' },
        { label: 'LTV médio',    value: brl(ltvAvg) },
      ]},
    ]
  }, [totals, total, mlPending, orphans, busy, resetting, fetchMlBilling, enrichBatch, resetOrphans, exportCsv, list])

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
    </>
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
