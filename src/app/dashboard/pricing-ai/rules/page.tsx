'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Loader2, Save, AlertCircle, Settings, Zap,
} from 'lucide-react'
import { PricingAiApi, type PricingRules } from '@/components/pricing-ai/pricingAiApi'

export default function PricingAiRulesPage() {
  const router = useRouter()
  const [rules, setRules] = useState<PricingRules | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [draft, setDraft]     = useState<Partial<PricingRules>>({})

  useEffect(() => {
    void (async () => {
      setLoading(true); setError(null)
      try {
        const r = await PricingAiApi.getRules()
        setRules(r)
        setDraft({})
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  function set<K extends keyof PricingRules>(k: K, v: PricingRules[K]) {
    setDraft(prev => ({ ...prev, [k]: v }))
  }
  function v<K extends keyof PricingRules>(k: K): PricingRules[K] {
    return (draft[k] !== undefined ? draft[k] : rules?.[k]) as PricingRules[K]
  }

  async function save() {
    if (Object.keys(draft).length === 0) return
    setSaving(true); setError(null)
    try {
      const r = await PricingAiApi.updateRules(draft)
      setRules(r); setDraft({})
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="p-6 flex items-center gap-2 text-zinc-500 text-sm">
      <Loader2 size={14} className="animate-spin" /> carregando…
    </div>
  )

  if (error || !rules) return (
    <div className="p-6 space-y-3">
      <button onClick={() => router.back()} className="text-zinc-500 hover:text-zinc-300 text-sm flex items-center gap-1">
        <ArrowLeft size={14} /> voltar
      </button>
      <div className="rounded-lg border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-300">⚠ {error}</div>
    </div>
  )

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-3xl mx-auto">
      <button onClick={() => router.back()} className="text-zinc-500 hover:text-zinc-300 text-sm flex items-center gap-1">
        <ArrowLeft size={14} /> voltar
      </button>

      <div>
        <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
          <Settings size={18} className="text-cyan-400" />
          Regras de Precificação
        </h1>
        <p className="text-xs text-zinc-500 mt-0.5">Define como a IA gera sugestões e quando pode aplicar automaticamente.</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300 flex items-center gap-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* Margins */}
      <Section title="Margens & descontos">
        <Field label="Margem mínima global" hint="A IA nunca vai sugerir preço abaixo dessa margem">
          <NumberInput value={Number(v('min_margin_pct'))} onChange={n => set('min_margin_pct', n)} suffix="%" />
        </Field>
        <Field label="Desconto máximo" hint="Limite de desconto que a IA pode propor">
          <NumberInput value={Number(v('max_discount_pct'))} onChange={n => set('max_discount_pct', n)} suffix="%" />
        </Field>
        <Field label="Arredondamento" hint="Como arredondar o preço sugerido">
          <select
            value={String(v('price_rounding') ?? 'x.90')}
            onChange={e => set('price_rounding', e.target.value as PricingRules['price_rounding'])}
            className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-sm text-zinc-200 outline-none focus:border-cyan-400/60"
          >
            <option value="x.90">Termina em ,90 (ex: R$ 49,90)</option>
            <option value="x.99">Termina em ,99 (ex: R$ 49,99)</option>
            <option value="x.00">Inteiro (ex: R$ 50,00)</option>
            <option value="none">Sem arredondamento</option>
          </select>
        </Field>
      </Section>

      {/* Auto-apply */}
      <Section title="Auto-aplicação" icon={<Zap size={12} className="text-purple-400" />}>
        <Field
          label="Aplicar automaticamente"
          hint="Se ativado, a IA aplica preços sem precisar de aprovação quando a mudança for pequena"
        >
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={Boolean(v('auto_apply_enabled'))}
              onChange={e => set('auto_apply_enabled', e.target.checked)}
              className="w-4 h-4 rounded border-zinc-700 bg-zinc-950 accent-cyan-400"
            />
            <span className="text-sm text-zinc-200">Habilitado</span>
          </label>
        </Field>
        <Field label="Mudança máxima pra auto-apply" hint="Se a sugestão for menor que isso, aplica direto. Maior, pede aprovação.">
          <NumberInput
            value={Number(v('auto_apply_max_change_pct'))}
            onChange={n => set('auto_apply_max_change_pct', n)}
            suffix="%"
            disabled={!v('auto_apply_enabled')}
          />
        </Field>
      </Section>

      {/* Frequency */}
      <Section title="Frequência de análise">
        <Field label="Quando rodar análise automática">
          <select
            value={String(v('analysis_frequency') ?? 'weekly')}
            onChange={e => set('analysis_frequency', e.target.value as PricingRules['analysis_frequency'])}
            className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-sm text-zinc-200 outline-none focus:border-cyan-400/60"
          >
            <option value="daily">Diariamente</option>
            <option value="weekly">Semanalmente</option>
            <option value="biweekly">Quinzenalmente</option>
            <option value="monthly">Mensalmente</option>
            <option value="manual">Manual (só quando eu pedir)</option>
          </select>
        </Field>
        {rules.last_analysis_at && (
          <p className="text-[11px] text-zinc-500">
            Última análise: {new Date(rules.last_analysis_at).toLocaleString('pt-BR')}
          </p>
        )}
      </Section>

      {/* Save */}
      <div className="sticky bottom-4 flex justify-end">
        <button
          onClick={save}
          disabled={saving || Object.keys(draft).length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-black text-sm font-medium shadow-lg"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Salvar alterações
        </button>
      </div>
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
      <h2 className="text-xs uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
        {icon}{title}
      </h2>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-zinc-300">{label}</p>
      {hint && <p className="text-[10px] text-zinc-500">{hint}</p>}
      <div>{children}</div>
    </div>
  )
}

function NumberInput({ value, onChange, suffix, disabled }: {
  value: number; onChange: (n: number) => void; suffix?: string; disabled?: boolean
}) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        step="0.5"
        min={0}
        max={100}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        disabled={disabled}
        className="w-24 bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-sm text-zinc-200 outline-none focus:border-cyan-400/60 disabled:opacity-50"
      />
      {suffix && <span className="text-xs text-zinc-500">{suffix}</span>}
    </div>
  )
}
