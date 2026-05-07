'use client'

import { useEffect, useState, useCallback } from 'react'
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
            <Link href="/dashboard/ml-campaigns" className="hover:text-cyan-400">Campaign Center</Link>
            <span>/</span>
            <span className="text-zinc-300">Configuração</span>
          </div>
          <h1 className="text-2xl font-bold mt-1 flex items-center gap-2">
            <Settings size={22} className="text-cyan-400" />
            Configuração
          </h1>
          <p className="text-xs text-zinc-500 mt-1">Regras do motor de decisão pra esta conta.</p>
        </div>
        <AccountSelector compact hideWhenEmpty />
      </div>

      {!sid && (
        <div className="rounded-lg p-3 text-sm" style={{ background: 'rgba(251,191,36,0.06)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)' }}>
          Selecione uma conta ML pra configurar.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>
      )}

      {loading && <div className="text-zinc-500 text-sm flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Carregando…</div>}

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
                  <h3 className="text-sm font-semibold">Uso de IA hoje</h3>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    {usage.calls} chamada{usage.calls === 1 ? '' : 's'} · ${usage.cost_usd.toFixed(4)} de ${cfg.ai_daily_cap_usd.toFixed(2)}
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
                  <AlertOctagon size={11} /> Você está em {usage.pct_used}% do cap. Considere aumentar abaixo se precisar de mais hoje.
                </p>
              )}
            </div>
          )}

          {/* Margem */}
          <Section title="Regras de margem">
            <NumField  label="Margem mínima aceitável (%)"  hint="Abaixo disso, recomendação vira 'skip'"
              value={cfg.min_acceptable_margin_pct} onChange={v => update('min_acceptable_margin_pct', v)} />
            <NumField  label="Margem alvo (%)"               hint="Cenário 'conservador' protege essa margem"
              value={cfg.target_margin_pct} onChange={v => update('target_margin_pct', v)} />
            <NumField  label="Margem mínima pra liquidação (%)" hint="Cenário 'agressivo' usa esse piso"
              value={cfg.clearance_min_margin_pct} onChange={v => update('clearance_min_margin_pct', v)} />
          </Section>

          {/* Estoque */}
          <Section title="Regras de estoque">
            <NumField label="Dias de estoque de segurança" value={cfg.safety_stock_days} onChange={v => update('safety_stock_days', v)} />
            <NumField label="Estoque alto = X dias de venda" hint="Acima disso considera 'parado' e elegível pra liquidação"
              value={cfg.high_stock_threshold_days} onChange={v => update('high_stock_threshold_days', v)} />
            <NumField label="Estoque mínimo pra participar" value={cfg.min_stock_to_participate} onChange={v => update('min_stock_to_participate', v)} />
          </Section>

          {/* Quality Gate */}
          <Section title="Quality Gate (Quality Center IA)">
            <BoolField label="Ativar quality gate" hint="Se ativo, anúncios com score baixo vêm como 'qualidade baixa' (warning, mas pode aprovar mesmo assim)"
              value={cfg.quality_gate_enabled} onChange={v => update('quality_gate_enabled', v)} />
            {cfg.quality_gate_enabled && (
              <NumField label="Score ML mínimo" value={cfg.quality_gate_min_score} onChange={v => update('quality_gate_min_score', v)} />
            )}
          </Section>

          {/* Custos operacionais */}
          <Section title="Custos operacionais (defaults)">
            <NumField label="Embalagem (R$ por unidade)" step={0.01}
              value={cfg.default_packaging_cost} onChange={v => update('default_packaging_cost', v)} />
            <NumField label="Operacional (% do preço)"
              value={cfg.default_operational_cost_pct} onChange={v => update('default_operational_cost_pct', v)} />
          </Section>

          {/* IA */}
          <Section title="IA">
            <BoolField label="Habilitar reasoning IA" hint="Quando desligado, recomendações usam só template determinístico (sem custo)"
              value={cfg.ai_reasoning_enabled} onChange={v => update('ai_reasoning_enabled', v)} />
            <NumField label="Cap diário (USD)" step={0.50}
              value={cfg.ai_daily_cap_usd} onChange={v => update('ai_daily_cap_usd', v)} />
            <NumField label="Alerta em (% do cap)" hint="Aviso quando você usar X% do cap diário"
              value={cfg.ai_alert_at_pct} onChange={v => update('ai_alert_at_pct', v)} />
          </Section>

          {/* Geração automática */}
          <Section title="Geração automática">
            <BoolField label="Gerar recomendação ao detectar novo candidato"
              value={cfg.auto_suggest_on_new_candidate} onChange={v => update('auto_suggest_on_new_candidate', v)} />
            <BoolField label="Análise diária" hint="Cron 1x/dia regenera recomendações pendentes"
              value={cfg.daily_analysis_enabled} onChange={v => update('daily_analysis_enabled', v)} />
          </Section>

          {/* Auto-approve (v1.1) */}
          <Section title="Auto-aprovação (experimental)">
            <BoolField label="Auto-aprovar recomendações de score alto"
              hint="⚠️ Ainda em beta — recomendações aprovadas vão direto pra fila de aplicação"
              value={cfg.auto_approve_enabled} onChange={v => update('auto_approve_enabled', v)} />
            {cfg.auto_approve_enabled && (
              <NumField label="Auto-aprovar quando score ≥" value={cfg.auto_approve_score_above} onChange={v => update('auto_approve_score_above', v)} />
            )}
          </Section>

          {/* Save */}
          <div className="sticky bottom-4 flex items-center gap-2">
            <button onClick={save} disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
              style={{ background: '#22c55e', color: '#000' }}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Salvar configuração
            </button>
            {success && <span className="text-xs text-emerald-400">✓ Salvo</span>}
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
