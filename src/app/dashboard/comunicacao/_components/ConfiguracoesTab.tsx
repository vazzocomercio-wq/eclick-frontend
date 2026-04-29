'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Save, RotateCcw, Loader2 } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

// ── types ─────────────────────────────────────────────────────────────────────

type BrandTone       = 'friendly' | 'professional' | 'casual'
type OptinMoment     = 'first_message' | 'after_delivery' | 'after_7_days' | 'never_auto'
type ChannelPriority = 'whatsapp_then_email' | 'email_only' | 'whatsapp_only' | 'both_always'

interface Settings {
  organization_id:           string
  auto_communication_enabled: boolean
  brand_display_name:        string | null
  brand_tone:                BrandTone | null
  send_window_start:         string | null   // "HH:MM:SS"
  send_window_end:           string | null
  send_timezone:             string | null
  marketing_optin_moment:    OptinMoment | null
  default_channel_priority:  ChannelPriority | null
  pause_after_days_no_reply: number | null
  created_at:                string
  updated_at:                string
}

const TONE_OPTIONS: { value: BrandTone; label: string }[] = [
  { value: 'friendly',     label: 'Informal (cordial e próximo)' },
  { value: 'professional', label: 'Profissional (formal e respeitoso)' },
  { value: 'casual',       label: 'Descontraído (bem informal)' },
]

const OPTIN_OPTIONS: { value: OptinMoment; label: string }[] = [
  { value: 'first_message',  label: 'Já na primeira mensagem' },
  { value: 'after_delivery', label: 'Após entrega' },
  { value: 'after_7_days',   label: '7 dias após o pedido' },
  { value: 'never_auto',     label: 'Nunca pedir automaticamente' },
]

const CHANNEL_OPTIONS: { value: ChannelPriority; label: string }[] = [
  { value: 'whatsapp_then_email', label: 'WhatsApp, depois Email' },
  { value: 'whatsapp_only',       label: 'Só WhatsApp' },
  { value: 'email_only',          label: 'Só Email' },
  { value: 'both_always',         label: 'Ambos sempre' },
]

const TIMEZONES: { value: string; label: string }[] = [
  { value: 'America/Sao_Paulo', label: 'América/São Paulo (Brasil — horário oficial)' },
  { value: 'America/Manaus',    label: 'América/Manaus (Amazonas)' },
  { value: 'America/Belem',     label: 'América/Belém (Pará)' },
  { value: 'America/Rio_Branco',label: 'América/Rio Branco (Acre)' },
  { value: 'America/Noronha',   label: 'América/Noronha (Fernando de Noronha)' },
]

/** Whitelist do PATCH — bate 1:1 com SETTINGS_WHITELIST do backend
 * (CommunicationCenterService). Se backend mudar, atualizar aqui. */
const PATCH_FIELDS: (keyof Settings)[] = [
  'auto_communication_enabled',
  'brand_display_name',
  'brand_tone',
  'send_window_start',
  'send_window_end',
  'send_timezone',
  'marketing_optin_moment',
  'default_channel_priority',
  'pause_after_days_no_reply',
]

interface Props {
  onToast?: (msg: string, type?: 'success' | 'error') => void
}

// ── helpers ───────────────────────────────────────────────────────────────────

/** "08:00:00" → "08:00" pro <input type="time">. */
function timeToInput(t: string | null | undefined): string {
  if (!t) return ''
  return t.slice(0, 5)
}

/** "08:00" → "08:00:00" pra Postgres TIME. Idempotente se já tem segundos. */
function inputToTime(t: string): string {
  if (!t) return ''
  return t.length === 5 ? `${t}:00` : t
}

// ── component ─────────────────────────────────────────────────────────────────

