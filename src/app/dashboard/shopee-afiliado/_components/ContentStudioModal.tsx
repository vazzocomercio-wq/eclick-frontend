'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Check, Copy, FileText, Camera, Loader2, MessageCircle, Music2,
  Radio, Sparkles, Video, X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'

/** F18 F2.6 — Modal Content Studio. Pick canal + tom → IA gera copy de
 *  venda com link rastreável injetado (POST /shopee-affiliate/content). */

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL
  ?? process.env.NEXT_PUBLIC_API_URL
  ?? 'https://eclick-backend-production-2a87.up.railway.app'

const CYAN = '#00E5FF'

type Channel = 'whatsapp' | 'instagram' | 'tiktok' | 'shopee_video' | 'shopee_live' | 'blog'

interface ContentResult {
  item_id:   number
  name:      string | null
  channel:   string
  content:   string
  short_url: string
  sub_id:    string
  link_id:   string
}

const CHANNELS: Array<{ key: Channel; icon: React.ReactNode }> = [
  { key: 'whatsapp',     icon: <MessageCircle size={16} /> },
  { key: 'instagram',    icon: <Camera size={16} /> },
  { key: 'tiktok',       icon: <Music2 size={16} /> },
  { key: 'shopee_video', icon: <Video size={16} /> },
  { key: 'shopee_live',  icon: <Radio size={16} /> },
  { key: 'blog',         icon: <FileText size={16} /> },
]

export default function ContentStudioModal({ itemId, itemName, onClose }: {
  itemId:   number
  itemName: string | null
  onClose:  () => void
}) {
  const t = useTranslations('shopeeAffiliate.contentStudio')
  const [channel, setChannel] = useState<Channel>('whatsapp')
  const [tone, setTone]       = useState('')
  const [result, setResult]   = useState<ContentResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [copied, setCopied]   = useState(false)

  const generate = async () => {
    setLoading(true)
    setError(null)
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      const res = await fetch(`${BACKEND}/shopee-affiliate/content`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ item_id: itemId, channel, tone: tone || undefined }),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error(b?.message ?? `HTTP ${res.status}`)
      }
      setResult(await res.json())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const copy = async () => {
    if (!result) return
    await navigator.clipboard.writeText(result.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative w-full max-w-lg rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
        style={{ background: '#0f0f13', border: '1px solid #1e1e24' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles size={16} style={{ color: CYAN }} />
              <h3 className="text-white font-semibold">{t('title')}</h3>
            </div>
            <p className="text-xs text-zinc-500 mt-1 line-clamp-1">{itemName ?? `Item ${itemId}`}</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white" aria-label={t('close')}>
            <X size={18} />
          </button>
        </div>

        {!result ? (
          <>
            <p className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold mb-2">{t('pickChannel')}</p>
            <div className="grid grid-cols-3 gap-2">
              {CHANNELS.map(c => {
                const active = channel === c.key
                return (
                  <button key={c.key} onClick={() => setChannel(c.key)}
                    className="flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all"
                    style={{ background: active ? CYAN + '15' : '#18181b', border: `1px solid ${active ? CYAN + '55' : '#27272a'}`, color: active ? CYAN : '#a1a1aa' }}>
                    {c.icon}
                    <span className="text-[10px] font-medium">{t(`channel.${c.key}`)}</span>
                  </button>
                )
              })}
            </div>

            <p className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold mt-4 mb-1">{t('tone')}</p>
            <input type="text" value={tone} onChange={e => setTone(e.target.value)}
              placeholder={t('tonePlaceholder')}
              className="w-full px-3 py-2 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-600"
              style={{ background: '#0a0a0e', border: '1px solid #1e1e24', outline: 'none' }} />

            {error && (
              <div className="mt-4 rounded-lg p-2.5 text-xs" style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}>{error}</div>
            )}

            <button onClick={generate} disabled={loading}
              className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
              style={{ background: CYAN, color: '#08080a' }}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {loading ? t('generating') : t('generate')}
            </button>
          </>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">{t('result')}</p>
                <button onClick={copy} className="flex items-center gap-1 text-xs" style={{ color: copied ? '#34d399' : CYAN }}>
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? t('copied') : t('copy')}
                </button>
              </div>
              <div className="rounded-lg p-3 text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed"
                style={{ background: '#18181b', border: '1px solid #27272a' }}>
                {result.content}
              </div>
            </div>

            <div className="rounded-lg p-2.5" style={{ background: '#0a0a0e', border: '1px solid #1e1e24' }}>
              <p className="text-[9px] uppercase tracking-wider text-zinc-600 font-semibold">{t('linkIncluded')}</p>
              <p className="text-[11px] text-zinc-400 font-mono truncate mt-0.5">{result.short_url}</p>
            </div>

            <p className="text-[10px] text-zinc-600 text-center">{t('hint')}</p>

            <button onClick={() => setResult(null)}
              className="w-full py-2 rounded-lg text-xs font-medium border transition-all"
              style={{ borderColor: '#2e2e33', color: '#a1a1aa' }}>
              {t('generateAnother')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
