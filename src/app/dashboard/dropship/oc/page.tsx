'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useConfirm } from '@/components/ui/dialog-provider'
import {
  ArrowLeft, AlertCircle, FileText, RefreshCw, ChevronRight, Eye, Clock, Lock,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

interface OC {
  id: string
  oc_number: string
  marketplace: string | null
  marketplace_account_label: string | null
  reference_date: string
  generation_date: string
  due_date: string
  items_count: number
  units_count: number
  gross_total: number
  total_credits: number
  net_total: number
  status: string
  sent_to_partner_at: string | null
  partner_approved_at: string | null
  paid_at: string | null
  suppliers: { id: string; name: string } | null
}

export default function OCsListPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [ocs, setOcs] = useState<OC[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [generating, setGenerating] = useState(false)
  const confirm = useConfirm()

  const getHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Não autenticado')
    return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
  }, [supabase])

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      const headers = await getHeaders()
      const params = new URLSearchParams()
      if (filterStatus !== 'all') params.set('status', filterStatus)
      const res = await fetch(`${BACKEND}/dropship/oc?${params}`, { headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setOcs(await res.json())
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao carregar')
      setOcs([])
    } finally { setLoading(false) }
  }, [getHeaders, filterStatus])

  useEffect(() => { load() }, [load])

  async function generateNow() {
    const ok = await confirm({
      title: 'Gerar OCs fora do horário',
      message: 'Vai gerar agora (fora das 22h programadas). Apenas pedidos elegíveis sem OC ativa serão incluídos.',
      confirmLabel: 'Gerar OCs',
      variant: 'warning',
    })
    if (!ok) return
    setGenerating(true); setErr('')
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/dropship/oc/generate`, { method: 'POST', headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const r = await res.json()
      if (r.length === 0) setErr('Nenhuma OC gerada — sem pedidos elegíveis no momento')
      else await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao gerar')
    } finally { setGenerating(false) }
  }

  // KPIs
  const total = ocs.length
  const drafts = ocs.filter(o => ['draft', 'preview_locked', 'generated'].includes(o.status)).length
  const pendingApproval = ocs.filter(o => ['sent', 'viewed'].includes(o.status)).length
  const totalNet = ocs.reduce((s, o) => s + Number(o.net_total ?? 0), 0)

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--background)', color: '#fff' }}>
      {/* header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/dropship" className="text-zinc-500 hover:text-white">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-white">Ordens de Compra Dropship</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Geradas automaticamente às 22h (1 OC por parceiro/marketplace/conta)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/dropship/oc/preview"
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors"
            style={{ border: '1px solid #27272a', color: '#a1a1aa' }}
          >
            <Eye size={14} />
            Ver Prévia
          </Link>
          <button
            onClick={generateNow}
            disabled={generating}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg"
            style={{ background: '#00E5FF', color: '#09090b', opacity: generating ? 0.6 : 1 }}
          >
            <RefreshCw size={14} className={generating ? 'animate-spin' : ''} />
            {generating ? 'Gerando...' : 'Gerar agora'}
          </button>
        </div>
      </div>

      {err && (
        <div className="rounded-lg p-3 text-sm mb-4" style={{
          background: 'rgba(252,211,77,0.10)', color: '#fcd34d', border: '1px solid rgba(252,211,77,0.3)',
        }}>
          <AlertCircle size={14} className="inline mr-2" />
          {err}
        </div>
      )}

      {/* Cutoff banner — fase do dia */}
      <CutoffBanner />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Kpi label="Total OCs" value={total} />
        <Kpi label="Geradas (sem envio)" value={drafts} accent={drafts > 0 ? '#fcd34d' : undefined} />
        <Kpi label="Aguardando aprovação" value={pendingApproval} />
        <Kpi label="Valor líquido total" value={fmtBrl(totalNet)} />
      </div>

      {/* filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex rounded-lg overflow-hidden flex-wrap" style={{ border: '1px solid #27272a' }}>
          {['all', 'generated', 'sent', 'approved', 'in_payable', 'paid', 'cancelled'].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className="px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: filterStatus === s ? '#00E5FF' : 'transparent',
                color: filterStatus === s ? '#09090b' : '#a1a1aa',
              }}
            >
              {s === 'all' ? 'Todas' : statusLabel(s)}
            </button>
          ))}
        </div>
      </div>

      {/* table */}
      <div className="rounded-xl overflow-x-auto" style={{ border: '1px solid #1a1a1f' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#111114', borderBottom: '1px solid #1a1a1f' }}>
              {['Número', 'Parceiro', 'Marketplace', 'Data ref.', 'Vencimento', 'Itens', 'Bruto', 'Créditos', 'Líquido', 'Status', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-zinc-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} className="px-4 py-12 text-center text-zinc-500 text-sm">Carregando...</td></tr>
            ) : ocs.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-12 text-center text-zinc-500 text-sm">
                  <FileText size={28} className="mx-auto mb-2 text-zinc-700" />
                  Nenhuma OC gerada{filterStatus !== 'all' ? ' nesse filtro' : ''}.
                  <p className="text-xs mt-1">
                    Cron @22h gera OCs com pedidos elegíveis. Use "Gerar agora" pra forçar fora do horário.
                  </p>
                </td>
              </tr>
            ) : ocs.map(o => (
              <tr
                key={o.id}
                onClick={() => router.push(`/dashboard/dropship/oc/${o.id}`)}
                className="cursor-pointer transition-colors"
                style={{ borderBottom: '1px solid #1a1a1f' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#111114'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                <td className="px-4 py-3 font-mono text-xs text-zinc-300">{o.oc_number}</td>
                <td className="px-4 py-3 text-white">{o.suppliers?.name ?? '—'}</td>
                <td className="px-4 py-3 text-zinc-400 text-xs">{o.marketplace_account_label ?? o.marketplace}</td>
                <td className="px-4 py-3 text-zinc-400 text-xs">{fmtDate(o.reference_date)}</td>
                <td className="px-4 py-3 text-zinc-300 text-xs">{fmtDate(o.due_date)}</td>
                <td className="px-4 py-3 text-zinc-300">{o.items_count}</td>
                <td className="px-4 py-3 text-zinc-300 text-xs">{fmtBrl(o.gross_total)}</td>
                <td className="px-4 py-3 text-xs" style={{ color: o.total_credits > 0 ? '#fcd34d' : '#71717a' }}>
                  {o.total_credits > 0 ? `-${fmtBrl(o.total_credits)}` : '—'}
                </td>
                <td className="px-4 py-3 font-semibold text-white text-xs">{fmtBrl(o.net_total)}</td>
                <td className="px-4 py-3"><OCStatusPill status={o.status} /></td>
                <td className="px-4 py-3 text-right">
                  <ChevronRight size={14} className="inline text-zinc-600" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Components ─────────────────────────────────────────────────────────────────

function CutoffBanner() {
  // Re-render a cada minuto pro countdown atualizar
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const h = now.getHours()
  const m = now.getMinutes()

  // 12:00 → 21:00 = janela de prévia (editável)
  // 21:00 → 22:00 = preview locked (admin only)
  // 22:00 = geração
  // 22:00 → 12:00 (next day) = depois geração

  let phase: 'before_preview' | 'preview_open' | 'preview_locked' | 'generating'
  let nextEventLabel: string
  let nextEventHour: number

  if (h < 12) {
    phase = 'before_preview'
    nextEventLabel = 'Prévia abre'
    nextEventHour = 12
  } else if (h < 21) {
    phase = 'preview_open'
    nextEventLabel = 'Prévia trava'
    nextEventHour = 21
  } else if (h < 22) {
    phase = 'preview_locked'
    nextEventLabel = 'Geração'
    nextEventHour = 22
  } else {
    phase = 'generating'
    nextEventLabel = 'Próxima prévia'
    nextEventHour = 36  // 12:00 next day
  }

  const minsUntil = nextEventHour < 24
    ? (nextEventHour - h) * 60 - m
    : (24 - h + 12) * 60 - m

  const hoursLeft = Math.floor(minsUntil / 60)
  const minsLeft = minsUntil % 60
  const countdown = hoursLeft > 0 ? `${hoursLeft}h${String(minsLeft).padStart(2, '0')}min` : `${minsLeft}min`

  const cfg: Record<string, { bg: string; border: string; fg: string; icon: React.ReactNode; title: string }> = {
    before_preview: {
      bg: 'rgba(113,113,122,0.05)',
      border: 'rgba(113,113,122,0.2)',
      fg: '#a1a1aa',
      icon: <Clock size={18} />,
      title: 'Aguardando prévia abrir',
    },
    preview_open: {
      bg: 'rgba(0,229,255,0.05)',
      border: 'rgba(0,229,255,0.2)',
      fg: '#00E5FF',
      icon: <Eye size={18} />,
      title: 'Prévia aberta — pedidos elegíveis editáveis',
    },
    preview_locked: {
      bg: 'rgba(252,211,77,0.05)',
      border: 'rgba(252,211,77,0.2)',
      fg: '#fcd34d',
      icon: <Lock size={18} />,
      title: 'Prévia trancada — admin pode liberar',
    },
    generating: {
      bg: 'rgba(34,197,94,0.05)',
      border: 'rgba(34,197,94,0.2)',
      fg: '#22c55e',
      icon: <FileText size={18} />,
      title: 'OCs do dia geradas',
    },
  }
  const c = cfg[phase]

  return (
    <div className="rounded-xl p-4 mb-6 flex items-center gap-3" style={{
      background: c.bg, border: `1px solid ${c.border}`,
    }}>
      <span style={{ color: c.fg }}>{c.icon}</span>
      <div className="flex-1">
        <p className="text-sm text-white font-medium">{c.title}</p>
        <p className="text-xs text-zinc-400 mt-0.5">
          {nextEventLabel} em <strong style={{ color: c.fg }}>{countdown}</strong>
          {' · '}
          12h abre · 21h trava · 22h gera
        </p>
      </div>
    </div>
  )
}

function Kpi({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className="text-2xl font-semibold" style={{ color: accent ?? '#fff' }}>{value}</p>
    </div>
  )
}

function OCStatusPill({ status }: { status: string }) {
  const c: Record<string, { bg: string; fg: string; label: string }> = {
    draft:               { bg: 'rgba(113,113,122,0.10)', fg: '#a1a1aa', label: 'Prévia' },
    preview_locked:      { bg: 'rgba(252,211,77,0.10)',  fg: '#fcd34d', label: 'Trancada' },
    generating:          { bg: 'rgba(0,229,255,0.10)',   fg: '#00E5FF', label: 'Gerando' },
    generated:           { bg: 'rgba(0,229,255,0.10)',   fg: '#00E5FF', label: 'Gerada' },
    sent:                { bg: 'rgba(96,165,250,0.10)',  fg: '#60a5fa', label: 'Enviada' },
    viewed:              { bg: 'rgba(96,165,250,0.10)',  fg: '#60a5fa', label: 'Visualizada' },
    approved:            { bg: 'rgba(34,197,94,0.10)',   fg: '#22c55e', label: 'Aprovada' },
    approved_with_notes: { bg: 'rgba(252,211,77,0.10)',  fg: '#fcd34d', label: 'Aprov. c/ notas' },
    rejected:            { bg: 'rgba(248,113,113,0.10)', fg: '#f87171', label: 'Rejeitada' },
    in_payable:          { bg: 'rgba(96,165,250,0.10)',  fg: '#60a5fa', label: 'A pagar' },
    paid:                { bg: 'rgba(34,197,94,0.10)',   fg: '#22c55e', label: 'Paga' },
    partially_paid:      { bg: 'rgba(252,211,77,0.10)',  fg: '#fcd34d', label: 'Pago parcial' },
    cancelled:           { bg: 'rgba(113,113,122,0.10)', fg: '#71717a', label: 'Cancelada' },
    on_hold:             { bg: 'rgba(252,211,77,0.10)',  fg: '#fcd34d', label: 'Em hold' },
  }
  const x = c[status] ?? { bg: 'rgba(113,113,122,0.10)', fg: '#a1a1aa', label: status }
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
      style={{ background: x.bg, color: x.fg, border: `1px solid ${x.fg}33` }}>
      {x.label}
    </span>
  )
}

function statusLabel(s: string): string {
  const m: Record<string, string> = {
    generated: 'Geradas', sent: 'Enviadas', approved: 'Aprovadas',
    in_payable: 'A pagar', paid: 'Pagas', cancelled: 'Canceladas',
  }
  return m[s] ?? s
}

function fmtBrl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
