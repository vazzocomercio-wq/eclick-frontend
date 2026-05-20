'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Loader2, RefreshCcw, Check, Calendar, Archive,
  Eye, Code2, AlertCircle, Sparkles, Save, X, Send,
} from 'lucide-react'
import { SocialContentApi } from '@/components/social/socialContentApi'
import SocialContentPreview from '@/components/social/SocialContentPreview'
import { ChannelBadge, StatusBadge } from '@/components/social/SocialBadges'
import { CHANNEL_META } from '@/components/social/channels'
import type { SocialContent } from '@/components/social/types'

export default function SocialContentDetailPage() {
  const t = useTranslations('social.detail')
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params.id

  const [item, setItem]       = useState<SocialContent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  // Edit mode
  const [view, setView]       = useState<'preview' | 'json'>('preview')
  const [jsonDraft, setJsonDraft] = useState<string>('')
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [saving, setSaving]   = useState(false)

  // Regenerate
  const [regenOpen, setRegenOpen] = useState(false)
  const [regenInstr, setRegenInstr] = useState('')
  const [regenBusy, setRegenBusy] = useState(false)

  // Schedule
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [scheduleAt, setScheduleAt] = useState('')

  // Action busy
  const [acting, setActing] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const data = await SocialContentApi.get(id)
      setItem(data)
      setJsonDraft(JSON.stringify(data.content, null, 2))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { void refresh() }, [refresh])

  async function saveJson() {
    setSaving(true); setJsonError(null)
    try {
      const parsed = JSON.parse(jsonDraft)
      await SocialContentApi.update(id, { content: parsed })
      await refresh()
    } catch (e) {
      setJsonError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function regenerate() {
    if (!regenInstr.trim()) return
    setRegenBusy(true)
    try {
      const res = await SocialContentApi.regenerate(id, regenInstr.trim())
      // Backend cria nova row — redireciona pra ela
      router.push(`/dashboard/social/content/${res.item.id}`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setRegenBusy(false)
      setRegenOpen(false)
    }
  }

  async function approve() {
    setActing(true); setError(null)
    try {
      await SocialContentApi.approve(id)
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setActing(false)
    }
  }

  async function schedule() {
    if (!scheduleAt) return
    setActing(true); setError(null)
    try {
      await SocialContentApi.schedule(id, new Date(scheduleAt).toISOString())
      setScheduleOpen(false)
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setActing(false)
    }
  }

  async function archive() {
    if (!confirm(t('confirmArchive'))) return
    setActing(true); setError(null)
    try {
      await SocialContentApi.archive(id)
      router.push('/dashboard/social')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setActing(false)
    }
  }

  async function publishNow() {
    if (!confirm(t('confirmPublishNow'))) return
    setActing(true); setError(null)
    try {
      const r = await SocialContentApi.publishNow(id)
      const s = r.result
      if (s.skipped_no_bridge) {
        alert(t('publishNoBridge'))
      } else {
        alert(t('publishDispatched', { dispatched: s.dispatched ?? 0, skipped: s.skipped ?? 0, errors: s.errors ?? 0 }))
      }
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setActing(false)
    }
  }

  if (loading) return (
    <div className="p-6 flex items-center gap-2 text-zinc-500 text-sm">
      <Loader2 size={14} className="animate-spin" /> {t('loading')}
    </div>
  )

  if (error || !item) return (
    <div className="p-6 space-y-3">
      <button onClick={() => router.back()} className="text-zinc-500 hover:text-zinc-300 text-sm flex items-center gap-1">
        <ArrowLeft size={14} /> {t('back')}
      </button>
      <div className="rounded-lg border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-300">
        ❌ {error ?? t('notFound')}
      </div>
    </div>
  )

  const meta = CHANNEL_META[item.channel]

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="space-y-3">
        <button onClick={() => router.back()} className="text-zinc-500 hover:text-zinc-300 text-sm flex items-center gap-1">
          <ArrowLeft size={14} /> {t('backToFeed')}
        </button>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-2 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <ChannelBadge channel={item.channel} />
              <StatusBadge status={item.status} />
              <span className="text-[10px] text-zinc-500 font-mono">v{item.version}</span>
            </div>
            <h1 className="text-lg sm:text-xl font-semibold text-zinc-100">{meta.label}</h1>
            <p className="text-[11px] text-zinc-500">
              {t('createdAt', { date: new Date(item.created_at).toLocaleString('pt-BR') })}
              {item.scheduled_at && t('scheduledForSuffix', { date: new Date(item.scheduled_at).toLocaleString('pt-BR') })}
              {item.published_at && t('publishedAtSuffix', { date: new Date(item.published_at).toLocaleString('pt-BR') })}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {item.status === 'draft' && (
              <button
                onClick={approve}
                disabled={acting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 text-black text-xs font-medium"
              >
                <Check size={12} /> {t('approve')}
              </button>
            )}
            {/* Publicar agora — só pra whatsapp_broadcast aprovado/agendado */}
            {item.channel === 'whatsapp_broadcast' && (item.status === 'approved' || item.status === 'scheduled' || item.status === 'draft') && (
              <button
                onClick={publishNow}
                disabled={acting}
                className="submit-glow inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#25D366] hover:bg-[#1da851] disabled:opacity-50 text-white text-xs font-medium"
                title={t('publishNowTitle')}
              >
                <Send size={12} /> {t('publishNow')}
              </button>
            )}
            {(item.status === 'draft' || item.status === 'approved') && (
              <button
                onClick={() => setScheduleOpen(true)}
                disabled={acting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-cyan-400/40 hover:bg-cyan-400/10 text-cyan-300 text-xs"
              >
                <Calendar size={12} /> {t('schedule')}
              </button>
            )}
            <button
              onClick={() => setRegenOpen(true)}
              disabled={acting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-cyan-400/60 text-zinc-300 hover:text-cyan-300 text-xs"
            >
              <RefreshCcw size={12} /> {t('regenerate')}
            </button>
            {item.status !== 'archived' && (
              <button
                onClick={archive}
                disabled={acting}
                aria-label={t('archive')}
                title={t('archive')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-red-400/40 text-zinc-500 hover:text-red-300 text-xs"
              >
                <Archive size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300 flex items-center gap-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* View toggle */}
      <div className="flex items-center gap-1 border-b border-zinc-800 -mb-px">
        <button
          onClick={() => setView('preview')}
          className={[
            'inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors',
            view === 'preview' ? 'border-cyan-400 text-cyan-300' : 'border-transparent text-zinc-500 hover:text-zinc-300',
          ].join(' ')}
        >
          <Eye size={12} /> {t('preview')}
        </button>
        <button
          onClick={() => setView('json')}
          className={[
            'inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors',
            view === 'json' ? 'border-cyan-400 text-cyan-300' : 'border-transparent text-zinc-500 hover:text-zinc-300',
          ].join(' ')}
        >
          <Code2 size={12} /> {t('editJson')}
        </button>
      </div>

      {view === 'preview' && (
        <SocialContentPreview channel={item.channel} content={item.content} />
      )}

      {view === 'json' && (
        <div className="space-y-2">
          <p className="text-[11px] text-zinc-500">
            {t('jsonHint', { channel: meta.shortLabel })}
          </p>
          <textarea
            value={jsonDraft}
            onChange={e => setJsonDraft(e.target.value)}
            disabled={saving}
            spellCheck={false}
            rows={20}
            className="w-full font-mono text-[11px] bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-cyan-200 outline-none focus:border-cyan-400/60 resize-y"
          />
          {jsonError && (
            <p className="text-[11px] text-red-300">⚠ {jsonError}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={saveJson}
              disabled={saving}
              className="glow-rainbow inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-black text-xs font-medium"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              {t('save')}
            </button>
            <button
              onClick={() => { setJsonDraft(JSON.stringify(item.content, null, 2)); setJsonError(null) }}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-zinc-600 text-zinc-300 text-xs disabled:opacity-50"
            >
              {t('revert')}
            </button>
          </div>
        </div>
      )}

      {/* Regenerate dialog */}
      {regenOpen && (
        <Dialog onClose={() => setRegenOpen(false)} title={t('regenDialogTitle')}>
          <p className="text-xs text-zinc-400">
            {t('regenDialogHint', { version: item.version + 1 })}
          </p>
          <textarea
            value={regenInstr}
            onChange={e => setRegenInstr(e.target.value)}
            placeholder={t('regenPlaceholder')}
            rows={3}
            disabled={regenBusy}
            className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-sm text-zinc-200 outline-none focus:border-cyan-400/60 resize-none"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setRegenOpen(false)}
              className="px-3 py-1.5 rounded border border-zinc-800 hover:border-zinc-700 text-zinc-300 text-xs"
            >{t('cancel')}</button>
            <button
              onClick={regenerate}
              disabled={regenBusy || !regenInstr.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-black text-xs font-medium"
            >
              {regenBusy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {t('regenerate')}
            </button>
          </div>
        </Dialog>
      )}

      {/* Schedule dialog */}
      {scheduleOpen && (
        <Dialog onClose={() => setScheduleOpen(false)} title={t('scheduleDialogTitle')}>
          <input
            type="datetime-local"
            value={scheduleAt}
            onChange={e => setScheduleAt(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-200 outline-none focus:border-cyan-400/60"
          />
          <p className="text-[10px] text-zinc-500">
            {t('scheduleDialogHint')}
          </p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setScheduleOpen(false)}
              className="px-3 py-1.5 rounded border border-zinc-800 hover:border-zinc-700 text-zinc-300 text-xs"
            >{t('cancel')}</button>
            <button
              onClick={schedule}
              disabled={!scheduleAt || acting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-black text-xs font-medium"
            >
              <Calendar size={12} /> {t('schedule')}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  )
}

function Dialog({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-950 p-4 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300"><X size={14} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
