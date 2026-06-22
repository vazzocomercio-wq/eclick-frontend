'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, ImagePlus, Loader2, Search, X, Check, AlertCircle, Upload,
  Link2, Link2Off, Sparkles, Send, FileText,
} from 'lucide-react'
import CanvaDesignPicker from '@/components/creative/CanvaDesignPicker'
import { CreativeApi, uploadProductImage, getMyOrgId } from '@/components/creative/api'
import type { CanvaExportAsset } from '@/components/creative/canvaApi'
import type { Marketplace } from '@/components/creative/types'

interface PickedImage {
  key:       string              // id do asset (canva) ou storage_path (upload) — único por página
  url:       string              // URL que o backend baixa
  thumb:     string              // miniatura pra preview
  kind:      'canva' | 'upload'
  designId?: string              // design de origem (canva) — agrupa páginas do mesmo design
}

interface CatalogHit {
  id: string; name: string; sku?: string | null; brand?: string | null; photo_urls?: string[] | null
}

const MARKETPLACES: Array<{ value: Marketplace; label: string }> = [
  { value: 'mercado_livre', label: 'Mercado Livre' },
  { value: 'shopee',        label: 'Shopee' },
  { value: 'magalu',        label: 'Magalu' },
  { value: 'amazon',        label: 'Amazon' },
  { value: 'loja_propria',  label: 'Loja própria' },
]

const ACCEPTED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const MAX_SIZE_MB = 10

