'use client'

/**
 * Blog da Loja — geração de conteúdo GEO ciente dos produtos, fila de revisão.
 * A IA escreve artigos que apresentam produtos reais da loja → vão pro ar na
 * vitrine /loja/[slug]/blog. Pipeline: gerar → revisar → publicar/agendar.
 *
 * Endpoints (eclick-backend, módulo store-blog):
 *   POST /store-blog/generate | /ideate | /generate-batch
 *   GET  /store-blog/posts
 *   POST /store-blog/posts/:id/publish|reject|schedule|unschedule
 */

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import Image from 'next/image'
import {
  Sparkles, Loader2, Send, Archive, CheckCircle2, ExternalLink,
  AlertCircle, Clock, Lightbulb, Newspaper, ChevronLeft, ChevronRight,
  Wand2, List, CalendarDays,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

type Status = 'generating' | 'review' | 'approved' | 'scheduled' | 'published' | 'failed' | 'archived'

interface Post {
  id: string
  title: string
  slug: string
  excerpt: string | null
  cover_image_url: string | null
  reading_time_minutes: number | null
  status: Status
  scheduled_for: string | null
  published_at: string | null
  rejected_reason: string | null
  source_topic: string | null
  featured_product_ids: string[]
}

interface TopicIdea {
  title: string
  angle: string
  why: string
  aiPrompts: string[]
  productIds?: string[]
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

export default function StoreBlogPage() {
  const [topic, setTopic] = useState('')
  const [notes, setNotes] = useState('')
  const [generating, setGenerating] = useState(false)
  const [seed, setSeed] = useState('')
  const [ideas, setIdeas] = useState<TopicIdea[]>([])
  const [ideating, setIdeating] = useState(false)
  const [batching, setBatching] = useState(false)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [storeSlug, setStoreSlug] = useState<string | null>(null)
  const [view, setView] = useState<'list' | 'calendar'>('list')

  const token = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token
  }, [])

  const api = useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T> => {
      const t = await token()
      const res = await fetch(`${BACKEND}${path}`, {
        ...init,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}`, ...(init?.headers ?? {}) },
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error((body && (body.message as string)) || `HTTP ${res.status}`)
      return body as T
    },
    [token],
  )

  const load = useCallback(async () => {
    try {
      const data = await api<Post[]>('/store-blog/posts')
      setPosts(data)
    } catch {
      setPosts([])
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    void load()
    // slug da loja pra montar o "ver no ar"
    api<{ slug?: string }>('/store-config').then((c) => setStoreSlug(c?.slug ?? null)).catch(() => {})
  }, [load, api])

  // polling enquanto houver 'generating'
  const hasGenerating = posts.some((p) => p.status === 'generating')
  useEffect(() => {
    if (!hasGenerating) return
    const id = setInterval(() => void load(), 6000)
    return () => clearInterval(id)
  }, [hasGenerating, load])

  async function runGenerate(topicVal: string, productIds?: string[]) {
    if (!topicVal.trim() || generating) return
    setGenerating(true); setError(null)
    try {
      const post = await api<Post>('/store-blog/generate', {
        method: 'POST',
        body: JSON.stringify({ topic: topicVal.trim(), notes: notes.trim() || undefined, productIds }),
      })
      setPosts((prev) => [post, ...prev.filter((p) => p.id !== post.id)])
      setTopic(''); setNotes(''); setIdeas([])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  async function onIdeate() {
    if (ideating) return
    setIdeating(true); setError(null)
    try {
      const { topics } = await api<{ topics: TopicIdea[] }>('/store-blog/ideate', {
        method: 'POST', body: JSON.stringify({ seed: seed.trim() || undefined }),
      })
      setIdeas(topics)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setIdeating(false)
    }
  }

  async function onBatch() {
    if (batching) return
    setBatching(true); setError(null)
    try {
      const created = await api<Post[]>('/store-blog/generate-batch', {
        method: 'POST', body: JSON.stringify({ seed: seed.trim() || undefined, count: 5 }),
      })
      setPosts((prev) => [...created, ...prev.filter((p) => !created.some((c) => c.id === p.id))])
      setIdeas([])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBatching(false)
    }
  }

  async function act(id: string, path: string, body?: unknown) {
    setBusyId(id); setError(null)
    try {
      const updated = await api<Post>(`/store-blog/posts/${id}/${path}`, {
        method: 'POST', body: body ? JSON.stringify(body) : undefined,
      })
      setPosts((prev) => prev.map((p) => (p.id === id ? updated : p)))
      if (path === 'publish') { setToast('Publicado! Já está no ar no blog da sua loja.'); setTimeout(() => setToast(null), 4000) }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Link href="/dashboard/loja" className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-100">
        <ChevronLeft size={16} /> Voltar pra Loja
      </Link>

      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-cyan-400">
            <Newspaper size={18} />
            <span className="text-xs font-semibold uppercase tracking-wider">Blog da Loja</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold text-zinc-50">Conteúdo que vende (GEO)</h1>
          <p className="mt-1 text-sm text-zinc-400">
            A IA escreve artigos otimizados pra IA/Google que apresentam seus produtos. Você revisa e publica no blog da sua loja.
          </p>
        </div>
        <Link href="/dashboard/loja/blog/estudio" className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-200 hover:bg-zinc-800">
          <Wand2 size={16} className="text-cyan-400" /> Estúdio
        </Link>
      </div>

      {/* Form */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <label className="mb-1.5 block text-sm font-medium text-zinc-200">Tema / pauta</label>
        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Ex: Como escolher a luminária ideal pra cada cômodo"
          rows={2}
          className="w-full resize-y rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-500"
        />
        <label className="mb-1.5 mt-3 block text-sm font-medium text-zinc-200">Direções extras (opcional)</label>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-500"
        />
        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            <AlertCircle size={16} className="mt-0.5 shrink-0" /> <span>{error}</span>
          </div>
        )}
        <button
          type="button"
          onClick={() => void runGenerate(topic)}
          disabled={generating || !topic.trim()}
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {generating ? 'Gerando…' : 'Gerar artigo'}
        </button>
      </div>

      {/* Sugerir pautas */}
      <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Lightbulb size={16} className="text-cyan-400" />
          <span className="text-sm font-medium text-zinc-200">Sem ideia? A IA sugere pautas</span>
          <input
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            placeholder="Foco opcional (ex: cozinha, presente, inverno)"
            className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-cyan-500"
          />
          <button
            type="button" onClick={onIdeate} disabled={ideating}
            className="inline-flex items-center gap-1.5 rounded-md border border-cyan-500/40 px-3 py-1.5 text-sm font-medium text-cyan-400 hover:bg-cyan-500/10 disabled:opacity-50"
          >
            {ideating ? <Loader2 size={16} className="animate-spin" /> : <Lightbulb size={16} />}
            {ideating ? 'Pensando…' : 'Sugerir pautas'}
          </button>
          <button
            type="button" onClick={onBatch} disabled={batching || ideating}
            className="inline-flex items-center gap-1.5 rounded-md bg-cyan-500 px-3 py-1.5 text-sm font-semibold text-zinc-950 hover:opacity-90 disabled:opacity-50"
          >
            {batching ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {batching ? 'Gerando lote…' : 'Gerar 5 em lote'}
          </button>
        </div>
        {ideas.length > 0 && (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {ideas.map((idea, i) => (
              <li key={i} className="flex flex-col gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                <span className="text-sm font-semibold text-zinc-100">{idea.title}</span>
                {idea.angle && <span className="text-xs text-zinc-400">{idea.angle}</span>}
                <button
                  type="button" onClick={() => void runGenerate(idea.title, idea.productIds)} disabled={generating}
                  className="mt-1 inline-flex items-center gap-1.5 self-start rounded-md bg-cyan-500 px-2.5 py-1 text-xs font-semibold text-zinc-950 hover:opacity-90 disabled:opacity-50"
                >
                  <Sparkles size={12} /> Gerar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {toast && (
        <div className="mt-4 flex items-center gap-2 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-400">
          <CheckCircle2 size={16} /> {toast}
        </div>
      )}

      <div className="mb-3 mt-8 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">{view === 'calendar' ? 'Calendário' : 'Posts'}</h2>
        <div className="inline-flex overflow-hidden rounded-md border border-zinc-700">
          <button type="button" onClick={() => setView('list')} className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium ${view === 'list' ? 'bg-cyan-500 text-zinc-950' : 'text-zinc-400 hover:bg-zinc-800'}`}><List size={14} /> Lista</button>
          <button type="button" onClick={() => setView('calendar')} className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium ${view === 'calendar' ? 'bg-cyan-500 text-zinc-950' : 'text-zinc-400 hover:bg-zinc-800'}`}><CalendarDays size={14} /> Calendário</button>
        </div>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-400"><Loader2 size={16} className="animate-spin" /> …</div>
      ) : view === 'calendar' ? (
        <EditorialCalendar posts={posts} storeSlug={storeSlug} />
      ) : posts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-500">
          Nenhum post ainda. Gere o primeiro acima.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {posts.map((post) => (
            <PostRow key={post.id} post={post} busy={busyId === post.id} storeSlug={storeSlug}
              onPublish={() => act(post.id, 'publish')}
              onReject={() => act(post.id, 'reject')}
              onSchedule={(iso) => act(post.id, 'schedule', { scheduled_for: iso })}
              onUnschedule={() => act(post.id, 'unschedule')}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

/** Calendário editorial: agendados (âmbar) + publicados (verde) por dia. */
function EditorialCalendar({ posts, storeSlug }: { posts: Post[]; storeSlug: string | null }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const year = cursor.getFullYear(), month = cursor.getMonth()
  const byDay = new Map<string, Array<{ post: Post; date: Date }>>()
  for (const post of posts) {
    const iso = post.status === 'scheduled' ? post.scheduled_for : post.status === 'published' ? post.published_at : null
    if (!iso) continue
    const d = new Date(iso); if (Number.isNaN(d.getTime())) continue
    const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    if (!byDay.has(k)) byDay.set(k, [])
    byDay.get(k)!.push({ post, date: d })
  }
  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date()
  const isToday = (day: number) => today.getFullYear() === year && today.getMonth() === month && today.getDate() === day
  const monthLabel = cursor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const cells: Array<number | null> = [...Array.from({ length: firstWeekday }, () => null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={() => setCursor(new Date(year, month - 1, 1))} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-700 text-zinc-400 hover:bg-zinc-800"><ChevronLeft size={16} /></button>
        <span className="text-sm font-semibold capitalize text-zinc-100">{monthLabel}</span>
        <button type="button" onClick={() => setCursor(new Date(year, month + 1, 1))} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-700 text-zinc-400 hover:bg-zinc-800"><ChevronRight size={16} /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((w) => <div key={w} className="py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{w}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} className="min-h-[64px] rounded-md" />
          const k = `${year}-${month}-${day}`
          const items = byDay.get(k) ?? []
          return (
            <div key={k} className={`min-h-[64px] rounded-md border p-1 ${isToday(day) ? 'border-cyan-500/60 bg-cyan-500/5' : 'border-zinc-800 bg-zinc-950'}`}>
              <div className={`mb-0.5 text-[11px] font-medium ${isToday(day) ? 'text-cyan-400' : 'text-zinc-500'}`}>{day}</div>
              <div className="flex flex-col gap-0.5">
                {items.slice(0, 3).map(({ post }) => {
                  const cls = post.status === 'scheduled' ? 'bg-amber-500/15 text-amber-400' : 'bg-green-500/15 text-green-400'
                  const chip = <span className={`block truncate rounded px-1 py-0.5 text-[10px] leading-tight ${cls}`} title={post.title}>{post.title}</span>
                  return post.status === 'published' && storeSlug ? <a key={post.id} href={`/loja/${storeSlug}/blog/${post.slug}`} target="_blank" rel="noopener noreferrer">{chip}</a> : <span key={post.id}>{chip}</span>
                })}
                {items.length > 3 && <span className="px-1 text-[10px] text-zinc-500">+{items.length - 3}</span>}
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-zinc-500">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-amber-500/40" /> Agendado</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-green-500/40" /> Publicado</span>
      </div>
    </div>
  )
}

function PostRow({ post, busy, storeSlug, onPublish, onReject, onSchedule, onUnschedule }: {
  post: Post; busy: boolean; storeSlug: string | null
  onPublish: () => void; onReject: () => void; onSchedule: (iso: string) => void; onUnschedule: () => void
}) {
  const [scheduleAt, setScheduleAt] = useState('')
  const canPublish = post.status === 'review' || post.status === 'approved'
  const statusColor =
    post.status === 'published' ? 'bg-green-500/15 text-green-400'
    : post.status === 'failed' ? 'bg-red-500/15 text-red-400'
    : post.status === 'scheduled' ? 'bg-amber-500/15 text-amber-400'
    : post.status === 'review' ? 'bg-cyan-500/15 text-cyan-400'
    : 'bg-zinc-700/40 text-zinc-400'
  const statusLabel =
    post.status === 'published' ? 'Publicado' : post.status === 'review' ? 'Em revisão'
    : post.status === 'scheduled' ? 'Agendado' : post.status === 'failed' ? 'Falhou'
    : post.status === 'archived' ? 'Arquivado' : post.status === 'generating' ? 'Gerando…' : post.status

  return (
    <li className="flex gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
      <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-md bg-zinc-950">
        {post.cover_image_url && <Image src={post.cover_image_url} alt="" fill sizes="112px" className="object-cover" unoptimized />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase ${statusColor}`}>{statusLabel}</span>
          {post.featured_product_ids?.length ? (
            <span className="text-[11px] text-zinc-500">{post.featured_product_ids.length} produto(s)</span>
          ) : null}
        </div>
        <h3 className="mt-1 truncate text-sm font-semibold text-zinc-100">{post.title}</h3>
        <p className="line-clamp-1 text-xs text-zinc-500">{post.excerpt ?? post.source_topic ?? ''}</p>
        {post.status === 'failed' && post.rejected_reason && (
          <p className="mt-0.5 text-[11px] text-red-400">{post.rejected_reason}</p>
        )}
      </div>
      <div className="flex w-44 shrink-0 flex-col items-end justify-center gap-1.5">
        {post.status === 'published' ? (
          storeSlug ? (
            <a href={`/loja/${storeSlug}/blog/${post.slug}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-cyan-400 hover:underline">
              Ver no ar <ExternalLink size={12} />
            </a>
          ) : <span className="text-[11px] text-green-400">Publicado</span>
        ) : post.status === 'scheduled' ? (
          <>
            <span className="flex items-center gap-1 text-[11px] font-medium text-amber-400"><Clock size={12} /> {fmtDateTime(post.scheduled_for)}</span>
            <button type="button" onClick={onPublish} disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:opacity-90 disabled:opacity-50">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Publicar agora
            </button>
            <button type="button" onClick={onUnschedule} disabled={busy} className="text-xs text-zinc-500 hover:text-zinc-200 disabled:opacity-50">Desagendar</button>
          </>
        ) : (
          <>
            {canPublish && (
              <button type="button" onClick={onPublish} disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-md bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:opacity-90 disabled:opacity-50">
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Publicar
              </button>
            )}
            {canPublish && (
              <div className="flex items-center gap-1">
                <input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)}
                  className="w-[8.5rem] rounded border border-zinc-700 bg-zinc-950 px-1.5 py-1 text-[11px] text-zinc-100 outline-none focus:border-cyan-500" />
                <button type="button" disabled={busy || !scheduleAt}
                  onClick={() => scheduleAt && onSchedule(new Date(scheduleAt).toISOString())}
                  className="inline-flex items-center gap-1 rounded-md border border-zinc-700 px-2 py-1 text-[11px] font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-40">
                  <Clock size={12} /> Agendar
                </button>
              </div>
            )}
            {post.status !== 'archived' && (
              <button type="button" onClick={onReject} disabled={busy}
                className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-red-400 disabled:opacity-50">
                <Archive size={14} /> Arquivar
              </button>
            )}
          </>
        )}
      </div>
    </li>
  )
}
