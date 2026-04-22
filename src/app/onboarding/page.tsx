'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

// ─── api call ──────────────────────────────────────────────────────────────

async function createOrganization(payload: {
  name: string
  slug: string
  platforms: string[]
}): Promise<{ orgId: string } | { error: string }> {
  const res = await fetch('/api/onboarding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const json = await res.json()
  if (!res.ok) return { error: json.error ?? 'Erro desconhecido.' }
  return { orgId: json.orgId }
}

// ─── helpers ───────────────────────────────────────────────────────────────

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

// ─── platform config ───────────────────────────────────────────────────────

const PLATFORMS = [
  { id: 'mercadolivre',   label: 'Mercado Livre',    abbr: 'ML', bg: '#FFE600', fg: '#111111' },
  { id: 'shopee',         label: 'Shopee',            abbr: 'SH', bg: '#EE4D2D', fg: '#ffffff' },
  { id: 'amazon',         label: 'Amazon',            abbr: 'AZ', bg: '#FF9900', fg: '#111111' },
  { id: 'magalu',         label: 'Magazine Luiza',    abbr: 'MG', bg: '#0086FF', fg: '#ffffff' },
]

// ─── sub-components ────────────────────────────────────────────────────────

function StepBar({ current }: { current: number }) {
  const steps = [
    { n: 1, label: 'Sua loja' },
    { n: 2, label: 'Plataformas' },
  ]
  return (
    <div className="flex items-start gap-0 mb-8 w-full max-w-xs mx-auto">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-start flex-1">
          <div className="flex flex-col items-center flex-1">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-300"
              style={{
                borderColor: current >= s.n ? '#00E5FF' : '#3f3f46',
                background:  current === s.n ? '#00E5FF' : 'transparent',
                color:       current === s.n ? '#000' : current > s.n ? '#00E5FF' : '#52525b',
              }}
            >
              {current > s.n
                ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                : s.n}
            </div>
            <span
              className="text-[11px] font-medium mt-1.5 tracking-wide"
              style={{ color: current >= s.n ? '#a1a1aa' : '#52525b' }}
            >
              {s.label}
            </span>
          </div>

          {i < steps.length - 1 && (
            <div
              className="h-px flex-1 mt-4 mx-1 transition-all duration-500"
              style={{ background: current > 1 ? '#00E5FF' : '#3f3f46' }}
            />
          )}
        </div>
      ))}
    </div>
  )
}

function PlatformCard({
  platform,
  selected,
  onToggle,
}: {
  platform: typeof PLATFORMS[0]
  selected: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="relative flex items-center gap-3 p-4 rounded-xl border text-left w-full transition-all duration-200 active:scale-[0.98]"
      style={{
        background:   selected ? `${platform.bg}12` : '#1c1c1f',
        borderColor:  selected ? platform.bg : '#3f3f46',
        boxShadow:    selected ? `0 0 0 1px ${platform.bg}30` : 'none',
      }}
    >
      {/* Brand badge */}
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center text-[13px] font-black shrink-0"
        style={{ background: platform.bg, color: platform.fg }}
      >
        {platform.abbr}
      </div>

      <span
        className="font-medium text-sm flex-1 leading-tight"
        style={{ color: selected ? '#ffffff' : '#a1a1aa' }}
      >
        {platform.label}
      </span>

      {/* Check */}
      <div
        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all duration-200"
        style={{
          background:  selected ? '#00E5FF' : 'transparent',
          border:      selected ? 'none' : '2px solid #3f3f46',
        }}
      >
        {selected && (
          <svg className="w-3 h-3" fill="none" stroke="#000" viewBox="0 0 24 24" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
          </svg>
        )}
      </div>
    </button>
  )
}

