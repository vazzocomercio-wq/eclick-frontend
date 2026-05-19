'use client'

/**
 * Recuperação de senha — passo 1: o usuário informa o e-mail e recebe
 * um link de redefinição (Supabase Auth resetPasswordForEmail). O link
 * volta por /auth/callback?next=/redefinir-senha.
 */

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase'

export default function ForgotPasswordPage() {
  const t = useTranslations('auth')
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/redefinir-senha`,
    })
    setLoading(false)
    if (error) {
      setError(t('errors.resetEmailFailed'))
      return
    }
    setSent(true)
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: '#09090b', fontFamily: 'system-ui, -apple-system, sans-serif' }}
    >
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt={t('logoAlt')}
            style={{ width: '220px', marginBottom: '8px', mixBlendMode: 'screen' as const }} />
        </div>

        <div className="rounded-2xl border border-zinc-800 p-8" style={{ background: '#111113' }}>
          {sent ? (
            <div className="text-center space-y-3">
              <h1 className="text-white text-2xl font-semibold">{t('forgot.sentTitle')}</h1>
              <p className="text-zinc-400 text-sm">
                {t.rich('forgot.sentMessage', {
                  email,
                  highlight: (chunks) => <span className="text-zinc-200">{chunks}</span>,
                })}
              </p>
              <Link href="/login" className="inline-block mt-2 text-sm font-semibold" style={{ color: '#00E5FF' }}>
                {t('forgot.backToLogin')}
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h1 className="text-white text-2xl font-semibold">{t('forgot.title')}</h1>
                <p className="text-zinc-400 text-sm mt-1">
                  {t('forgot.subtitle')}
                </p>
              </div>

              {error && (
                <div className="mb-5 px-4 py-3 rounded-lg border text-sm"
                  style={{ background: '#ff444420', borderColor: '#ff444440', color: '#ff8080' }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">{t('emailLabel')}</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder={t('emailPlaceholder')}
                    required
                    autoComplete="email"
                    className="w-full px-3.5 py-2.5 rounded-lg text-white text-sm placeholder-zinc-600 border border-zinc-700 outline-none transition-all"
                    style={{ background: '#1c1c1f' }}
                    onFocus={e => { e.target.style.borderColor = '#00E5FF'; e.target.style.boxShadow = '0 0 0 1px #00E5FF40' }}
                    onBlur={e => { e.target.style.borderColor = '#3f3f46'; e.target.style.boxShadow = 'none' }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-lg text-black font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ background: '#00E5FF', marginTop: '8px' }}
                >
                  {loading ? t('forgot.submitting') : t('forgot.submit')}
                </button>
              </form>

              <p className="text-center text-sm text-zinc-400 mt-6">
                {t('forgot.rememberedPassword')}{' '}
                <Link href="/login" className="font-semibold hover:underline" style={{ color: '#00E5FF' }}>
                  {t('forgot.backToLogin')}
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
