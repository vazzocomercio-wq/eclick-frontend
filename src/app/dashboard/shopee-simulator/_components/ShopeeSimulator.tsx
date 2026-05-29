'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { AlertCircle, CheckCircle2, Sparkles, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase'

/** F18 F1.7 — Simulador de Anúncio Shopee.
 *  Form ao vivo → roda guard de pré-publicação (POST /shopee/creative/
 *  evaluate). Mostra Algorithm Score + se está pronto pra publicar + issues.
 *  Funciona sem creds — é compute puro no backend. */

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL
  ?? process.env.NEXT_PUBLIC_API_URL
  ?? 'https://eclick-backend-production-2a87.up.railway.app'

const CYAN   = '#00E5FF'
const SHOPEE = '#EE4D2D'

type Pillar = 'relevance' | 'performance' | 'seller_quality' | 'price_marketing'
type Severity = 'high' | 'medium' | 'low'

interface Issue {
  pillar:             Pillar
  code:               string
  severity:           Severity
  description:        string
  recommended_action: string
  current_value?:     number | string
  target_value?:      number | string
}

interface EvaluateResponse {
  score: {
    score:   number
    pillars: Record<Pillar, number>
    issues:  Issue[]
  }
  ready:           boolean
  blockers:        string[]
  warnings:        string[]
  publish_enabled: boolean
}

interface DraftForm {
  title:                 string
  description:           string
  image_count:           number
  image_min_dimension:   number
  attrs_filled:          number
  attrs_mandatory_total: number
  price:                 number
  market_median_price:   number
}

const DEFAULT_FORM: DraftForm = {
  title:                 '',
  description:           '',
  image_count:           1,
  image_min_dimension:   800,
  attrs_filled:          0,
  attrs_mandatory_total: 10,
  price:                 0,
  market_median_price:   0,
}

