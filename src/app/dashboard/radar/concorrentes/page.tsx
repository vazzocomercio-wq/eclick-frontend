'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { ArrowLeft, Plus, Users, ChevronRight, X, Search } from 'lucide-react'
import { api } from '../_components/api'
import { secureImg } from '../_components/shared'

interface MonitoredProduct {
  product_id: string
  name: string | null
  sku: string | null
  image: string | null
  category_id: string | null
  competitor_count: number
  active_count: number
}
interface ProductHit {
  id: string
  name: string | null
  sku: string | null
  photo_urls: string[] | null
}

const CARD = { background: '#111114', border: '1px solid #1a1a1f' }

export default function ConcorrentesPage() {
  const t = useTranslations('radar')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [products, setProducts] = useState<MonitoredProduct[]>([])
  const [modalOpen, setModalOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setProducts(await api<MonitoredProduct[]>('/radar/competitors/products'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errorLoad'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => { void load() }, [load])

  return (
    <div className="px-6 py-6 max-w-[1100px] mx-auto">
      <Link href="/dashboard/radar"
        className="inline-flex items-center gap-1.5 text-xs mb-4 hover:text-zinc-300 transition-colors"
        style={{ color: '#71717a' }}>
        <ArrowLeft size={13} /> {t('backToRadar')}
      </Link>

      <div className="flex items-start justify-between gap-4 mb-1">
        <h1 className="text-xl font-bold" style={{ color: '#fafafa' }}>{t('linkedCompetitors')}</h1>
        <button onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium shrink-0 transition-colors"
          style={{ background: '#00E5FF', color: '#09090b' }}>
          <Plus size={14} /> {t('linkCompetitor')}
        </button>
      </div>
      <p className="text-xs mb-5" style={{ color: '#52525b' }}>
        {t('linkedCompetitorsIntro')}
      </p>

      {error && (
        <div className="rounded-lg p-3 text-sm mb-5" style={{
          background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)',
        }}>{error}</div>
      )}

      {loading && (
        <div className="space-y-2">
          {[0, 1, 2].map(i => <div key={i} className="h-16 rounded-xl bg-zinc-800/30 animate-pulse" />)}
        </div>
      )}

      {!loading && products.length === 0 && (
        <div className="rounded-xl p-10 text-center" style={CARD}>
          <Users size={28} className="mx-auto mb-3" style={{ color: '#3f3f46' }} />
          <p className="text-sm font-medium" style={{ color: '#fafafa' }}>{t('noLinkedCompetitors')}</p>
          <p className="text-xs mt-1 mb-4" style={{ color: '#71717a' }}>
            {t('noLinkedCompetitorsHint')}
          </p>
          <button onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium"
            style={{ background: '#00E5FF', color: '#09090b' }}>
            <Plus size={14} /> {t('linkFirstCompetitor')}
          </button>
        </div>
      )}

      {!loading && products.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={CARD}>
          {products.map((p, i) => (
            <Link key={p.product_id} href={`/dashboard/radar/concorrentes/${p.product_id}`}
              className="flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.02] transition-colors"
              style={{ borderTop: i > 0 ? '1px solid #18181b' : undefined }}>
              {p.image
                ? <img src={secureImg(p.image)} alt="" loading="lazy"
                    className="h-10 w-10 rounded object-cover shrink-0"
                    style={{ border: '1px solid #27272a' }} />
                : <div className="h-10 w-10 rounded shrink-0"
                    style={{ background: '#1a1a1f', border: '1px solid #27272a' }} />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate" style={{ color: '#fafafa' }}>
                  {p.name ?? p.product_id}
                </p>
                <p className="text-[11px] truncate" style={{ color: '#52525b' }}>
                  {p.sku ? t('skuLabel', { sku: p.sku }) : '—'}
                </p>
              </div>
              <span className="text-[11px] tabular-nums rounded-full px-2.5 py-1 shrink-0"
                style={{ background: 'rgba(0,229,255,0.10)', color: '#67e8f9' }}>
                {t('competitorCount', { count: p.active_count })}
              </span>
              <ChevronRight size={15} style={{ color: '#52525b' }} />
            </Link>
          ))}
        </div>
      )}

      {modalOpen && (
        <LinkModal onClose={() => setModalOpen(false)} onSaved={() => { setModalOpen(false); void load() }} />
      )}
    </div>
  )
}

function LinkModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const t = useTranslations('radar')
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<ProductHit[]>([])
  const [picked, setPicked] = useState<ProductHit | null>(null)
  const [url, setUrl] = useState('')
  const [label, setLabel] = useState('')
  const [price, setPrice] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (picked || query.trim().length < 2) { setHits([]); return }
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(async () => {
      try {
        const res = await api<{ data: ProductHit[] }>(`/products?search=${encodeURIComponent(query)}&per_page=8`)
        setHits(res.data ?? [])
      } catch { setHits([]) }
    }, 300)
    return () => { if (debounce.current) clearTimeout(debounce.current) }
  }, [query, picked])

  const submit = async () => {
    setErr(null)
    if (!picked) { setErr(t('errChooseProduct')); return }
    if (!url.trim()) { setErr(t('errPasteLink')); return }
    setSaving(true)
    try {
      await api('/radar/competitors/links', {
        method: 'POST',
        body: JSON.stringify({
          product_id: picked.id,
          url: url.trim(),
          label: label.trim() || undefined,
          current_price: price ? Number(price.replace(',', '.')) : undefined,
        }),
      })
      onSaved()
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('errorSave'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-xl p-5" style={CARD} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold" style={{ color: '#fafafa' }}>{t('linkCompetitor')}</h2>
          <button onClick={onClose}><X size={16} style={{ color: '#71717a' }} /></button>
        </div>

        <label className="text-[11px] block mb-1" style={{ color: '#a1a1aa' }}>{t('yourProduct')}</label>
        {picked ? (
          <div className="flex items-center justify-between rounded-lg px-3 py-2 mb-3"
            style={{ background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.2)' }}>
            <span className="text-xs truncate" style={{ color: '#fafafa' }}>{picked.name ?? picked.id}</span>
            <button onClick={() => { setPicked(null); setQuery('') }}
              className="text-[10px] shrink-0 ml-2" style={{ color: '#67e8f9' }}>{t('change')}</button>
          </div>
        ) : (
          <div className="relative mb-3">
            <Search size={13} className="absolute left-2.5 top-2.5" style={{ color: '#52525b' }} />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('searchProductByNameOrSku')}
              className="w-full rounded-lg pl-8 pr-3 py-2 text-xs outline-none"
              style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#fafafa' }} />
            {hits.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-lg overflow-hidden"
                style={{ background: '#18181b', border: '1px solid #27272a' }}>
                {hits.map(h => (
                  <button key={h.id} onClick={() => { setPicked(h); setHits([]) }}
                    className="flex items-center gap-2 w-full text-left px-3 py-2 hover:bg-white/[0.04]">
                    {h.photo_urls?.[0]
                      ? <img src={secureImg(h.photo_urls[0])} alt="" loading="lazy"
                          className="h-8 w-8 rounded object-cover shrink-0"
                          style={{ border: '1px solid #27272a' }} />
                      : <div className="h-8 w-8 rounded shrink-0"
                          style={{ background: '#1a1a1f', border: '1px solid #27272a' }} />}
                    <span className="min-w-0 flex-1 truncate text-xs" style={{ color: '#e4e4e7' }}>
                      {h.name ?? h.id}
                      {h.sku && <span style={{ color: '#52525b' }}> · {h.sku}</span>}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <label className="text-[11px] block mb-1" style={{ color: '#a1a1aa' }}>{t('competitorLink')}</label>
        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://produto.mercadolivre.com.br/MLB-…"
          className="w-full rounded-lg px-3 py-2 text-xs outline-none mb-3"
          style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#fafafa' }} />

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-[11px] block mb-1" style={{ color: '#a1a1aa' }}>{t('nicknameOptional')}</label>
            <input value={label} onChange={e => setLabel(e.target.value)} placeholder={t('nicknamePlaceholder')}
              className="w-full rounded-lg px-3 py-2 text-xs outline-none"
              style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#fafafa' }} />
          </div>
          <div>
            <label className="text-[11px] block mb-1" style={{ color: '#a1a1aa' }}>{t('theirPrice')}</label>
            <input value={price} onChange={e => setPrice(e.target.value)} placeholder="0,00" inputMode="decimal"
              className="w-full rounded-lg px-3 py-2 text-xs outline-none tabular-nums"
              style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#fafafa' }} />
          </div>
        </div>
        <p className="text-[10px] mb-3" style={{ color: '#52525b' }}>
          {t('priceNotShared')}
        </p>

        {err && (
          <div className="rounded-lg p-2.5 text-xs mb-3" style={{
            background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)',
          }}>{err}</div>
        )}

        <button onClick={submit} disabled={saving}
          className="w-full rounded-lg py-2.5 text-xs font-medium transition-opacity disabled:opacity-50"
          style={{ background: '#00E5FF', color: '#09090b' }}>
          {saving ? t('saving') : t('link')}
        </button>
      </div>
    </div>
  )
}
