'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { PM, ScraperResult, brl } from '../types'

const SCRAPER = process.env.NEXT_PUBLIC_SCRAPER_URL ?? 'https://price-scraper-production-2e7c.up.railway.app'

type Product = { id: string; name: string; price: number | null }

type Props = {
  orgId: string
  onClose: () => void
  onSaved: () => void
}

export default function AddCompetitorModal({ orgId, onClose, onSaved }: Props) {
  const [products, setProducts] = useState<Product[]>([])
  const [productId, setProductId] = useState('')
  const [url, setUrl] = useState('')
  const [scraping, setScraping] = useState(false)
  const [preview, setPreview] = useState<ScraperResult | null>(null)
  const [scrapeError, setScrapeError] = useState('')
  const [saving, setSaving] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('products')
      .select('id,name,price')
      .eq('organization_id', orgId)
      .order('name')
      .then(({ data }) => setProducts(data ?? []))
  }, [orgId])

  // Auto-scrape on URL paste with 800ms debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setPreview(null)
    setScrapeError('')
    if (!url.startsWith('http')) return

    debounceRef.current = setTimeout(() => scrapeUrl(url), 800)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [url])

  async function scrapeUrl(target: string) {
    setScraping(true)
    setScrapeError('')
    try {
      const res = await fetch(`${SCRAPER}/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: ScraperResult = await res.json()
      if (!data.price) throw new Error('Preço não encontrado na página.')
      setPreview(data)
    } catch (e: unknown) {
      setScrapeError(e instanceof Error ? e.message : 'Falha ao buscar dados do concorrente.')
    } finally {
      setScraping(false)
    }
  }

  async function handleSave() {
    if (!productId || !url || !preview) return
    setSaving(true)
    const supabase = createClient()

    const product = products.find(p => p.id === productId)

    const { error } = await supabase.from('competitors').insert({
      product_id: productId,
      organization_id: orgId,
      platform: preview.platform ?? detectPlatform(url),
      url,
      title: preview.title ?? null,
      seller: preview.seller ?? null,
      current_price: preview.price,
      my_price: product?.price ?? null,
      status: 'active',
      last_checked: new Date().toISOString(),
    })

    if (!error) {
      // Save first price_history entry
      const { data: comp } = await supabase
        .from('competitors')
        .select('id')
        .eq('url', url)
        .eq('organization_id', orgId)
        .maybeSingle()
      if (comp) {
        await supabase.from('price_history').insert({
          competitor_id: comp.id,
          price: preview.price,
        })
      }
      onSaved()
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col"
        style={{ background: '#111114', border: '1px solid #1e1e24' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid #1e1e24' }}>
          <p className="text-white font-semibold">Adicionar Concorrente</p>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Product select */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Produto monitorado
            </label>
            <select value={productId} onChange={e => setProductId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-sm text-white border border-[#3f3f46] outline-none focus:border-[#00E5FF] transition-all"
              style={{ background: '#1c1c1f' }}>
              <option value="">Selecione um produto…</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.price != null ? ` — ${brl(p.price)}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* URL input */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              URL do concorrente
            </label>
            <div className="relative">
              <input
                type="url"
                placeholder="https://www.mercadolivre.com.br/..."
                value={url}
                onChange={e => setUrl(e.target.value)}
                className="w-full px-3 py-2.5 pr-10 rounded-lg text-sm text-white placeholder-zinc-600 border border-[#3f3f46] outline-none focus:border-[#00E5FF] transition-all"
                style={{ background: '#1c1c1f' }}
              />
              {scraping && (
                <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-cyan-400"
                  fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
            </div>
            {scraping && (
              <p className="text-[11px] text-zinc-500 mt-1">Buscando dados do produto…</p>
            )}
          </div>

          {/* Scrape error */}
          {scrapeError && (
            <div className="px-4 py-3 rounded-xl text-sm"
              style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}>
              {scrapeError}
            </div>
          )}

          {/* Preview */}
          {preview && (
            <div className="rounded-xl p-4 space-y-3"
              style={{ background: 'rgba(0,229,255,0.04)', border: '1px solid rgba(0,229,255,0.15)' }}>
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-cyan-400">
                  Dados encontrados
                </p>
                {preview.platform && PM[preview.platform] && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded"
                    style={{ background: PM[preview.platform].bg, color: PM[preview.platform].fg }}>
                    {PM[preview.platform].label}
                  </span>
                )}
              </div>
              <p className="text-white text-sm font-medium leading-snug line-clamp-2">
                {preview.title ?? '—'}
              </p>
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-zinc-500 text-[10px]">Preço</p>
                  <p className="text-white font-bold text-base">{brl(preview.price)}</p>
                </div>
                {preview.seller && (
                  <div>
                    <p className="text-zinc-500 text-[10px]">Vendedor</p>
                    <p className="text-zinc-300 text-sm">{preview.seller}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4"
          style={{ borderTop: '1px solid #1e1e24' }}>
          <button onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium border transition-all"
            style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!productId || !url || !preview || saving}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: '#00E5FF', color: '#000' }}>
            {saving
              ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Salvando…</>
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
