'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase'
import { Loader2, Save, Brain, Sparkles, Eye, GraduationCap, Bell, CheckCircle2 } from 'lucide-react'
import { AiModelSelector, AiModelSelectorValue } from '@/components/ai/AiModelSelector'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface Settings {
  show_cost_estimates?:  boolean
  classifier_provider?:  string
  classifier_model?:     string
  embedding_provider?:   string
  embedding_model?:      string
  auto_send_threshold?:  number
  queue_threshold?:      number
  show_tokens?:          boolean
  capture_edits?:        boolean
  auto_retrain?:         boolean
  notify_escalation?:    boolean
  notify_daily?:         boolean
}

export default function ConfiguracoesAiPage() {
  const t = useTranslations('atendenteIa')
  const supabase = useMemo(() => createClient(), [])
  const [s,         setS]         = useState<Settings | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [savedOk,   setSavedOk]   = useState(false)
  const [err,       setErr]       = useState<string | null>(null)

  // Persisted toggles (read from settings, written via PATCH /ai/settings).
  // The five booleans below now live in ai_module_settings as of the
  // 20260426_ai_module_settings_toggles.sql migration.

  const getHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return { Authorization: `Bearer ${session?.access_token ?? ''}`, 'Content-Type': 'application/json' }
  }, [supabase])

  const load = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/ai/settings`, { headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setS(await res.json())
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t('config.errors.load'))
    } finally { setLoading(false) }
  }, [getHeaders, t])

  useEffect(() => { load() }, [load])

  async function save() {
    if (!s) return
    setSaving(true); setSavedOk(false); setErr(null)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/ai/settings`, {
        method: 'PATCH', headers, body: JSON.stringify(s),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.message ?? `HTTP ${res.status}`)
      }
      setS(await res.json())
      setSavedOk(true)
      setTimeout(() => setSavedOk(false), 2500)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t('config.errors.save'))
    } finally { setSaving(false) }
  }

  if (loading || !s) {
    return (
      <div className="p-6 space-y-6 min-h-full" style={{ background: 'var(--background)' }}>
        <div className="flex items-center gap-2 text-zinc-500 text-sm">
          <Loader2 size={14} className="animate-spin" /> {t('config.loading')}
        </div>
      </div>
    )
  }

  const classifierVal: AiModelSelectorValue = {
    provider: s.classifier_provider ?? 'anthropic',
    model:    s.classifier_model    ?? 'claude-haiku-4-5-20251001',
  }
  const embeddingVal: AiModelSelectorValue = {
    provider: s.embedding_provider ?? 'openai',
    model:    s.embedding_model    ?? 'text-embedding-3-small',
  }

  return (
    <div className="p-6 space-y-7 min-h-full" style={{ background: 'var(--background)' }}>
      <div>
        <p className="text-zinc-500 text-xs">{t('config.eyebrow')}</p>
        <h2 className="text-white text-lg font-semibold mt-0.5">{t('config.pageTitle')}</h2>
        <p className="text-zinc-500 text-xs mt-1">{t('config.pageSubtitle')}</p>
      </div>

      {/* Inteligência */}
      <Section title={t('config.sections.intelligence')} icon={<Brain size={13} />}>
        <Card title={t('config.cards.classifier.title')} subtitle={t('config.cards.classifier.subtitle')}>
          <AiModelSelector
            value={classifierVal}
            onChange={v => setS({ ...s, classifier_provider: v.provider, classifier_model: v.model })}
            showCostEstimate={s.show_cost_estimates}
          />
        </Card>

        <Card title={t('config.cards.embeddings.title')} subtitle={t('config.cards.embeddings.subtitle')}>
          <AiModelSelector
            value={embeddingVal}
            onChange={v => setS({ ...s, embedding_provider: v.provider, embedding_model: v.model })}
            embeddingOnly
          />
        </Card>

        <Card title={t('config.cards.autonomy.title')} subtitle={t('config.cards.autonomy.subtitle')}>
          <div className="space-y-4">
            <Slider
              label={t('config.cards.autonomy.autoSendLabel')}
              value={s.auto_send_threshold ?? 80}
              onChange={v => setS({ ...s, auto_send_threshold: v })}
              min={50} max={100}
            />
            <Slider
              label={t('config.cards.autonomy.queueLabel')}
              value={s.queue_threshold ?? 50}
              onChange={v => setS({ ...s, queue_threshold: v })}
              min={0} max={90}
            />
          </div>
        </Card>
      </Section>

      {/* Exibição */}
      <Section title={t('config.sections.display')} icon={<Eye size={13} />}>
        <Card title={t('config.cards.showCosts.title')} subtitle={t('config.cards.showCosts.subtitle')}>
          <Toggle value={!!s.show_cost_estimates} onChange={v => setS({ ...s, show_cost_estimates: v })} />
        </Card>
        <Card title={t('config.cards.showTokens.title')} subtitle={t('config.cards.showTokens.subtitle')}>
          <Toggle value={s.show_tokens ?? true} onChange={v => setS({ ...s, show_tokens: v })} />
        </Card>
      </Section>

      {/* Aprendizado */}
      <Section title={t('config.sections.learning')} icon={<GraduationCap size={13} />}>
        <Card title={t('config.cards.captureEdits.title')} subtitle={t('config.cards.captureEdits.subtitle')}>
          <Toggle value={s.capture_edits ?? true} onChange={v => setS({ ...s, capture_edits: v })} />
        </Card>
        <Card title={t('config.cards.autoRetrain.title')} subtitle={t('config.cards.autoRetrain.subtitle')}>
          <Toggle value={s.auto_retrain ?? false} onChange={v => setS({ ...s, auto_retrain: v })} />
        </Card>
      </Section>

      {/* Notificações */}
      <Section title={t('config.sections.notifications')} icon={<Bell size={13} />}>
        <Card title={t('config.cards.notifyEscalation.title')} subtitle={t('config.cards.notifyEscalation.subtitle')}>
          <Toggle value={s.notify_escalation ?? true} onChange={v => setS({ ...s, notify_escalation: v })} />
        </Card>
        <Card title={t('config.cards.notifyDaily.title')} subtitle={t('config.cards.notifyDaily.subtitle')}>
          <Toggle value={s.notify_daily ?? false} onChange={v => setS({ ...s, notify_daily: v })} />
        </Card>
      </Section>

      {/* Footer */}
      <div className="flex items-center gap-3 pt-2">
        {err     && <p className="text-[11px] text-red-400">{err}</p>}
        {savedOk && <p className="inline-flex items-center gap-1 text-[11px] text-green-400"><CheckCircle2 size={12}/> {t('config.saved')}</p>}
        <button onClick={save} disabled={saving}
          className="glow-rainbow ml-auto inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
          style={{ background: '#00E5FF', color: '#000' }}>
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          {saving ? t('config.saving') : t('config.saveButton')}
        </button>
      </div>
    </div>
  )
}

// ── helpers ────────────────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-zinc-600">{icon}</span>
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">{title}</h3>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-200">{title}</p>
          {subtitle && <p className="text-[11px] text-zinc-500 mt-0.5 leading-snug">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)}
      className="relative w-10 h-5 rounded-full transition-colors shrink-0"
      style={{ background: value ? '#00E5FF' : '#27272a' }}>
      <span className="absolute top-0.5 transition-all w-4 h-4 rounded-full shadow"
        style={{ left: value ? '1.25rem' : '0.125rem', background: value ? '#000' : '#71717a' }} />
    </button>
  )
}

function Slider({ label, value, onChange, min, max }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[11px] text-zinc-400">{label}</label>
        <span className="text-sm font-bold tabular-nums" style={{ color: '#00E5FF' }}>{value}%</span>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-cyan-400" />
    </div>
  )
}
