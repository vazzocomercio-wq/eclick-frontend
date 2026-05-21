'use client'

/**
 * Galeria de banners gerados pela IA.
 *
 * Cada banner gerado em qualquer ponto (Designer, esta página, modal
 * de seção do storefront) fica persistido em generated_banners. Aqui
 * o lojista vê histórico, copia URLs pra usar em outros lugares,
 * dispara nova geração e deleta os antigos.
 *
 * Endpoints:
 *   GET    /banner-generator/history?format=&limit=&offset=
 *   DELETE /banner-generator/:id
 */

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import {
  ImageIcon, Loader2, ChevronLeft, Plus, Trash2, Copy, Check,
  Sparkles, AlertCircle, Monitor, Smartphone, Square,
} from 'lucide-react'
import Link from 'next/link'
import { BannerGeneratorModal } from '@/components/storefront/BannerGeneratorModal'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

interface Banner {
  id:            string
  image_url:     string
  format:        string
  style_key:     string | null
  prompt_used:   string | null
  custom_prompt: boolean
  product_ids:   string[]
  cost_usd:      number
  fallback_used: boolean
  created_at:    string
}

type FormatFilter = '' | 'wide_desktop' | 'square_mobile' | 'tall_mobile' | 'square' | 'wide'

const FORMAT_LABELS: Record<string, { label: string; icon: React.ReactNode; ratio: string }> = {
  wide_desktop:   { label: 'Desktop',    icon: <Monitor   size={12} />, ratio: '16/9' },
  wide:           { label: 'Wide',       icon: <Monitor   size={12} />, ratio: '16/9' },
  square_mobile:  { label: 'Mobile',     icon: <Smartphone size={12} />, ratio: '1/1' },
  square:         { label: 'Quadrado',   icon: <Square    size={12} />, ratio: '1/1' },
  tall_mobile:    { label: 'Story',      icon: <Smartphone size={12} />, ratio: '9/16' },
}

export default function BannersPage() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FormatFilter>('')
  const [showModal, setShowModal] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const fetchToken = useCallback(async () => {
    const supabase = createClient()
    const { data: session } = await supabase.auth.getSession()
    return session.session?.access_token
  }, [])

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const token = await fetchToken()
      const params = new URLSearchParams({ limit: '60' })
      if (filter) params.set('format', filter)
      const res = await fetch(`${BACKEND}/banner-generator/history?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setBanners(data.banners ?? [])
      setTotal(data.total ?? 0)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [fetchToken, filter])

  useEffect(() => { void load() }, [load])

  const remove = async (id: string) => {
    if (!confirm('Remover este banner do histórico?')) return
    try {
      const token = await fetchToken()
      const res = await fetch(`${BACKEND}/banner-generator/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await load()
    } catch (e) { setError((e as Error).message) }
  }

  const copy = async (banner: Banner) => {
    try {
      await navigator.clipboard.writeText(banner.image_url)
      setCopiedId(banner.id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch { /* navigator.clipboard pode falhar — silent */ }
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-5">
      {/* Header */}
      <div>
        <Link href="/dashboard/loja" className="text-xs text-zinc-500 hover:text-cyan-400 inline-flex items-center gap-1 mb-2">
          <ChevronLeft size={12} /> Voltar pro hub
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-white text-3xl font-semibold flex items-center gap-2">
              <ImageIcon size={24} /> Banners IA
            </h1>
            <p className="text-xs text-zinc-500 mt-1">
              Galeria de banners gerados · estilos por produto · multi-formato
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: '#00E5FF', color: '#0a0a0e', minHeight: 44 }}>
            <Sparkles size={14} /> Gerar novo banner
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <FilterChip label="Todos"     value=""              current={filter} onClick={setFilter} />
        <FilterChip label="Desktop"   value="wide_desktop"  current={filter} onClick={setFilter} icon={<Monitor size={12} />} />
        <FilterChip label="Mobile"    value="square_mobile" current={filter} onClick={setFilter} icon={<Smartphone size={12} />} />
        <FilterChip label="Story"     value="tall_mobile"   current={filter} onClick={setFilter} icon={<Smartphone size={12} />} />
        <FilterChip label="Wide"      value="wide"          current={filter} onClick={setFilter} icon={<Monitor size={12} />} />
        <FilterChip label="Quadrado"  value="square"        current={filter} onClick={setFilter} icon={<Square size={12} />} />
        <span className="text-xs text-zinc-500 ml-auto">
          {loading ? '…' : `${total} banner${total === 1 ? '' : 's'}`}
        </span>
      </div>

      {error && (
        <div className="p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
          <p className="text-sm text-red-400 flex items-center gap-2">
            <AlertCircle size={14} /> {error}
          </p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-zinc-500">
          <Loader2 className="animate-spin inline-block" size={20} />
        </div>
      ) : banners.length === 0 ? (
        <div className="text-center py-12 rounded-lg" style={{ background: '#0a0a0e', border: '1px dashed #27272a' }}>
          <ImageIcon size={32} className="mx-auto text-zinc-700 mb-2" />
          <p className="text-sm text-zinc-500 mb-3">
            {filter ? 'Nenhum banner nesse formato' : 'Nenhum banner gerado ainda'}
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="text-xs px-3 py-1.5 rounded font-medium inline-flex items-center gap-1"
            style={{ background: '#00E5FF', color: '#0a0a0e', minHeight: 36 }}>
            <Sparkles size={12} /> Gerar primeiro banner
          </button>
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {banners.map(b => (
            <BannerCard
              key={b.id}
              banner={b}
              copied={copiedId === b.id}
              onCopy={() => copy(b)}
              onRemove={() => remove(b.id)}
            />
          ))}
        </div>
      )}

      {showModal && (
        <BannerGeneratorModal
          onClose={() => { setShowModal(false); void load() }}
          onPick={() => { setShowModal(false); void load() }}
        />
      )}
    </div>
  )
}

