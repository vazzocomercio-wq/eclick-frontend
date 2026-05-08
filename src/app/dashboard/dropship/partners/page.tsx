'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Plus, Search, X, Building2, ChevronRight } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Partner {
  id: string
  dropship_status: 'active' | 'paused' | 'inactive' | 'pending_setup'
  integration_type: string
  cutoff_time: string
  ship_lead_days: number
  notification_email: string
  notification_whatsapp: string | null
  oc_generation_time: string
  cost_strategy: string
  return_credit_strategy: string
  active_dropship_skus: number
  orders_30d: number
  revenue_30d: number
  pending_payable: number
  partner_score: number | null
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
    is_active: boolean
  }
}

interface NewPartnerForm {
  // supplier
  name: string
  legal_name: string
  cnpj: string
  contact_name: string
  contact_email: string
  contact_phone: string
  contact_whatsapp: string
  payment_terms: string
  payment_method: string
  // profile
  notification_email: string
  notification_whatsapp: string
  cutoff_time: string
  ship_lead_days: string
  oc_generation_time: string
  oc_preview_open_time: string
  oc_review_cutoff_time: string
  integration_type: 'manual' | 'spreadsheet' | 'api' | 'csv_email' | 'sftp' | 'erp_bling' | 'erp_tiny' | 'erp_omie'
  cost_strategy: 'current_table' | 'at_sale_date' | 'at_ship_date' | 'fixed_per_period' | 'per_campaign'
  return_credit_strategy: 'same_oc' | 'next_oc' | 'separate_invoice'
  notes: string
}

