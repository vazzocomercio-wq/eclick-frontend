'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

// ── types ──────────────────────────────────────────────────────────────────────

interface Supplier {
  id: string
  name: string
  legal_name: string | null
  supplier_type: 'nacional' | 'importado'
  country: string
  currency: string
  is_active: boolean
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  default_lead_time_days: number | null
  rating: number | null
  total_orders_count: number | null
  total_ordered_value_brl: number | null
  on_time_delivery_rate: number | null
  last_order_at: string | null
  created_at: string
  supplier_products: { count: number }[] | null
}

interface NewSupplierForm {
  name: string
  supplier_type: 'nacional' | 'importado'
  country: string
  currency: string
  legal_name: string
  tax_id: string
  contact_name: string
  contact_email: string
  contact_phone: string
  contact_whatsapp: string
  payment_terms: string
  payment_method: string
  default_lead_time_days: string
  default_safety_days: string
  shipping_terms: string
  freight_included: boolean
  customs_agent: string
  port_of_origin: string
  notes: string
}

const EMPTY_FORM: NewSupplierForm = {
  name: '', supplier_type: 'nacional', country: 'Brasil', currency: 'BRL',
  legal_name: '', tax_id: '', contact_name: '', contact_email: '',
  contact_phone: '', contact_whatsapp: '', payment_terms: '', payment_method: '',
  default_lead_time_days: '', default_safety_days: '', shipping_terms: '',
  freight_included: false, customs_agent: '', port_of_origin: '', notes: '',
}

// ── icons ──────────────────────────────────────────────────────────────────────

function Icon({ d, d2, size = 16 }: { d: string; d2?: string; size?: number }) {
  return (
    <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
      {d2 && <path strokeLinecap="round" strokeLinejoin="round" d={d2} />}
    </svg>
  )
}

const ICONS = {
  truck:   'M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0',
  plus:    'M12 4v16m8-8H4',
  globe:   'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  package: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  star:    'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
  x:       'M6 18L18 6M6 6l12 12',
  search:  'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0',
}

// ── helpers ────────────────────────────────────────────────────────────────────

