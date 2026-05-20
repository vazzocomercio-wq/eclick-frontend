'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Settings, Loader2, Save, AlertOctagon } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import AccountSelector, { useMlAccount, getStoredSellerId } from '@/components/ml/AccountSelector'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

interface Config {
  min_acceptable_margin_pct:    number
  target_margin_pct:            number
  clearance_min_margin_pct:     number
  safety_stock_days:            number
  high_stock_threshold_days:    number
  min_stock_to_participate:     number
  quality_gate_enabled:         boolean
  quality_gate_min_score:       number
  default_packaging_cost:       number
  default_operational_cost_pct: number
  ai_daily_cap_usd:             number
  ai_alert_at_pct:              number
  ai_reasoning_enabled:         boolean
  auto_suggest_on_new_candidate: boolean
  daily_analysis_enabled:       boolean
  auto_approve_enabled:         boolean
  auto_approve_score_above:     number
  // M1 — operação humana + soft gate
  assignee_user_id:                  string | null
  notification_phone:                string | null
  manager_user_id:                   string | null
  manager_whatsapp_phone:            string | null
  min_approval_margin_pct:           number
  per_campaign_type_overrides:       Record<string, number>
  deadline_alert_days_before:        number
  whatsapp_alerts_enabled:           boolean
  escalate_alerts:                   boolean
  auto_alert_when_subsidy_above_pct: number
  audit_attempts_threshold:          number
  // M4 — Active integration
  active_org_id:                     string | null
  active_pipeline_id:                string | null
  active_stage_initial_id:           string | null
  active_stage_pending_manager_id:   string | null
  active_stage_in_campaign_id:       string | null
  active_assigned_to:                string | null
}

interface AiUsage {
  cost_usd: number
  calls:    number
  cap_usd:  number
  pct_used: number
}

async function getToken(): Promise<string | null> {
  const sb = createClient()
  const { data } = await sb.auth.getSession()
  return data.session?.access_token ?? null
}

