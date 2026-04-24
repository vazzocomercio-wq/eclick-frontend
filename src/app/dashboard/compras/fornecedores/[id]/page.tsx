'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

// ── types ──────────────────────────────────────────────────────────────────────

interface Supplier {
  id: string; name: string; legal_name: string | null; supplier_type: string
  country: string; currency: string; is_active: boolean; tax_id: string | null
  contact_name: string | null; contact_email: string | null; contact_phone: string | null
  contact_whatsapp: string | null; payment_terms: string | null; payment_method: string | null
  default_lead_time_days: number | null; default_safety_days: number | null
  shipping_terms: string | null; freight_included: boolean; customs_agent: string | null
  port_of_origin: string | null; notes: string | null; rating: number | null
  total_orders_count: number | null; total_ordered_value_brl: number | null
  on_time_delivery_rate: number | null; last_order_at: string | null; created_at: string
  supplier_products: SupplierProduct[]
  supplier_documents: SupplierDocument[]
}

interface SupplierProduct {
  id: string; product_id: string; lead_time_days: number | null; safety_days: number | null
  unit_cost: number | null; currency: string | null; moq: number | null
  is_preferred: boolean; supplier_sku: string | null; notes: string | null
  price_tiers: PriceTier[] | null
  products: { id: string; name: string; sku: string | null; photo_urls: string[] | null; price: number | null; status: string } | null
}

interface SupplierDocument {
  id: string; document_type: string | null; file_name: string; file_url: string; notes: string | null; created_at: string
}

interface PriceTier { min_qty: number; unit_price: number }

interface ProductOption { id: string; name: string; sku: string | null; photo_urls: string[] | null }

type Tab = 'dados' | 'produtos' | 'documentos' | 'historico'

// ── icons ──────────────────────────────────────────────────────────────────────

function Icon({ d, d2, size = 16 }: { d: string; d2?: string; size?: number }) {
  return (
    <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
      {d2 && <path strokeLinecap="round" strokeLinejoin="round" d={d2} />}
    </svg>
  )
}
const I = {
  back:    'M10 19l-7-7m0 0l7-7m-7 7h18',
  edit:    'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  trash:   'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  plus:    'M12 4v16m8-8H4',
  x:       'M6 18L18 6M6 6l12 12',
  check:   'M5 13l4 4L19 7',
  package: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  file:    'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  star:    'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
  search:  'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0',
}

// ── helpers ────────────────────────────────────────────────────────────────────

const inp = 'w-full bg-[#0f0f12] border border-[#27272a] text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-[#00E5FF]'
const lbl = 'block text-xs text-zinc-400 mb-1'

function fmtBrl(v: number | null) {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR')
}

// ── main page ──────────────────────────────────────────────────────────────────

