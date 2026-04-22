import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

async function signOut() {
  'use server'
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
  await supabase.auth.signOut()
  redirect('/login')
}

const stats = [
  { label: 'Propostas Ativas', value: '—', icon: '📋' },
  { label: 'Leads do Mês', value: '—', icon: '🎯' },
  { label: 'Taxa de Conversão', value: '—', icon: '📈' },
  { label: 'Receita Mensal', value: '—', icon: '💰' },
]

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const displayName =
    user.user_metadata?.full_name ||
    user.email?.split('@')[0] ||
    'Usuário'

  const initials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div
      className="min-h-screen text-white"
      style={{ background: '#09090b', fontFamily: 'system-ui, -apple-system, sans-serif' }}
    >
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-3.5 flex items-center justify-between sticky top-0 z-10" style={{ background: '#09090b' }}>
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-black text-xs shrink-0"
            style={{ background: '#00E5FF' }}
          >
            eC
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-white font-bold text-lg tracking-tight">e-Click</span>
            <span
              className="text-xs font-semibold tracking-widest uppercase hidden sm:block"
              style={{ color: '#00E5FF' }}
            >
              Inteligência Comercial
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-black shrink-0"
              style={{ background: '#00E5FF' }}
            >
              {initials}
            </div>
            <div className="text-right">
              <p className="text-white text-sm font-medium leading-none">{displayName}</p>
              <p className="text-zinc-500 text-xs mt-0.5">{user.email}</p>
            </div>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-300 text-sm font-medium hover:border-zinc-600 hover:text-white transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sair
            </button>
          </form>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-6 py-8">

        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-white">
            Olá, {displayName.split(' ')[0]} 👋
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Bem-vindo ao painel e-Click. Aqui está um resumo das suas atividades.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-zinc-800 p-5 hover:border-zinc-700 transition-colors"
              style={{ background: '#111113' }}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-zinc-400 text-sm">{stat.label}</p>
                <span className="text-lg">{stat.icon}</span>
              </div>
              <p className="text-white text-2xl font-bold">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Content area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Activity */}
          <div
            className="lg:col-span-2 rounded-xl border border-zinc-800 p-6"
            style={{ background: '#111113' }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-semibold">Atividade Recente</h2>
              <span
                className="text-xs font-medium px-2.5 py-1 rounded-full"
                style={{ background: '#00E5FF15', color: '#00E5FF' }}
              >
                Em breve
              </span>
            </div>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                style={{ background: '#00E5FF10' }}
              >
                <svg
                  className="w-6 h-6"
                  style={{ color: '#00E5FF' }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-zinc-300 font-medium text-sm">Nenhuma atividade ainda</p>
              <p className="text-zinc-600 text-xs mt-1">As suas atividades aparecerão aqui</p>
            </div>
          </div>

          {/* Account info */}
          <div
            className="rounded-xl border border-zinc-800 p-6"
            style={{ background: '#111113' }}
          >
            <h2 className="text-white font-semibold mb-5">Sua Conta</h2>
            <div className="space-y-4">
              <div
                className="flex items-center justify-center w-16 h-16 rounded-full text-xl font-bold text-black mx-auto mb-2"
                style={{ background: '#00E5FF' }}
              >
                {initials}
              </div>
              <div className="text-center">
                <p className="text-white font-medium">{displayName}</p>
                <p className="text-zinc-500 text-xs mt-0.5">{user.email}</p>
              </div>
              <div className="border-t border-zinc-800 pt-4 space-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Plano</span>
                  <span
                    className="font-medium px-2 py-0.5 rounded text-xs"
                    style={{ background: '#00E5FF15', color: '#00E5FF' }}
                  >
                    Gratuito
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Status</span>
                  <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                    Ativo
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Desde</span>
                  <span className="text-zinc-300">
                    {new Date(user.created_at).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
