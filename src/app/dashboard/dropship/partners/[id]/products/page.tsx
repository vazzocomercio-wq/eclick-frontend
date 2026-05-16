'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useConfirm } from '@/components/ui/dialog-provider'
import { Plus, X, Search, ArrowLeft, Edit2, Archive, AlertCircle, History, Package, Upload } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

// ── Types ──────────────────────────────────────────────────────────────────────

interface PartnerProduct {
  id: string
  supplier_id: string
  product_id: string
  supplier_sku: string
  master_sku: string | null
  unit_cost: number
  currency: string
  partner_stock: number
  partner_reserved: number
  partner_available: number
  partner_packaging_cost: number
  partner_handling_cost: number
  lead_time_days: number | null
  safety_days: number | null
  moq: number | null
  is_preferred: boolean
  dropship_status: 'active' | 'paused' | 'unavailable' | 'discontinued' | 'pending_validation'
  last_sync_at: string | null
  last_cost_change_at: string | null
  last_stock_change_at: string | null
  notes: string | null
  created_at: string
  products: { id: string; name: string; sku: string | null; photo_urls: string[] | null; price: number | null } | null
}

interface PartnerInfo {
  id: string
  supplier_id: string
  suppliers: { id: string; name: string }
}

interface ProductOption {
  id: string
  name: string
  sku: string | null
  photo_urls: string[] | null
  price: number | null
}

