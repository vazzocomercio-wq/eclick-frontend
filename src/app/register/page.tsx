'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
      </svg>
    )
  }
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  )
}

export default function RegisterPage() {
  const router = useRouter()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  function inputFocus(e: React.FocusEvent<HTMLInputElement>) {
    e.target.style.borderColor = '#00E5FF'
    e.target.style.boxShadow = '0 0 0 1px #00E5FF40'
  }
  function inputBlur(e: React.FocusEvent<HTMLInputElement>) {
    e.target.style.borderColor = '#3f3f46'
    e.target.style.boxShadow = 'none'
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.')
      return
    }

    setLoading(true)

    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message === 'User already registered'
        ? 'Este email já está cadastrado. Faça login.'
        : 'Erro ao criar conta. Tente novamente.')
      setLoading(false)
      return
    }

    if (data.user && !data.session) {
      setSuccess('Conta criada! Verifique seu email para confirmar o cadastro.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  if (success) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ background: '#09090b', fontFamily: 'system-ui, -apple-system, sans-serif' }}
      >
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center mb-8">
            <img src="/logo.png" alt="e-Click Inteligência Comercial" style={{ width: '220px', marginBottom: '8px', mixBlendMode: 'screen' as const }} />
          </div>
          <div className="rounded-2xl border border-zinc-800 p-8 text-center" style={{ background: '#111113' }}>
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: '#00E5FF20' }}
            >
              <svg className="w-7 h-7" style={{ color: '#00E5FF' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-white text-xl font-semibold mb-2">Verifique seu email</h2>
            <p className="text-zinc-400 text-sm mb-6">{success}</p>
            <Link
              href="/login"
              className="inline-block px-6 py-2.5 rounded-lg text-black text-sm font-semibold transition-all hover:opacity-90"
              style={{ background: '#00E5FF' }}
            >
              Ir para o Login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: '#09090b', fontFamily: 'system-ui, -apple-system, sans-serif' }}
    >
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img src="/logo.png" alt="e-Click Inteligência Comercial" style={{ width: '220px', marginBottom: '8px', mixBlendMode: 'screen' as const }} />
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-zinc-800 p-8" style={{ background: '#111113' }}>
          <div className="mb-6">
            <h1 className="text-white text-2xl font-semibold">Criar conta</h1>
            <p className="text-zinc-400 text-sm mt-1">Comece a usar a plataforma gratuitamente</p>
          </div>

          {error && (
            <div className="mb-5 px-4 py-3 rounded-lg border text-sm" style={{ background: '#ff444420', borderColor: '#ff444440', color: '#ff8080' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Nome completo</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                required
                autoComplete="name"
                className="w-full px-3.5 py-2.5 rounded-lg text-white text-sm placeholder-zinc-600 border border-zinc-700 outline-none transition-all"
                style={{ background: '#1c1c1f' }}
                onFocus={inputFocus}
                onBlur={inputBlur}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                autoComplete="email"
                className="w-full px-3.5 py-2.5 rounded-lg text-white text-sm placeholder-zinc-600 border border-zinc-700 outline-none transition-all"
                style={{ background: '#1c1c1f' }}
                onFocus={inputFocus}
                onBlur={inputBlur}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Senha</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                  autoComplete="new-password"
                  className="w-full px-3.5 py-2.5 pr-10 rounded-lg text-white text-sm placeholder-zinc-600 border border-zinc-700 outline-none transition-all"
                  style={{ background: '#1c1c1f' }}
                  onFocus={inputFocus}
                  onBlur={inputBlur}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                  tabIndex={-1}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Confirmar senha</label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a senha"
                  required
                  autoComplete="new-password"
                  className="w-full px-3.5 py-2.5 pr-10 rounded-lg text-white text-sm placeholder-zinc-600 border border-zinc-700 outline-none transition-all"
                  style={{ background: '#1c1c1f' }}
                  onFocus={inputFocus}
                  onBlur={inputBlur}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                  tabIndex={-1}
                >
                  <EyeIcon open={showConfirm} />
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-black font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: '#00E5FF', marginTop: '8px' }}
            >
              {loading ? 'Criando conta...' : 'Criar conta grátis'}
            </button>
          </form>

          <p className="text-center text-sm text-zinc-400 mt-6">
            Já tem uma conta?{' '}
            <Link href="/login" className="font-semibold hover:underline" style={{ color: '#00E5FF' }}>
              Fazer login
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