// ─── main page ─────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()

  const [userId, setUserId]     = useState<string | null>(null)
  const [step, setStep]         = useState(1)
  const [storeName, setStoreName] = useState('')
  const [slug, setSlug]         = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [platforms, setPlatforms] = useState<string[]>([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  // Auth guard + redirect if org already exists
  useEffect(() => {
    async function check() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) { router.replace('/login'); return }
      setUserId(user.id)

      const { data: membership } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()

      if (membership) { router.replace('/dashboard'); return }
    }
    check()
  }, [router])

  // Auto-slug from name (only if user hasn't manually edited it)
  useEffect(() => {
    if (!slugEdited) setSlug(generateSlug(storeName))
  }, [storeName, slugEdited])

  function togglePlatform(id: string) {
    setPlatforms(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id])
  }

  async function handleFinish() {
    if (!userId) return
    if (platforms.length === 0) {
      setError('Selecione pelo menos uma plataforma para continuar.')
      return
    }

    setLoading(true)
    setError(null)

    const result = await createOrganization({
      name: storeName.trim(),
      slug,
      platforms,
    })

    if ('error' in result) {
      setError(result.error)
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  const canProceedStep1 = storeName.trim().length >= 2

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ background: '#09090b', fontFamily: 'system-ui, -apple-system, sans-serif' }}
    >
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img
            src="/logo.png"
            alt="e-Click Inteligência Comercial"
            style={{ width: '180px', mixBlendMode: 'screen' as const }}
          />
        </div>

        {/* Step bar */}
        <StepBar current={step} />

        {/* Card */}
        <div
          className="rounded-2xl border p-7"
          style={{ background: '#111114', borderColor: 'rgba(0,229,255,0.1)' }}
        >

          {/* ── STEP 1: store name ── */}
          {step === 1 && (
            <div>
              <div className="mb-6">
                <h1 className="text-white text-xl font-semibold">Como se chama sua loja?</h1>
                <p className="text-zinc-400 text-sm mt-1">
                  Esse nome identifica sua conta no e-Click.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                    Nome da loja / empresa
                  </label>
                  <input
                    type="text"
                    value={storeName}
                    onChange={e => setStoreName(e.target.value)}
                    placeholder="Ex: Minha Loja Oficial"
                    autoFocus
                    maxLength={80}
                    className="w-full px-4 py-3 rounded-lg text-white text-sm placeholder-zinc-600 border border-zinc-700 outline-none transition-all"
                    style={{ background: '#1c1c1f' }}
                    onFocus={e => { e.target.style.borderColor = '#00E5FF'; e.target.style.boxShadow = '0 0 0 1px #00E5FF30' }}
                    onBlur={e => { e.target.style.borderColor = '#3f3f46'; e.target.style.boxShadow = 'none' }}
                    onKeyDown={e => e.key === 'Enter' && canProceedStep1 && setStep(2)}
                  />
                </div>

                {/* Slug preview */}
                {slug && (
                  <div
                    className="rounded-lg px-4 py-3"
                    style={{ background: 'rgba(0,229,255,0.05)', border: '1px solid rgba(0,229,255,0.12)' }}
                  >
                    <p className="text-[11px] font-medium text-zinc-500 mb-1 uppercase tracking-widest">
                      Identificador
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500 text-xs">eclick.io/</span>
                      <input
                        type="text"
                        value={slug}
                        onChange={e => {
                          setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                          setSlugEdited(true)
                        }}
                        className="text-sm font-mono outline-none bg-transparent flex-1"
                        style={{ color: '#00E5FF' }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => setStep(2)}
                disabled={!canProceedStep1}
                className="w-full mt-6 py-3 rounded-lg font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ background: '#00E5FF', color: '#000' }}
              >
                Continuar
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
                </svg>
              </button>
            </div>
          )}

          {/* ── STEP 2: platforms ── */}
          {step === 2 && (
            <div>
              <div className="mb-6">
                <h1 className="text-white text-xl font-semibold">Onde você vende?</h1>
                <p className="text-zinc-400 text-sm mt-1">
                  Selecione as plataformas que você usa. Pode adicionar mais depois.
                </p>
              </div>

              {error && (
                <div
                  className="mb-5 px-4 py-3 rounded-lg border text-sm"
                  style={{ background: '#ff444420', borderColor: '#ff444440', color: '#ff8080' }}
                >
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5 mb-6">
                {PLATFORMS.map(p => (
                  <PlatformCard
                    key={p.id}
                    platform={p}
                    selected={platforms.includes(p.id)}
                    onToggle={() => togglePlatform(p.id)}
                  />
                ))}
              </div>

              {platforms.length > 0 && (
                <p className="text-center text-xs text-zinc-500 mb-4">
                  {platforms.length} plataforma{platforms.length > 1 ? 's' : ''} selecionada{platforms.length > 1 ? 's' : ''}
                </p>
              )}

              <button
                onClick={handleFinish}
                disabled={loading || platforms.length === 0}
                className="w-full py-3 rounded-lg font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ background: '#00E5FF', color: '#000' }}
              >
                {loading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Criando sua conta…
                  </>
                ) : (
                  <>
                    Criar minha conta
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                    </svg>
                  </>
                )}
              </button>

              <button
                onClick={() => { setStep(1); setError(null) }}
                disabled={loading}
                className="w-full mt-3 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ color: '#71717a' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#a1a1aa')}
                onMouseLeave={e => (e.currentTarget.style.color = '#71717a')}
              >
                ← Voltar
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-zinc-600 text-xs mt-6">
          Você pode editar essas informações depois em Configurações.
        </p>
      </div>
    </div>
  )
}