export default function ConfigPage() {
  const t = useTranslations('mlCampaigns.config')
  const { selected: selectedSellerId, connections } = useMlAccount()
  const [cfg, setCfg]         = useState<Config | null>(null)
  const [usage, setUsage]     = useState<AiUsage | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const sid = selectedSellerId ?? getStoredSellerId() ?? connections[0]?.seller_id

  const load = useCallback(async () => {
    if (!sid) { setLoading(false); return }
    setLoading(true); setError(null)
    try {
      const t = await getToken()
      const [cfgRes, usageRes] = await Promise.all([
        fetch(`${BACKEND}/ml-campaigns/config?seller_id=${sid}`, { headers: { Authorization: `Bearer ${t}` } }),
        fetch(`${BACKEND}/ml-campaigns/ai-usage`,                 { headers: { Authorization: `Bearer ${t}` } }),
      ])
      if (!cfgRes.ok) throw new Error(`HTTP ${cfgRes.status}`)
      setCfg(await cfgRes.json())
      if (usageRes.ok) setUsage(await usageRes.json())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [sid])

  useEffect(() => { void load() }, [load])

  async function save() {
    if (!cfg || !sid) return
    setSaving(true); setError(null); setSuccess(false)
    try {
      const t = await getToken()
      const r = await fetch(`${BACKEND}/ml-campaigns/config?seller_id=${sid}`, {
        method:  'PATCH',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify(cfg),
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2500)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const update = <K extends keyof Config>(k: K, v: Config[K]) => {
    if (cfg) setCfg({ ...cfg, [k]: v })
  }

  return (
    <div className="p-6 space-y-4 max-w-3xl mx-auto" style={{ background: 'var(--background)', minHeight: '100vh', color: 'var(--text)' }}>
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Link href="/dashboard/ml-campaigns" className="hover:text-cyan-400">{t('breadcrumb')}</Link>
            <span>/</span>
            <span className="text-zinc-300">{t('breadcrumbCurrent')}</span>
          </div>
          <h1 className="text-2xl font-bold mt-1 flex items-center gap-2">
            <Settings size={22} className="text-cyan-400" />
            {t('title')}
          </h1>
          <p className="text-xs text-zinc-500 mt-1">{t('subtitle')}</p>
        </div>
        <AccountSelector compact hideWhenEmpty />
      </div>

      {!sid && (
        <div className="rounded-lg p-3 text-sm" style={{ background: 'rgba(251,191,36,0.06)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)' }}>
          {t('selectAccount')}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>
      )}

      {loading && <div className="text-zinc-500 text-sm flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> {t('loading')}</div>}

      {cfg && (
        <>
          {/* Cap diário IA com alerta */}
          {usage && (
            <div className="rounded-xl p-4"
              style={{
                background: usage.pct_used >= cfg.ai_alert_at_pct ? 'rgba(251,191,36,0.06)' : '#0c0c10',
                border: usage.pct_used >= cfg.ai_alert_at_pct ? '1px solid rgba(251,191,36,0.25)' : '1px solid #1a1a1f',
              }}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-semibold">{t('aiUsage.title')}</h3>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    {t('aiUsage.calls', { calls: usage.calls })} · ${usage.cost_usd.toFixed(4)} {t('aiUsage.of')} ${cfg.ai_daily_cap_usd.toFixed(2)}
                  </p>
                </div>
                <span className="text-2xl font-bold" style={{ color: usage.pct_used >= cfg.ai_alert_at_pct ? '#fbbf24' : '#22c55e' }}>
                  {usage.pct_used}%
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden mt-3" style={{ background: '#1a1a1f' }}>
                <div className="h-full transition-all"
                  style={{
                    width: `${Math.min(100, usage.pct_used)}%`,
                    background: usage.pct_used >= 100 ? '#ef4444' : usage.pct_used >= cfg.ai_alert_at_pct ? '#fbbf24' : '#22c55e',
                  }} />
              </div>
              {usage.pct_used >= cfg.ai_alert_at_pct && usage.pct_used < 100 && (
                <p className="text-[11px] text-amber-300 mt-2 inline-flex items-center gap-1">
                  <AlertOctagon size={11} /> {t('aiUsage.capWarning', { pct: usage.pct_used })}
                </p>
              )}
            </div>
          )}

          {/* Margem */}
          <Section title={t('margin.section')}>
            <NumField  label={t('margin.minAcceptable')}  hint={t('margin.minAcceptableHint')}
              value={cfg.min_acceptable_margin_pct} onChange={v => update('min_acceptable_margin_pct', v)} />
            <NumField  label={t('margin.target')}               hint={t('margin.targetHint')}
              value={cfg.target_margin_pct} onChange={v => update('target_margin_pct', v)} />
            <NumField  label={t('margin.clearance')} hint={t('margin.clearanceHint')}
              value={cfg.clearance_min_margin_pct} onChange={v => update('clearance_min_margin_pct', v)} />
          </Section>

          {/* M1 — Soft gate de aprovação */}
          <Section title={t('softGate.section')}>
            <p className="text-[11px] text-zinc-500 -mt-1">
              {t('softGate.intro')}
            </p>
            <NumField label={t('softGate.minApproval')} step={0.5}
              hint={t('softGate.minApprovalHint')}
              value={cfg.min_approval_margin_pct} onChange={v => update('min_approval_margin_pct', v)} />
            <PerTypeOverrides
              value={cfg.per_campaign_type_overrides ?? {}}
              defaultValue={cfg.min_approval_margin_pct}
              onChange={v => update('per_campaign_type_overrides', v)} />
            <NumField label={t('softGate.suspiciousAttempts')}
              hint={t('softGate.suspiciousAttemptsHint')}
              value={cfg.audit_attempts_threshold} onChange={v => update('audit_attempts_threshold', v)} />
          </Section>

          {/* M1 — Responsáveis (operador + gestor) */}
          <Section title={t('responsibles.section')}>
            <p className="text-[11px] text-zinc-500 -mt-1">
              {t('responsibles.intro')}
            </p>
            <TextField label={t('responsibles.operatorWhatsapp')}
              hint={t('responsibles.operatorWhatsappHint')}
              value={cfg.notification_phone ?? ''} onChange={v => update('notification_phone', v || null)} />
            <TextField label={t('responsibles.managerWhatsapp')}
              hint={t('responsibles.managerWhatsappHint')}
              value={cfg.manager_whatsapp_phone ?? ''} onChange={v => update('manager_whatsapp_phone', v || null)} />
            <TextField label={t('responsibles.operatorId')} hint={t('responsibles.operatorIdHint')}
              value={cfg.assignee_user_id ?? ''} onChange={v => update('assignee_user_id', v || null)} />
            <TextField label={t('responsibles.managerId')} hint={t('responsibles.managerIdHint')}
              value={cfg.manager_user_id ?? ''} onChange={v => update('manager_user_id', v || null)} />
          </Section>

          {/* M4 — Integração Active (cards + tasks) */}
          <Section title={t('active.section')}>
            <p className="text-[11px] text-zinc-500 -mt-1">
              {t('active.intro')}
            </p>
            <p className="text-[10px] text-amber-300">
              💡 {t('active.idsHint')} <code>SELECT id, name FROM active.organizations</code>; <code>SELECT id, name FROM active.pipelines</code>; <code>SELECT id, name FROM active.pipeline_stages WHERE pipeline_id='...'</code>
            </p>
            <TextField label={t('active.orgId')}
              hint={t('active.orgIdHint')}
              value={cfg.active_org_id ?? ''} onChange={v => update('active_org_id', v || null)} />
            <TextField label={t('active.pipelineId')}
              hint={t('active.pipelineIdHint')}
              value={cfg.active_pipeline_id ?? ''} onChange={v => update('active_pipeline_id', v || null)} />
            <TextField label={t('active.stageInitial')}
              hint={t('active.stageInitialHint')}
              value={cfg.active_stage_initial_id ?? ''} onChange={v => update('active_stage_initial_id', v || null)} />
            <TextField label={t('active.stagePendingManager')}
              hint={t('active.stagePendingManagerHint')}
              value={cfg.active_stage_pending_manager_id ?? ''} onChange={v => update('active_stage_pending_manager_id', v || null)} />
            <TextField label={t('active.stageInCampaign')}
              hint={t('active.stageInCampaignHint')}
              value={cfg.active_stage_in_campaign_id ?? ''} onChange={v => update('active_stage_in_campaign_id', v || null)} />
            <TextField label={t('active.assignedTo')}
              hint={t('active.assignedToHint')}
              value={cfg.active_assigned_to ?? ''} onChange={v => update('active_assigned_to', v || null)} />
          </Section>

          {/* M1 — Alertas */}
          <Section title={t('alerts.section')}>
            <BoolField label={t('alerts.enableWhatsapp')}
              hint={t('alerts.enableWhatsappHint')}
              value={cfg.whatsapp_alerts_enabled} onChange={v => update('whatsapp_alerts_enabled', v)} />
            <NumField label={t('alerts.daysBefore')}
              hint={t('alerts.daysBeforeHint')}
              value={cfg.deadline_alert_days_before} onChange={v => update('deadline_alert_days_before', v)} />
            <BoolField label={t('alerts.escalate')}
              hint={t('alerts.escalateHint')}
              value={cfg.escalate_alerts} onChange={v => update('escalate_alerts', v)} />
            <NumField label={t('alerts.subsidyAbove')} step={0.5}
              hint={t('alerts.subsidyAboveHint')}
              value={cfg.auto_alert_when_subsidy_above_pct} onChange={v => update('auto_alert_when_subsidy_above_pct', v)} />
          </Section>

          {/* Estoque */}
          <Section title={t('stock.section')}>
            <NumField label={t('stock.safetyDays')} value={cfg.safety_stock_days} onChange={v => update('safety_stock_days', v)} />
            <NumField label={t('stock.highThreshold')} hint={t('stock.highThresholdHint')}
              value={cfg.high_stock_threshold_days} onChange={v => update('high_stock_threshold_days', v)} />
            <NumField label={t('stock.minToParticipate')} value={cfg.min_stock_to_participate} onChange={v => update('min_stock_to_participate', v)} />
          </Section>

          {/* Quality Gate */}
          <Section title={t('qualityGate.section')}>
            <BoolField label={t('qualityGate.enable')} hint={t('qualityGate.enableHint')}
              value={cfg.quality_gate_enabled} onChange={v => update('quality_gate_enabled', v)} />
            {cfg.quality_gate_enabled && (
              <NumField label={t('qualityGate.minScore')} value={cfg.quality_gate_min_score} onChange={v => update('quality_gate_min_score', v)} />
            )}
          </Section>

          {/* Custos operacionais */}
          <Section title={t('opCosts.section')}>
            <NumField label={t('opCosts.packaging')} step={0.01}
              value={cfg.default_packaging_cost} onChange={v => update('default_packaging_cost', v)} />
            <NumField label={t('opCosts.operational')}
              value={cfg.default_operational_cost_pct} onChange={v => update('default_operational_cost_pct', v)} />
          </Section>

          {/* IA */}
          <Section title={t('ai.section')}>
            <BoolField label={t('ai.enableReasoning')} hint={t('ai.enableReasoningHint')}
              value={cfg.ai_reasoning_enabled} onChange={v => update('ai_reasoning_enabled', v)} />
            <NumField label={t('ai.dailyCap')} step={0.50}
              value={cfg.ai_daily_cap_usd} onChange={v => update('ai_daily_cap_usd', v)} />
            <NumField label={t('ai.alertAt')} hint={t('ai.alertAtHint')}
              value={cfg.ai_alert_at_pct} onChange={v => update('ai_alert_at_pct', v)} />
          </Section>

          {/* Geração automática */}
          <Section title={t('autoGen.section')}>
            <BoolField label={t('autoGen.onNewCandidate')}
              value={cfg.auto_suggest_on_new_candidate} onChange={v => update('auto_suggest_on_new_candidate', v)} />
            <BoolField label={t('autoGen.dailyAnalysis')} hint={t('autoGen.dailyAnalysisHint')}
              value={cfg.daily_analysis_enabled} onChange={v => update('daily_analysis_enabled', v)} />
          </Section>

          {/* Auto-approve (v1.1) */}
          <Section title={t('autoApprove.section')}>
            <BoolField label={t('autoApprove.enable')}
              hint={t('autoApprove.enableHint')}
              value={cfg.auto_approve_enabled} onChange={v => update('auto_approve_enabled', v)} />
            {cfg.auto_approve_enabled && (
              <NumField label={t('autoApprove.scoreAbove')} value={cfg.auto_approve_score_above} onChange={v => update('auto_approve_score_above', v)} />
            )}
          </Section>

          {/* Save */}
          <div className="sticky bottom-4 flex items-center gap-2">
            <button onClick={save} disabled={saving}
              className="glow-rainbow px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
              style={{ background: '#22c55e', color: '#000' }}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {t('save')}
            </button>
            {success && <span className="text-xs text-emerald-400">{t('saved')}</span>}
          </div>
        </>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
      <h2 className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">{title}</h2>
      {children}
    </div>
  )
}

function NumField({ label, value, onChange, hint, step }: {
  label: string; value: number; onChange: (v: number) => void; hint?: string; step?: number
}) {
  return (
    <div>
      <label className="block text-xs text-zinc-300 mb-1">{label}</label>
      <input type="number" step={step ?? 1} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full rounded px-2 py-1.5 text-sm outline-none"
        style={{ background: '#09090b', border: '1px solid #27272a', color: '#fafafa' }} />
      {hint && <p className="text-[10px] text-zinc-500 mt-1">{hint}</p>}
    </div>
  )
}

function BoolField({ label, value, onChange, hint }: {
  label: string; value: boolean; onChange: (v: boolean) => void; hint?: string
}) {
  return (
    <div>
      <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
        <input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)} />
        {label}
      </label>
      {hint && <p className="text-[10px] text-zinc-500 mt-0.5 ml-6">{hint}</p>}
    </div>
  )
}

function TextField({ label, value, onChange, hint, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; hint?: string; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs text-zinc-300 mb-1">{label}</label>
      <input type="text" value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded px-2 py-1.5 text-sm outline-none"
        style={{ background: '#09090b', border: '1px solid #27272a', color: '#fafafa' }} />
      {hint && <p className="text-[10px] text-zinc-500 mt-1">{hint}</p>}
    </div>
  )
}

/** Editor pra `per_campaign_type_overrides`. Mostra os tipos comuns de
 *  campanha ML e deixa user definir margem mínima específica por tipo,
 *  sobrepondo o global `min_approval_margin_pct`. */
function PerTypeOverrides({ value, defaultValue, onChange }: {
  value: Record<string, number>
  defaultValue: number
  onChange: (v: Record<string, number>) => void
}) {
  const t = useTranslations('mlCampaigns.config')
  const KNOWN_TYPE_KEYS = ['DEAL', 'PRICE_DISCOUNT', 'LIGHTNING', 'DOD', 'MARKETPLACE_CAMPAIGN', 'PRE_NEGOTIATED']
  return (
    <div>
      <label className="block text-xs text-zinc-300 mb-1">{t('perType.label')}</label>
      <p className="text-[10px] text-zinc-500 mb-2">
        {t('perType.hint', { value: defaultValue })}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {KNOWN_TYPE_KEYS.map(key => (
          <div key={key} className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-400 flex-1 truncate">{t(`perType.type.${key}`)}</span>
            <input type="number" step={0.5} placeholder={`${defaultValue}`}
              value={value[key] ?? ''}
              onChange={e => {
                const next = { ...value }
                if (e.target.value === '') delete next[key]
                else next[key] = Number(e.target.value)
                onChange(next)
              }}
              className="w-20 rounded px-2 py-1 text-xs outline-none"
              style={{ background: '#09090b', border: '1px solid #27272a', color: '#fafafa' }} />
          </div>
        ))}
      </div>
    </div>
  )
}
