'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { emptyForm, ProductForm } from '../../novo/types'
import Tab1Basic from '../../novo/_components/Tab1Basic'
import Tab2Description from '../../novo/_components/Tab2Description'
import Tab3Attributes from '../../novo/_components/Tab3Attributes'
import Tab4Variations from '../../novo/_components/Tab4Variations'
import Tab5Sales from '../../novo/_components/Tab5Sales'
import Tab6Shipping from '../../novo/_components/Tab6Shipping'
import Tab7Fiscal from '../../novo/_components/Tab7Fiscal'
import Tab8Others from '../../novo/_components/Tab8Others'

// ── tab config ────────────────────────────────────────────────────────────────

const TABS = [
  { n: 1, label: 'Informação Básica', short: 'Básico' },
  { n: 2, label: 'Descrição',          short: 'Descrição' },
  { n: 3, label: 'Atributos',          short: 'Atributos' },
  { n: 4, label: 'Variações',          short: 'Variações' },
  { n: 5, label: 'Vendas & Estoque',   short: 'Vendas' },
  { n: 6, label: 'Envio',              short: 'Envio' },
  { n: 7, label: 'Fiscal',             short: 'Fiscal' },
  { n: 8, label: 'Outros',             short: 'Outros' },
]

const REQUIRED: (keyof ProductForm)[] = [
  'name', 'brand', 'mlTitle', 'price', 'stock',
  'weightKg', 'widthCm', 'lengthCm', 'heightCm',
]

function calcProgress(f: ProductForm) {
  const filled = REQUIRED.filter(k => String(f[k]).trim() !== '').length
  return Math.round((filled / REQUIRED.length) * 100)
}

// ── DB → form conversion ──────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbToForm(p: Record<string, any>): ProductForm {
  const attrs  = p.attributes  ?? {}
  const fiscal = p.fiscal      ?? {}

  // Parse "100W" → { power: "100", powerUnit: "W" }
  let power = '', powerUnit = 'W'
  if (attrs.power) {
    const m = String(attrs.power).match(/^([\d.]+)([A-Za-z]+)$/)
    if (m) { power = m[1]; powerUnit = m[2] }
    else power = attrs.power
  }

  return {
    ...emptyForm,
    // Basic
    photos: [],
    photoUrls:    p.photo_urls   ?? [],
    name:         p.name         ?? '',
    sku:          p.sku          ?? '',
    gtin:         p.gtin         ?? '',
    brand:        p.brand        ?? '',
    model:        p.model        ?? '',
    condition:    p.condition    ?? 'new',
    category:     p.category     ?? '',
    // Description
    mlTitle:      p.ml_title     ?? '',
    description:  p.description  ?? '',
    // Attributes
    color:            attrs.color             ?? '',
    lightColor:       attrs.light_color       ?? '',
    voltage:          attrs.voltage           ?? '',
    material:         attrs.material          ?? '',
    power,
    powerUnit,
    lightingType:     attrs.lighting_type     ?? '',
    lampType:         attrs.lamp_type         ?? '',
    connectionType:   attrs.connection_type   ?? '',
    installLocation:  attrs.install_location  ?? '',
    originCountry:    attrs.origin_country    ?? 'Brasil',
    warrantyType:     attrs.warranty_type     ?? 'seller',
    warrantyDays:     String(attrs.warranty_days ?? 90),
    // Variations
    hasVariations:    p.has_variations        ?? false,
    variations:       p.variations            ?? [],
    // Sales
    price:            p.price != null ? String(p.price) : '',
    stock:            p.stock != null ? String(p.stock) : '',
    saleFormat:       p.sale_format           ?? 'unit',
    wholesaleEnabled: p.wholesale_enabled     ?? false,
    wholesaleLevels:  p.wholesale_levels      ?? [],
    mlListingType:    p.ml_listing_type       ?? 'classic',
    // Shipping
    weightKg: p.weight_kg != null ? String(p.weight_kg) : '',
    widthCm:  p.width_cm  != null ? String(p.width_cm)  : '',
    lengthCm: p.length_cm != null ? String(p.length_cm) : '',
    heightCm: p.height_cm != null ? String(p.height_cm) : '',
    mlFreeShipping:   p.ml_free_shipping      ?? false,
    mlFlex:           p.ml_flex               ?? false,
    shopeeXpress:     p.shopee_xpress         ?? false,
    shopeeQuickDelivery: p.shopee_quick_delivery ?? false,
    shopeePickup:     p.shopee_pickup         ?? false,
    // Fiscal
    ncm:             fiscal.ncm              ?? '',
    origin:          fiscal.origin           ?? '0',
    cfopSameState:   fiscal.cfop_same_state  ?? '',
    cfopOtherState:  fiscal.cfop_other_state ?? '',
    csosn:           fiscal.csosn            ?? '',
    pisCofins:       fiscal.pis_cofins       ?? '',
    cest:            fiscal.cest             ?? '',
    tributesPercent: fiscal.tributes_percent != null ? String(fiscal.tributes_percent) : '',
    recopi:          fiscal.recopi           ?? '',
    exTipi:          fiscal.ex_tipi          ?? '',
    fci:             fiscal.fci              ?? '',
    additionalInfo:  fiscal.additional_info  ?? '',
    groupable:       fiscal.groupable        ?? false,
    // Others
    mainSku:            p.main_sku            ?? '',
    publishAt:          p.publish_at
      ? new Date(p.publish_at).toISOString().slice(0, 16) : '',
    anatelHomologation: p.anatel_homologation ?? '',
    anatelFile:         null,
    platforms:          p.platforms           ?? ['mercadolivre', 'shopee'],
  }
}

