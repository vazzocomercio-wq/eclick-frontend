'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Save, Settings, Zap } from 'lucide-react'
import {
  StoreAutomationApi, type StoreAutomationConfig, type AutomationTrigger,
} from '@/components/store-automation/storeAutomationApi'

const ALL_TRIGGERS: AutomationTrigger[] = [
  'low_stock','high_stock','sales_drop','sales_spike',
  'low_conversion','high_conversion','competitor_price_drop',
  'competitor_out_of_stock','low_score','no_content','no_ads',
  'ads_underperforming','abandoned_carts_spike','new_product_ready',
  'seasonal_opportunity','margin_erosion','review_needed',
]

export default function AutomationConfigPage() {
  const t = useTranslations('automation.config')
  const router = useRouter()
  const [config, setConfig] = useState<StoreAutomationConfig | null>(null)
  const [draft, setDraft]   = useState<Partial<StoreAutomationConfig>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      setLoading(true); setError(null)
      try {
        const c = await StoreAutomationApi.getConfig()
        setConfig(c)
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  function getValue<K extends keyof StoreAutomationConfig>(k: K): StoreAutomationConfig[K] | undefined {
    return (draft[k] !== undefined ? draft[k] : config?.[k]) as StoreAutomationConfig[K] | undefined
  }
  function set<K extends keyof StoreAutomationConfig>(k: K, v: StoreAutomationConfig[K]) {
    setDraft(prev => ({ ...prev, [k]: v }))
  }

  function toggleTrigger(trigger: AutomationTrigger, list: 'active_triggers' | 'auto_execute_triggers') {
    const current = (getValue(list) ?? []) as AutomationTrigger[]
    const next = current.includes(trigger) ? current.filter(x => x !== trigger) : [...current, trigger]
    set(list, next)
  }

  async function save() {
    if (Object.keys(draft).length === 0) return
    setSaving(true); setError(null)
    try {
      const c = await StoreAutomationApi.updateConfig(draft)
      setConfig(c); setDraft({})
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="p-6 flex items-center gap-2 text-zinc-500 text-sm">
      <Loader2 size={14} className="animate-spin" /> {t('loading')}
    </div>
  )

  if (!config) return (
    <div className="p-6 text-sm text-red-300">⚠ {error}</div>
  )

  const activeTriggers      = (getValue('active_triggers') ?? []) as AutomationTrigger[]
  const autoExecuteTriggers = (getValue('auto_execute_triggers') ?? []) as AutomationTrigger[]

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-3xl mx-auto">
      <button onClick={() => router.back()} className="text-zinc-500 hover:text-zinc-300 text-sm flex items-center gap-1">
        <ArrowLeft size={14} /> {t('back')}
      </button>

      <div>
        <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
          <Settings size={18} className="text-cyan-400" />
          {t('title')}
        </h1>
        <p className="text-xs text-zinc-500 mt-0.5">{t('subtitle')}</p>
      </div>

      {/* Enable */}
      <Section title={t('sectionGeneral')}>
        <Field label={t('automationEnabled')}>
          <input
            type="checkbox"
            checked={Boolean(getValue('enabled'))}
            onChange={e => set('enabled', e.target.checked)}
            className="w-4 h-4 accent-cyan-400"
          />
        </Field>
        <Field label={t('analysisFrequency')}>
          <select
            value={String(getValue('analysis_frequency') ?? 'daily')}
            onChange={e => set('analysis_frequency', e.target.value as StoreAutomationConfig['analysis_frequency'])}
            className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-sm text-zinc-200 outline-none focus:border-cyan-400/60"
          >
            <option value="hourly">{t('freqHourly')}</option>
            <option value="daily">{t('freqDaily')}</option>
            <option value="weekly">{t('freqWeekly')}</option>
          </select>
        </Field>
        {config.last_analysis_at && (
          <p className="text-[11px] text-zinc-500">
            {t('lastAnalysis', { date: new Date(config.last_analysis_at).toLocaleString('pt-BR') })}
          </p>
        )}
      </Section>

      {/* Triggers */}
      <Section title={t('sectionTriggers')} hint={t('sectionTriggersHint')}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ALL_TRIGGERS.map(trigger => {
            const active = activeTriggers.includes(trigger)
            const auto   = autoExecuteTriggers.includes(trigger)
            return (
              <div key={trigger} className="rounded border border-zinc-800 bg-zinc-950/40 p-2 space-y-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggleTrigger(trigger, 'active_triggers')}
                    className="w-4 h-4 accent-cyan-400"
                  />
                  <span className="text-xs text-zinc-200 font-mono">{trigger}</span>
                </label>
                <p className="text-[10px] text-zinc-500 pl-6">{t(`triggerDesc.${trigger}`)}</p>
                {active && (
                  <label className="flex items-center gap-2 cursor-pointer pl-6 mt-1">
                    <input
                      type="checkbox"
                      checked={auto}
                      onChange={() => toggleTrigger(trigger, 'auto_execute_triggers')}
                      className="w-3 h-3 accent-purple-400"
                    />
                    <span className="text-[10px] text-purple-300 flex items-center gap-1">
                      <Zap size={9} /> {t('autoExecute')}
                    </span>
                  </label>
                )}
              </div>
            )
          })}
        </div>
      </Section>

      {/* Limits */}
      <Section title={t('sectionLimits')} hint={t('sectionLimitsHint')}>
        <Field label={t('maxAutoActions')}>
          <input
            type="number" min={0} max={100}
            value={Number(getValue('max_auto_actions_per_day') ?? 10)}
            onChange={e => set('max_auto_actions_per_day', parseInt(e.target.value, 10) || 0)}
            className="w-24 bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-sm text-zinc-200 outline-none"
          />
        </Field>
        <Field label={t('maxPriceChange')}>
          <input
            type="number" min={0} max={50} step="0.5"
            value={Number(getValue('max_price_change_auto_pct') ?? 5)}
            onChange={e => set('max_price_change_auto_pct', parseFloat(e.target.value) || 0)}
            className="w-24 bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-sm text-zinc-200 outline-none"
          />
        </Field>
        <Field label={t('maxBudget')}>
          <input
            type="number" min={0} max={1000} step="5"
            value={Number(getValue('max_budget_auto_brl') ?? 50)}
            onChange={e => set('max_budget_auto_brl', parseFloat(e.target.value) || 0)}
            className="w-24 bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-sm text-zinc-200 outline-none"
          />
        </Field>
      </Section>

      {/* Notifications */}
      <Section title={t('sectionNotifications')}>
        <Field label={t('channel')}>
          <select
            value={String(getValue('notify_channel') ?? 'dashboard')}
            onChange={e => set('notify_channel', e.target.value as StoreAutomationConfig['notify_channel'])}
            className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-sm text-zinc-200 outline-none"
          >
            <option value="dashboard">{t('channelDashboard')}</option>
            <option value="whatsapp">{t('channelWhatsapp')}</option>
            <option value="email">{t('channelEmail')}</option>
            <option value="all">{t('channelAll')}</option>
          </select>
        </Field>
        <Field label={t('minSeverity')}>
          <select
            value={String(getValue('notify_min_severity') ?? 'medium')}
            onChange={e => set('notify_min_severity', e.target.value as StoreAutomationConfig['notify_min_severity'])}
            className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-sm text-zinc-200 outline-none"
          >
            <option value="opportunity">{t('sevOpportunity')}</option>
            <option value="low">{t('sevLow')}</option>
            <option value="medium">{t('sevMedium')}</option>
            <option value="high">{t('sevHigh')}</option>
            <option value="critical">{t('sevCritical')}</option>
          </select>
        </Field>
      </Section>

      <div className="sticky bottom-4 flex justify-end">
        <button
          onClick={save}
          disabled={saving || Object.keys(draft).length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-black text-sm font-medium shadow-lg"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {t('save')}
        </button>
      </div>
    </div>
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
      <div>
        <h2 className="text-xs uppercase tracking-wider text-zinc-300">{title}</h2>
        {hint && <p className="text-[10px] text-zinc-500 mt-0.5">{hint}</p>}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <p className="text-xs text-zinc-300">{label}</p>
      <div>{children}</div>
    </div>
  )
}
