'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase'
import {
  ArrowLeft, AlertCircle, Calendar, Building2, FileText,
  Ban, Package, Download, Send, Mail, MessageSquare, CheckCircle2,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

interface OCItem {
  id: string
  partner_sku: string
  master_sku: string | null
  product_name: string
  variation_label: string | null
  quantity: number
  unit_cost: number
  packaging_cost: number
  handling_cost: number
  unit_total_cost: number
  line_total: number
  marketplace: string
  ml_order_id: string | null
  ml_pack_id: string | null
  sale_date: string
  shipped_at: string | null
  status: string
  products: { id: string; name: string; photo_urls: string[] | null } | null
}

interface OCDetail {
  id: string
  oc_number: string
  marketplace: string
  marketplace_account_label: string | null
  reference_date: string
  generation_date: string
  due_date: string
  items_count: number
  units_count: number
  gross_total: number
  total_credits: number
  return_credits: number
  cancellation_credits: number
  warranty_credits: number
  divergence_credits: number
  other_credits: number
  net_total: number
  status: string
  sent_to_partner_at: string | null
  partner_viewed_at: string | null
  partner_approved_at: string | null
  partner_rejection_reason: string | null
  paid_at: string | null
  notes: string | null
  pdf_url: string | null
  excel_url: string | null
  created_at: string
  suppliers: {
    id: string
    name: string
    legal_name: string | null
    tax_id: string | null
    contact_email: string | null
    contact_phone: string | null
    payment_terms: string | null
    payment_method: string | null
  } | null
  items: OCItem[]
}

export default function OCDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const supabase = useMemo(() => createClient(), [])

  const [oc, setOc] = useState<OCDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<{ portal_url: string; email_status: string; whatsapp_status: string } | null>(null)

  const getHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Não autenticado')
    return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
  }, [supabase])

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/dropship/oc/${id}`, { headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setOc(await res.json())
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao carregar')
    } finally { setLoading(false) }
  }, [getHeaders, id])

  useEffect(() => { load() }, [load])

  async function handleCancel() {
    const reason = prompt('Motivo do cancelamento (pedidos voltam pra fila de OC):')
    if (!reason?.trim()) return
    setCancelling(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/dropship/oc/${id}/cancel`, {
        method: 'POST', headers, body: JSON.stringify({ reason }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      router.push('/dashboard/dropship/oc')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao cancelar')
    } finally { setCancelling(false) }
  }

  async function handleSend() {
    if (!oc) return
    // Pre-flight: verifica setup
    try {
      const headers = await getHeaders()
      const setupRes = await fetch(`${BACKEND}/dropship/setup-status`, { headers })
      if (setupRes.ok) {
        const setup = await setupRes.json()
        if (!setup.has_email_config) {
          if (!confirm(
            'Você ainda não configurou provider de e-mail (Resend/SendGrid). ' +
            'O parceiro NÃO vai receber a notificação por e-mail.\n\n' +
            'Configure em /dashboard/configuracoes/integracoes antes de continuar.\n\n' +
            'Deseja enviar mesmo assim (só vai criar o link, sem disparar)?'
          )) return
        } else if (!confirm(`Enviar OC ${oc.oc_number} ao parceiro? Vai disparar e-mail${setup.has_whatsapp_config ? ' + WhatsApp' : ''} com link de aprovação.`)) {
          return
        }
      }
    } catch { /* segue mesmo se check falhar */ }

    setSending(true); setErr('')
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/dropship/oc/${id}/send`, { method: 'POST', headers })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.message ?? `HTTP ${res.status}`)
      }
      const r = await res.json()
      setSendResult(r)
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao enviar')
    } finally { setSending(false) }
  }

  function downloadExcel() {
    if (!oc) return
    // 1. Aba "OC" — cabeçalho da ordem
    const summary = [
      ['ORDEM DE COMPRA DROPSHIP'],
      [],
      ['Número', oc.oc_number],
      ['Parceiro', oc.suppliers?.name ?? '—'],
      ['CNPJ', oc.suppliers?.tax_id ?? '—'],
      ['Razão Social', oc.suppliers?.legal_name ?? '—'],
      [],
      ['Marketplace', oc.marketplace],
      ['Conta', oc.marketplace_account_label ?? '—'],
      [],
      ['Data Referência', fmtDate(oc.reference_date)],
      ['Geração', fmtDateTime(oc.generation_date)],
      ['Vencimento', fmtDate(oc.due_date)],
      ['Prazo Pagamento', oc.suppliers?.payment_terms ? `${oc.suppliers.payment_terms} dias` : '—'],
      ['Método Pagamento', oc.suppliers?.payment_method ?? '—'],
      [],
      ['Itens', oc.items_count],
      ['Unidades', oc.units_count],
      ['Bruto', oc.gross_total],
      ['Devoluções', -oc.return_credits],
      ['Cancelamentos', -oc.cancellation_credits],
      ['Garantias', -oc.warranty_credits],
      ['Divergências', -oc.divergence_credits],
      ['Outros', -oc.other_credits],
      ['Total Créditos', -oc.total_credits],
      ['LÍQUIDO', oc.net_total],
      [],
      ['Status', oc.status],
    ]
    const summarySheet = XLSX.utils.aoa_to_sheet(summary)
    summarySheet['!cols'] = [{ wch: 25 }, { wch: 50 }]

    // 2. Aba "Itens" — tabela de produtos
    const itemHeaders = [
      'SKU Parceiro', 'Master SKU', 'Produto', 'Variação',
      'Marketplace', 'Pedido ML', 'Pack ID',
      'Qtd', 'Custo Unit.', 'Embalagem', 'Manuseio', 'Total Linha',
      'Data Venda', 'Data Envio', 'Status',
    ]
    const itemRows = oc.items.map(it => [
      it.partner_sku,
      it.master_sku ?? '',
      it.product_name,
      it.variation_label ?? '',
      it.marketplace,
      it.ml_order_id ?? '',
      it.ml_pack_id ?? '',
      it.quantity,
      Number(it.unit_cost),
      Number(it.packaging_cost),
      Number(it.handling_cost),
      Number(it.line_total),
      fmtDate(it.sale_date),
      it.shipped_at ? fmtDate(it.shipped_at) : '',
      it.status,
    ])
    const itemsSheet = XLSX.utils.aoa_to_sheet([itemHeaders, ...itemRows])
    itemsSheet['!cols'] = [
      { wch: 18 }, { wch: 18 }, { wch: 40 }, { wch: 15 },
      { wch: 15 }, { wch: 18 }, { wch: 15 },
      { wch: 6 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 },
      { wch: 12 }, { wch: 12 }, { wch: 12 },
    ]

    // Compose workbook
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, summarySheet, 'OC')
    XLSX.utils.book_append_sheet(wb, itemsSheet, 'Itens')

    XLSX.writeFile(wb, `${oc.oc_number}.xlsx`)
  }

  if (loading) return <div className="min-h-screen p-6 text-zinc-500" style={{ background: 'var(--background)' }}>Carregando...</div>
  if (!oc) {
    return (
      <div className="min-h-screen p-6" style={{ background: 'var(--background)', color: '#fff' }}>
        <div className="rounded-lg p-3 text-sm" style={{
          background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)',
        }}>
          OC não encontrada. {err && `(${err})`}{' '}
          <Link href="/dashboard/dropship/oc" style={{ color: '#00E5FF' }}>Voltar à lista</Link>
        </div>
      </div>
    )
  }

  const canCancel = !['paid', 'cancelled'].includes(oc.status)

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--background)', color: '#fff' }}>
      {/* header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/dropship/oc" className="text-zinc-500 hover:text-white">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-white font-mono">{oc.oc_number}</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              {oc.suppliers?.name ?? '—'} · {oc.marketplace_account_label ?? oc.marketplace}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadExcel}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors hover:bg-[#1a1a1f]"
            style={{ border: '1px solid #27272a', color: '#a1a1aa' }}
            title="Download XLSX"
          >
            <Download size={14} />
            Excel
          </button>
          {['generated', 'sent', 'viewed'].includes(oc.status) && (
            <button
              onClick={handleSend}
              disabled={sending}
              className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg"
              style={{ background: '#00E5FF', color: '#09090b', opacity: sending ? 0.6 : 1 }}
              title="Enviar e-mail + WhatsApp ao parceiro com link de aprovação"
            >
              <Send size={14} />
              {sending ? 'Enviando...' : oc.status === 'generated' ? 'Enviar Parceiro' : 'Reenviar'}
            </button>
          )}
          <button
            onClick={async () => {
              try {
                const headers = await getHeaders()
                const res = await fetch(`${BACKEND}/dropship/oc/${id}/pdf`, { headers })
                if (!res.ok) throw new Error(`PDF HTTP ${res.status}`)
                const blob = await res.blob()
                const url = URL.createObjectURL(blob)
                window.open(url, '_blank')
                setTimeout(() => URL.revokeObjectURL(url), 60_000)
              } catch (e) {
                setErr(e instanceof Error ? e.message : 'Erro ao gerar PDF')
              }
            }}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors hover:bg-[#1a1a1f]"
            style={{ border: '1px solid #27272a', color: '#a1a1aa' }}
            title="Visualizar PDF"
          >
            <FileText size={14} />
            PDF
          </button>
          {canCancel && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg"
              style={{ border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}
            >
              <Ban size={14} />
              {cancelling ? 'Cancelando...' : 'Cancelar OC'}
            </button>
          )}
        </div>
      </div>

      {err && (
        <div className="rounded-lg p-3 text-sm mb-4" style={{
          background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)',
        }}>
          <AlertCircle size={14} className="inline mr-2" />
          {err}
        </div>
      )}

      {/* send result */}
      {sendResult && (
        <div className="rounded-xl p-4 mb-4 space-y-2" style={{
          background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)',
        }}>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} style={{ color: '#22c55e' }} />
            <p className="text-sm font-medium text-white">Notificação enviada ao parceiro</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-zinc-400">
            <p><Mail size={11} className="inline mr-1" />E-mail: <span className="text-zinc-200">{sendResult.email_status}</span></p>
            <p><MessageSquare size={11} className="inline mr-1" />WhatsApp: <span className="text-zinc-200">{sendResult.whatsapp_status}</span></p>
          </div>
          <p className="text-xs text-zinc-500 pt-1">
            Link do portal:{' '}
            <button
              onClick={() => navigator.clipboard.writeText(sendResult.portal_url)}
              className="font-mono"
              style={{ color: '#00E5FF' }}
              title="Copiar link"
            >
              {sendResult.portal_url}
            </button>
          </p>
        </div>
      )}

      {/* OC já enviada — info do envio anterior */}
      {!sendResult && oc.sent_to_partner_at && (
        <div className="rounded-xl p-3 mb-4 flex items-center gap-2 text-sm" style={{
          background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.2)',
        }}>
          <Send size={14} style={{ color: '#60a5fa' }} />
          <p className="text-zinc-300">
            Enviada ao parceiro em <strong>{fmtDateTime(oc.sent_to_partner_at)}</strong>
            {oc.partner_viewed_at && <> · visualizada em <strong>{fmtDateTime(oc.partner_viewed_at)}</strong></>}
            {oc.partner_approved_at && <> · aprovada em <strong style={{ color: '#22c55e' }}>{fmtDateTime(oc.partner_approved_at)}</strong></>}
          </p>
        </div>
      )}

      {/* status + datas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
          <p className="text-xs text-zinc-500 mb-2">Status</p>
          <OCStatusPill status={oc.status} />
        </div>
        <div className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
          <p className="text-xs text-zinc-500 mb-1 flex items-center gap-1">
            <Calendar size={11} />
            Data referência
          </p>
          <p className="text-base font-semibold text-white">{fmtDate(oc.reference_date)}</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
          <p className="text-xs text-zinc-500 mb-1 flex items-center gap-1">
            <Calendar size={11} />
            Vencimento
          </p>
          <p className="text-base font-semibold text-white">{fmtDate(oc.due_date)}</p>
        </div>
      </div>

      {/* totais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Kpi label="Itens" value={oc.items_count} />
        <Kpi label="Unidades" value={oc.units_count} />
        <Kpi label="Bruto" value={fmtBrl(oc.gross_total)} />
        <Kpi
          label="Líquido"
          value={fmtBrl(oc.net_total)}
          accent="#00E5FF"
        />
      </div>

      {/* breakdown créditos (se houver) */}
      {oc.total_credits > 0 && (
        <div className="rounded-xl p-4 mb-6" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Créditos aplicados</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            <CreditLine label="Devoluções" value={oc.return_credits} />
            <CreditLine label="Cancelamentos" value={oc.cancellation_credits} />
            <CreditLine label="Garantias" value={oc.warranty_credits} />
            <CreditLine label="Divergências" value={oc.divergence_credits} />
            <CreditLine label="Outros" value={oc.other_credits} />
          </div>
        </div>
      )}

      {/* dados do parceiro */}
      <div className="rounded-xl p-4 mb-6" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Building2 size={12} />
          Dados do Parceiro
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Field label="Razão Social" value={oc.suppliers?.legal_name ?? '—'} />
          <Field label="CNPJ" value={oc.suppliers?.tax_id ?? '—'} />
          <Field label="E-mail" value={oc.suppliers?.contact_email ?? '—'} />
          <Field label="Telefone" value={oc.suppliers?.contact_phone ?? '—'} />
          <Field label="Prazo pgto" value={oc.suppliers?.payment_terms ? `${oc.suppliers.payment_terms} dias` : '—'} />
          <Field label="Método" value={oc.suppliers?.payment_method ?? '—'} />
        </div>
      </div>

      {/* items */}
      <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
        Itens ({oc.items.length})
      </h2>
      <div className="rounded-xl overflow-x-auto" style={{ border: '1px solid #1a1a1f' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#111114', borderBottom: '1px solid #1a1a1f' }}>
              {['Produto', 'SKU Parceiro', 'Pedido ML', 'Qtd', 'Custo', 'Embal.', 'Manuseio', 'Total Linha', 'Status'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-zinc-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {oc.items.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-zinc-500 text-sm">Sem itens nessa OC</td></tr>
            ) : oc.items.map(it => (
              <tr key={it.id} style={{ borderBottom: '1px solid #1a1a1f' }}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {it.products?.photo_urls?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.products.photo_urls[0]} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded flex items-center justify-center shrink-0" style={{ background: '#1a1a1f' }}>
                        <Package size={12} className="text-zinc-600" />
                      </div>
                    )}
                    <p className="text-white text-xs truncate max-w-[280px]">{it.product_name}</p>
                  </div>
                </td>
                <td className="px-4 py-3 text-zinc-300 font-mono text-xs">{it.partner_sku}</td>
                <td className="px-4 py-3 text-zinc-400 text-xs font-mono">{it.ml_order_id ?? '—'}</td>
                <td className="px-4 py-3 text-zinc-300">{it.quantity}</td>
                <td className="px-4 py-3 text-zinc-300 text-xs">{fmtBrl(it.unit_cost)}</td>
                <td className="px-4 py-3 text-zinc-500 text-xs">{it.packaging_cost > 0 ? fmtBrl(it.packaging_cost) : '—'}</td>
                <td className="px-4 py-3 text-zinc-500 text-xs">{it.handling_cost > 0 ? fmtBrl(it.handling_cost) : '—'}</td>
                <td className="px-4 py-3 font-semibold text-white text-xs">{fmtBrl(it.line_total)}</td>
                <td className="px-4 py-3"><ItemStatusPill status={it.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* notas */}
      {oc.notes && (
        <div className="mt-6 rounded-xl p-4" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Notas</p>
          <p className="text-sm text-zinc-300">{oc.notes}</p>
        </div>
      )}

      {/* placeholder portal/envio */}
      <div className="mt-6 rounded-xl p-4 flex items-center gap-3" style={{ background: 'rgba(252,211,77,0.05)', border: '1px solid rgba(252,211,77,0.2)' }}>
        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(252,211,77,0.10)', color: '#fcd34d', border: '1px solid rgba(252,211,77,0.3)' }}>
          Em breve
        </span>
        <p className="text-sm text-zinc-300">
          Portal do parceiro com aprovação por token + envio automático de e-mail/WhatsApp + PDF
          chegam no Sprint 6. Por enquanto use o download Excel acima pra enviar manualmente.
        </p>
      </div>
    </div>
  )
}

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Components ─────────────────────────────────────────────────────────────────

function Kpi({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className="text-xl font-semibold" style={{ color: accent ?? '#fff' }}>{value}</p>
    </div>
  )
}

function CreditLine({ label, value }: { label: string; value: number }) {
  if (value <= 0) {
    return (
      <div>
        <p className="text-xs text-zinc-500 mb-0.5">{label}</p>
        <p className="text-zinc-700 text-sm">—</p>
      </div>
    )
  }
  return (
    <div>
      <p className="text-xs text-zinc-500 mb-0.5">{label}</p>
      <p className="text-sm font-semibold" style={{ color: '#fcd34d' }}>-{fmtBrl(value)}</p>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-zinc-500 mb-0.5">{label}</p>
      <p className="text-sm text-white truncate">{value}</p>
    </div>
  )
}

function OCStatusPill({ status }: { status: string }) {
  const c: Record<string, { bg: string; fg: string; label: string }> = {
    draft:               { bg: 'rgba(113,113,122,0.10)', fg: '#a1a1aa', label: 'Prévia' },
    preview_locked:      { bg: 'rgba(252,211,77,0.10)',  fg: '#fcd34d', label: 'Trancada' },
    generated:           { bg: 'rgba(0,229,255,0.10)',   fg: '#00E5FF', label: 'Gerada' },
    sent:                { bg: 'rgba(96,165,250,0.10)',  fg: '#60a5fa', label: 'Enviada' },
    viewed:              { bg: 'rgba(96,165,250,0.10)',  fg: '#60a5fa', label: 'Visualizada' },
    approved:            { bg: 'rgba(34,197,94,0.10)',   fg: '#22c55e', label: 'Aprovada' },
    approved_with_notes: { bg: 'rgba(252,211,77,0.10)',  fg: '#fcd34d', label: 'Aprov. c/ notas' },
    rejected:            { bg: 'rgba(248,113,113,0.10)', fg: '#f87171', label: 'Rejeitada' },
    in_payable:          { bg: 'rgba(96,165,250,0.10)',  fg: '#60a5fa', label: 'A pagar' },
    paid:                { bg: 'rgba(34,197,94,0.10)',   fg: '#22c55e', label: 'Paga' },
    cancelled:           { bg: 'rgba(113,113,122,0.10)', fg: '#71717a', label: 'Cancelada' },
  }
  const x = c[status] ?? { bg: 'rgba(113,113,122,0.10)', fg: '#a1a1aa', label: status }
  return (
    <span className="inline-block px-3 py-1 rounded-full text-sm font-medium"
      style={{ background: x.bg, color: x.fg, border: `1px solid ${x.fg}33` }}>
      {x.label}
    </span>
  )
}

function ItemStatusPill({ status }: { status: string }) {
  const c: Record<string, { bg: string; fg: string; label: string }> = {
    included:       { bg: 'rgba(34,197,94,0.10)',   fg: '#22c55e', label: 'Incluído' },
    pending_credit: { bg: 'rgba(252,211,77,0.10)',  fg: '#fcd34d', label: 'Aguard. crédito' },
    credited:       { bg: 'rgba(96,165,250,0.10)',  fg: '#60a5fa', label: 'Creditado' },
    disputed:       { bg: 'rgba(248,113,113,0.10)', fg: '#f87171', label: 'Em disputa' },
    excluded:       { bg: 'rgba(113,113,122,0.10)', fg: '#71717a', label: 'Excluído' },
  }
  const x = c[status] ?? c.included
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: x.bg, color: x.fg, border: `1px solid ${x.fg}33` }}>
      {x.label}
    </span>
  )
}

function fmtBrl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