export default function ConfiguracoesTab({ onToast }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [original, setOriginal] = useState<Settings | null>(null)
  const [form,     setForm]     = useState<Settings | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [errors,   setErrors]   = useState<Record<string, string>>({})

  const isDirty = original !== null && form !== null
                && JSON.stringify(form) !== JSON.stringify(original)

  const headers = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return {
      Authorization:  `Bearer ${session?.access_token ?? ''}`,
      'Content-Type': 'application/json',
    }
  }, [supabase])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const h   = await headers()
      const res = await fetch(`${BACKEND}/communication/settings`, { headers: h })
      if (!res.ok) {
        onToast?.('Falha ao carregar configurações', 'error')
        return
      }
      const body = await res.json() as Settings | null
      if (!body) {
        onToast?.('Nenhuma configuração encontrada para esta org', 'error')
        return
      }
      setOriginal(body)
      setForm(body)
      setErrors({})
    } catch {
      onToast?.('Erro de rede', 'error')
    } finally {
      setLoading(false)
    }
  }, [headers, onToast])

  useEffect(() => { void load() }, [load])

  // ── validation ───────────────────────────────────────────────────────────────
  const validate = (f: Settings): Record<string, string> => {
    const errs: Record<string, string> = {}
    const name = (f.brand_display_name ?? '').trim()
    if (!name)              errs.brand_display_name = 'Nome obrigatório'
    else if (name.length < 2) errs.brand_display_name = 'Mínimo 2 caracteres'

    const start = timeToInput(f.send_window_start)
    const end   = timeToInput(f.send_window_end)
    if (start && end && start >= end) {
      errs.send_window_end = 'Horário final deve ser após o inicial'
    }

    const days = Number(f.pause_after_days_no_reply ?? 0)
    if (!Number.isInteger(days) || days < 0 || days > 365) {
      errs.pause_after_days_no_reply = 'Use um inteiro entre 0 e 365'
    }
    return errs
  }

  // ── save / discard ───────────────────────────────────────────────────────────
  const save = useCallback(async () => {
    if (!form || !original) return
    const errs = validate(form)
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    // Diff: envia só os campos que mudaram
    const patch: Record<string, unknown> = {}
    for (const k of PATCH_FIELDS) {
      if (form[k] !== original[k]) patch[k] = form[k]
    }
    if (Object.keys(patch).length === 0) return

    setSaving(true)
    try {
      const h   = await headers()
      const res = await fetch(`${BACKEND}/communication/settings`, {
        method: 'PATCH', headers: h, body: JSON.stringify(patch),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null) as { message?: string } | null
        onToast?.(err?.message ?? `Falha ao salvar (${res.status})`, 'error')
        return
      }
      const saved = await res.json() as Settings
      setOriginal(saved)
      setForm(saved)
      onToast?.('Configurações salvas', 'success')
    } catch {
      onToast?.('Erro de rede', 'error')
    } finally {
      setSaving(false)
    }
  }, [form, original, headers, onToast])

  const discard = useCallback(() => {
    if (!original) return
    setForm(original)
    setErrors({})
  }, [original])

  // ── render ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="rounded-xl p-12 text-center"
        style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
        <Loader2 size={20} className="inline-block animate-spin text-zinc-500" />
        <p className="text-zinc-500 text-sm mt-2">Carregando configurações…</p>
      </div>
    )
  }
  if (!form) {
    return (
      <div className="rounded-xl p-12 text-center"
        style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
        <p className="text-zinc-500 text-sm">Sem configurações pra esta org.</p>
      </div>
    )
  }

  const setField = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setForm(f => f ? { ...f, [key]: value } : f)

  const inputCls   = 'w-full px-3 py-2 text-[13px] rounded-lg outline-none focus:border-cyan-500'
  const inputStyle = (hasErr?: boolean) => ({
    background: '#18181b',
    border: `1px solid ${hasErr ? '#dc2626' : '#27272a'}`,
    color: '#e4e4e7',
  })

  const on = form.auto_communication_enabled

  return (
    <div className="max-w-3xl mx-auto space-y-4">

      {/* Card 1 — STATUS */}
      <div className="rounded-xl p-6"
        style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-zinc-100 text-base font-semibold">Comunicação Automática</h3>
            <p className="text-zinc-400 text-[12px] mt-1.5 leading-relaxed">
              {on
                ? <>Cada venda nova dispara automaticamente a jornada pós-venda (boas-vindas → rastreio → entrega).</>
                : <>Nada é disparado automaticamente. Mensagens só saem por ação manual.</>}
            </p>
            <p className="text-[11px] mt-2 font-semibold"
              style={{ color: on ? '#4ade80' : '#a1a1aa' }}>
              Status atual: {on ? '● LIGADA' : '○ DESLIGADA'}
            </p>
          </div>

          {/* Toggle custom — track 44×24 + knob 20×20 com 2px de padding
              em cada lado (44 − 20 − 2 − 2 = 20px de curso). Sem left:0
              explícito, o knob ficava 4px fora do track à direita. */}
          <button type="button" aria-label="Toggle"
            onClick={() => setField('auto_communication_enabled', !on)}
            className="relative w-11 h-6 rounded-full transition-colors shrink-0"
            style={{ background: on ? '#00E5FF' : '#3f3f46' }}>
            <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow-sm"
              style={{ transform: on ? 'translateX(20px)' : 'translateX(0)' }} />
          </button>
        </div>
      </div>

      {/* Card 2 — IDENTIDADE DA MARCA */}
      <div className="rounded-xl p-6 space-y-4"
        style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
        <h3 className="text-zinc-100 text-base font-semibold">Identidade da marca</h3>

        <div>
          <label className="text-[10px] uppercase tracking-widest text-zinc-500">Nome exibido nas mensagens</label>
          <input value={form.brand_display_name ?? ''}
            onChange={e => setField('brand_display_name', e.target.value)}
            className={`${inputCls} mt-1`}
            style={inputStyle(!!errors.brand_display_name)} />
          {errors.brand_display_name && (
            <p className="text-[10px] text-red-500 mt-1">{errors.brand_display_name}</p>
          )}
          <p className="text-[10px] text-zinc-600 mt-1">
            Aparece em <span className="font-mono">{`{{brand_name}}`}</span> dos templates.
          </p>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-widest text-zinc-500">Tom de voz</label>
          <select value={form.brand_tone ?? 'friendly'}
            onChange={e => setField('brand_tone', e.target.value as BrandTone)}
            className={`${inputCls} mt-1`} style={inputStyle()}>
            {TONE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* Card 3 — REGRAS DE ENVIO */}
      <div className="rounded-xl p-6 space-y-4"
        style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
        <h3 className="text-zinc-100 text-base font-semibold">Regras de envio</h3>

        {/* Janela de horário */}
        <div>
          <label className="text-[10px] uppercase tracking-widest text-zinc-500">Janela de horário permitida</label>
          <div className="grid grid-cols-2 gap-3 mt-1">
            <div>
              <span className="text-[11px] text-zinc-500">De</span>
              <input type="time" value={timeToInput(form.send_window_start)}
                onChange={e => setField('send_window_start', inputToTime(e.target.value))}
                className={inputCls} style={inputStyle()} />
            </div>
            <div>
              <span className="text-[11px] text-zinc-500">Até</span>
              <input type="time" value={timeToInput(form.send_window_end)}
                onChange={e => setField('send_window_end', inputToTime(e.target.value))}
                className={inputCls}
                style={inputStyle(!!errors.send_window_end)} />
            </div>
          </div>
          {errors.send_window_end && (
            <p className="text-[10px] text-red-500 mt-1">{errors.send_window_end}</p>
          )}
        </div>

        {/* Timezone */}
        <div>
          <label className="text-[10px] uppercase tracking-widest text-zinc-500">Fuso horário</label>
          <select value={form.send_timezone ?? 'America/Sao_Paulo'}
            onChange={e => setField('send_timezone', e.target.value)}
            className={`${inputCls} mt-1`} style={inputStyle()}>
            {TIMEZONES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        {/* Canal preferencial */}
        <div>
          <label className="text-[10px] uppercase tracking-widest text-zinc-500">Canal preferencial</label>
          <select value={form.default_channel_priority ?? 'whatsapp_then_email'}
            onChange={e => setField('default_channel_priority', e.target.value as ChannelPriority)}
            className={`${inputCls} mt-1`} style={inputStyle()}>
            {CHANNEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Marketing opt-in */}
        <div>
          <label className="text-[10px] uppercase tracking-widest text-zinc-500">Quando pedir consentimento de marketing</label>
          <select value={form.marketing_optin_moment ?? 'after_delivery'}
            onChange={e => setField('marketing_optin_moment', e.target.value as OptinMoment)}
            className={`${inputCls} mt-1`} style={inputStyle()}>
            {OPTIN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Pause days */}
        <div>
          <label className="text-[10px] uppercase tracking-widest text-zinc-500">Pausar cliente sem resposta após</label>
          <div className="flex items-center gap-2 mt-1">
            <input type="number" min={0} max={365}
              value={form.pause_after_days_no_reply ?? 0}
              onChange={e => setField('pause_after_days_no_reply', Number(e.target.value))}
              className={`${inputCls} w-24`}
              style={inputStyle(!!errors.pause_after_days_no_reply)} />
            <span className="text-[12px] text-zinc-400">dias</span>
          </div>
          {errors.pause_after_days_no_reply && (
            <p className="text-[10px] text-red-500 mt-1">{errors.pause_after_days_no_reply}</p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 pt-2">
        {isDirty && (
          <button type="button" onClick={discard}
            className="flex items-center gap-1.5 px-4 py-2 text-[12px] rounded-lg text-zinc-300 border border-zinc-800 hover:bg-zinc-900/50">
            <RotateCcw size={11} /> Descartar
          </button>
        )}
        <button type="button" onClick={save}
          disabled={!isDirty || saving}
          className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-semibold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: 'rgba(0,229,255,0.08)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.30)' }}>
          <Save size={11} /> {saving ? 'Salvando…' : 'Salvar alterações'}
        </button>
      </div>
    </div>
  )
}
