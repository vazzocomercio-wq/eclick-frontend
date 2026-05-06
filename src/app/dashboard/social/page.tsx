'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Sparkles, Plus, Loader2, Filter as FilterIcon } from 'lucide-react'
import { SocialContentApi } from '@/components/social/socialContentApi'
import type { SocialChannel, SocialContent, SocialContentStatus } from '@/components/social/types'
import { ALL_CHANNELS, CHANNEL_META, STATUS_META } from '@/components/social/channels'
import { ChannelBadge, StatusBadge } from '@/components/social/SocialBadges'

const STATUSES: SocialContentStatus[] = ['draft', 'approved', 'scheduled', 'published', 'archived']

export default function SocialFeedPage() {
  const [items, setItems]     = useState<SocialContent[] | null>(null)
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const [fChannel, setFChannel] = useState<SocialChannel | ''>('')
  const [fStatus,  setFStatus]  = useState<SocialContentStatus | ''>('')

  const summary = useMemo(() => {
    if (!items) return null
    const acc: Record<string, number> = {}
    for (const it of items) acc[it.status] = (acc[it.status] ?? 0) + 1
    return acc
  }, [items])

  async function refresh() {
    setLoading(true); setError(null)
    try {
      const res = await SocialContentApi.list({
        channel: fChannel || undefined,
        status:  fStatus  || undefined,
        limit:   100,
      })
      setItems(res.items)
      setTotal(res.total)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [fChannel, fStatus])  // eslint-disable-line

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <Sparkles size={20} className="text-cyan-400" />
            Conteúdo Social
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Posts, reels, ads e copies gerados a partir do catálogo. {total > 0 && `${total} peças no total.`}
          </p>
        </div>
        <Link
          href="/dashboard/social/generate"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black text-sm font-medium transition-colors shrink-0"
        >
          <Plus size={14} /> Gerar conteúdo
        </Link>
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 space-y-3">
        <div className="flex items-center gap-2 text-zinc-400">
          <FilterIcon size={12} />
          <span className="text-[11px] uppercase tracking-wider">Filtros</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <select
            value={fChannel}
            onChange={e => setFChannel(e.target.value as SocialChannel | '')}
            className="bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-200 focus:border-cyan-400/60 outline-none"
          >
            <option value="">Todos os canais</option>
            {ALL_CHANNELS.map(c => (
              <option key={c} value={c}>{CHANNEL_META[c].label}</option>
            ))}
          </select>
          <select
            value={fStatus}
            onChange={e => setFStatus(e.target.value as SocialContentStatus | '')}
            className="bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-200 focus:border-cyan-400/60 outline-none"
          >
            <option value="">Todos os status</option>
            {STATUSES.map(s => (
              <option key={s} value={s}>{STATUS_META[s].label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Status summary */}
      {summary && Object.keys(summary).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {STATUSES.filter(s => summary[s]).map(s => (
            <button
              key={s}
              onClick={() => setFStatus(fStatus === s ? '' : s)}
              className={[
                'rounded-lg px-3 py-2 text-[11px] border transition-colors',
                fStatus === s
                  ? 'border-cyan-400/60 bg-cyan-400/10 text-cyan-300'
                  : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700',
              ].join(' ')}
            >
              <span className="font-medium">{summary[s]}</span> {STATUS_META[s].label}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      {loading && (
        <div className="flex items-center gap-2 text-zinc-500 text-sm">
          <Loader2 size={14} className="animate-spin" /> carregando…
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">
          ❌ {error}
        </div>
      )}

      {!loading && !error && items && items.length === 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-8 text-center space-y-3">
          <Sparkles size={32} className="mx-auto text-cyan-400 opacity-60" />
          <p className="text-sm text-zinc-300">Nenhum conteúdo social ainda.</p>
          <p className="text-xs text-zinc-500">
            Selecione um produto enriquecido e gere conteúdo para 1 ou mais canais em segundos.
          </p>
          <Link
            href="/dashboard/social/generate"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black text-sm font-medium"
          >
            <Plus size={14} /> Gerar primeiro conteúdo
          </Link>
        </div>
      )}

      {!loading && items && items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map(it => (
            <ContentCard key={it.id} item={it} />
          ))}
        </div>
      )}
    </div>
  )
}

function ContentCard({ item }: { item: SocialContent }) {
  // Heurística pra extrair "primeira linha" relevante do JSON content
  const preview = useMemo(() => {
    const c = item.content as Record<string, unknown>
    const candidates = [
      c.caption, c.main_caption, c.message, c.subject, c.script,
      Array.isArray(c.headlines) && (c.headlines as unknown[])[0],
    ]
    for (const cand of candidates) {
      if (typeof cand === 'string' && cand.trim().length > 0) return cand.slice(0, 200)
    }
    return JSON.stringify(item.content).slice(0, 200)
  }, [item])

  return (
    <Link
      href={`/dashboard/social/content/${item.id}`}
      className="rounded-lg border border-zinc-800 bg-zinc-900/40 hover:border-cyan-400/40 transition-colors p-3 space-y-2 block"
    >
      <div className="flex items-center justify-between gap-2">
        <ChannelBadge channel={item.channel} />
        <StatusBadge status={item.status} size="xs" />
      </div>
      <p className="text-xs text-zinc-300 line-clamp-3 leading-relaxed">{preview}</p>
      <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 text-[10px] text-zinc-500">
        <span>v{item.version}</span>
        <span>{new Date(item.created_at).toLocaleDateString('pt-BR')}</span>
      </div>
    </Link>
  )
}
