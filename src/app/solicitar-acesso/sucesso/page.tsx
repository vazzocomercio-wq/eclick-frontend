'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { CheckCircle2, Mail } from 'lucide-react'

/**
 * F17-A · Página de retorno do Stripe Checkout (success_url).
 * Não valida session_id no frontend — o webhook backend já provisionou
 * user+org+subscription e disparou o magic-link de acesso.
 */
export default function SolicitarAcessoSucessoPage() {
  const t = useTranslations('accessGate.successPage')

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
         style={{ background: '#09090b', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="e-Click"
               style={{ width: '220px', marginBottom: '8px', mixBlendMode: 'screen' }} />
        </div>

        <div className="rounded-2xl border border-zinc-800 p-8 text-center"
             style={{ background: '#111113' }}>
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
               style={{ background: '#00E5FF20' }}>
            <CheckCircle2 size={26} style={{ color: '#00E5FF' }} />
          </div>

          <h1 className="text-white text-xl font-semibold mb-2">{t('title')}</h1>
          <p className="text-zinc-400 text-sm mb-6">{t('message')}</p>

          <div className="rounded-lg border px-4 py-3 mb-6 flex items-start gap-3 text-left"
               style={{ background: '#1c1c1f', borderColor: '#3f3f46' }}>
            <Mail size={16} className="shrink-0 mt-0.5" style={{ color: '#00E5FF' }} />
            <div>
              <p className="text-white text-sm font-medium">{t('checkEmailTitle')}</p>
              <p className="text-zinc-400 text-xs mt-0.5">{t('checkEmailHint')}</p>
            </div>
          </div>

          <Link href="/login"
                className="inline-block px-6 py-2.5 rounded-lg text-black text-sm font-semibold transition-all hover:opacity-90"
                style={{ background: '#00E5FF' }}>
            {t('goToLogin')}
          </Link>

          <p className="text-zinc-500 text-xs mt-6">
            {t('supportHint')}{' '}
            <a href="mailto:suporte@eclick.app.br"
               className="font-medium hover:underline"
               style={{ color: '#00E5FF' }}>
              suporte@eclick.app.br
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
