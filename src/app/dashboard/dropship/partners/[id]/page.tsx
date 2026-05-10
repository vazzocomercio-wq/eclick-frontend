'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useConfirm } from '@/components/ui/dialog-provider'
import { ArrowLeft, Save, Archive, AlertCircle, Package, History, Trophy, TrendingUp, TrendingDown, Minus } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

interface PartnerDetail {
  id: string
  supplier_id: string
  dropship_status: 'active' | 'paused' | 'inactive' | 'pending_setup'
  notification_email: string
  notification_whatsapp: string | null
  cutoff_time: string
  ship_lead_days: number
  oc_generation_time: string
  oc_preview_open_time: string
  oc_review_cutoff_time: string
  integration_type: string
  cost_strategy: string
  return_credit_strategy: string
  cost_divergence_tolerance_pct: number
  stock_divergence_tolerance_units: number
  marketplaces_supported: string[]
  active_dropship_skus: number
  orders_30d: number
  revenue_30d: number
  pending_payable: number
  partner_score: number | null
  paused_reason: string | null
  notes: string | null
  created_at: string
  suppliers: {
    id: string
    name: string
    legal_name: string | null
    tax_id: string | null
    contact_name: string | null
    contact_email: string | null
    contact_phone: string | null
    contact_whatsapp: string | null
    payment_terms: string | null
    payment_method: string | null
    is_active: boolean
  }
}