// ── storage helpers ───────────────────────────────────────────────────────────

const BUCKET = 'produtos'
const STORAGE_MARKER = `/storage/v1/object/public/${BUCKET}/`

function urlToPath(url: string): string | null {
  const idx = url.indexOf(STORAGE_MARKER)
  return idx === -1 ? null : url.slice(idx + STORAGE_MARKER.length)
}

async function deleteFromStorage(urls: string[]) {
  const paths = urls.map(urlToPath).filter(Boolean) as string[]
  if (paths.length === 0) return
  const supabase = createClient()
  await supabase.storage.from(BUCKET).remove(paths)
}

// ── toast ─────────────────────────────────────────────────────────────────────

type Toast = { id: number; msg: string; type: 'success' | 'error' }

function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id}
          className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium shadow-2xl pointer-events-auto"
          style={{
            background: t.type === 'success' ? '#111114' : '#1a0a0a',
            border: `1px solid ${t.type === 'success' ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`,
            color: t.type === 'success' ? '#34d399' : '#f87171',
          }}>
          {t.type === 'success'
            ? <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            : <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          }
          {t.msg}
        </div>
      ))}
    </div>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function EditarProdutoPage() {
  const router   = useRouter()
  const params   = useParams()
  const id       = params.id as string

  const [form, setForm]         = useState<ProductForm>(emptyForm)
  const [productName, setProductName] = useState('')
  const [tab, setTab]           = useState(1)
  const [saving, setSaving]     = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadingProduct, setLoadingProduct] = useState(true)
  const [orgId, setOrgId]       = useState<string | null>(null)
  const [toasts, setToasts]     = useState<Toast[]>([])

  // Track original photo URLs to detect deletions on save
  const originalPhotos = useRef<string[]>([])

  // ── load product ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return
    async function load() {
      const supabase = createClient()

      // Get org
      const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id')
        .maybeSingle()
      if (member) setOrgId(member.organization_id)

      // Get product
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single()

      setLoadingProduct(false)
      if (error || !data) {
        setLoadError('Produto não encontrado.')
        return
      }

      const f = dbToForm(data)
      setForm(f)
      setProductName(data.name ?? '')
      originalPhotos.current = f.photoUrls
    }
    load()
  }, [id])

  function set<K extends keyof ProductForm>(key: K, value: ProductForm[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function toast(msg: string, type: Toast['type'] = 'success') {
    const id = Date.now()
    setToasts(prev => [...prev, { id, msg, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }

  // ── validation ─────────────────────────────────────────────────────────────
  function validate(): string | null {
    if (!form.name.trim())  return 'Nome do produto é obrigatório.'
    if (!form.brand.trim()) return 'Marca é obrigatória.'
    if (!form.mlTitle.trim()) return 'Título ML é obrigatório.'
    if (form.mlTitle.length > 60) return 'Título ML deve ter no máximo 60 caracteres.'
    if (!form.price.trim()) return 'Preço de venda é obrigatório.'
    if (!form.stock.trim()) return 'Estoque é obrigatório.'
    if (!form.weightKg.trim()) return 'Peso é obrigatório.'
    if (!form.widthCm.trim() || !form.lengthCm.trim() || !form.heightCm.trim())
      return 'Dimensões (L × C × A) são obrigatórias.'
    if (form.platforms.length === 0) return 'Selecione ao menos uma plataforma.'
    return null
  }

  // ── build payload ──────────────────────────────────────────────────────────
  function buildPayload(status: 'draft' | 'active') {
    return {
      status,
      platforms:    form.platforms,
      name:         form.name.trim(),
      sku:          form.sku.trim()   || null,
      gtin:         form.gtin.trim()  || null,
      brand:        form.brand.trim(),
      model:        form.model.trim() || null,
      condition:    form.condition,
      category:     form.category     || null,
      photo_urls:   form.photoUrls.length > 0 ? form.photoUrls : null,
      ml_title:     form.mlTitle.trim(),
      description:  form.description.trim() || null,
      attributes: {
        color:             form.color            || null,
        light_color:       form.lightColor       || null,
        voltage:           form.voltage          || null,
        material:          form.material         || null,
        power:             form.power ? `${form.power}${form.powerUnit}` : null,
        lighting_type:     form.lightingType     || null,
        lamp_type:         form.lampType         || null,
        connection_type:   form.connectionType   || null,
        install_location:  form.installLocation  || null,
        origin_country:    form.originCountry    || null,
        warranty_type:     form.warrantyType,
        warranty_days:     form.warrantyDays ? parseInt(form.warrantyDays) : null,
      },
      has_variations:   form.hasVariations,
      variations:       form.hasVariations ? form.variations : null,
      price:            parseFloat(form.price.replace(',', '.')) || 0,
      stock:            parseInt(form.stock) || 0,
      sale_format:      form.saleFormat,
      wholesale_enabled: form.wholesaleEnabled,
      wholesale_levels:  form.wholesaleEnabled ? form.wholesaleLevels : null,
      ml_listing_type:  form.mlListingType,
      weight_kg:        parseFloat(form.weightKg) || null,
      width_cm:         parseFloat(form.widthCm)  || null,
      length_cm:        parseFloat(form.lengthCm) || null,
      height_cm:        parseFloat(form.heightCm) || null,
      ml_free_shipping:     form.mlFreeShipping,
      ml_flex:              form.mlFlex,
      shopee_xpress:        form.shopeeXpress,
      shopee_quick_delivery: form.shopeeQuickDelivery,
      shopee_pickup:        form.shopeePickup,
      fiscal: {
        ncm:             form.ncm            || null,
        origin:          form.origin         || null,
        cfop_same_state: form.cfopSameState  || null,
        cfop_other_state: form.cfopOtherState || null,
        csosn:           form.csosn          || null,
        pis_cofins:      form.pisCofins      || null,
        cest:            form.cest           || null,
        tributes_percent: form.tributesPercent ? parseFloat(form.tributesPercent) : null,
        recopi:          form.recopi         || null,
        ex_tipi:         form.exTipi         || null,
        fci:             form.fci            || null,
        additional_info: form.additionalInfo || null,
        groupable:       form.groupable,
      },
      main_sku:            form.mainSku            || null,
      publish_at:          form.publishAt           || null,
      anatel_homologation: form.anatelHomologation  || null,
      updated_at:          new Date().toISOString(),
    }
  }

  // ── save (UPDATE) ──────────────────────────────────────────────────────────
  async function save(status: 'draft' | 'active') {
    if (status === 'active') {
      const err = validate()
      if (err) { toast(err, 'error'); return }
    }

    setSaving(true)
    const supabase = createClient()

    const { error } = await supabase
      .from('products')
      .update(buildPayload(status))
      .eq('id', id)

    if (error) {
      console.error('[produto/editar] update error:', error)
      toast(`Erro ao salvar: ${error.message}`, 'error')
      setSaving(false)
      return
    }

    // Delete photos that were removed during editing
    const removed = originalPhotos.current.filter(u => !form.photoUrls.includes(u))
    if (removed.length > 0) {
      await deleteFromStorage(removed)
    }
    // Update baseline for subsequent saves in the same session
    originalPhotos.current = form.photoUrls

    setSaving(false)
    toast('Produto atualizado com sucesso!', 'success')
    setTimeout(() => router.push('/dashboard/produtos'), 1000)
  }

  const progress = calcProgress(form)

  // ── loading / error states ─────────────────────────────────────────────────
  if (loadingProduct) {
    return (
      <div className="flex items-center justify-center h-full" style={{ background: '#09090b' }}>
        <svg className="w-6 h-6 animate-spin" style={{ color: '#00E5FF' }} fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4" style={{ background: '#09090b' }}>
        <p className="text-zinc-400 text-sm">{loadError}</p>
        <button onClick={() => router.push('/dashboard/produtos')}
          className="text-sm font-medium" style={{ color: '#00E5FF' }}>
          ← Voltar para Produtos
        </button>
      </div>
    )
  }

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="flex flex-col h-full" style={{ background: '#09090b' }}>

        {/* ── Top bar ── */}
        <div className="shrink-0 px-6 pt-5 pb-0" style={{ borderBottom: '1px solid #1e1e24' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3 min-w-0">
              {/* Breadcrumb */}
              <nav className="flex items-center gap-1.5 text-[12px] min-w-0">
                <Link href="/dashboard/produtos"
                  className="text-zinc-500 hover:text-zinc-300 transition-colors shrink-0">
                  Produtos
                </Link>
                <span className="text-zinc-700">/</span>
                <span className="text-zinc-500 truncate max-w-[160px]">{productName || '…'}</span>
                <span className="text-zinc-700">/</span>
                <span className="text-white font-medium shrink-0">Editar</span>
              </nav>
            </div>

            {/* Progress */}
            <div className="hidden md:flex items-center gap-3 shrink-0">
              <div className="w-40 h-1.5 rounded-full overflow-hidden" style={{ background: '#1e1e24' }}>
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${progress}%`, background: progress === 100 ? '#34d399' : '#00E5FF' }} />
              </div>
              <span className="text-[12px] font-semibold" style={{ color: progress === 100 ? '#34d399' : '#00E5FF' }}>
                {progress}%
              </span>
            </div>
          </div>

          {/* Tab strip */}
          <div className="flex gap-0 overflow-x-auto no-scrollbar">
            {TABS.map(t => {
              const active = tab === t.n
              return (
                <button key={t.n} type="button" onClick={() => setTab(t.n)}
                  className="shrink-0 px-4 py-2.5 text-[13px] font-medium border-b-2 transition-all whitespace-nowrap"
                  style={{
                    borderColor: active ? '#00E5FF' : 'transparent',
                    color: active ? '#00E5FF' : '#71717a',
                    background: 'transparent',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.color = '#a1a1aa' }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.color = '#71717a' }}>
                  <span className="hidden lg:inline">{t.label}</span>
                  <span className="lg:hidden">{t.short}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Tab content ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-7">
            {tab === 1 && <Tab1Basic data={form} set={set} orgId={orgId} />}
            {tab === 2 && <Tab2Description data={form} set={set} />}
            {tab === 3 && <Tab3Attributes data={form} set={set} />}
            {tab === 4 && <Tab4Variations data={form} set={set} />}
            {tab === 5 && <Tab5Sales data={form} set={set} />}
            {tab === 6 && <Tab6Shipping data={form} set={set} />}
            {tab === 7 && <Tab7Fiscal data={form} set={set} />}
            {tab === 8 && <Tab8Others data={form} set={set} />}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="shrink-0 px-6 py-4 flex items-center justify-between gap-3"
          style={{ borderTop: '1px solid #1e1e24', background: '#0c0c0f' }}>
          <button type="button" disabled={tab === 1 || saving}
            onClick={() => setTab(t => Math.max(1, t - 1))}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ borderColor: '#3f3f46', color: '#a1a1aa', background: 'transparent' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Anterior
          </button>

          <div className="flex items-center gap-2">
            {/* Save draft */}
            <button type="button" disabled={saving} onClick={() => save('draft')}
              className="px-4 py-2 rounded-lg text-sm font-medium border transition-all disabled:opacity-60"
              style={{ borderColor: '#3f3f46', color: '#a1a1aa', background: 'transparent' }}>
              {saving ? 'Salvando…' : 'Salvar rascunho'}
            </button>

            {/* Save active */}
            <button type="button" disabled={saving} onClick={() => save('active')}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-60"
              style={{ background: '#00E5FF', color: '#000' }}>
              {saving
                ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>Salvando…</>
                : <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>Salvar alterações</>
              }
            </button>
          </div>

          <button type="button" disabled={tab === 8 || saving}
            onClick={() => setTab(t => Math.min(8, t + 1))}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ borderColor: '#3f3f46', color: '#a1a1aa', background: 'transparent' }}>
            Próxima
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <Toasts toasts={toasts} />
    </>
  )
}
