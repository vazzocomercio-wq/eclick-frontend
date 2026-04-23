'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { PM, brl } from '../types'

const SCRAPER  = process.env.NEXT_PUBLIC_SCRAPER_URL  ?? 'https://price-scraper-production-2e7c.up.railway.app'
const BACKEND  = process.env.NEXT_PUBLIC_BACKEND_URL  ?? 'http://localhost:3001'

type Product = {
  id: string
  name: string
  sku: string | null
  price: number | null
  photo_urls: string[] | null
}

type ScraperData = {
  title?: string
  price?: number
  seller?: string
  platform?: string
  photo_url?: string
  partial?: boolean
}

type UrlEntry = {
  id: number
  url: string
  scraping: boolean
  scraped: ScraperData | null
  fetchError: string
  manualPrice: string
  fetchSource: 'ml' | 'scraper' | null
}

type Props = {
  orgId: string
  competitorCounts: Record<string, number>
  onClose: () => void
  onSaved: () => Promise<void>
}

// ── helpers ───────────────────────────────────────────────────────────────────

function isMlUrl(url: string) {
  return url.includes('mercadolivre') || url.includes('mercadolibre')
}



// ── ProductSearch ─────────────────────────────────────────────────────────────

function ProductSearch({
  products,
  selected,
  onSelect,
}: {
  products: Product[]
  selected: Product | null
  onSelect: (p: Product | null) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<Product[]>([])
  const [activeIdx, setActiveIdx] = useState(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.length < 2) { setResults([]); return }
    debounceRef.current = setTimeout(() => {
      const q = query.toLowerCase()
      const matched = products
        .filter(p => p.name.toLowerCase().includes(q) || (p.sku ?? '').toLowerCase().includes(q))
        .slice(0, 8)
      setResults(matched)
      setActiveIdx(0)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, products])

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  function handleSelect(p: Product) {
    onSelect(p)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter')     { e.preventDefault(); if (results[activeIdx]) handleSelect(results[activeIdx]) }
    if (e.key === 'Escape')    { setOpen(false); inputRef.current?.blur() }
  }

  if (selected) {
    return (
      <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg border"
        style={{ background: 'rgba(0,229,255,0.06)', borderColor: 'rgba(0,229,255,0.25)' }}>
        {selected.photo_urls?.[0] && (
          <img src={selected.photo_urls[0]} alt=""
            className="w-9 h-9 rounded-lg object-cover shrink-0"
            style={{ border: '1px solid #2e2e33' }} />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-white text-[13px] font-medium truncate">{selected.name}</p>
          <p className="text-zinc-500 text-[11px]">
            {selected.sku ? `SKU: ${selected.sku}` : 'Sem SKU'}
            {selected.price != null ? ` · ${brl(selected.price)}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="text-zinc-500 hover:text-white transition-colors shrink-0 p-0.5 rounded"
          aria-label="Remover produto selecionado">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none"
          fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          placeholder="Buscar por SKU ou nome do produto…"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => { if (query.length >= 2) setOpen(true) }}
          onKeyDown={handleKeyDown}
          className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm text-white placeholder-zinc-600 border border-[#3f3f46] outline-none transition-all focus:border-[#00E5FF]"
          style={{ background: '#1c1c1f' }}
          autoComplete="off"
        />
      </div>

      {open && query.length >= 2 && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 rounded-xl border overflow-hidden shadow-2xl"
          style={{ background: '#18181b', borderColor: '#2e2e33' }}>
          {results.length === 0 ? (
            <div className="px-4 py-3 text-zinc-500 text-[13px]">
              Nenhum produto encontrado para &quot;{query}&quot;
            </div>
          ) : (
            <ul>
              {results.map((p, idx) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onMouseDown={e => { e.preventDefault(); handleSelect(p) }}
                    onMouseEnter={() => setActiveIdx(idx)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors"
                    style={{ background: idx === activeIdx ? 'rgba(0,229,255,0.07)' : 'transparent' }}>
                    <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 flex items-center justify-center"
                      style={{ background: '#2a2a2e', border: '1px solid #3f3f46' }}>
                      {p.photo_urls?.[0]
                        ? <img src={p.photo_urls[0]} alt="" className="w-full h-full object-cover" />
                        : <svg className="w-4 h-4 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-[13px] font-medium truncate">{p.name}</p>
                      <p className="text-zinc-500 text-[11px]">
                        {p.sku ? `SKU: ${p.sku}` : 'Sem SKU'}
                        {p.price != null ? ` · ${brl(p.price)}` : ''}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export default function AddCompetitorModal({ orgId, competitorCounts, onClose, onSaved }: Props) {
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [entries, setEntries] = useState<UrlEntry[]>([
    { id: 1, url: '', scraping: false, scraped: null, fetchError: '', manualPrice: '', fetchSource: null },
  ])
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)
  const debounceTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('products')
      .select('id,name,sku,price,photo_urls')
      .eq('organization_id', orgId)
      .order('name')
      .then(({ data }) => setProducts(data ?? []))
  }, [orgId])

  // ── ML fetch via backend (uses stored access_token) ─────────────────────────

  const fetchMlData = useCallback(async (entryId: number, url: string) => {
    setEntries(prev => prev.map(e => e.id === entryId
      ? { ...e, scraping: true, fetchError: '', scraped: null, fetchSource: 'ml' }
      : e
    ))

    try {
      const supabase = createClient()
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token
      if (!token) throw new Error('Sessão expirada. Faça login novamente.')

      const res = await fetch(
        `${BACKEND}/ml/item-info?url=${encodeURIComponent(url)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.message ?? `Backend retornou HTTP ${res.status}`)
      }
      const data = await res.json()

      setEntries(prev => prev.map(e => e.id === entryId
        ? {
            ...e,
            scraping: false,
            scraped: {
              title: data.title ?? null,
              price: typeof data.price === 'number' ? data.price : null,
              seller: data.seller ?? null,
              platform: 'ml',
              photo_url: data.thumbnail ?? null,
            },
          }
        : e
      ))
    } catch (err: unknown) {
      setEntries(prev => prev.map(e => e.id === entryId
        ? {
            ...e,
            scraping: false,
            fetchError: err instanceof Error ? err.message : 'Erro ao buscar dados no Mercado Livre.',
          }
        : e
      ))
    }
  }, [])

  // ── Scraper fallback ────────────────────────────────────────────────────────

  const scrapeEntry = useCallback(async (entryId: number, url: string) => {
    setEntries(prev => prev.map(e => e.id === entryId
      ? { ...e, scraping: true, fetchError: '', scraped: null, fetchSource: 'scraper' }
      : e
    ))
    try {
      const res = await fetch(`${SCRAPER}/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      if (!res.ok) throw new Error(`Scraper retornou HTTP ${res.status}.`)
      const data: ScraperData = await res.json()
      setEntries(prev => prev.map(e => e.id === entryId
        ? { ...e, scraping: false, scraped: data }
        : e
      ))
    } catch (err: unknown) {
      setEntries(prev => prev.map(e => e.id === entryId
        ? { ...e, scraping: false, fetchError: err instanceof Error ? err.message : 'Falha ao conectar com o scraper.' }
        : e
      ))
    }
  }, [])

  // ── URL change handler ──────────────────────────────────────────────────────

  function handleUrlChange(entryId: number, url: string) {
    setEntries(prev => prev.map(e => e.id === entryId
      ? { ...e, url, scraped: null, manualPrice: '', fetchError: '', fetchSource: null }
      : e
    ))
    const existing = debounceTimers.current.get(entryId)
    if (existing) clearTimeout(existing)
    if (!url.startsWith('http')) return

    const timer = setTimeout(() => {
      if (isMlUrl(url)) fetchMlData(entryId, url)
      else scrapeEntry(entryId, url)
    }, 800)
    debounceTimers.current.set(entryId, timer)
  }

  function addEntry() {
    setEntries(prev => [...prev, {
      id: Date.now(),
      url: '', scraping: false, scraped: null, fetchError: '', manualPrice: '', fetchSource: null,
    }])
  }

  function removeEntry(id: number) {
    const timer = debounceTimers.current.get(id)
    if (timer) { clearTimeout(timer); debounceTimers.current.delete(id) }
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  const entriesWithUrl = entries.filter(e => e.url.startsWith('http'))

  const canSave = !!selectedProduct && entriesWithUrl.length > 0 && entriesWithUrl.every(e => {
    if (e.scraping || e.scraped === null) return false
    const price = e.scraped.price ?? (e.manualPrice ? parseFloat(e.manualPrice.replace(',', '.')) : null)
    return price != null && !isNaN(price as number)
  })

  async function handleSave() {
    if (!canSave || !selectedProduct) return
    setSaving(true)
    setSaveError('')
    const supabase = createClient()

    for (const entry of entriesWithUrl) {
      if (!entry.scraped) continue
      const resolvedPrice = entry.scraped.price
        ?? (entry.manualPrice ? parseFloat(entry.manualPrice.replace(',', '.')) : null)
      if (!resolvedPrice || isNaN(resolvedPrice)) continue

      const platform = entry.scraped.platform ?? detectPlatform(entry.url)
      const { data: inserted, error } = await supabase
        .from('competitors')
        .insert({
          product_id: selectedProduct.id,
          organization_id: orgId,
          platform,
          url: entry.url,
          title: entry.scraped.title ?? null,
          seller: entry.scraped.seller ?? null,
          current_price: resolvedPrice,
          my_price: selectedProduct.price ?? null,
          photo_url: entry.scraped.photo_url ?? null,
          status: 'active',
          last_checked: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (error || !inserted) {
        setSaveError(error?.message ?? 'Erro ao salvar. Tente novamente.')
        setSaving(false)
        return
      }

      await supabase.from('price_history').insert({
        competitor_id: inserted.id,
        price: resolvedPrice,
      })
    }

    await onSaved()
  }

  const existingCount = selectedProduct ? (competitorCounts[selectedProduct.id] ?? 0) : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col"
        style={{ background: '#111114', border: '1px solid #1e1e24', maxHeight: '90vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: '1px solid #1e1e24' }}>
          <p className="text-white font-semibold">Adicionar Concorrente</p>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Product autocomplete */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Produto monitorado
            </label>
            <ProductSearch
              products={products}
              selected={selectedProduct}
              onSelect={setSelectedProduct}
            />
            {existingCount > 0 && (
              <p className="text-[11px] text-zinc-500 mt-1.5">
                {existingCount} concorrente{existingCount !== 1 ? 's' : ''} já monitorado{existingCount !== 1 ? 's' : ''} para este produto.
              </p>
            )}
          </div>

          {/* URL entries */}
          {entries.map((entry, idx) => {
            const needsManualPrice = entry.scraped !== null && !entry.scraped.price
            const pm = entry.scraped?.platform ? PM[entry.scraped.platform] : null
            const loadingMsg = entry.fetchSource === 'ml'
              ? 'Buscando dados no Mercado Livre…'
              : 'Buscando dados do produto…'

            return (
              <div key={entry.id} className="space-y-3">
                {idx > 0 && <div style={{ height: 1, background: '#1e1e24' }} />}

                {/* URL input */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-zinc-400">
                      {entries.length > 1 ? `URL do concorrente ${idx + 1}` : 'URL do concorrente'}
                    </label>
                    {entries.length > 1 && (
                      <button type="button" onClick={() => removeEntry(entry.id)}
                        className="text-[11px] text-zinc-500 hover:text-red-400 transition-colors">
                        Remover
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="url"
                      placeholder="https://www.mercadolivre.com.br/..."
                      value={entry.url}
                      onChange={e => handleUrlChange(entry.id, e.target.value)}
                      className="w-full px-3 py-2.5 pr-10 rounded-lg text-sm text-white placeholder-zinc-600 border border-[#3f3f46] outline-none focus:border-[#00E5FF] transition-all"
                      style={{ background: '#1c1c1f' }}
                    />
                    {entry.scraping && (
                      <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-cyan-400"
                        fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    )}
                  </div>
                  {entry.scraping && (
                    <p className="text-[11px] text-zinc-500 mt-1">{loadingMsg}</p>
                  )}
                </div>

                {/* Network error */}
                {entry.fetchError && (
                  <div className="px-4 py-3 rounded-xl text-sm"
                    style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}>
                    {entry.fetchError}
                  </div>
                )}

                {/* Preview */}
                {entry.scraped && (
                  <div className="rounded-xl p-4 space-y-2"
                    style={{ background: 'rgba(0,229,255,0.04)', border: '1px solid rgba(0,229,255,0.15)' }}>
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-cyan-400">
                        Dados encontrados
                      </p>
                      {pm && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded"
                          style={{ background: pm.bg, color: pm.fg }}>
                          {pm.label}
                        </span>
                      )}
                    </div>
                    <div className="flex items-start gap-3">
                      {entry.scraped.photo_url && (
                        <img src={entry.scraped.photo_url} alt=""
                          className="w-14 h-14 rounded-lg object-cover shrink-0"
                          style={{ border: '1px solid #2e2e33' }} />
                      )}
                      <div className="flex-1 min-w-0 space-y-1">
                        {entry.scraped.title && (
                          <p className="text-white text-sm font-medium leading-snug line-clamp-2">
                            {entry.scraped.title}
                          </p>
                        )}
                        {entry.scraped.seller && (
                          <p className="text-zinc-400 text-[12px] flex items-center gap-1">
                            <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            {entry.scraped.seller}
                          </p>
                        )}
                        {entry.scraped.price != null && (
                          <p className="text-white font-bold text-base">{brl(entry.scraped.price)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Manual price */}
                {needsManualPrice && (
                  <div className="rounded-xl px-4 py-3 space-y-3"
                    style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 shrink-0" style={{ color: '#f59e0b' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-[13px]" style={{ color: '#f59e0b' }}>
                        Preço não detectado automaticamente. Informe manualmente:
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-400 text-sm shrink-0">R$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0,00"
                        value={entry.manualPrice}
                        onChange={e => setEntries(prev => prev.map(x =>
                          x.id === entry.id ? { ...x, manualPrice: e.target.value } : x
                        ))}
                        className="flex-1 px-3 py-2 rounded-lg text-sm text-white placeholder-zinc-600 border outline-none transition-all"
                        style={{ background: '#1c1c1f', borderColor: entry.manualPrice ? '#f59e0b' : '#3f3f46' }}
                        onFocus={e => (e.target.style.borderColor = '#f59e0b')}
                        onBlur={e => (e.target.style.borderColor = entry.manualPrice ? '#f59e0b' : '#3f3f46')}
                        autoFocus={idx === 0}
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* Add another URL */}
          <button
            type="button"
            onClick={addEntry}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium border border-dashed transition-all"
            style={{ borderColor: '#3f3f46', color: '#71717a' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#00E5FF'; e.currentTarget.style.color = '#00E5FF' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#3f3f46'; e.currentTarget.style.color = '#71717a' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Adicionar outra URL
          </button>

        </div>

        {/* Save error */}
        {saveError && (
          <div className="mx-6 mb-2 px-4 py-3 rounded-xl text-sm shrink-0"
            style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}>
            {saveError}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 shrink-0"
          style={{ borderTop: '1px solid #1e1e24' }}>
          <button onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium border transition-all"
            style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: '#00E5FF', color: '#000' }}>
            {saving
              ? <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Salvando…
                </>
              : entriesWithUrl.length > 1
              ? `Salvar ${entriesWithUrl.length} concorrentes`
              : 'Salvar concorrente'
            }
          </button>
        </div>

      </div>
    </div>
  )
}

function detectPlatform(url: string): string {
  if (url.includes('mercadolivre') || url.includes('mercadolibre')) return 'ml'
  if (url.includes('shopee')) return 'shopee'
  if (url.includes('amazon')) return 'amazon'
  if (url.includes('magazineluiza') || url.includes('magalu')) return 'magalu'
  return 'other'
}