const EMPTY_FORM: NewPartnerForm = {
  name: '', legal_name: '', cnpj: '',
  contact_name: '', contact_email: '', contact_phone: '', contact_whatsapp: '',
  payment_terms: '15', payment_method: 'pix',
  notification_email: '', notification_whatsapp: '',
  cutoff_time: '14:00', ship_lead_days: '1',
  oc_generation_time: '22:00', oc_preview_open_time: '12:00', oc_review_cutoff_time: '21:00',
  integration_type: 'manual',
  cost_strategy: 'current_table',
  return_credit_strategy: 'next_oc',
  notes: '',
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function PartnersPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'paused' | 'inactive'>('all')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<NewPartnerForm>(EMPTY_FORM)
  const [formErr, setFormErr] = useState('')

  const getHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Não autenticado')
    return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
  }, [supabase])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const headers = await getHeaders()
      const params = new URLSearchParams()
      if (filterStatus !== 'all') params.set('status', filterStatus)
      if (search.trim()) params.set('q', search.trim())
      const res = await fetch(`${BACKEND}/dropship/partners?${params}`, { headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setPartners(await res.json())
    } catch { setPartners([]) }
    finally { setLoading(false) }
  }, [getHeaders, filterStatus, search])

  useEffect(() => { load() }, [load])

  const total = partners.length
  const active = partners.filter(p => p.dropship_status === 'active').length
  const paused = partners.filter(p => p.dropship_status === 'paused').length
  const totalSkus = partners.reduce((s, p) => s + (p.active_dropship_skus || 0), 0)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setFormErr('Nome do parceiro é obrigatório'); return }
    if (!form.notification_email.trim()) { setFormErr('E-mail de notificação é obrigatório'); return }
    setSaving(true); setFormErr('')
    try {
      const headers = await getHeaders()
      const payload = {
        name: form.name.trim(),
        legal_name: form.legal_name || null,
        cnpj: form.cnpj || null,
        contact_name: form.contact_name || null,
        contact_email: form.contact_email || null,
        contact_phone: form.contact_phone || null,
        contact_whatsapp: form.contact_whatsapp || null,
        payment_terms: form.payment_terms || null,
        payment_method: form.payment_method || null,
        notification_email: form.notification_email.trim(),
        notification_whatsapp: form.notification_whatsapp || null,
        cutoff_time: form.cutoff_time,
        ship_lead_days: form.ship_lead_days ? Number(form.ship_lead_days) : 1,
        oc_generation_time: form.oc_generation_time,
        oc_preview_open_time: form.oc_preview_open_time,
        oc_review_cutoff_time: form.oc_review_cutoff_time,
        integration_type: form.integration_type,
        cost_strategy: form.cost_strategy,
        return_credit_strategy: form.return_credit_strategy,
        notes: form.notes || null,
      }
      const res = await fetch(`${BACKEND}/dropship/partners`, {
        method: 'POST', headers, body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.message ?? `HTTP ${res.status}`)
      }
      const created = await res.json()
      setShowModal(false)
      setForm(EMPTY_FORM)
      router.push(`/dashboard/dropship/partners/${created.profile.id}`)
    } catch (err: unknown) {
      setFormErr(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally { setSaving(false) }
  }

  const inp = 'w-full bg-[#0f0f12] border border-[#27272a] text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-[#00E5FF]'
  const lbl = 'block text-xs text-zinc-400 mb-1'

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--background)', color: '#fff' }}>
      {/* header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Parceiros Dropship</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Cadastre fornecedores que despacham direto pro comprador</p>
        </div>
        <button
          onClick={() => { setShowModal(true); setForm(EMPTY_FORM); setFormErr('') }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ background: '#00E5FF', color: '#09090b' }}
        >
          <Plus size={15} />
          Novo Parceiro
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Total" value={total} />
        <KpiCard label="Ativos" value={active} />
        <KpiCard label="Pausados" value={paused} />
        <KpiCard label="SKUs Dropship" value={totalSkus} />
      </div>

      {/* filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #27272a' }}>
          {(['all', 'active', 'paused', 'inactive'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className="px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: filterStatus === s ? '#00E5FF' : 'transparent',
                color: filterStatus === s ? '#09090b' : '#a1a1aa',
              }}
            >
              {s === 'all' ? 'Todos' : s === 'active' ? 'Ativos' : s === 'paused' ? 'Pausados' : 'Inativos'}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
            <Search size={14} />
          </span>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar parceiro..."
            className="w-full pl-8 pr-3 py-2 text-sm rounded-lg outline-none"
            style={{ background: '#111114', border: '1px solid #27272a', color: '#fff' }}
          />
        </div>
      </div>

      {/* table */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1a1a1f' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#111114', borderBottom: '1px solid #1a1a1f' }}>
              {['Parceiro', 'Status', 'Integração', 'Cutoff', 'SKUs', 'Pedidos 30d', 'A Pagar', 'Score', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-zinc-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-zinc-500 text-sm">Carregando...</td></tr>
            ) : partners.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-zinc-500 text-sm">
                  Nenhum parceiro cadastrado.{' '}
                  <button onClick={() => setShowModal(true)} style={{ color: '#00E5FF' }}>Cadastrar o primeiro</button>
                </td>
              </tr>
            ) : partners.map(p => (
              <tr
                key={p.id}
                onClick={() => router.push(`/dashboard/dropship/partners/${p.id}`)}
                className="cursor-pointer transition-colors"
                style={{ borderBottom: '1px solid #1a1a1f' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#111114'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-white">{p.suppliers?.name ?? '—'}</p>
                  {p.suppliers?.legal_name && <p className="text-xs text-zinc-500">{p.suppliers.legal_name}</p>}
                </td>
                <td className="px-4 py-3"><StatusPill status={p.dropship_status} /></td>
                <td className="px-4 py-3"><IntegrationPill type={p.integration_type} /></td>
                <td className="px-4 py-3 text-zinc-300 text-xs">{(p.cutoff_time || '').slice(0, 5)}</td>
                <td className="px-4 py-3 text-zinc-300">{p.active_dropship_skus ?? 0}</td>
                <td className="px-4 py-3 text-zinc-300">{p.orders_30d ?? 0}</td>
                <td className="px-4 py-3 text-zinc-300 text-xs">{fmtBrl(p.pending_payable ?? 0)}</td>
                <td className="px-4 py-3"><ScorePill score={p.partner_score} /></td>
                <td className="px-4 py-3 text-right">
                  <ChevronRight size={14} className="inline text-zinc-600" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* modal novo parceiro */}
      {showModal && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60" onClick={() => !saving && setShowModal(false)} />
          <div className="fixed right-0 top-0 h-full z-50 w-full max-w-lg flex flex-col overflow-hidden"
            style={{ background: '#111114', borderLeft: '1px solid #1e1e24' }}>
            <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: '1px solid #1e1e24' }}>
              <div className="flex items-center gap-2">
                <Building2 size={18} style={{ color: '#00E5FF' }} />
                <h2 className="text-white font-semibold">Novo Parceiro Dropship</h2>
              </div>
              <button onClick={() => !saving && setShowModal(false)} className="text-zinc-500 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Identificação */}
              <Section title="Identificação">
                <div>
                  <label className={lbl}>Nome do parceiro *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inp} placeholder="Ex: Distribuidora ABC" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>CNPJ</label>
                    <input value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))} className={inp} placeholder="00.000.000/0001-00" />
                  </div>
                  <div>
                    <label className={lbl}>Razão Social</label>
                    <input value={form.legal_name} onChange={e => setForm(f => ({ ...f, legal_name: e.target.value }))} className={inp} />
                  </div>
                </div>
              </Section>

              {/* Contato comercial */}
              <Section title="Contato Comercial">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={lbl}>Nome</label><input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} className={inp} /></div>
                  <div><label className={lbl}>E-mail</label><input type="email" value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} className={inp} /></div>
                  <div><label className={lbl}>Telefone</label><input value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} className={inp} /></div>
                  <div><label className={lbl}>WhatsApp</label><input value={form.contact_whatsapp} onChange={e => setForm(f => ({ ...f, contact_whatsapp: e.target.value }))} className={inp} /></div>
                </div>
              </Section>

              {/* Notificação operacional */}
              <Section title="Notificação Operacional">
                <p className="text-xs text-zinc-500 mb-2">Por onde o parceiro recebe a OC do dia + lembretes.</p>
                <div>
                  <label className={lbl}>E-mail de notificação *</label>
                  <input type="email" value={form.notification_email} onChange={e => setForm(f => ({ ...f, notification_email: e.target.value }))} className={inp} placeholder="ops@parceiro.com.br" />
                </div>
                <div>
                  <label className={lbl}>WhatsApp de notificação</label>
                  <input value={form.notification_whatsapp} onChange={e => setForm(f => ({ ...f, notification_whatsapp: e.target.value }))} className={inp} placeholder="+5571..." />
                </div>
              </Section>

              {/* Janela operacional */}
              <Section title="Janela Operacional">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Cutoff time (parceiro)</label>
                    <input type="time" value={form.cutoff_time} onChange={e => setForm(f => ({ ...f, cutoff_time: e.target.value }))} className={inp} />
                  </div>
                  <div>
                    <label className={lbl}>Ship lead (dias)</label>
                    <input type="number" min="0" value={form.ship_lead_days} onChange={e => setForm(f => ({ ...f, ship_lead_days: e.target.value }))} className={inp} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={lbl}>Prévia abre</label>
                    <input type="time" value={form.oc_preview_open_time} onChange={e => setForm(f => ({ ...f, oc_preview_open_time: e.target.value }))} className={inp} />
                  </div>
                  <div>
                    <label className={lbl}>Cutoff prévia</label>
                    <input type="time" value={form.oc_review_cutoff_time} onChange={e => setForm(f => ({ ...f, oc_review_cutoff_time: e.target.value }))} className={inp} />
                  </div>
                  <div>
                    <label className={lbl}>Geração OC</label>
                    <input type="time" value={form.oc_generation_time} onChange={e => setForm(f => ({ ...f, oc_generation_time: e.target.value }))} className={inp} />
                  </div>
                </div>
              </Section>

              {/* Estratégia */}
              <Section title="Estratégia Comercial">
                <div>
                  <label className={lbl}>Tipo de integração</label>
                  <select value={form.integration_type} onChange={e => setForm(f => ({ ...f, integration_type: e.target.value as NewPartnerForm['integration_type'] }))} className={inp}>
                    <option value="manual">Manual (sem automação)</option>
                    <option value="spreadsheet">Planilha periódica</option>
                    <option value="api">API/ERP do parceiro</option>
                    <option value="csv_email">CSV por e-mail</option>
                    <option value="sftp">SFTP</option>
                    <option value="erp_bling">Bling</option>
                    <option value="erp_tiny">Tiny ERP</option>
                    <option value="erp_omie">Omie</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>Estratégia de custo</label>
                  <select value={form.cost_strategy} onChange={e => setForm(f => ({ ...f, cost_strategy: e.target.value as NewPartnerForm['cost_strategy'] }))} className={inp}>
                    <option value="current_table">Tabela vigente no momento da OC (recomendado)</option>
                    <option value="at_sale_date">Custo do momento da venda</option>
                    <option value="at_ship_date">Custo do momento do envio</option>
                    <option value="fixed_per_period">Tabela fixa por período</option>
                    <option value="per_campaign">Acordo por campanha</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>Régua de devolução</label>
                  <select value={form.return_credit_strategy} onChange={e => setForm(f => ({ ...f, return_credit_strategy: e.target.value as NewPartnerForm['return_credit_strategy'] }))} className={inp}>
                    <option value="next_oc">Crédito na próxima OC (recomendado)</option>
                    <option value="same_oc">Abate na mesma OC se ainda não paga</option>
                    <option value="separate_invoice">Lançamento financeiro separado</option>
                  </select>
                </div>
              </Section>

              {/* Pagamento */}
              <Section title="Pagamento">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Prazo (dias)</label>
                    <input value={form.payment_terms} onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))} className={inp} placeholder="15" />
                  </div>
                  <div>
                    <label className={lbl}>Método</label>
                    <select value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))} className={inp}>
                      <option value="pix">PIX</option>
                      <option value="boleto">Boleto</option>
                      <option value="transfer">Transferência</option>
                      <option value="check">Cheque</option>
                    </select>
                  </div>
                </div>
              </Section>

              <div>
                <label className={lbl}>Observações</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={inp + ' resize-none'} placeholder="Notas internas (opcional)" />
              </div>
            </form>

            <div className="shrink-0 px-6 py-4 flex items-center justify-between gap-3" style={{ borderTop: '1px solid #1e1e24' }}>
              {formErr && (
                <div className="rounded-lg p-2 text-xs flex-1" style={{
                  background: 'rgba(239,68,68,0.10)',
                  color: '#f87171',
                  border: '1px solid rgba(239,68,68,0.3)',
                }}>{formErr}</div>
              )}
              <div className="flex gap-2 ml-auto">
                <button onClick={() => !saving && setShowModal(false)} disabled={saving} className="px-4 py-2 text-sm rounded-lg text-zinc-400 hover:text-white transition-colors" style={{ border: '1px solid #27272a' }}>Cancelar</button>
                <button onClick={handleCreate} disabled={saving} className="px-4 py-2 text-sm font-medium rounded-lg transition-colors" style={{ background: '#00E5FF', color: '#09090b', opacity: saving ? 0.6 : 1 }}>
                  {saving ? 'Salvando...' : 'Criar Parceiro'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Components ─────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg p-4 space-y-3" style={{ background: '#0f0f12', border: '1px solid #1e1e24' }}>
      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{title}</p>
      {children}
    </div>
  )
}

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className="text-2xl font-semibold text-white">{value}</p>
      {sub && <p className="text-xs text-zinc-500 mt-0.5">{sub}</p>}
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const c: Record<string, { bg: string; fg: string; label: string }> = {
    active:        { bg: 'rgba(34,197,94,0.10)',   fg: '#22c55e', label: 'Ativo' },
    paused:        { bg: 'rgba(252,211,77,0.10)',  fg: '#fcd34d', label: 'Pausado' },
    inactive:      { bg: 'rgba(113,113,122,0.10)', fg: '#71717a', label: 'Inativo' },
    pending_setup: { bg: 'rgba(0,229,255,0.10)',   fg: '#00E5FF', label: 'Setup' },
  }
  const x = c[status] ?? c.inactive
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: x.bg, color: x.fg, border: `1px solid ${x.fg}33` }}>
      {x.label}
    </span>
  )
}

function IntegrationPill({ type }: { type: string }) {
  const labels: Record<string, string> = {
    manual: 'Manual',
    spreadsheet: 'Planilha',
    api: 'API',
    csv_email: 'CSV/email',
    sftp: 'SFTP',
    erp_bling: 'Bling',
    erp_tiny: 'Tiny',
    erp_omie: 'Omie',
  }
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs"
      style={{ background: 'rgba(113,113,122,0.10)', color: '#a1a1aa', border: '1px solid #27272a' }}>
      {labels[type] ?? type}
    </span>
  )
}

function ScorePill({ score }: { score: number | null }) {
  if (score == null) return <span className="text-zinc-600 text-xs">—</span>
  let bg = 'rgba(34,197,94,0.10)', fg = '#22c55e'
  if (score < 60) { bg = 'rgba(248,113,113,0.10)'; fg = '#f87171' }
  else if (score < 80) { bg = 'rgba(252,211,77,0.10)'; fg = '#fcd34d' }
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: bg, color: fg, border: `1px solid ${fg}33` }}>
      {score}
    </span>
  )
}

function fmtBrl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
