'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

type State = 'loading' | 'success' | 'error'

function MlCallbackContent() {
  const router = useRouter()
  const params = useSearchParams()
  const [state, setState] = useState<State>('loading')
  const [errMsg, setErrMsg] = useState('')

  useEffect(() => {
    const code = params.get('code')
    const error = params.get('error')

    if (error || !code) {
      setState('error')
      setErrMsg(error ?? 'Código de autorização ausente.')
      return
    }

    ;(async () => {
      const supabase = createClient()
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token

      if (!token) {
        setState('error')
        setErrMsg('Sessão expirada. Faça login novamente.')
        return
      }

      const redirectUri = process.env.NEXT_PUBLIC_ML_REDIRECT_URI ?? (window.location.origin + '/dashboard/integracoes/ml/callback')

      const res = await fetch(`${BACKEND}/ml/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code, redirect_uri: redirectUri }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setState('error')
        setErrMsg(body?.message ?? 'Falha ao conectar conta.')
        return
      }

      setState('success')
      setTimeout(() => router.push('/dashboard/integracoes'), 2000)
    })()
  }, [params, router])

  return (
    <div className="flex flex-col items-center justify-center h-screen" style={{ background: '#09090b' }}>
      <div
        className="w-full max-w-sm mx-4 rounded-2xl px-8 py-10 flex flex-col items-center gap-5 text-center"
        style={{ background: '#111114', border: '1px solid #1e1e24' }}
      >
        {/* ML logo */}
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold"
          style={{ background: '#ffe600', color: '#333' }}
        >
          ML
        </div>

        {state === 'loading' && (
          <>
            <svg className="w-8 h-8 animate-spin text-cyan-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <div>
              <p className="text-white font-semibold">Conectando ao Mercado Livre…</p>
              <p className="text-zinc-500 text-sm mt-1">Aguarde enquanto confirmamos sua conta.</p>
            </div>
          </>
        )}

        {state === 'success' && (
          <>
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(52,211,153,0.15)' }}
            >
              <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-white font-semibold">Conta conectada!</p>
              <p className="text-zinc-500 text-sm mt-1">Redirecionando para Integrações…</p>
            </div>
          </>
        )}

        {state === 'error' && (
          <>
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(248,113,113,0.15)' }}
            >
              <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div>
              <p className="text-white font-semibold">Falha na conexão</p>
              <p className="text-zinc-500 text-sm mt-1">{errMsg}</p>
            </div>
            <button
              onClick={() => router.push('/dashboard/integracoes')}
              className="mt-2 px-5 py-2 rounded-lg text-sm font-medium border transition-all"
              style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}
            >
              Voltar para Integrações
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function MlCallbackPage() {
  return (
    <Suspense>
      <MlCallbackContent />
    </Suspense>
  )
}