export default function ShopeeSimulator() {
  const t = useTranslations('shopeeSimulator')
  const [form, setForm]       = useState<DraftForm>(DEFAULT_FORM)
  const [result, setResult]   = useState<EvaluateResponse | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const evaluate = useCallback(async (draft: DraftForm) => {
    setLoading(true)
    setError(null)
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      const res = await fetch(`${BACKEND}/shopee/creative/evaluate`, {
        method:  'POST',
        headers: {
          Authorization:  `Bearer ${session?.access_token ?? ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shop_id:               999990001,   // simulador usa shop placeholder
          title:                 draft.title || null,
          description:           draft.description || null,
          image_count:           draft.image_count,
          image_min_dimension:   draft.image_min_dimension,
          attrs_filled:          draft.attrs_filled,
          attrs_mandatory_total: draft.attrs_mandatory_total,
          price:                 draft.price || null,
          market_median_price:   draft.market_median_price || null,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setResult(await res.json())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounced live eval ao mudar o form
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => { void evaluate(form) }, 500)
    return () => { if (debounce.current) clearTimeout(debounce.current) }
  }, [form, evaluate])

  const set = <K extends keyof DraftForm>(key: K, value: DraftForm[K]) =>
    setForm(f => ({ ...f, [key]: value }))

  return (
    <div className="p-6 min-h-full" style={{ background: '#09090b' }}>
      <Header t={t} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
        {/* Form */}
        <div className="rounded-2xl p-5 space-y-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
          <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">{t('form.title')}</h3>

          <Field label={t('field.titleLabel')} hint={t('field.titleHint')}>
            <input
              type="text" value={form.title} onChange={e => set('title', e.target.value)}
              placeholder={t('field.titlePlaceholder')}
              className="w-full px-3 py-2 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-600"
              style={{ background: '#0a0a0e', border: '1px solid #1e1e24', outline: 'none' }}
            />
            <CharCount n={form.title.length} ideal={80} max={120} />
          </Field>

          <Field label={t('field.descLabel')} hint={t('field.descHint')}>
            <textarea
              value={form.description} onChange={e => set('description', e.target.value)}
              rows={4} placeholder={t('field.descPlaceholder')}
              className="w-full px-3 py-2 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-600 resize-none"
              style={{ background: '#0a0a0e', border: '1px solid #1e1e24', outline: 'none' }}
            />
            <CharCount n={form.description.length} ideal={500} max={3000} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <NumField label={t('field.imageCount')} value={form.image_count} min={0} max={9} onChange={v => set('image_count', v)} />
            <NumField label={t('field.imageDim')} value={form.image_min_dimension} min={0} max={4000} step={100} onChange={v => set('image_min_dimension', v)} suffix="px" />
            <NumField label={t('field.attrsFilled')} value={form.attrs_filled} min={0} max={form.attrs_mandatory_total} onChange={v => set('attrs_filled', v)} />
            <NumField label={t('field.attrsTotal')} value={form.attrs_mandatory_total} min={0} max={30} onChange={v => set('attrs_mandatory_total', v)} />
            <NumField label={t('field.price')} value={form.price} min={0} max={100000} step={1} onChange={v => set('price', v)} prefix="R$" />
            <NumField label={t('field.marketPrice')} value={form.market_median_price} min={0} max={100000} step={1} onChange={v => set('market_median_price', v)} prefix="R$" />
          </div>
        </div>

        {/* Result */}
        <div className="space-y-4">
          {error && (
            <div className="rounded-xl p-3 flex items-center gap-3"
              style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)' }}>
              <AlertCircle size={14} className="text-red-400" />
              <p className="text-xs text-red-300">{t('error', { msg: error })}</p>
            </div>
          )}
          {result ? (
            <ResultPanel result={result} loading={loading} t={t} />
          ) : (
            <div className="rounded-2xl p-8 text-center" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
              <p className="text-xs text-zinc-600">{t('startHint')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Result panel ───────────────────────────────────────────────────────────

function ResultPanel({ result, loading, t }: { result: EvaluateResponse; loading: boolean; t: ReturnType<typeof useTranslations> }) {
  const s = result.score
  return (
    <>
      {/* Score + ready */}
      <div className="rounded-2xl p-5" style={{ background: '#111114', border: `1px solid ${result.ready ? '#34d39955' : '#f8717155'}`, opacity: loading ? 0.6 : 1 }}>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="text-[9px] uppercase tracking-widest text-zinc-600 font-semibold">{t('score')}</p>
            <p className="text-4xl font-black leading-none mt-1" style={{ color: scoreColor(s.score) }}>{s.score}</p>
          </div>
          <div className="flex-1">
            {result.ready ? (
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-400" />
                <div>
                  <p className="text-sm font-semibold text-emerald-300">{t('ready.yes')}</p>
                  <p className="text-[10px] text-zinc-500">
                    {result.publish_enabled ? t('ready.canPublish') : t('ready.pendingCreds')}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <XCircle size={18} className="text-red-400" />
                <div>
                  <p className="text-sm font-semibold text-red-300">{t('ready.no')}</p>
                  <p className="text-[10px] text-zinc-500">{t('ready.fixFirst')}</p>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 mt-4">
          {(['relevance','performance','seller_quality','price_marketing'] as Pillar[]).map(p => (
            <div key={p}>
              <div className="flex justify-between mb-1">
                <span className="text-[9px] uppercase tracking-wider text-zinc-600 font-semibold">{t(`pillar.${p}`)}</span>
              </div>
              <div className="h-1 rounded-full overflow-hidden" style={{ background: '#18181b' }}>
                <div className="h-full" style={{ width: `${s.pillars[p]}%`, background: scoreColor(s.pillars[p]) }} />
              </div>
              <p className="text-[10px] text-zinc-400 mt-0.5">{s.pillars[p]}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Blockers */}
      {result.blockers.length > 0 && (
        <div className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)' }}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-red-400">{t('blockers')}</p>
          {result.blockers.map((b, i) => (
            <p key={i} className="text-xs text-red-200 leading-relaxed">{b}</p>
          ))}
        </div>
      )}

      {/* Issues */}
      {s.issues.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{t('issues', { n: s.issues.length })}</p>
          {s.issues.slice(0, 5).map((iss, i) => (
            <div key={i} className="rounded-lg p-2.5" style={{ background: '#18181b', border: `1px solid ${sevColor(iss.severity)}33` }}>
              <div className="flex items-start gap-2">
                <AlertCircle size={12} style={{ color: sevColor(iss.severity) }} className="mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-zinc-200">{iss.description}</p>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    <span className="text-zinc-500">{t('action')}: </span>{iss.recommended_action}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {s.issues.length === 0 && result.ready && (
        <div className="rounded-2xl p-5 text-center" style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.2)' }}>
          <Sparkles size={16} className="mx-auto text-emerald-400" />
          <p className="text-xs font-semibold text-emerald-300 mt-2">{t('perfect')}</p>
        </div>
      )}
    </>
  )
}

// ── Form helpers ───────────────────────────────────────────────────────────

function Header({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black"
        style={{ background: 'rgba(238,77,45,0.15)', color: SHOPEE }}>SH</div>
      <div>
        <h2 className="text-white text-lg font-semibold">{t('title')}</h2>
        <p className="text-zinc-500 text-xs">{t('subtitle')}</p>
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-medium text-zinc-400">{label}</label>
      {hint && <p className="text-[10px] text-zinc-600 mb-1">{hint}</p>}
      {children}
    </div>
  )
}

function NumField({ label, value, min, max, step = 1, onChange, prefix, suffix }: {
  label: string; value: number; min: number; max: number; step?: number
  onChange: (v: number) => void; prefix?: string; suffix?: string
}) {
  return (
    <div>
      <label className="text-[11px] font-medium text-zinc-400">{label}</label>
      <div className="flex items-center gap-1 mt-1 px-3 py-2 rounded-lg"
        style={{ background: '#0a0a0e', border: '1px solid #1e1e24' }}>
        {prefix && <span className="text-xs text-zinc-600">{prefix}</span>}
        <input
          type="number" value={value} min={min} max={max} step={step}
          onChange={e => onChange(Math.max(min, Math.min(max, Number(e.target.value) || 0)))}
          className="w-full bg-transparent text-sm text-zinc-200"
          style={{ outline: 'none' }}
        />
        {suffix && <span className="text-xs text-zinc-600">{suffix}</span>}
      </div>
    </div>
  )
}

function CharCount({ n, ideal, max }: { n: number; ideal: number; max: number }) {
  const color = n === 0 ? '#52525b' : n < ideal * 0.4 ? '#fbbf24' : n <= max ? '#34d399' : '#f87171'
  return <p className="text-[10px] mt-1" style={{ color }}>{n} / {max} ({ideal} ideal)</p>
}

function scoreColor(s: number): string {
  if (s >= 80) return '#34d399'
  if (s >= 60) return CYAN
  if (s >= 40) return '#fbbf24'
  return '#f87171'
}
function sevColor(sev: Severity): string {
  if (sev === 'high')   return '#f87171'
  if (sev === 'medium') return '#fbbf24'
  return '#71717a'
}
