'use client'

/**
 * Captura de newsletter do blog. Variantes: footer, inline, sidebar, minimal.
 * POST → /public/blog/newsletter/signup (endpoint do backend = Sprint 3;
 * até lá o submit mostra erro amigável). O modal de exit-intent é Sprint 3.
 */
import { useState, useEffect, type FormEvent } from 'react'
import { ArrowRight, Loader2, CheckCircle2, Mail } from 'lucide-react'
import { C, BACKEND } from './tokens'

type Variant = 'footer' | 'inline' | 'sidebar' | 'minimal'

interface Props {
  variant?: Variant
  position?: 'top' | 'middle' | 'bottom'
  postSlug?: string
}

export function NewsletterSignup({ variant = 'footer', position, postSlug }: Props) {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [utm, setUtm] = useState<Record<string, string>>({})

  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search)
      const captured: Record<string, string> = {}
      for (const k of ['utm_source', 'utm_medium', 'utm_campaign']) {
        const v = p.get(k)
        if (v) captured[k.replace('utm_', '')] = v.slice(0, 120)
      }
      if (Object.keys(captured).length) setUtm(captured)
    } catch {
      /* ignore */
    }
  }, [])

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault()
    setError(null)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Email inválido.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`${BACKEND}/public/blog/newsletter/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          sourcePostSlug: postSlug,
          sourcePosition: variant + (position ? `-${position}` : ''),
          utm: Object.keys(utm).length ? utm : undefined,
        }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string }
        setError(body.message ?? 'Não foi possível inscrever agora. Tente de novo em instantes.')
        setSubmitting(false)
        return
      }
      setDone(true)
    } catch {
      setError('Falha de conexão. Tente de novo.')
      setSubmitting(false)
    }
  }

  const compact = variant === 'minimal'

  if (done) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '16px 18px', borderRadius: 12,
        background: 'rgba(74,222,128,0.07)', border: `1px solid ${C.GREEN}55`, color: C.TXT,
      }}>
        <CheckCircle2 size={20} color={C.GREEN} />
        <span style={{ fontSize: 14.5 }}>Inscrito! Você vai receber 1 email por semana com conteúdo de GEO.</span>
      </div>
    )
  }

  return (
    <div
      id={variant === 'footer' ? 'newsletter' : undefined}
      style={{
        padding: compact ? 0 : 'clamp(20px, 3vw, 28px)',
        borderRadius: 16,
        background: compact ? 'transparent' : 'linear-gradient(160deg, rgba(0,229,255,0.06), rgba(18,18,20,0.4))',
        border: compact ? 'none' : `1px solid ${C.BORDER}`,
      }}
    >
      {!compact && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.CYAN, fontWeight: 800, fontSize: 13, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            <Mail size={15} /> Newsletter
          </div>
          <h3 style={{ fontSize: variant === 'sidebar' ? 18 : 22, fontWeight: 800, letterSpacing: '-0.02em', margin: '10px 0 6px', color: C.TXT }}>
            GEO na sua caixa de entrada
          </h3>
          <p style={{ fontSize: 14, color: C.MUT, lineHeight: 1.55, margin: '0 0 16px' }}>
            1 email por semana · só conteúdo de GEO · sem spam.
          </p>
        </>
      )}
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: variant === 'sidebar' || compact ? 'column' : 'row', gap: 10, flexWrap: 'wrap' }}>
        <input
          type="email" inputMode="email" placeholder="seu@email.com" value={email}
          onChange={(e) => setEmail(e.target.value)} autoComplete="email"
          style={{
            flex: 1, minWidth: 0, background: C.INPUT, border: `1px solid ${C.BORDER_STRONG}`,
            borderRadius: 10, padding: '12px 14px', fontSize: 15, color: C.TXT, outline: 'none',
          }}
        />
        <button type="submit" disabled={submitting} style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          background: C.CYAN, color: '#04141a', border: 'none', borderRadius: 10,
          padding: '12px 18px', fontSize: 14.5, fontWeight: 800, cursor: submitting ? 'wait' : 'pointer',
          whiteSpace: 'nowrap',
        }}>
          {submitting ? <Loader2 size={16} className="bl-spin" /> : <>Inscrever <ArrowRight size={16} /></>}
        </button>
      </form>
      {error && <p style={{ color: C.RED, fontSize: 12.5, margin: '8px 0 0' }}>{error}</p>}
    </div>
  )
}