function FilterChip({ label, value, current, onClick, icon }: {
  label: string; value: FormatFilter; current: FormatFilter
  onClick: (v: FormatFilter) => void
  icon?: React.ReactNode
}) {
  const active = current === value
  return (
    <button
      onClick={() => onClick(value)}
      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
      style={{
        background: active ? '#00E5FF' : '#0a0a0e',
        color: active ? '#0a0a0e' : '#fafafa',
        border: `1px solid ${active ? '#00E5FF' : '#27272a'}`,
        minHeight: 36,
      }}>
      {icon} {label}
    </button>
  )
}

function BannerCard({ banner, copied, onCopy, onRemove }: {
  banner: Banner
  copied: boolean
  onCopy: () => void
  onRemove: () => void
}) {
  const fmt = FORMAT_LABELS[banner.format] ?? { label: banner.format, icon: null, ratio: '1/1' }
  const date = new Date(banner.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="rounded-lg overflow-hidden transition-all"
      style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
      <div style={{ aspectRatio: fmt.ratio, position: 'relative', background: '#18181b' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={banner.image_url} alt="Banner gerado"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        <div style={{ position: 'absolute', top: 8, left: 8 }}>
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase px-2 py-1 rounded"
            style={{ background: 'rgba(0,0,0,0.7)', color: '#fff', backdropFilter: 'blur(4px)' }}>
            {fmt.icon} {fmt.label}
          </span>
        </div>
        {banner.fallback_used && (
          <div style={{ position: 'absolute', top: 8, right: 8 }}>
            <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(245,158,11,0.8)', color: '#000' }}>
              fallback
            </span>
          </div>
        )}
      </div>

      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between gap-2 text-[10px] text-zinc-500">
          <span>{banner.style_key ?? 'Custom'}</span>
          <span>{date}</span>
        </div>
        {banner.prompt_used && (
          <p className="text-[11px] text-zinc-400 line-clamp-2 leading-snug">
            {banner.prompt_used}
          </p>
        )}
        <div className="flex items-center gap-2 pt-2 border-t" style={{ borderColor: '#27272a' }}>
          <button
            onClick={onCopy}
            className="flex-1 text-xs px-2 py-2 rounded font-medium inline-flex items-center justify-center gap-1"
            style={{
              background: copied ? 'rgba(34,197,94,0.1)' : '#18181b',
              color:      copied ? '#22c55e' : '#fafafa',
              border:     `1px solid ${copied ? 'rgba(34,197,94,0.3)' : '#27272a'}`,
              minHeight: 36,
            }}>
            {copied ? <><Check size={12} /> Copiado</> : <><Copy size={12} /> Copiar URL</>}
          </button>
          <a
            href={banner.image_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs px-3 py-2 rounded font-medium inline-flex items-center gap-1"
            style={{ background: '#18181b', color: '#fafafa', border: '1px solid #27272a', minHeight: 36 }}>
            Abrir
          </a>
          <button
            onClick={onRemove}
            className="text-xs px-2 py-2 rounded font-medium"
            title="Remover"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', minHeight: 36, minWidth: 36 }}>
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  )
}