interface CostHistoryEntry {
  id: string
  cost_value: number
  cost_packaging: number
  cost_handling: number
  cost_total: number
  effective_from: string
  effective_until: string | null
  change_reason: string | null
  change_source: string | null
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function PartnerProductsPage() {
  const params = useParams()
  const profileId = params.id as string
  const supabase = useMemo(() => createClient(), [])

  const [partner, setPartner] = useState<PartnerInfo | null>(null)
  const [items, setItems] = useState<PartnerProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [pageErr, setPageErr] = useState('')

  const [filterStatus, setFilterStatus] = useState<'all' | PartnerProduct['dropship_status']>('all')
  const [search, setSearch] = useState('')

  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<PartnerProduct | null>(null)
  const [showHistory, setShowHistory] = useState<string | null>(null)

  const getHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Não autenticado')
    return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
  }, [supabase])

  const load = useCallback(async () => {
    setLoading(true); setPageErr('')
    try {
      const headers = await getHeaders()
      // 1. Buscar partner profile pra resolver supplier_id
      const pRes = await fetch(`${BACKEND}/dropship/partners/${profileId}`, { headers })
      if (!pRes.ok) throw new Error(`Parceiro HTTP ${pRes.status}`)
      const pData = await pRes.json()
      setPartner(pData)
      const supplierId = pData.supplier_id as string

      // 2. Listar partner-products desse supplier
      const params = new URLSearchParams({ supplier_id: supplierId })
      if (filterStatus !== 'all') params.set('status', filterStatus)
      if (search.trim()) params.set('q', search.trim())
      const ppRes = await fetch(`${BACKEND}/dropship/partner-products?${params}`, { headers })
      if (!ppRes.ok) throw new Error(`Catálogo HTTP ${ppRes.status}`)
      setItems(await ppRes.json())
    } catch (e) {
      setPageErr(e instanceof Error ? e.message : 'Erro ao carregar')
      setItems([])
    } finally { setLoading(false) }
  }, [getHeaders, profileId, filterStatus, search])

  useEffect(() => { load() }, [load])

  // KPIs
  const total = items.length
  const active = items.filter(i => i.dropship_status === 'active').length
  const oos = items.filter(i => i.partner_available <= 0).length
  const stockValue = items.reduce((s, i) => s + (i.partner_stock * i.unit_cost), 0)

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--background)', color: '#fff' }}>
      {/* header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href={`/dashboard/dropship/partners/${profileId}`} className="text-zinc-500 hover:text-white">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-white">Catálogo Dropship</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              {partner?.suppliers?.name ?? 'Carregando...'} · {total} SKUs
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/dropship/partners/${profileId}/import`}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors hover:bg-[#1a1a1f]"
            style={{ border: '1px solid #27272a', color: '#a1a1aa' }}
          >
            <Upload size={14} />
            Importar Planilha
          </Link>
          <button
            onClick={() => setShowAdd(true)}
            disabled={!partner}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ background: '#00E5FF', color: '#09090b', opacity: partner ? 1 : 0.5 }}
          >
            <Plus size={15} />
            Adicionar Produto
          </button>
        </div>
      </div>

      {pageErr && (
        <div className="rounded-lg p-3 text-sm mb-4" style={{
          background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)',
        }}>
          <AlertCircle size={14} className="inline mr-2" />
          {pageErr}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Kpi label="Total SKUs" value={total} />
        <Kpi label="Ativos" value={active} />
        <Kpi label="Sem Estoque" value={oos} accent={oos > 0 ? '#f87171' : undefined} />
        <Kpi label="Valor Estoque" value={fmtBrl(stockValue)} />
      </div>

      {/* filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #27272a' }}>
          {(['all', 'active', 'paused', 'unavailable', 'discontinued'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className="px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: filterStatus === s ? '#00E5FF' : 'transparent',
                color: filterStatus === s ? '#09090b' : '#a1a1aa',
              }}
            >
              {statusLabel(s)}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
            <Search size={14} />
          </span>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar SKU do parceiro..."
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
              {['Produto', 'SKU Parceiro', 'Master SKU', 'Custo', 'Estoque', 'Disponível', 'Status', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-zinc-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-zinc-500 text-sm">Carregando...</td></tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-zinc-500 text-sm">
                  Nenhum produto vinculado ainda.{' '}
                  <button onClick={() => setShowAdd(true)} style={{ color: '#00E5FF' }}>Adicionar o primeiro</button>
                </td>
              </tr>
            ) : items.map(p => (
              <tr key={p.id} style={{ borderBottom: '1px solid #1a1a1f' }}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {p.products?.photo_urls?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.products.photo_urls[0]} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded flex items-center justify-center shrink-0" style={{ background: '#1a1a1f' }}>
                        <Package size={14} className="text-zinc-600" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-white truncate max-w-[300px]">{p.products?.name ?? '—'}</p>
                      <p className="text-xs text-zinc-500">{p.products?.sku ?? '—'}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-zinc-300 font-mono text-xs">{p.supplier_sku}</td>
                <td className="px-4 py-3 text-zinc-400 font-mono text-xs">{p.master_sku ?? '—'}</td>
                <td className="px-4 py-3 text-zinc-300 text-xs">{fmtBrl(p.unit_cost)}</td>
                <td className="px-4 py-3 text-zinc-300">{p.partner_stock}</td>
                <td className="px-4 py-3">
                  <span className="text-xs font-medium"
                    style={{ color: p.partner_available <= 0 ? '#f87171' : p.partner_available < 5 ? '#fcd34d' : '#22c55e' }}>
                    {p.partner_available}
                  </span>
                </td>
                <td className="px-4 py-3"><DropshipStatusPill status={p.dropship_status} /></td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setShowHistory(p.id)}
                      className="text-zinc-500 hover:text-white transition-colors"
                      title="Histórico de custo"
                    >
                      <History size={14} />
                    </button>
                    <button
                      onClick={() => setEditing(p)}
                      className="text-zinc-500 hover:text-white transition-colors"
                      title="Editar"
                    >
                      <Edit2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* modal adicionar */}
      {showAdd && partner && (
        <AddProductModal
          partnerSupplierId={partner.supplier_id}
          getHeaders={getHeaders}
          supabase={supabase}
          onClose={() => setShowAdd(false)}
          onCreated={() => { setShowAdd(false); load() }}
        />
      )}

      {/* modal editar */}
      {editing && (
        <EditProductModal
          partnerProduct={editing}
          getHeaders={getHeaders}
          onClose={() => setEditing(null)}
          onUpdated={() => { setEditing(null); load() }}
        />
      )}

      {/* modal histórico */}
      {showHistory && (
        <CostHistoryModal
          partnerProductId={showHistory}
          getHeaders={getHeaders}
          onClose={() => setShowHistory(null)}
        />
      )}
    </div>
  )
}

// ── Add Product Modal ──────────────────────────────────────────────────────────