export default function QuickListingPage() {
  const router = useRouter()

  const [linkMode, setLinkMode]   = useState<'none' | 'catalog'>('none')
  const [name, setName]           = useState('')
  const [marketplace, setMarketplace] = useState<Marketplace>('mercado_livre')
  const [images, setImages]       = useState<PickedImage[]>([])
  const [textMode, setTextMode]   = useState<'catalog' | 'ai' | 'blank'>('blank')

  // Catálogo
  const [catalogSearch, setCatalogSearch]   = useState('')
  const [catalogResults, setCatalogResults] = useState<CatalogHit[]>([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [selectedCatalog, setSelectedCatalog] = useState<CatalogHit | null>(null)

  // Upload
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState<string | null>(null)

  const pickedDesignIds = new Set(images.filter(i => i.designId).map(i => i.designId!))

  // Busca de catálogo (debounce 350ms)
  useEffect(() => {
    if (linkMode !== 'catalog' || !catalogSearch.trim()) { setCatalogResults([]); return }
    const t = setTimeout(async () => {
      setCatalogLoading(true)
      try {
        const res = await CreativeApi.searchCatalogProducts(catalogSearch.trim())
        setCatalogResults(res.data ?? [])
      } catch {
        setCatalogResults([])
      } finally {
        setCatalogLoading(false)
      }
    }, 350)
    return () => clearTimeout(t)
  }, [catalogSearch, linkMode])

  function chooseLinkMode(mode: 'none' | 'catalog') {
    setLinkMode(mode)
    if (mode === 'none') {
      setSelectedCatalog(null)
      if (textMode === 'catalog') setTextMode('blank')
    }
  }

  function selectCatalog(hit: CatalogHit) {
    setSelectedCatalog(hit)
    setName(hit.name)
    setCatalogResults([])
    setCatalogSearch('')
    setTextMode('catalog')
  }

  // ── Imagens ──
  // Um design do Canva pode ter VÁRIAS páginas → cada uma vira uma imagem (em ordem).
  function onCanvaPicked(assets: CanvaExportAsset[]) {
    const novos: PickedImage[] = assets
      .filter(a => !!a.storage_url)
      .map(a => ({ key: a.id, url: a.storage_url!, thumb: a.storage_url!, kind: 'canva' as const, designId: a.canva_design_id }))
    setImages(prev => {
      const existentes = new Set(prev.map(i => i.key))
      return [...prev, ...novos.filter(n => !existentes.has(n.key))]
    })
  }
  function onCanvaUnpicked(designId: string) {
    setImages(prev => prev.filter(i => i.designId !== designId))
  }
  function removeImage(key: string) {
    setImages(prev => prev.filter(i => i.key !== key))
  }

  async function handleFiles(files: FileList) {
    setError(null)
    const valid = Array.from(files).filter(f => {
      if (!ACCEPTED.includes(f.type)) { setError(`"${f.name}": formato não suportado (use JPG/PNG/WebP)`); return false }
      if (f.size > MAX_SIZE_MB * 1024 * 1024) { setError(`"${f.name}": maior que ${MAX_SIZE_MB}MB`); return false }
      return true
    })
    if (valid.length === 0) return
    setUploading(true)
    try {
      const orgId = await getMyOrgId()
      if (!orgId) throw new Error('organização não encontrada — refaça login')
      for (const file of valid) {
        const res = await uploadProductImage(orgId, file)
        setImages(prev => [...prev, { key: res.storage_path, url: res.signed_url, thumb: res.signed_url, kind: 'upload' }])
      }
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  // ── Submit ──
  const canSubmit =
    images.length > 0 &&
    (linkMode === 'catalog' ? !!selectedCatalog : !!name.trim()) &&
    !submitting && !uploading

  async function submit() {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await CreativeApi.quickListing({
        target_marketplace: marketplace,
        text_mode: textMode,
        images: images.map(i => ({ url: i.url, kind: i.kind })),
        ...(linkMode === 'catalog' && selectedCatalog
          ? { catalog_product_id: selectedCatalog.id }
          : { name: name.trim() }),
      })
      router.push(`/dashboard/creative/${res.creative_product_id}/listing/${res.listing_id}`)
    } catch (e: unknown) {
      setError((e as Error).message)
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 px-4 sm:px-8 py-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link href="/dashboard/creative" className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 mb-3">
            <ArrowLeft size={14} /> Voltar
          </Link>
          <div className="flex items-center gap-2">
            <ImagePlus size={20} className="text-cyan-400" />
            <h1 className="text-lg font-semibold">Anúncio com imagens prontas</h1>
          </div>
          <p className="text-sm text-zinc-400 mt-1">
            Escolha designs do Canva ou envie imagens próprias — elas viram as imagens do anúncio e você vai direto pra publicação.
          </p>
        </div>

        {error && (
          <div className="mb-5 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            <AlertCircle size={14} className="shrink-0 mt-0.5" /> <span>{error}</span>
          </div>
        )}

        {/* 1. Vínculo */}
        <Section step={1} title="Vínculo com o catálogo">
          <div className="flex gap-2 mb-3">
            <ModeButton active={linkMode === 'none'} onClick={() => chooseLinkMode('none')} icon={<Link2Off size={14} />} label="Seguir sem vínculo" />
            <ModeButton active={linkMode === 'catalog'} onClick={() => chooseLinkMode('catalog')} icon={<Link2 size={14} />} label="Vincular a um produto" />
          </div>

          {linkMode === 'catalog' && (
            selectedCatalog ? (
              <div className="flex items-center gap-3 rounded-lg border border-cyan-400/30 bg-cyan-400/5 p-3">
                {selectedCatalog.photo_urls?.[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedCatalog.photo_urls[0]} alt="" className="h-10 w-10 rounded object-cover" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{selectedCatalog.name}</p>
                  <p className="text-[11px] text-zinc-500">{selectedCatalog.sku ? `SKU ${selectedCatalog.sku}` : 'vinculado'} — dados do produto vão enriquecer o anúncio</p>
                </div>
                <button type="button" onClick={() => { setSelectedCatalog(null); if (textMode === 'catalog') setTextMode('blank') }} className="text-zinc-500 hover:text-red-400"><X size={15} /></button>
              </div>
            ) : (
              <div>
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    value={catalogSearch}
                    onChange={e => setCatalogSearch(e.target.value)}
                    placeholder="Buscar produto do catálogo por nome ou SKU…"
                    className="w-full pl-8 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 outline-none focus:border-cyan-400 placeholder:text-zinc-600"
                  />
                  {catalogLoading && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-zinc-500" />}
                </div>
                {catalogResults.length > 0 && (
                  <div className="mt-2 rounded-lg border border-zinc-800 bg-zinc-950 divide-y divide-zinc-900 max-h-60 overflow-y-auto">
                    {catalogResults.map(hit => (
                      <button key={hit.id} type="button" onClick={() => selectCatalog(hit)} className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-zinc-900">
                        {hit.photo_urls?.[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={hit.photo_urls[0]} alt="" className="h-8 w-8 rounded object-cover shrink-0" />
                        ) : <div className="h-8 w-8 rounded bg-zinc-900 shrink-0" />}
                        <div className="min-w-0">
                          <p className="text-sm truncate">{hit.name}</p>
                          <p className="text-[10px] text-zinc-500">{hit.sku ? `SKU ${hit.sku}` : ''}{hit.brand ? ` · ${hit.brand}` : ''}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          )}
        </Section>

        {/* 2. Nome (só quando sem vínculo) */}
        {linkMode === 'none' && (
          <Section step={2} title="Nome do produto">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Luminária de mesa LED articulável"
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 outline-none focus:border-cyan-400 placeholder:text-zinc-600"
            />
          </Section>
        )}

        {/* 3. Imagens */}
        <Section step={linkMode === 'none' ? 3 : 2} title="Imagens do anúncio">
          {/* Strip de selecionadas */}
          {images.length > 0 && (
            <div className="mb-3">
              <p className="text-[11px] text-zinc-500 mb-1.5">{images.length} selecionada(s) — a 1ª é a capa</p>
              <div className="flex flex-wrap gap-2">
                {images.map((img, i) => (
                  <div key={img.key} className="relative h-16 w-16 rounded-lg overflow-hidden border border-zinc-800 bg-zinc-950 group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.thumb} alt="" className="h-full w-full object-cover" />
                    {i === 0 && <span className="absolute bottom-0 inset-x-0 text-[8px] text-center bg-cyan-400 text-black font-semibold">capa</span>}
                    <button type="button" onClick={() => removeImage(img.key)} className="absolute top-0.5 right-0.5 w-4 h-4 rounded bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100"><X size={10} className="text-white" /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload externo */}
          <div
            onClick={() => !uploading && fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); if (e.dataTransfer.files?.length) void handleFiles(e.dataTransfer.files) }}
            className="mb-4 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-800 hover:border-cyan-400/50 bg-zinc-950 py-4 cursor-pointer text-sm text-zinc-400"
          >
            {uploading ? <Loader2 size={16} className="animate-spin text-cyan-400" /> : <Upload size={16} className="text-cyan-400" />}
            {uploading ? 'Enviando…' : 'Arraste imagens aqui ou clique para enviar (JPG/PNG/WebP)'}
          </div>
          <input ref={fileRef} type="file" accept={ACCEPTED.join(',')} multiple className="hidden" onChange={e => { if (e.target.files?.length) void handleFiles(e.target.files); e.target.value = '' }} />

          {/* Canva */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3">
            <div className="flex items-center gap-1.5 mb-2.5">
              <span className="h-4 w-4 rounded flex items-center justify-center bg-[#7D2AE7] text-white text-[9px] font-bold">C</span>
              <span className="text-xs font-semibold text-zinc-300">Seus designs do Canva</span>
            </div>
            <CanvaDesignPicker
              pickedDesignIds={pickedDesignIds}
              onPicked={onCanvaPicked}
              onUnpicked={onCanvaUnpicked}
              redirectTo="/dashboard/creative/quick"
            />
          </div>
        </Section>

        {/* 4. Texto + marketplace */}
        <Section step={linkMode === 'none' ? 4 : 3} title="Texto do anúncio e destino">
          <div className="mb-3">
            <label className="block text-[11px] text-zinc-500 mb-1.5">Marketplace alvo</label>
            <div className="flex flex-wrap gap-1.5">
              {MARKETPLACES.map(m => (
                <button key={m.value} type="button" onClick={() => setMarketplace(m.value)}
                  className={['px-2.5 py-1 rounded-full text-[11px] border transition-all', marketplace === m.value ? 'bg-cyan-400 text-black border-cyan-400 font-semibold' : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'].join(' ')}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {linkMode === 'catalog' && selectedCatalog && (
              <TextModeOption active={textMode === 'catalog'} onClick={() => setTextMode('catalog')} icon={<FileText size={14} />}
                title="Puxar dados do produto" desc="Usa título, descrição e ficha técnica do produto vinculado." />
            )}
            <TextModeOption active={textMode === 'ai'} onClick={() => setTextMode('ai')} icon={<Sparkles size={14} />}
              title="Gerar com IA" desc="A IA escreve título, descrição e atributos (leva alguns segundos)." />
            <TextModeOption active={textMode === 'blank'} onClick={() => setTextMode('blank')} icon={<FileText size={14} />}
              title="Deixar em branco" desc="Você preenche o texto na própria tela de publicação." />
          </div>
        </Section>

        {/* Footer */}
        <div className="sticky bottom-0 -mx-4 sm:-mx-8 px-4 sm:px-8 py-3 bg-zinc-950/90 backdrop-blur border-t border-zinc-900 mt-6">
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            {submitting ? 'Criando anúncio…' : 'Criar e ir para publicação'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Subcomponentes ──

function Section({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="h-5 w-5 rounded-full bg-zinc-800 text-zinc-300 text-[11px] font-semibold flex items-center justify-center">{step}</span>
        <h2 className="text-sm font-semibold text-zinc-200">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function ModeButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button type="button" onClick={onClick}
      className={['flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all', active ? 'bg-cyan-400/10 text-cyan-300 border-cyan-400/40' : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'].join(' ')}>
      {icon} {label}
    </button>
  )
}

function TextModeOption({ active, onClick, icon, title, desc }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <button type="button" onClick={onClick}
      className={['w-full flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-left border transition-all', active ? 'bg-cyan-400/10 border-cyan-400/40' : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'].join(' ')}>
      <span className={['mt-0.5', active ? 'text-cyan-300' : 'text-zinc-500'].join(' ')}>{icon}</span>
      <span className="flex items-center gap-2">
        {active && <Check size={13} className="text-cyan-400 shrink-0" strokeWidth={3} />}
        <span>
          <span className={['block text-sm font-medium', active ? 'text-cyan-200' : 'text-zinc-200'].join(' ')}>{title}</span>
          <span className="block text-[11px] text-zinc-500">{desc}</span>
        </span>
      </span>
    </button>
  )
}