export default function PartnerDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = useMemo(() => createClient(), [])

  const [partner, setPartner] = useState<PartnerDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [savedOk, setSavedOk] = useState(false)

  // Score history (último período + delta)
  const [latestScore, setLatestScore] = useState<{
    total_score: number
    score_change: number | null
    period_end: string
    score_breakdown: Record<string, number>
  } | null>(null)
  const [creditsBalance, setCreditsBalance] = useState<number>(0)
  const confirm = useConfirm()

  // form local
  const [form, setForm] = useState<Record<string, unknown>>({})

  const getHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Não autenticado')
    return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
  }, [supabase])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/dropship/partners/${id}`, { headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: PartnerDetail = await res.json()
      setPartner(data)
      setForm({
        // supplier
        name: data.suppliers?.name ?? '',
        legal_name: data.suppliers?.legal_name ?? '',
        cnpj: data.suppliers?.tax_id ?? '',
        contact_name: data.suppliers?.contact_name ?? '',
        contact_email: data.suppliers?.contact_email ?? '',
        contact_phone: data.suppliers?.contact_phone ?? '',
        contact_whatsapp: data.suppliers?.contact_whatsapp ?? '',
        payment_terms: data.suppliers?.payment_terms ?? '',
        payment_method: data.suppliers?.payment_method ?? '',
        // profile
        notification_email: data.notification_email,
        notification_whatsapp: data.notification_whatsapp ?? '',
        cutoff_time: (data.cutoff_time || '').slice(0, 5),
        ship_lead_days: data.ship_lead_days ?? 1,
        oc_generation_time: (data.oc_generation_time || '').slice(0, 5),
        oc_preview_open_time: (data.oc_preview_open_time || '').slice(0, 5),
        oc_review_cutoff_time: (data.oc_review_cutoff_time || '').slice(0, 5),
        integration_type: data.integration_type,
        cost_strategy: data.cost_strategy,
        return_credit_strategy: data.return_credit_strategy,
        dropship_status: data.dropship_status,
        paused_reason: data.paused_reason ?? '',
        notes: data.notes ?? '',
      })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao carregar')
    } finally { setLoading(false) }
  }, [getHeaders, id])

  useEffect(() => { load() }, [load])

  // Carrega score history + saldo de créditos pendentes em paralelo
  useEffect(() => {
    if (!partner?.supplier_id) return
    (async () => {
      try {
        const headers = await getHeaders()
        const [scoresRes, creditsRes] = await Promise.all([
          fetch(`${BACKEND}/dropship/partners/${partner.supplier_id}/score-history`, { headers }),
          fetch(`${BACKEND}/dropship/partners/${partner.supplier_id}/credits-balance`, { headers }),
        ])
        if (scoresRes.ok) {
          const arr = await scoresRes.json()
          if (arr.length > 0) {
            setLatestScore({
              total_score: arr[0].total_score,
              score_change: arr[0].score_change,
              period_end: arr[0].period_end,
              score_breakdown: arr[0].score_breakdown,
            })
          }
        }
        if (creditsRes.ok) {
          const r = await creditsRes.json()
          setCreditsBalance(Number(r.pending_credits_balance ?? 0))
        }
      } catch { /* ignore */ }
    })()
  }, [partner?.supplier_id, getHeaders])

  async function handleSave() {
    setSaving(true); setErr(''); setSavedOk(false)
    try {
      const headers = await getHeaders()
      const payload: Record<string, unknown> = { ...form }
      // Limpa strings vazias pra null em fields opcionais
      const optionalNullable = ['legal_name', 'cnpj', 'contact_name', 'contact_email', 'contact_phone', 'contact_whatsapp', 'payment_terms', 'payment_method', 'notification_whatsapp', 'paused_reason', 'notes']
      for (const k of optionalNullable) {
        if (payload[k] === '') payload[k] = null
      }
      payload.ship_lead_days = Number(payload.ship_lead_days)

      const res = await fetch(`${BACKEND}/dropship/partners/${id}`, {
        method: 'PATCH', headers, body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.message ?? `HTTP ${res.status}`)
      }
      setSavedOk(true)
      setTimeout(() => setSavedOk(false), 2000)
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally { setSaving(false) }
  }

  async function handleArchive() {
    const ok = await confirm({
      title: 'Arquivar parceiro?',
      message: 'Ficará inativo (sem novas OCs), mas todos os dados históricos são preservados. Pode reativar depois mudando o status.',
      confirmLabel: 'Arquivar',
      variant: 'warning',
    })
    if (!ok) return
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/dropship/partners/${id}`, { method: 'DELETE', headers })
      if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`)
      router.push('/dashboard/dropship/partners')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao arquivar')
    }
  }

  const setField = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  const inp = 'w-full bg-[#0f0f12] border border-[#27272a] text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-[#00E5FF]'
  const lbl = 'block text-xs text-zinc-400 mb-1'

  if (loading) {
    return <div className="min-h-screen p-6 text-zinc-500" style={{ background: 'var(--background)' }}>Carregando...</div>
  }
  if (!partner) {
    return (
      <div className="min-h-screen p-6" style={{ background: 'var(--background)', color: '#fff' }}>
        <div className="rounded-lg p-4 text-sm" style={{
          background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)',
        }}>
          Parceiro não encontrado. {err && `(${err})`}{' '}
          <Link href="/dashboard/dropship/partners" style={{ color: '#00E5FF' }}>Voltar à lista</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--background)', color: '#fff' }}>
      {/* header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/dropship/partners" className="text-zinc-500 hover:text-white">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-white">{partner.suppliers?.name ?? '—'}</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              {partner.suppliers?.legal_name ?? 'Parceiro Dropship'} · CNPJ {partner.suppliers?.tax_id ?? '—'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/dashboard/dropship/partners/${id}/products`}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors hover:bg-[#1a1a1f]"
            style={{ border: '1px solid #27272a', color: '#a1a1aa' }}
          >
            <Package size={14} />
            Catálogo
          </Link>
          <Link
            href={`/dashboard/dropship/sync-logs?supplier_id=${partner.supplier_id}`}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors hover:bg-[#1a1a1f]"
            style={{ border: '1px solid #27272a', color: '#a1a1aa' }}
          >
            <History size={14} />
            Logs
          </Link>
          <button
            onClick={handleArchive}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors"
            style={{ border: '1px solid #27272a', color: '#a1a1aa' }}
          >
            <Archive size={14} />
            Arquivar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ background: '#00E5FF', color: '#09090b', opacity: saving ? 0.6 : 1 }}
          >
            <Save size={14} />
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>

      {/* alerts */}
      {err && (
        <div className="rounded-lg p-3 text-sm mb-4" style={{
          background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)',
        }}>
          <AlertCircle size={14} className="inline mr-2" />
          {err}
        </div>
      )}
      {savedOk && (
        <div className="rounded-lg p-3 text-sm mb-4" style={{
          background: 'rgba(34,197,94,0.10)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)',
        }}>
          ✓ Salvo
        </div>
      )}

      {/* Score banner (se já calculado) */}
      {latestScore && (
        <ScoreBadge
          score={latestScore.total_score}
          change={latestScore.score_change}
          periodEnd={latestScore.period_end}
          breakdown={latestScore.score_breakdown}
          supplierId={partner.supplier_id}
        />
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Kpi label="Status" value={statusLabel(partner.dropship_status)} />
        <Kpi label="SKUs ativos" value={partner.active_dropship_skus ?? 0} />
        <Kpi label="Pedidos 30d" value={partner.orders_30d ?? 0} />
        <Kpi label="A pagar" value={fmtBrl(partner.pending_payable ?? 0)} />
        <Kpi
          label="Créditos pendentes"
          value={fmtBrl(creditsBalance)}
          accent={creditsBalance > 0 ? '#fcd34d' : undefined}
        />
      </div>

      {/* form em 2 colunas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Section title="Identificação">
          <div>
            <label className={lbl}>Nome *</label>
            <input value={String(form.name ?? '')} onChange={e => setField('name', e.target.value)} className={inp} />
          </div>
          <div>
            <label className={lbl}>Razão Social</label>
            <input value={String(form.legal_name ?? '')} onChange={e => setField('legal_name', e.target.value)} className={inp} />
          </div>
          <div>
            <label className={lbl}>CNPJ</label>
            <input value={String(form.cnpj ?? '')} onChange={e => setField('cnpj', e.target.value)} className={inp} />
          </div>
        </Section>

        <Section title="Contato Comercial">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Nome</label><input value={String(form.contact_name ?? '')} onChange={e => setField('contact_name', e.target.value)} className={inp} /></div>
            <div><label className={lbl}>E-mail</label><input value={String(form.contact_email ?? '')} onChange={e => setField('contact_email', e.target.value)} className={inp} /></div>
            <div><label className={lbl}>Telefone</label><input value={String(form.contact_phone ?? '')} onChange={e => setField('contact_phone', e.target.value)} className={inp} /></div>
            <div><label className={lbl}>WhatsApp</label><input value={String(form.contact_whatsapp ?? '')} onChange={e => setField('contact_whatsapp', e.target.value)} className={inp} /></div>
          </div>
        </Section>

        <Section title="Notificação Operacional">
          <div>
            <label className={lbl}>E-mail (recebe OC) *</label>
            <input value={String(form.notification_email ?? '')} onChange={e => setField('notification_email', e.target.value)} className={inp} />
          </div>
          <div>
            <label className={lbl}>WhatsApp</label>
            <input value={String(form.notification_whatsapp ?? '')} onChange={e => setField('notification_whatsapp', e.target.value)} className={inp} />
          </div>
        </Section>

        <Section title="Janela Operacional">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Cutoff (parceiro)</label>
              <input type="time" value={String(form.cutoff_time ?? '')} onChange={e => setField('cutoff_time', e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Ship lead (dias)</label>
              <input type="number" min="0" value={Number(form.ship_lead_days ?? 1)} onChange={e => setField('ship_lead_days', e.target.value)} className={inp} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className={lbl}>Prévia abre</label><input type="time" value={String(form.oc_preview_open_time ?? '')} onChange={e => setField('oc_preview_open_time', e.target.value)} className={inp} /></div>
            <div><label className={lbl}>Cutoff prévia</label><input type="time" value={String(form.oc_review_cutoff_time ?? '')} onChange={e => setField('oc_review_cutoff_time', e.target.value)} className={inp} /></div>
            <div><label className={lbl}>Geração OC</label><input type="time" value={String(form.oc_generation_time ?? '')} onChange={e => setField('oc_generation_time', e.target.value)} className={inp} /></div>
          </div>
        </Section>

        <Section title="Estratégia">
          <div>
            <label className={lbl}>Integração</label>
            <select value={String(form.integration_type ?? 'manual')} onChange={e => setField('integration_type', e.target.value)} className={inp}>
              <option value="manual">Manual</option>
              <option value="spreadsheet">Planilha</option>
              <option value="api">API/ERP</option>
              <option value="csv_email">CSV por e-mail</option>
              <option value="sftp">SFTP</option>
              <option value="erp_bling">Bling</option>
              <option value="erp_tiny">Tiny</option>
              <option value="erp_omie">Omie</option>
            </select>
          </div>
          <div>
            <label className={lbl}>Custo</label>
            <select value={String(form.cost_strategy ?? 'current_table')} onChange={e => setField('cost_strategy', e.target.value)} className={inp}>
              <option value="current_table">Tabela vigente na OC</option>
              <option value="at_sale_date">Custo do momento da venda</option>
              <option value="at_ship_date">Custo do momento do envio</option>
              <option value="fixed_per_period">Tabela fixa por período</option>
              <option value="per_campaign">Acordo por campanha</option>
            </select>
          </div>
          <div>
            <label className={lbl}>Devolução</label>
            <select value={String(form.return_credit_strategy ?? 'next_oc')} onChange={e => setField('return_credit_strategy', e.target.value)} className={inp}>
              <option value="next_oc">Crédito na próxima OC</option>
              <option value="same_oc">Abate na mesma OC se ainda não paga</option>
              <option value="separate_invoice">Lançamento separado</option>
            </select>
          </div>
        </Section>

        <Section title="Pagamento + Status">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Prazo (dias)</label>
              <input value={String(form.payment_terms ?? '')} onChange={e => setField('payment_terms', e.target.value)} className={inp} placeholder="15" />
            </div>
            <div>
              <label className={lbl}>Método</label>
              <select value={String(form.payment_method ?? 'pix')} onChange={e => setField('payment_method', e.target.value)} className={inp}>
                <option value="pix">PIX</option>
                <option value="boleto">Boleto</option>
                <option value="transfer">Transferência</option>
                <option value="check">Cheque</option>
              </select>
            </div>
          </div>
          <div>
            <label className={lbl}>Status dropship</label>
            <select value={String(form.dropship_status ?? 'active')} onChange={e => setField('dropship_status', e.target.value)} className={inp}>
              <option value="active">Ativo</option>
              <option value="paused">Pausado</option>
              <option value="inactive">Inativo</option>
              <option value="pending_setup">Setup pendente</option>
            </select>
          </div>
          {form.dropship_status === 'paused' && (
            <div>
              <label className={lbl}>Motivo da pausa</label>
              <input value={String(form.paused_reason ?? '')} onChange={e => setField('paused_reason', e.target.value)} className={inp} />
            </div>
          )}
        </Section>
      </div>

      <div className="mt-4">
        <Section title="Observações Internas">
          <textarea value={String(form.notes ?? '')} onChange={e => setField('notes', e.target.value)} rows={3} className={inp + ' resize-none'} placeholder="Notas internas (não visíveis ao parceiro)" />
        </Section>
      </div>
    </div>
  )
}

// ── helpers ────────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{title}</p>
      {children}
    </div>
  )
}

function Kpi({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className="text-lg font-semibold" style={{ color: accent ?? '#fff' }}>{value}</p>
    </div>
  )
}

function ScoreBadge({
  score, change, periodEnd, breakdown, supplierId,
}: {
  score: number
  change: number | null
  periodEnd: string
  breakdown: Record<string, number>
  supplierId: string
}) {
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#fcd34d' : '#f87171'
  const bg = score >= 80 ? 'rgba(34,197,94,0.05)' : score >= 60 ? 'rgba(252,211,77,0.05)' : 'rgba(248,113,113,0.05)'

  const dimLabels: Record<string, string> = {
    stock_accuracy: 'Estoque',
    ship_lead_compliance: 'Prazo',
    divergence_rate: 'Divergência',
    return_rate: 'Devolução',
    approval_speed: 'Aprovação',
  }

  return (
    <div
      className="rounded-xl p-5 mb-6"
      style={{ background: bg, border: `1px solid ${color}33` }}
    >
      <div className="flex items-start gap-5 flex-wrap">
        <div className="flex items-center gap-3">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-2xl"
            style={{ background: `${color}1A`, color, border: `2px solid ${color}66` }}
          >
            {score}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Trophy size={14} style={{ color }} />
              <p className="text-sm font-semibold text-white">Score do parceiro</p>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              Período {new Date(periodEnd).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}
            </p>
            {change != null && change !== 0 && (
              <div className="flex items-center gap-1 text-xs mt-1">
                {change > 0 ? (
                  <><TrendingUp size={11} style={{ color: '#22c55e' }} /><span style={{ color: '#22c55e' }}>+{change} vs anterior</span></>
                ) : (
                  <><TrendingDown size={11} style={{ color: '#f87171' }} /><span style={{ color: '#f87171' }}>{change} vs anterior</span></>
                )}
              </div>
            )}
            {change === 0 && (
              <div className="flex items-center gap-1 text-xs mt-1 text-zinc-500">
                <Minus size={11} /> sem mudança
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-[280px] grid grid-cols-5 gap-2">
          {Object.entries(breakdown).map(([key, value]) => {
            const pct = (value / 20) * 100
            const dimColor = pct >= 75 ? '#22c55e' : pct >= 50 ? '#fcd34d' : '#f87171'
            return (
              <div key={key} className="text-center">
                <p className="text-xs font-semibold" style={{ color: dimColor }}>{value}/20</p>
                <p className="text-xs text-zinc-500 mt-0.5">{dimLabels[key] ?? key}</p>
                <div className="h-1 rounded-full overflow-hidden mt-1.5" style={{ background: '#0d0d10' }}>
                  <div className="h-full" style={{ width: `${pct}%`, background: dimColor }} />
                </div>
              </div>
            )
          })}
        </div>

        <Link
          href={`/dashboard/dropship/scores`}
          className="text-xs px-3 py-1.5 rounded-lg shrink-0"
          style={{ border: `1px solid ${color}33`, color }}
        >
          Ver ranking →
        </Link>
      </div>
    </div>
  )
}

function statusLabel(s: string): string {
  return s === 'active' ? 'Ativo' : s === 'paused' ? 'Pausado' : s === 'inactive' ? 'Inativo' : 'Setup'
}

function fmtBrl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
