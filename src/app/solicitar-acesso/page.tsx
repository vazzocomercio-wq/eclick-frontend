'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL
  ?? process.env.NEXT_PUBLIC_API_URL
  ?? 'https://eclick-backend-production-2a87.up.railway.app'

interface Plan {
  key: string
  name: string
  description: string | null
  target: 'saas' | 'active' | 'combo'
  price_brl: number | null
  display_order: number
}

/**
 * F17-A · Página pública /solicitar-acesso. Substitui o /register aberto.
 * Cria row em access_requests; o platform admin aprova manualmente.
 */
export default function SolicitarAcessoPage() {
  const t = useTranslations('accessGate.page')

  const [name, setName]       = useState('')
  const [email, setEmail]     = useState('')
  const [phone, setPhone]     = useState('')
  const [company, setCompany] = useState('')
  const [message, setMessage] = useState('')
  const [planKey, setPlanKey] = useState('')

  const [plans, setPlans]       = useState<Plan[]>([])
  const [plansLoading, setPlansLoading] = useState(true)

  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [success, setSuccess]   = useState<{ duplicated: boolean } | null>(null)

  useEffect(() => {
    fetch(`${BACKEND}/access/plans`)
      .then(r => r.ok ? r.json() : [])
      .then((data: Plan[]) => setPlans(data))
      .catch(() => setPlans([]))
      .finally(() => setPlansLoading(false))
  }, [])

  function inputFocus(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    e.target.style.borderColor = '#00E5FF'
    e.target.style.boxShadow = '0 0 0 1px #00E5FF40'
  }
  function inputBlur(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    e.target.style.borderColor = '#3f3f46'
    e.target.style.boxShadow = 'none'
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (name.trim().length < 2 || !email.trim()) {
      setError(t('errorRequired'))
      return
    }
    if (!email.includes('@') || !email.includes('.')) {
      setError(t('errorEmailInvalid'))
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`${BACKEND}/access/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:    name.trim(),
          email:   email.trim().toLowerCase(),
          phone:   phone.trim() || undefined,
          company: company.trim() || undefined,
          message: message.trim() || undefined,
          planKey: planKey || undefined,
          source:  'web',
        }),
      })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const data: { id: string; duplicated: boolean; status: string } = await res.json()
      setSuccess({ duplicated: !!data.duplicated })
    } catch {
      setError(t('errorSubmit'))
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4"
           style={{ background: '#09090b', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="e-Click" style={{ width: '220px', marginBottom: '8px', mixBlendMode: 'screen' }} />
          </div>
          <div className="rounded-2xl border border-zinc-800 p-8 text-center" style={{ background: '#111113' }}>
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                 style={{ background: '#00E5FF20' }}>
              <CheckCircle2 size={26} style={{ color: '#00E5FF' }} />
            </div>
            <h2 className="text-white text-xl font-semibold mb-2">{t('successTitle')}</h2>
            <p className="text-zinc-400 text-sm mb-6">
              {success.duplicated ? t('duplicateMessage') : t('successMessage')}
            </p>
            <Link href="/login"
                  className="inline-block px-6 py-2.5 rounded-lg text-black text-sm font-semibold transition-all hover:opacity-90"
                  style={{ background: '#00E5FF' }}>
              {t('backToLogin')}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
         style={{ background: '#09090b', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="e-Click" style={{ width: '220px', marginBottom: '8px', mixBlendMode: 'screen' }} />
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-zinc-800 p-8" style={{ background: '#111113' }}>
          <div className="mb-6">
            <h1 className="text-white text-2xl font-semibold">{t('title')}</h1>
            <p className="text-zinc-400 text-sm mt-1">{t('subtitle')}</p>
          </div>

          {error && (
            <div className="mb-5 px-4 py-3 rounded-lg border text-sm flex items-start gap-2"
                 style={{ background: 'rgba(239,68,68,0.10)', borderColor: 'rgba(239,68,68,0.30)', color: '#f87171' }}>
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <Field label={t('nameLabel')}>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                     placeholder={t('namePlaceholder')} required autoComplete="name"
                     className="input-style" onFocus={inputFocus} onBlur={inputBlur}
                     style={inputBaseStyle} />
            </Field>

            <Field label={t('emailLabel')}>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                     placeholder={t('emailPlaceholder')} required autoComplete="email"
                     className="input-style" onFocus={inputFocus} onBlur={inputBlur}
                     style={inputBaseStyle} />
            </Field>

            <Field label={t('phoneLabel')}>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                     placeholder={t('phonePlaceholder')} autoComplete="tel"
                     className="input-style" onFocus={inputFocus} onBlur={inputBlur}
                     style={inputBaseStyle} />
            </Field>

            <Field label={t('companyLabel')}>
              <input type="text" value={company} onChange={e => setCompany(e.target.value)}
                     placeholder={t('companyPlaceholder')} autoComplete="organization"
                     className="input-style" onFocus={inputFocus} onBlur={inputBlur}
                     style={inputBaseStyle} />
            </Field>

            <Field label={`${t('planLabel')} ${t('planOptional')}`}>
              {plansLoading ? (
                <p className="text-xs text-zinc-500 px-1">{t('planLoading')}</p>
              ) : (
                <select value={planKey} onChange={e => setPlanKey(e.target.value)}
                        className="input-style" onFocus={inputFocus} onBlur={inputBlur}
                        style={{ ...inputBaseStyle, appearance: 'auto' }}>
                  <option value="">—</option>
                  {plans.map(p => (
                    <option key={p.key} value={p.key}>
                      {p.name} {p.target === 'active' ? '(Active)' : p.target === 'combo' ? '(SaaS + Active)' : ''}
                    </option>
                  ))}
                </select>
              )}
            </Field>

            <Field label={t('messageLabel')}>
              <textarea value={message} onChange={e => setMessage(e.target.value)}
                        placeholder={t('messagePlaceholder')} rows={4}
                        className="input-style resize-none" onFocus={inputFocus} onBlur={inputBlur}
                        style={{ ...inputBaseStyle, paddingTop: '10px', paddingBottom: '10px' }} />
            </Field>

            <button type="submit" disabled={loading}
                    className="w-full py-2.5 rounded-lg text-black font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
                    style={{ background: '#00E5FF', marginTop: '8px' }}>
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? t('submitting') : t('submit')}
            </button>
          </form>

          <p className="text-center text-sm text-zinc-400 mt-6">
            {t('alreadyHaveAccount')}{' '}
            <Link href="/login" className="font-semibold hover:underline" style={{ color: '#00E5FF' }}>
              {t('loginLink')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

const inputBaseStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: '8px',
  color: '#fff',
  background: '#1c1c1f',
  border: '1px solid #3f3f46',
  outline: 'none',
  fontSize: '14px',
  transition: 'all 0.15s ease',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-300 mb-1.5">{label}</label>
      {children}
    </div>
  )
}