export default function FornecedorDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id     = params.id as string
  const supabase = useMemo(() => createClient(), [])

  const [supplier, setSupplier]   = useState<Supplier | null>(null)
  const [loading, setLoading]     = useState(true)
  const [tab, setTab]             = useState<Tab>('dados')
  const [saving, setSaving]       = useState(false)
  const [saveMsg, setSaveMsg]     = useState('')

  // produto link modal
  const [showLinkModal, setShowLinkModal]     = useState(false)
  const [prodSearch, setProdSearch]           = useState('')
  const [prodOptions, setProdOptions]         = useState<ProductOption[]>([])
  const [selectedProd, setSelectedProd]       = useState<ProductOption | null>(null)
  const [linkForm, setLinkForm]               = useState({ lead_time_days: '', safety_days: '', unit_cost: '', currency: 'BRL', moq: '', is_preferred: false, supplier_sku: '', notes: '' })
  const [priceTiers, setPriceTiers]           = useState<PriceTier[]>([])
  const [linkSaving, setLinkSaving]           = useState(false)
  const [linkErr, setLinkErr]                 = useState('')

  // doc modal
  const [showDocModal, setShowDocModal]       = useState(false)
  const [docForm, setDocForm]                 = useState({ document_type: '', file_name: '', file_url: '', notes: '' })
  const [docSaving, setDocSaving]             = useState(false)

  // edit mode for dados tab
  const [editMode, setEditMode]               = useState(false)
  const [editData, setEditData]               = useState<Partial<Supplier>>({})

  const getHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Não autenticado')
    return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
  }, [supabase])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/suppliers/${id}`, { headers })
      if (!res.ok) throw new Error('Não encontrado')
      const data = await res.json()
      setSupplier(data)
      setEditData(data)
    } catch { router.push('/dashboard/compras/fornecedores') }
    finally { setLoading(false) }
  }, [getHeaders, id, router])

  useEffect(() => { load() }, [load])

  // search products for linking
  useEffect(() => {
    if (!showLinkModal || !prodSearch.trim()) { setProdOptions([]); return }
    const t = setTimeout(async () => {
      try {
        const headers = await getHeaders()
        const res = await fetch(`${BACKEND}/products?q=${encodeURIComponent(prodSearch)}`, { headers })
        if (res.ok) setProdOptions((await res.json()).slice(0, 10))
      } catch { /* ignore */ }
    }, 300)
    return () => clearTimeout(t)
  }, [prodSearch, showLinkModal, getHeaders])

  async function handleSaveDados() {
    if (!supplier) return
    setSaving(true); setSaveMsg('')
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/suppliers/${id}`, {
        method: 'PATCH', headers,
        body: JSON.stringify({
          name: editData.name, legal_name: editData.legal_name, tax_id: editData.tax_id,
          contact_name: editData.contact_name, contact_email: editData.contact_email,
          contact_phone: editData.contact_phone, contact_whatsapp: editData.contact_whatsapp,
          country: editData.country, currency: editData.currency,
          payment_terms: editData.payment_terms, payment_method: editData.payment_method,
          default_lead_time_days: editData.default_lead_time_days,
          default_safety_days: editData.default_safety_days,
          shipping_terms: editData.shipping_terms, freight_included: editData.freight_included,
          customs_agent: editData.customs_agent, port_of_origin: editData.port_of_origin,
          notes: editData.notes,
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.message) }
      const updated = await res.json()
      setSupplier(s => s ? { ...s, ...updated } : s)
      setEditMode(false)
      setSaveMsg('Salvo!')
      setTimeout(() => setSaveMsg(''), 2000)
    } catch (e: unknown) { setSaveMsg(e instanceof Error ? e.message : 'Erro') }
    finally { setSaving(false) }
  }

  async function handleDeactivate() {
    if (!confirm('Desativar este fornecedor?')) return
    const headers = await getHeaders()
    await fetch(`${BACKEND}/suppliers/${id}`, { method: 'DELETE', headers })
    router.push('/dashboard/compras/fornecedores')
  }

  async function handleLinkProduct(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedProd) { setLinkErr('Selecione um produto'); return }
    setLinkSaving(true); setLinkErr('')
    try {
      const headers = await getHeaders()
      const payload = {
        product_id:    selectedProd.id,
        lead_time_days: linkForm.lead_time_days ? Number(linkForm.lead_time_days) : null,
        safety_days:    linkForm.safety_days    ? Number(linkForm.safety_days)    : null,
        unit_cost:      linkForm.unit_cost      ? Number(linkForm.unit_cost)      : null,
        currency:       linkForm.currency,
        moq:            linkForm.moq            ? Number(linkForm.moq)            : null,
        is_preferred:   linkForm.is_preferred,
        supplier_sku:   linkForm.supplier_sku || null,
        notes:          linkForm.notes        || null,
        price_tiers:    priceTiers.length > 0  ? priceTiers                       : null,
      }
      const res = await fetch(`${BACKEND}/suppliers/${id}/products`, { method: 'POST', headers, body: JSON.stringify(payload) })
      if (!res.ok) { const d = await res.json(); throw new Error(d.message) }
      setShowLinkModal(false)
      setSelectedProd(null); setProdSearch(''); setLinkForm({ lead_time_days: '', safety_days: '', unit_cost: '', currency: 'BRL', moq: '', is_preferred: false, supplier_sku: '', notes: '' }); setPriceTiers([])
      await load()
    } catch (e: unknown) { setLinkErr(e instanceof Error ? e.message : 'Erro') }
    finally { setLinkSaving(false) }
  }

  async function handleUnlink(productId: string) {
    if (!confirm('Remover vínculo?')) return
    const headers = await getHeaders()
    await fetch(`${BACKEND}/suppliers/${id}/products/${productId}`, { method: 'DELETE', headers })
    await load()
  }

  async function handleTogglePreferred(sp: SupplierProduct) {
    const headers = await getHeaders()
    await fetch(`${BACKEND}/suppliers/${id}/products/${sp.product_id}`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ is_preferred: !sp.is_preferred }),
    })
    await load()
  }

  async function handleAddDoc(e: React.FormEvent) {
    e.preventDefault()
    if (!docForm.file_name || !docForm.file_url) return
    setDocSaving(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/suppliers/${id}/documents`, {
        method: 'POST', headers,
        body: JSON.stringify({ ...docForm, document_type: docForm.document_type || null, notes: docForm.notes || null }),
      })
      if (!res.ok) throw new Error()
      setShowDocModal(false)
      setDocForm({ document_type: '', file_name: '', file_url: '', notes: '' })
      await load()
    } catch { /* ignore */ }
    finally { setDocSaving(false) }
  }

  async function handleRemoveDoc(docId: string) {
    if (!confirm('Remover documento?')) return
    const headers = await getHeaders()
    await fetch(`${BACKEND}/suppliers/${id}/documents/${docId}`, { method: 'DELETE', headers })
    await load()
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#09090b' }}>
      <p className="text-zinc-500 text-sm">Carregando...</p>
    </div>
  )

  if (!supplier) return null

  return (
    <div className="min-h-screen p-6" style={{ background: '#09090b', color: '#fff' }}>
      {/* header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard/compras/fornecedores')} className="text-zinc-500 hover:text-white transition-colors">
            <Icon d={I.back} size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-white">{supplier.name}</h1>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ background: supplier.is_active ? 'rgba(34,197,94,0.1)' : 'rgba(113,113,122,0.1)', color: supplier.is_active ? '#22c55e' : '#71717a' }}>
                {supplier.is_active ? 'Ativo' : 'Inativo'}
              </span>
            </div>
            <p className="text-sm text-zinc-500">{supplier.supplier_type === 'importado' ? 'Importado' : 'Nacional'} · {supplier.country} · {supplier.currency}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleDeactivate} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg text-zinc-400 hover:text-red-400 transition-colors" style={{ border: '1px solid #27272a' }}>
            <Icon d={I.trash} size={13} /> Desativar
          </button>
        </div>
      </div>

      {/* tabs */}
      <div className="flex gap-1 mb-6" style={{ borderBottom: '1px solid #1a1a1f' }}>
        {(['dados', 'produtos', 'documentos', 'historico'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-2.5 text-sm font-medium capitalize transition-colors"
            style={{
              color: tab === t ? '#fff' : '#71717a',
              borderBottom: tab === t ? '2px solid #00E5FF' : '2px solid transparent',
              marginBottom: '-1px',
            }}>
            {t === 'historico' ? 'Histórico' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── TAB DADOS ── */}
      {tab === 'dados' && (
        <div className="max-w-2xl space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-400">Informações do fornecedor</p>
            {!editMode ? (
              <button onClick={() => setEditMode(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors" style={{ border: '1px solid #27272a', color: '#71717a' }}>
                <Icon d={I.edit} size={13} /> Editar
              </button>
            ) : (
              <div className="flex gap-2 items-center">
                {saveMsg && <span className="text-xs text-emerald-400">{saveMsg}</span>}
                <button onClick={() => { setEditMode(false); setEditData(supplier) }} className="text-xs text-zinc-500 hover:text-white px-3 py-1.5 rounded-lg" style={{ border: '1px solid #27272a' }}>Cancelar</button>
                <button onClick={handleSaveDados} disabled={saving} className="text-xs font-medium px-3 py-1.5 rounded-lg" style={{ background: '#00E5FF', color: '#09090b', opacity: saving ? 0.6 : 1 }}>
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            )}
          </div>

          {/* dados básicos */}
          <div className="rounded-xl p-4 space-y-3" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Dados Básicos</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Nome</label>
                {editMode ? <input value={editData.name ?? ''} onChange={e => setEditData(d => ({ ...d, name: e.target.value }))} className={inp} /> : <p className="text-sm text-white">{supplier.name}</p>}
              </div>
              <div><label className={lbl}>Razão Social</label>
                {editMode ? <input value={editData.legal_name ?? ''} onChange={e => setEditData(d => ({ ...d, legal_name: e.target.value }))} className={inp} /> : <p className="text-sm text-zinc-300">{supplier.legal_name || '—'}</p>}
              </div>
              <div><label className={lbl}>CNPJ / Tax ID</label>
                {editMode ? <input value={editData.tax_id ?? ''} onChange={e => setEditData(d => ({ ...d, tax_id: e.target.value }))} className={inp} /> : <p className="text-sm text-zinc-300">{supplier.tax_id || '—'}</p>}
              </div>
              <div><label className={lbl}>País</label>
                {editMode ? <input value={editData.country ?? ''} onChange={e => setEditData(d => ({ ...d, country: e.target.value }))} className={inp} /> : <p className="text-sm text-zinc-300">{supplier.country}</p>}
              </div>
            </div>
          </div>

          {/* contato */}
          <div className="rounded-xl p-4 space-y-3" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Contato</p>
            <div className="grid grid-cols-2 gap-3">
              {[['contact_name', 'Nome'], ['contact_email', 'E-mail'], ['contact_phone', 'Telefone'], ['contact_whatsapp', 'WhatsApp']].map(([k, l]) => (
                <div key={k}><label className={lbl}>{l}</label>
                  {editMode ? <input value={(editData as Record<string, unknown>)[k] as string ?? ''} onChange={e => setEditData(d => ({ ...d, [k]: e.target.value }))} className={inp} /> : <p className="text-sm text-zinc-300">{(supplier as unknown as Record<string, string | null>)[k] || '—'}</p>}
                </div>
              ))}
            </div>
          </div>

          {/* logistica */}
          <div className="rounded-xl p-4 space-y-3" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Logística & Pagamento</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Lead Time (dias)</label>
                {editMode ? <input type="number" value={editData.default_lead_time_days ?? ''} onChange={e => setEditData(d => ({ ...d, default_lead_time_days: e.target.value ? Number(e.target.value) : null }))} className={inp} /> : <p className="text-sm text-zinc-300">{supplier.default_lead_time_days ?? '—'}</p>}
              </div>
              <div><label className={lbl}>Safety Stock (dias)</label>
                {editMode ? <input type="number" value={editData.default_safety_days ?? ''} onChange={e => setEditData(d => ({ ...d, default_safety_days: e.target.value ? Number(e.target.value) : null }))} className={inp} /> : <p className="text-sm text-zinc-300">{supplier.default_safety_days ?? '—'}</p>}
              </div>
              <div><label className={lbl}>Prazo Pagamento</label>
                {editMode ? <input value={editData.payment_terms ?? ''} onChange={e => setEditData(d => ({ ...d, payment_terms: e.target.value }))} className={inp} /> : <p className="text-sm text-zinc-300">{supplier.payment_terms || '—'}</p>}
              </div>
              <div><label className={lbl}>Forma Pagamento</label>
                {editMode ? <input value={editData.payment_method ?? ''} onChange={e => setEditData(d => ({ ...d, payment_method: e.target.value }))} className={inp} /> : <p className="text-sm text-zinc-300">{supplier.payment_method || '—'}</p>}
              </div>
              {supplier.supplier_type === 'importado' && <>
                <div><label className={lbl}>Porto de Origem</label>
                  {editMode ? <input value={editData.port_of_origin ?? ''} onChange={e => setEditData(d => ({ ...d, port_of_origin: e.target.value }))} className={inp} /> : <p className="text-sm text-zinc-300">{supplier.port_of_origin || '—'}</p>}
                </div>
                <div><label className={lbl}>Agente Despacho</label>
                  {editMode ? <input value={editData.customs_agent ?? ''} onChange={e => setEditData(d => ({ ...d, customs_agent: e.target.value }))} className={inp} /> : <p className="text-sm text-zinc-300">{supplier.customs_agent || '—'}</p>}
                </div>
              </>}
            </div>
            {editMode ? (
              <div className="flex items-center gap-2">
                <input type="checkbox" id="fi" checked={editData.freight_included ?? false} onChange={e => setEditData(d => ({ ...d, freight_included: e.target.checked }))} className="w-4 h-4 accent-[#00E5FF]" />
                <label htmlFor="fi" className="text-sm text-zinc-400 cursor-pointer">Frete incluso</label>
              </div>
            ) : (
              <p className="text-xs text-zinc-500">Frete incluso: <span className="text-zinc-300">{supplier.freight_included ? 'Sim' : 'Não'}</span></p>
            )}
          </div>

          {/* notas */}
          <div className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
            <label className={lbl}>Observações</label>
            {editMode ? (
              <textarea value={editData.notes ?? ''} onChange={e => setEditData(d => ({ ...d, notes: e.target.value }))} rows={3} className={inp + ' resize-none'} />
            ) : (
              <p className="text-sm text-zinc-300">{supplier.notes || '—'}</p>
            )}
          </div>
        </div>
      )}

      {/* ── TAB PRODUTOS ── */}
      {tab === 'produtos' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-zinc-400">{supplier.supplier_products.length} produto(s) vinculado(s)</p>
            <button onClick={() => setShowLinkModal(true)} className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg" style={{ background: '#00E5FF', color: '#09090b' }}>
              <Icon d={I.plus} size={14} /> Vincular Produto
            </button>
          </div>

          {supplier.supplier_products.length === 0 ? (
            <div className="rounded-xl p-12 text-center" style={{ border: '1px dashed #27272a' }}>
              <Icon d={I.package} size={32} />
              <p className="text-zinc-500 text-sm mt-3">Nenhum produto vinculado ainda.</p>
              <button onClick={() => setShowLinkModal(true)} className="mt-3 text-sm" style={{ color: '#00E5FF' }}>+ Vincular primeiro produto</button>
            </div>
          ) : (
            <div className="space-y-2">
              {supplier.supplier_products.map(sp => (
                <div key={sp.id} className="rounded-xl p-4 flex items-center gap-4" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
                  {/* thumb */}
                  {sp.products?.photo_urls?.[0] ? (
                    <img src={sp.products.photo_urls[0]} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" style={{ background: '#1a1a1f' }} />
                  ) : (
                    <div className="w-12 h-12 rounded-lg shrink-0 flex items-center justify-center text-zinc-600" style={{ background: '#1a1a1f' }}>
                      <Icon d={I.package} size={20} />
                    </div>
                  )}
                  {/* info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{sp.products?.name ?? 'Produto desvinculado'}</p>
                    <p className="text-xs text-zinc-500">SKU: {sp.products?.sku ?? '—'}{sp.supplier_sku ? ` · SKU Fornecedor: ${sp.supplier_sku}` : ''}</p>
                  </div>
                  {/* stats */}
                  <div className="flex items-center gap-6 shrink-0">
                    <div className="text-center">
                      <p className="text-xs text-zinc-500">Lead Time</p>
                      <p className="text-sm font-medium text-white">{sp.lead_time_days != null ? `${sp.lead_time_days}d` : '—'}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-zinc-500">Custo Unit.</p>
                      <p className="text-sm font-medium text-white">{sp.unit_cost != null ? `${sp.currency ?? ''} ${sp.unit_cost.toFixed(2)}` : '—'}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-zinc-500">MOQ</p>
                      <p className="text-sm font-medium text-white">{sp.moq ?? '—'}</p>
                    </div>
                    <button onClick={() => handleTogglePreferred(sp)} title="Preferido" className="transition-colors" style={{ color: sp.is_preferred ? '#f59e0b' : '#3f3f46' }}>
                      <Icon d={I.star} size={18} />
                    </button>
                    <button onClick={() => handleUnlink(sp.product_id)} className="text-zinc-600 hover:text-red-400 transition-colors">
                      <Icon d={I.trash} size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB DOCUMENTOS ── */}
      {tab === 'documentos' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-zinc-400">{supplier.supplier_documents.length} documento(s)</p>
            <button onClick={() => setShowDocModal(true)} className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg" style={{ background: '#00E5FF', color: '#09090b' }}>
              <Icon d={I.plus} size={14} /> Adicionar Documento
            </button>
          </div>
          {supplier.supplier_documents.length === 0 ? (
            <div className="rounded-xl p-12 text-center" style={{ border: '1px dashed #27272a' }}>
              <Icon d={I.file} size={32} />
              <p className="text-zinc-500 text-sm mt-3">Nenhum documento cadastrado.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {supplier.supplier_documents.map(doc => (
                <div key={doc.id} className="rounded-xl p-4 flex items-center gap-4" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
                  <Icon d={I.file} size={20} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{doc.file_name}</p>
                    {doc.document_type && <p className="text-xs text-zinc-500">{doc.document_type}</p>}
                    {doc.notes && <p className="text-xs text-zinc-600">{doc.notes}</p>}
                  </div>
                  <p className="text-xs text-zinc-500 shrink-0">{fmtDate(doc.created_at)}</p>
                  <a href={doc.file_url} target="_blank" rel="noreferrer" className="text-xs shrink-0" style={{ color: '#00E5FF' }}>Abrir →</a>
                  <button onClick={() => handleRemoveDoc(doc.id)} className="text-zinc-600 hover:text-red-400 transition-colors">
                    <Icon d={I.trash} size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB HISTÓRICO ── */}
      {tab === 'historico' && (
        <div className="max-w-lg space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Total de Pedidos', value: supplier.total_orders_count ?? 0 },
              { label: 'Valor Total Comprado', value: fmtBrl(supplier.total_ordered_value_brl) },
              { label: 'On-Time Delivery', value: supplier.on_time_delivery_rate != null ? `${supplier.on_time_delivery_rate.toFixed(1)}%` : '—' },
              { label: 'Última Compra', value: fmtDate(supplier.last_order_at) },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
                <p className="text-xs text-zinc-500 mb-1">{label}</p>
                <p className="text-lg font-semibold text-white">{value}</p>
              </div>
            ))}
          </div>
          {supplier.rating != null && (
            <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
              <Icon d={I.star} size={24} />
              <div>
                <p className="text-xs text-zinc-500">Rating</p>
                <p className="text-2xl font-semibold text-white">{supplier.rating.toFixed(1)}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── MODAL VINCULAR PRODUTO ── */}
      {showLinkModal && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setShowLinkModal(false)} />
          <div className="fixed right-0 top-0 h-full z-50 w-full max-w-lg flex flex-col overflow-hidden" style={{ background: '#111114', borderLeft: '1px solid #1e1e24' }}>
            <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: '1px solid #1e1e24' }}>
              <h2 className="text-white font-semibold">Vincular Produto</h2>
              <button onClick={() => setShowLinkModal(false)} className="text-zinc-500 hover:text-white"><Icon d={I.x} size={18} /></button>
            </div>
            <form onSubmit={handleLinkProduct} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* busca produto */}
              <div>
                <label className={lbl}>Produto *</label>
                {selectedProd ? (
                  <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: '#0f0f12', border: '1px solid #00E5FF' }}>
                    <span className="flex-1 text-sm text-white">{selectedProd.name}</span>
                    <span className="text-xs text-zinc-500">{selectedProd.sku}</span>
                    <button type="button" onClick={() => setSelectedProd(null)} className="text-zinc-500 hover:text-white"><Icon d={I.x} size={14} /></button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      value={prodSearch} onChange={e => setProdSearch(e.target.value)}
                      placeholder="Buscar por nome ou SKU..."
                      className={inp}
                    />
                    {prodOptions.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 rounded-lg overflow-hidden" style={{ background: '#1a1a1f', border: '1px solid #27272a' }}>
                        {prodOptions.map(p => (
                          <button key={p.id} type="button" onClick={() => { setSelectedProd(p); setProdSearch(''); setProdOptions([]) }}
                            className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-white/5 transition-colors">
                            {p.photo_urls?.[0] ? <img src={p.photo_urls[0]} className="w-8 h-8 rounded object-cover" /> : <div className="w-8 h-8 rounded flex items-center justify-center text-zinc-600" style={{ background: '#111114' }}><Icon d={I.package} size={14} /></div>}
                            <div>
                              <p className="text-sm text-white">{p.name}</p>
                              <p className="text-xs text-zinc-500">SKU: {p.sku ?? '—'}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>Lead Time (dias)</label><input type="number" value={linkForm.lead_time_days} onChange={e => setLinkForm(f => ({ ...f, lead_time_days: e.target.value }))} className={inp} placeholder="30" /></div>
                <div><label className={lbl}>Safety Days</label><input type="number" value={linkForm.safety_days} onChange={e => setLinkForm(f => ({ ...f, safety_days: e.target.value }))} className={inp} placeholder="7" /></div>
                <div><label className={lbl}>Custo Unitário</label><input type="number" step="0.01" value={linkForm.unit_cost} onChange={e => setLinkForm(f => ({ ...f, unit_cost: e.target.value }))} className={inp} placeholder="0.00" /></div>
                <div><label className={lbl}>Moeda</label>
                  <select value={linkForm.currency} onChange={e => setLinkForm(f => ({ ...f, currency: e.target.value }))} className={inp}>
                    {['BRL','USD','EUR','CNY'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div><label className={lbl}>MOQ</label><input type="number" value={linkForm.moq} onChange={e => setLinkForm(f => ({ ...f, moq: e.target.value }))} className={inp} placeholder="1" /></div>
                <div><label className={lbl}>SKU do Fornecedor</label><input value={linkForm.supplier_sku} onChange={e => setLinkForm(f => ({ ...f, supplier_sku: e.target.value }))} className={inp} /></div>
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="pref" checked={linkForm.is_preferred} onChange={e => setLinkForm(f => ({ ...f, is_preferred: e.target.checked }))} className="w-4 h-4 accent-[#00E5FF]" />
                <label htmlFor="pref" className="text-sm text-zinc-400 cursor-pointer">Fornecedor preferido para este produto</label>
              </div>

              {/* faixas de preço */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={lbl}>Faixas de Preço</label>
                  <button type="button" onClick={() => setPriceTiers(t => [...t, { min_qty: 1, unit_price: 0 }])} className="text-xs" style={{ color: '#00E5FF' }}>+ Adicionar faixa</button>
                </div>
                {priceTiers.length > 0 && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2 text-xs text-zinc-500 px-1">
                      <span>Qtd mínima</span><span>Preço unitário</span><span />
                    </div>
                    {priceTiers.map((tier, i) => (
                      <div key={i} className="grid grid-cols-3 gap-2 items-center">
                        <input type="number" value={tier.min_qty} onChange={e => setPriceTiers(t => t.map((x, j) => j === i ? { ...x, min_qty: Number(e.target.value) } : x))} className={inp} />
                        <input type="number" step="0.01" value={tier.unit_price} onChange={e => setPriceTiers(t => t.map((x, j) => j === i ? { ...x, unit_price: Number(e.target.value) } : x))} className={inp} />
                        <button type="button" onClick={() => setPriceTiers(t => t.filter((_, j) => j !== i))} className="text-zinc-600 hover:text-red-400 transition-colors"><Icon d={I.x} size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div><label className={lbl}>Notas</label><textarea value={linkForm.notes} onChange={e => setLinkForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={inp + ' resize-none'} /></div>
            </form>
            <div className="shrink-0 px-6 py-4 flex items-center justify-between gap-3" style={{ borderTop: '1px solid #1e1e24' }}>
              {linkErr && <p className="text-xs text-red-400 flex-1">{linkErr}</p>}
              <div className="flex gap-2 ml-auto">
                <button type="button" onClick={() => setShowLinkModal(false)} className="px-4 py-2 text-sm rounded-lg text-zinc-400" style={{ border: '1px solid #27272a' }}>Cancelar</button>
                <button type="button" onClick={handleLinkProduct} disabled={linkSaving} className="px-4 py-2 text-sm font-medium rounded-lg" style={{ background: '#00E5FF', color: '#09090b', opacity: linkSaving ? 0.6 : 1 }}>
                  {linkSaving ? 'Vinculando...' : 'Vincular'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── MODAL DOCUMENTO ── */}
      {showDocModal && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setShowDocModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-xl p-6 space-y-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
              <div className="flex items-center justify-between">
                <h2 className="text-white font-semibold">Adicionar Documento</h2>
                <button onClick={() => setShowDocModal(false)} className="text-zinc-500 hover:text-white"><Icon d={I.x} size={18} /></button>
              </div>
              <form onSubmit={handleAddDoc} className="space-y-3">
                <div><label className={lbl}>Nome do Arquivo *</label><input value={docForm.file_name} onChange={e => setDocForm(f => ({ ...f, file_name: e.target.value }))} className={inp} placeholder="contrato.pdf" /></div>
                <div><label className={lbl}>URL do Arquivo *</label><input value={docForm.file_url} onChange={e => setDocForm(f => ({ ...f, file_url: e.target.value }))} className={inp} placeholder="https://..." /></div>
                <div><label className={lbl}>Tipo</label><input value={docForm.document_type} onChange={e => setDocForm(f => ({ ...f, document_type: e.target.value }))} className={inp} placeholder="Contrato, Certificado, NF..." /></div>
                <div><label className={lbl}>Notas</label><input value={docForm.notes} onChange={e => setDocForm(f => ({ ...f, notes: e.target.value }))} className={inp} /></div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowDocModal(false)} className="px-4 py-2 text-sm rounded-lg text-zinc-400" style={{ border: '1px solid #27272a' }}>Cancelar</button>
                  <button type="submit" disabled={docSaving} className="px-4 py-2 text-sm font-medium rounded-lg" style={{ background: '#00E5FF', color: '#09090b' }}>
                    {docSaving ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