function AddProductModal({
  partnerSupplierId,
  getHeaders,
  supabase,
  onClose,
  onCreated,
}: {
  partnerSupplierId: string
  getHeaders: () => Promise<Record<string, string>>
  supabase: ReturnType<typeof createClient>
  onClose: () => void
  onCreated: () => void
}) {
  const [search, setSearch] = useState('')
  const [productOptions, setProductOptions] = useState<ProductOption[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<ProductOption | null>(null)
  const [supplierSku, setSupplierSku] = useState('')
  const [masterSku, setMasterSku] = useState('')
  const [unitCost, setUnitCost] = useState('')
  const [packagingCost, setPackagingCost] = useState('0')
  const [handlingCost, setHandlingCost] = useState('0')
  const [stock, setStock] = useState('0')
  const [leadTime, setLeadTime] = useState('')
  const [moq, setMoq] = useState('1')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  // Search products via supabase client (autocomplete)
  useEffect(() => {
    if (!search.trim() || search.trim().length < 2) {
      setProductOptions([])
      return
    }
    let cancelled = false
    setSearching(true)
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('products')
        .select('id, name, sku, photo_urls, price')
        .or(`name.ilike.%${search}%,sku.ilike.%${search}%`)
        .limit(10)
      if (!cancelled) {
        setProductOptions(data ?? [])
        setSearching(false)
      }
    }, 250)
    return () => { cancelled = true; clearTimeout(t) }
  }, [search, supabase])

  async function handleSave() {
    if (!selected) { setErr('Selecione um produto'); return }
    if (!supplierSku.trim()) { setErr('SKU do parceiro é obrigatório'); return }
    if (!unitCost || Number(unitCost) < 0) { setErr('Custo inválido'); return }
    setSaving(true); setErr('')
    try {
      const headers = await getHeaders()
      const payload = {
        supplier_id: partnerSupplierId,
        product_id: selected.id,
        supplier_sku: supplierSku.trim(),
        master_sku: masterSku.trim() || selected.sku || null,
        unit_cost: Number(unitCost),
        partner_packaging_cost: Number(packagingCost) || 0,
        partner_handling_cost: Number(handlingCost) || 0,
        partner_stock: Number(stock) || 0,
        lead_time_days: leadTime ? Number(leadTime) : null,
        moq: moq ? Number(moq) : 1,
      }
      const res = await fetch(`${BACKEND}/dropship/partner-products`, {
        method: 'POST', headers, body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.message ?? `HTTP ${res.status}`)
      }
      onCreated()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally { setSaving(false) }
  }

  const inp = 'w-full bg-[#0f0f12] border border-[#27272a] text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-[#00E5FF]'
  const lbl = 'block text-xs text-zinc-400 mb-1'

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={() => !saving && onClose()} />
      <div className="fixed right-0 top-0 h-full z-50 w-full max-w-md flex flex-col overflow-hidden"
        style={{ background: '#111114', borderLeft: '1px solid #1e1e24' }}>
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: '1px solid #1e1e24' }}>
          <div className="flex items-center gap-2">
            <Package size={18} style={{ color: '#00E5FF' }} />
            <h2 className="text-white font-semibold">Adicionar Produto Dropship</h2>
          </div>
          <button onClick={() => !saving && onClose()} className="text-zinc-500 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* selecionar produto */}
          {!selected ? (
            <>
              <div>
                <label className={lbl}>Produto do catálogo *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"><Search size={14} /></span>
                  <input
                    value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar por nome ou SKU..."
                    className={inp + ' pl-9'}
                    autoFocus
                  />
                </div>
                <p className="text-xs text-zinc-500 mt-1">Mín. 2 caracteres</p>
              </div>

              <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #1e1e24' }}>
                {searching ? (
                  <div className="px-4 py-6 text-center text-zinc-500 text-xs">Buscando...</div>
                ) : productOptions.length === 0 ? (
                  <div className="px-4 py-6 text-center text-zinc-500 text-xs">
                    {search.length < 2 ? 'Digite pra buscar' : 'Nenhum produto encontrado'}
                  </div>
                ) : (
                  productOptions.map(p => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelected(p)
                        setMasterSku(p.sku ?? '')
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-[#0f0f12]"
                      style={{ borderBottom: '1px solid #1a1a1f' }}
                    >
                      {p.photo_urls?.[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.photo_urls[0]} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded flex items-center justify-center shrink-0" style={{ background: '#1a1a1f' }}>
                          <Package size={14} className="text-zinc-600" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-white truncate">{p.name}</p>
                        <p className="text-xs text-zinc-500">SKU: {p.sku ?? '—'}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </>
          ) : (
            <>
              <div className="rounded-lg p-3 flex items-center gap-3" style={{ background: '#0f0f12', border: '1px solid #1e1e24' }}>
                {selected.photo_urls?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selected.photo_urls[0]} alt="" className="w-12 h-12 rounded object-cover shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded flex items-center justify-center shrink-0" style={{ background: '#1a1a1f' }}>
                    <Package size={16} className="text-zinc-600" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white truncate">{selected.name}</p>
                  <p className="text-xs text-zinc-500">SKU: {selected.sku ?? '—'}</p>
                </div>
                <button onClick={() => setSelected(null)} className="text-xs" style={{ color: '#00E5FF' }}>
                  Trocar
                </button>
              </div>

              <div>
                <label className={lbl}>SKU no parceiro *</label>
                <input value={supplierSku} onChange={e => setSupplierSku(e.target.value)} className={inp} placeholder="Ex: ABC-123" />
              </div>
              <div>
                <label className={lbl}>Master SKU (opcional)</label>
                <input value={masterSku} onChange={e => setMasterSku(e.target.value)} className={inp} placeholder="Identidade independente do parceiro" />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={lbl}>Custo unit. (R$) *</label>
                  <input type="number" step="0.01" min="0" value={unitCost} onChange={e => setUnitCost(e.target.value)} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Embalagem (R$)</label>
                  <input type="number" step="0.01" min="0" value={packagingCost} onChange={e => setPackagingCost(e.target.value)} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Manuseio (R$)</label>
                  <input type="number" step="0.01" min="0" value={handlingCost} onChange={e => setHandlingCost(e.target.value)} className={inp} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={lbl}>Estoque</label>
                  <input type="number" min="0" value={stock} onChange={e => setStock(e.target.value)} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Lead time (dias)</label>
                  <input type="number" min="0" value={leadTime} onChange={e => setLeadTime(e.target.value)} className={inp} placeholder="1" />
                </div>
                <div>
                  <label className={lbl}>MOQ</label>
                  <input type="number" min="1" value={moq} onChange={e => setMoq(e.target.value)} className={inp} />
                </div>
              </div>
            </>
          )}
        </div>

        <div className="shrink-0 px-6 py-4 flex items-center justify-between gap-3" style={{ borderTop: '1px solid #1e1e24' }}>
          {err && (
            <div className="rounded-lg p-2 text-xs flex-1" style={{
              background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)',
            }}>{err}</div>
          )}
          <div className="flex gap-2 ml-auto">
            <button onClick={() => !saving && onClose()} disabled={saving} className="px-4 py-2 text-sm rounded-lg text-zinc-400 hover:text-white" style={{ border: '1px solid #27272a' }}>Cancelar</button>
            <button onClick={handleSave} disabled={saving || !selected} className="px-4 py-2 text-sm font-medium rounded-lg" style={{ background: '#00E5FF', color: '#09090b', opacity: (saving || !selected) ? 0.6 : 1 }}>
              {saving ? 'Salvando...' : 'Adicionar'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Edit Product Modal ────────────────────────────────────────────────────────

function EditProductModal({
  partnerProduct: pp,
  getHeaders,
  onClose,
  onUpdated,
}: {
  partnerProduct: PartnerProduct
  getHeaders: () => Promise<Record<string, string>>
  onClose: () => void
  onUpdated: () => void
}) {
  const [supplierSku, setSupplierSku] = useState(pp.supplier_sku)
  const [masterSku, setMasterSku] = useState(pp.master_sku ?? '')
  const [unitCost, setUnitCost] = useState(String(pp.unit_cost))
  const [packagingCost, setPackagingCost] = useState(String(pp.partner_packaging_cost))
  const [handlingCost, setHandlingCost] = useState(String(pp.partner_handling_cost))
  const [stock, setStock] = useState(String(pp.partner_stock))
  const [reserved, setReserved] = useState(String(pp.partner_reserved))
  const [leadTime, setLeadTime] = useState(pp.lead_time_days != null ? String(pp.lead_time_days) : '')
  const [moq, setMoq] = useState(pp.moq != null ? String(pp.moq) : '1')
  const [status, setStatus] = useState<PartnerProduct['dropship_status']>(pp.dropship_status)
  const [changeReason, setChangeReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [err, setErr] = useState('')

  const costChanged =
    Math.abs(Number(unitCost) - pp.unit_cost) > 0.001 ||
    Math.abs(Number(packagingCost) - pp.partner_packaging_cost) > 0.001 ||
    Math.abs(Number(handlingCost) - pp.partner_handling_cost) > 0.001

  const confirm = useConfirm()

  async function handleSave() {
    setSaving(true); setErr('')
    try {
      const headers = await getHeaders()
      const payload: Record<string, unknown> = {
        supplier_sku: supplierSku.trim(),
        master_sku: masterSku.trim() || null,
        unit_cost: Number(unitCost),
        partner_packaging_cost: Number(packagingCost),
        partner_handling_cost: Number(handlingCost),
        partner_stock: Number(stock),
        partner_reserved: Number(reserved),
        lead_time_days: leadTime ? Number(leadTime) : null,
        moq: moq ? Number(moq) : 1,
        dropship_status: status,
      }
      if (costChanged && changeReason) payload.change_reason = changeReason
      const res = await fetch(`${BACKEND}/dropship/partner-products/${pp.id}`, {
        method: 'PATCH', headers, body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.message ?? `HTTP ${res.status}`)
      }
      onUpdated()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally { setSaving(false) }
  }

  async function handleArchive() {
    const ok = await confirm({
      title: 'Arquivar produto?',
      message: 'Marca como descontinuado. Pode ser reativado depois mudando o status pra ativo.',
      confirmLabel: 'Arquivar',
      variant: 'warning',
    })
    if (!ok) return
    setArchiving(true); setErr('')
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/dropship/partner-products/${pp.id}`, { method: 'DELETE', headers })
      if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`)
      onUpdated()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao arquivar')
    } finally { setArchiving(false) }
  }

  const inp = 'w-full bg-[#0f0f12] border border-[#27272a] text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-[#00E5FF]'
  const lbl = 'block text-xs text-zinc-400 mb-1'

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={() => !saving && onClose()} />
      <div className="fixed right-0 top-0 h-full z-50 w-full max-w-md flex flex-col overflow-hidden"
        style={{ background: '#111114', borderLeft: '1px solid #1e1e24' }}>
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: '1px solid #1e1e24' }}>
          <div className="flex items-center gap-2 min-w-0">
            <Edit2 size={18} style={{ color: '#00E5FF' }} />
            <h2 className="text-white font-semibold truncate">{pp.products?.name ?? 'Editar Produto'}</h2>
          </div>
          <button onClick={() => !saving && onClose()} className="text-zinc-500 hover:text-white shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>SKU parceiro *</label>
              <input value={supplierSku} onChange={e => setSupplierSku(e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Master SKU</label>
              <input value={masterSku} onChange={e => setMasterSku(e.target.value)} className={inp} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={lbl}>Custo unit. (R$)</label>
              <input type="number" step="0.01" min="0" value={unitCost} onChange={e => setUnitCost(e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Embalagem</label>
              <input type="number" step="0.01" min="0" value={packagingCost} onChange={e => setPackagingCost(e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Manuseio</label>
              <input type="number" step="0.01" min="0" value={handlingCost} onChange={e => setHandlingCost(e.target.value)} className={inp} />
            </div>
          </div>

          {costChanged && (
            <div>
              <label className={lbl}>Motivo da mudança de custo</label>
              <input value={changeReason} onChange={e => setChangeReason(e.target.value)} className={inp} placeholder="Ex: Reajuste do parceiro em maio" />
              <p className="text-xs text-zinc-500 mt-1">Vai pro histórico de custos pra auditoria</p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={lbl}>Estoque</label>
              <input type="number" min="0" value={stock} onChange={e => setStock(e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Reservado</label>
              <input type="number" min="0" value={reserved} onChange={e => setReserved(e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Disponível</label>
              <div className={inp} style={{ color: '#a1a1aa', cursor: 'not-allowed', background: '#0a0a0e' }}>
                {Number(stock) - Number(reserved)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Lead time (dias)</label>
              <input type="number" min="0" value={leadTime} onChange={e => setLeadTime(e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>MOQ</label>
              <input type="number" min="1" value={moq} onChange={e => setMoq(e.target.value)} className={inp} />
            </div>
          </div>

          <div>
            <label className={lbl}>Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as PartnerProduct['dropship_status'])} className={inp}>
              <option value="active">Ativo</option>
              <option value="paused">Pausado</option>
              <option value="unavailable">Indisponível</option>
              <option value="discontinued">Descontinuado</option>
              <option value="pending_validation">Aguardando validação</option>
            </select>
          </div>
        </div>

        <div className="shrink-0 px-6 py-4 flex items-center justify-between gap-3" style={{ borderTop: '1px solid #1e1e24' }}>
          {err ? (
            <div className="rounded-lg p-2 text-xs flex-1" style={{
              background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)',
            }}>{err}</div>
          ) : (
            <button onClick={handleArchive} disabled={archiving} className="flex items-center gap-1 text-xs text-zinc-500 hover:text-red-400">
              <Archive size={12} />
              {archiving ? 'Arquivando...' : 'Arquivar'}
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button onClick={() => !saving && onClose()} disabled={saving} className="px-4 py-2 text-sm rounded-lg text-zinc-400 hover:text-white" style={{ border: '1px solid #27272a' }}>Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="glow-rainbow px-4 py-2 text-sm font-medium rounded-lg" style={{ background: '#00E5FF', color: '#09090b', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Cost History Modal ────────────────────────────────────────────────────────

function CostHistoryModal({
  partnerProductId,
  getHeaders,
  onClose,
}: {
  partnerProductId: string
  getHeaders: () => Promise<Record<string, string>>
  onClose: () => void
}) {
  const [history, setHistory] = useState<CostHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const headers = await getHeaders()
        const res = await fetch(`${BACKEND}/dropship/partner-products/${partnerProductId}/cost-history`, { headers })
        if (res.ok) setHistory(await res.json())
      } finally { setLoading(false) }
    })()
  }, [partnerProductId, getHeaders])

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full z-50 w-full max-w-md flex flex-col overflow-hidden"
        style={{ background: '#111114', borderLeft: '1px solid #1e1e24' }}>
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: '1px solid #1e1e24' }}>
          <div className="flex items-center gap-2">
            <History size={18} style={{ color: '#00E5FF' }} />
            <h2 className="text-white font-semibold">Histórico de Custos</h2>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {loading ? (
            <p className="text-zinc-500 text-sm">Carregando...</p>
          ) : history.length === 0 ? (
            <p className="text-zinc-500 text-sm">Nenhum registro.</p>
          ) : history.map((h, idx) => (
            <div key={h.id} className="rounded-lg p-3 space-y-1" style={{
              background: idx === 0 ? 'rgba(0,229,255,0.05)' : '#0f0f12',
              border: idx === 0 ? '1px solid rgba(0,229,255,0.2)' : '1px solid #1e1e24',
            }}>
              <div className="flex items-center justify-between">
                <p className="text-white text-sm font-semibold">{fmtBrl(h.cost_total)}</p>
                {idx === 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{
                    background: 'rgba(0,229,255,0.10)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.3)',
                  }}>Vigente</span>
                )}
              </div>
              <p className="text-xs text-zinc-500">
                {fmtDateTime(h.effective_from)}
                {h.effective_until && ` → ${fmtDateTime(h.effective_until)}`}
              </p>
              <p className="text-xs text-zinc-400">
                Custo: {fmtBrl(h.cost_value)}
                {h.cost_packaging > 0 && ` · Embal: ${fmtBrl(h.cost_packaging)}`}
                {h.cost_handling > 0 && ` · Manuseio: ${fmtBrl(h.cost_handling)}`}
              </p>
              {h.change_reason && (
                <p className="text-xs text-zinc-500 italic">{h.change_reason}</p>
              )}
              {h.change_source && (
                <p className="text-xs text-zinc-600">Fonte: {h.change_source}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// ── helpers ────────────────────────────────────────────────────────────────────

function Kpi({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className="text-2xl font-semibold" style={{ color: accent ?? '#fff' }}>{value}</p>
    </div>
  )
}

function DropshipStatusPill({ status }: { status: PartnerProduct['dropship_status'] }) {
  const c: Record<string, { bg: string; fg: string; label: string }> = {
    active:             { bg: 'rgba(34,197,94,0.10)',   fg: '#22c55e', label: 'Ativo' },
    paused:             { bg: 'rgba(252,211,77,0.10)',  fg: '#fcd34d', label: 'Pausado' },
    unavailable:        { bg: 'rgba(248,113,113,0.10)', fg: '#f87171', label: 'Indisponível' },
    discontinued:       { bg: 'rgba(113,113,122,0.10)', fg: '#71717a', label: 'Descontinuado' },
    pending_validation: { bg: 'rgba(0,229,255,0.10)',   fg: '#00E5FF', label: 'Validação' },
  }
  const x = c[status] ?? c.discontinued
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: x.bg, color: x.fg, border: `1px solid ${x.fg}33` }}>
      {x.label}
    </span>
  )
}

function statusLabel(s: string): string {
  return s === 'all' ? 'Todos'
    : s === 'active' ? 'Ativos'
    : s === 'paused' ? 'Pausados'
    : s === 'unavailable' ? 'Indispon.'
    : s === 'discontinued' ? 'Descont.'
    : s
}

function fmtBrl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDateTime(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
