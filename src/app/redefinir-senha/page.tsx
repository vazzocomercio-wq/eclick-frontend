'use client'

/**
 * Recuperação de senha — passo 2: o usuário chega aqui por um link de
 * recuperação. A página valida o token (token_hash via verifyOtp, ou
 * code via exchangeCodeForSession, ou sessão já detectada no hash) e aí
 * libera o formulário pra definir a nova senha.
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  )
}

type Phase = 'verifying' | 'ready' | 'invalid'

export default function RedefinirSenhaPage() {
  const router = useRouter()
  const [phase, setPhase]       = useState<Phase>('verifying')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [show, setShow]         = useState(false)
  const [loading, setLoading]   = useState(false)
  const [done, setDone]         = useState(false)
  const [error, setError]       = useState<string | null>(null)

  // Valida o link de recuperação ao montar.
  useEffect(() => {
    void (async () => {
      const supabase = createClient()
      const params = new URLSearchParams(window.location.search)
      const tokenHash = params.get('token_hash')
      const type      = params.get('type')
      const code      = params.get('code')
      const urlErr    = params.get('error_description') || params.get('error')

      if (urlErr) { setPhase('invalid'); return }

      if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as 'recovery',
        })
        setPhase(error ? 'invalid' : 'ready')
        return
      }
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        setPhase(error ? 'invalid' : 'ready')
        return
      }
      // Sem token na URL — confia numa sessão já estabelecida (link com
      // hash auto-detectado pelo cliente, ou usuário já logado).
      const { data } = await supabase.auth.getSession()
      setPhase(data.session ? 'ready' : 'invalid')
    })()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('A senha precisa ter pelo menos 8 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('As senhas não conferem.')
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) {
      setError('Não foi possível redefinir. O link pode ter expirado — peça um novo.')
      return
    }
    setDone(true)
    setTimeout(() => { router.push('/dashboard'); router.refresh() }, 1500)
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: '#09090b', fontFamily: 'system-ui, -apple-system, sans-serif' }}
    >
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="e-Click Inteligência Comercial"
            style={{ width: '220px', marginBottom: '8px', mixBlendMode: 'screen' as const }} />
        </div>

        <div className="rounded-2xl border border-zinc-800 p-8" style={{ background: '#111113' }}>
          {done ? (
            <div className="text-center space-y-3">
              <h1 className="text-white text-2xl font-semibold">Senha redefinida</h1>
              <p className="text-zinc-400 text-sm">Tudo certo — redirecionando você para o painel…</p>
            </div>
          ) : phase === 'verifying' ? (
            <div className="text-center space-y-3 py-4">
              <h1 className="text-white text-2xl font-semibold">Validando o link…</h1>
              <p className="text-zinc-400 text-sm">Um instante.</p>
            </div>
          ) : phase === 'invalid' ? (
            <div className="text-center space-y-3">
              <h1 className="text-white text-2xl font-semibold">Link inválido ou expirado</h1>
              <p className="text-zinc-400 text-sm">
                Este link de redefinição não é mais válido. Peça um novo na tela de acesso.
              </p>
              <Link href="/forgot-password" className="inline-block mt-2 text-sm font-semibold" style={{ color: '#00E5FF' }}>
                Pedir novo link
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h1 className="text-white text-2xl font-semibold">Criar nova senha</h1>
                <p className="text-zinc-400 text-sm mt-1">Escolha uma senha com pelo menos 8 caracteres.</p>
              </div>

              {error && (
                <div className="mb-5 px-4 py-3 rounded-lg border text-sm"
                  style={{ background: '#ff444420', borderColor: '#ff444440', color: '#ff8080' }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">Nova senha</label>
                  <div className="relative">
                    <input
                      type={show ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      autoComplete="new-password"
                      className="w-full px-3.5 py-2.5 pr-10 rounded-lg text-white text-sm placeholder-zinc-600 border border-zinc-700 outline-none transition-all"
                      style={{ background: '#1c1c1f' }}
                      onFocus={e => { e.target.style.borderColor = '#00E5FF'; e.target.style.boxShadow = '0 0 0 1px #00E5FF40' }}
                      onBlur={e => { e.target.style.borderColor = '#3f3f46'; e.target.style.boxShadow = 'none' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShow(!show)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                      tabIndex={-1}
                    >
                      <EyeIcon open={show} />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">Confirmar nova senha</label>
                  <input
                    type={show ? 'text' : 'password'}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="new-password"
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
                  {loading ? 'Salvando...' : 'Redefinir senha'}
                </button>
              </form>

              <p className="text-center text-sm text-zinc-400 mt-6">
                <Link href="/login" className="font-semibold hover:underline" style={{ color: '#00E5FF' }}>
                  Voltar para o login
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