function productCount(s: Supplier): number {
  if (!s.supplier_products) return 0
  if (Array.isArray(s.supplier_products) && s.supplier_products[0]?.count != null)
    return Number(s.supplier_products[0].count)
  return (s.supplier_products as unknown as unknown[]).length
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtBrl(v: number | null) {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ── KPI card ───────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className="text-2xl font-semibold text-white">{value}</p>
      {sub && <p className="text-xs text-zinc-500 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── main page ──────────────────────────────────────────────────────────────────

export default function FornecedoresPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading]     = useState(true)
  const [filterType, setFilterType] = useState<'all' | 'nacional' | 'importado'>('all')
  const [search, setSearch]       = useState('')
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [form, setForm]           = useState<NewSupplierForm>(EMPTY_FORM)
  const [formErr, setFormErr]     = useState('')

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
      if (filterType !== 'all') params.set('type', filterType)
      if (search.trim()) params.set('q', search.trim())
      const res = await fetch(`${BACKEND}/suppliers?${params}`, { headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setSuppliers(await res.json())
    } catch { setSuppliers([]) }
    finally { setLoading(false) }
  }, [getHeaders, filterType, search])

  useEffect(() => { load() }, [load])

  // KPIs
  const total      = suppliers.length
  const nacionais  = suppliers.filter(s => s.supplier_type === 'nacional').length
  const importados = suppliers.filter(s => s.supplier_type === 'importado').length
  const semProd    = suppliers.filter(s => productCount(s) === 0).length

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setFormErr('Nome obrigatório'); return }
    setSaving(true); setFormErr('')
    try {
      const headers = await getHeaders()
      const payload = {
        ...form,
        default_lead_time_days: form.default_lead_time_days ? Number(form.default_lead_time_days) : null,
        default_safety_days:    form.default_safety_days    ? Number(form.default_safety_days)    : null,
        legal_name:    form.legal_name    || null,
        tax_id:        form.tax_id        || null,
        contact_name:  form.contact_name  || null,
        contact_email: form.contact_email || null,
        contact_phone: form.contact_phone || null,
        contact_whatsapp: form.contact_whatsapp || null,
        payment_terms:    form.payment_terms    || null,
        payment_method:   form.payment_method   || null,
        shipping_terms:   form.shipping_terms   || null,
        customs_agent:    form.customs_agent     || null,
        port_of_origin:   form.port_of_origin   || null,
        notes:            form.notes             || null,
      }
      const res = await fetch(`${BACKEND}/suppliers`, { method: 'POST', headers, body: JSON.stringify(payload) })
      if (!res.ok) { const d = await res.json(); throw new Error(d.message ?? `HTTP ${res.status}`) }
      const created = await res.json()
      setShowModal(false)
      setForm(EMPTY_FORM)
      router.push(`/dashboard/compras/fornecedores/${created.id}`)
    } catch (err: unknown) {
      setFormErr(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally { setSaving(false) }
  }

  const inp = 'w-full bg-[#0f0f12] border border-[#27272a] text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-[#00E5FF]'
  const label = 'block text-xs text-zinc-400 mb-1'

  return (
    <div className="min-h-screen p-6" style={{ background: '#09090b', color: '#fff' }}>
      {/* header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Fornecedores</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Gerencie seus fornecedores nacionais e importados</p>
        </div>
        <button
          onClick={() => { setShowModal(true); setForm(EMPTY_FORM); setFormErr('') }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ background: '#00E5FF', color: '#09090b' }}
        >
          <Icon d={ICONS.plus} size={15} />
          Novo Fornecedor
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Total" value={total} />
        <KpiCard label="Nacionais" value={nacionais} />
        <KpiCard label="Importados" value={importados} />
        <KpiCard label="Sem produto" value={semProd} sub="sem vínculo" />
      </div>

      {/* filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #27272a' }}>
          {(['all', 'nacional', 'importado'] as const).map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className="px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: filterType === t ? '#00E5FF' : 'transparent',
                color: filterType === t ? '#09090b' : '#a1a1aa',
              }}>
              {t === 'all' ? 'Todos' : t === 'nacional' ? 'Nacional' : 'Importado'}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
            <Icon d={ICONS.search} size={14} />
          </span>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar fornecedor..."
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
              {['Nome', 'País / Tipo', 'Produtos', 'Lead Time', 'Última Compra', 'Rating', 'Status', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-zinc-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-zinc-500 text-sm">Carregando...</td></tr>
            ) : suppliers.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-zinc-500 text-sm">
                Nenhum fornecedor encontrado.{' '}
                <button onClick={() => setShowModal(true)} style={{ color: '#00E5FF' }}>Cadastrar o primeiro</button>
              </td></tr>
            ) : suppliers.map(s => (
              <tr
                key={s.id}
                onClick={() => router.push(`/dashboard/compras/fornecedores/${s.id}`)}
                className="cursor-pointer transition-colors"
                style={{ borderBottom: '1px solid #1a1a1f' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#111114'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-white">{s.name}</p>
                  {s.legal_name && <p className="text-xs text-zinc-500">{s.legal_name}</p>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Icon d={s.supplier_type === 'importado' ? ICONS.globe : ICONS.truck} size={14} />
                    <div>
                      <p className="text-zinc-300">{s.country}</p>
                      <p className="text-xs text-zinc-500 capitalize">{s.supplier_type}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded-full text-xs"
                    style={{ background: productCount(s) > 0 ? 'rgba(0,229,255,0.1)' : 'rgba(113,113,122,0.1)', color: productCount(s) > 0 ? '#00E5FF' : '#71717a' }}>
                    {productCount(s)} produto{productCount(s) !== 1 ? 's' : ''}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-300">
                  {s.default_lead_time_days != null ? `${s.default_lead_time_days}d` : '—'}
                </td>
                <td className="px-4 py-3 text-zinc-300 text-xs">{fmtDate(s.last_order_at)}</td>
                <td className="px-4 py-3">
                  {s.rating != null ? (
                    <span className="flex items-center gap-1 text-zinc-300">
                      <Icon d={ICONS.star} size={13} />
                      {s.rating.toFixed(1)}
                    </span>
                  ) : <span className="text-zinc-600">—</span>}
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ background: s.is_active ? 'rgba(34,197,94,0.1)' : 'rgba(113,113,122,0.1)', color: s.is_active ? '#22c55e' : '#71717a' }}>
                    {s.is_active ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs" style={{ color: '#00E5FF' }}>Ver →</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* modal novo fornecedor */}
      {showModal && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setShowModal(false)} />
          <div className="fixed right-0 top-0 h-full z-50 w-full max-w-lg flex flex-col overflow-hidden"
            style={{ background: '#111114', borderLeft: '1px solid #1e1e24' }}>
            <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: '1px solid #1e1e24' }}>
              <h2 className="text-white font-semibold">Novo Fornecedor</h2>
              <button onClick={() => setShowModal(false)} className="text-zinc-500 hover:text-white">
                <Icon d={ICONS.x} size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* obrigatórios */}
              <div className="rounded-lg p-4 space-y-3" style={{ background: '#0f0f12', border: '1px solid #1e1e24' }}>
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Dados Básicos</p>
                <div>
                  <label className={label}>Nome *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inp} placeholder="Ex: Fornecedor ABC" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={label}>Tipo *</label>
                    <select value={form.supplier_type} onChange={e => setForm(f => ({ ...f, supplier_type: e.target.value as 'nacional' | 'importado', currency: e.target.value === 'importado' ? 'USD' : 'BRL', country: e.target.value === 'importado' ? '' : 'Brasil' }))} className={inp}>
                      <option value="nacional">Nacional</option>
                      <option value="importado">Importado</option>
                    </select>
                  </div>
                  <div>
                    <label className={label}>País *</label>
                    <input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} className={inp} placeholder="Brasil" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={label}>Moeda *</label>
                    <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} className={inp}>
                      {['BRL','USD','EUR','CNY','JPY','GBP'].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={label}>CNPJ / Tax ID</label>
                    <input value={form.tax_id} onChange={e => setForm(f => ({ ...f, tax_id: e.target.value }))} className={inp} placeholder="00.000.000/0001-00" />
                  </div>
                </div>
                <div>
                  <label className={label}>Razão Social</label>
                  <input value={form.legal_name} onChange={e => setForm(f => ({ ...f, legal_name: e.target.value }))} className={inp} placeholder="Razão social completa" />
                </div>
              </div>

              {/* contato */}
              <div className="rounded-lg p-4 space-y-3" style={{ background: '#0f0f12', border: '1px solid #1e1e24' }}>
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Contato</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={label}>Nome do Contato</label><input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} className={inp} /></div>
                  <div><label className={label}>E-mail</label><input type="email" value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} className={inp} /></div>
                  <div><label className={label}>Telefone</label><input value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} className={inp} /></div>
                  <div><label className={label}>WhatsApp</label><input value={form.contact_whatsapp} onChange={e => setForm(f => ({ ...f, contact_whatsapp: e.target.value }))} className={inp} /></div>
                </div>
              </div>

              {/* financeiro / logístico */}
              <div className="rounded-lg p-4 space-y-3" style={{ background: '#0f0f12', border: '1px solid #1e1e24' }}>
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Logística & Pagamento</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={label}>Lead Time Padrão (dias)</label><input type="number" value={form.default_lead_time_days} onChange={e => setForm(f => ({ ...f, default_lead_time_days: e.target.value }))} className={inp} placeholder="30" /></div>
                  <div><label className={label}>Safety Stock (dias)</label><input type="number" value={form.default_safety_days} onChange={e => setForm(f => ({ ...f, default_safety_days: e.target.value }))} className={inp} placeholder="7" /></div>
                  <div><label className={label}>Prazo de Pagamento</label><input value={form.payment_terms} onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))} className={inp} placeholder="30/60/90 dias" /></div>
                  <div><label className={label}>Forma de Pagamento</label><input value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))} className={inp} placeholder="TT, L/C, Boleto" /></div>
                </div>
                {form.supplier_type === 'importado' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={label}>Porto de Origem</label><input value={form.port_of_origin} onChange={e => setForm(f => ({ ...f, port_of_origin: e.target.value }))} className={inp} placeholder="Shenzhen, Shanghai..." /></div>
                    <div><label className={label}>Agente de Despacho</label><input value={form.customs_agent} onChange={e => setForm(f => ({ ...f, customs_agent: e.target.value }))} className={inp} /></div>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="freight" checked={form.freight_included} onChange={e => setForm(f => ({ ...f, freight_included: e.target.checked }))} className="w-4 h-4 accent-[#00E5FF]" />
                  <label htmlFor="freight" className="text-sm text-zinc-400 cursor-pointer">Frete incluso no preço</label>
                </div>
              </div>

              <div>
                <label className={label}>Observações</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} className={inp + ' resize-none'} placeholder="Notas internas..." />
              </div>
            </form>

            <div className="shrink-0 px-6 py-4 flex items-center justify-between gap-3" style={{ borderTop: '1px solid #1e1e24' }}>
              {formErr && <p className="text-xs text-red-400 flex-1">{formErr}</p>}
              <div className="flex gap-2 ml-auto">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm rounded-lg text-zinc-400 hover:text-white transition-colors" style={{ border: '1px solid #27272a' }}>Cancelar</button>
                <button onClick={handleCreate} disabled={saving} className="px-4 py-2 text-sm font-medium rounded-lg transition-colors" style={{ background: '#00E5FF', color: '#09090b', opacity: saving ? 0.6 : 1 }}>
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
