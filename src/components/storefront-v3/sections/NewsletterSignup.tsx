'use client'

/**
 * NewsletterSignup — formulário funcional de inscrição da vitrine v3.
 *
 * Usado pela section `newsletter` (standard.tsx) e pelo rodapé
 * (siteFooter.showNewsletter). Faz POST no MESMO endpoint público de lead
 * do leadForm (POST /public/store/by-slug/:slug/lead) — o backend exige
 * `pipelineId`+`stageId` (destino no Active CRM) e `fields` com pelo menos
 * name|email|phone. A origem "newsletter" vai em formTitle + custom.
 *
 * Estados: enviando / sucesso ("Inscrito! ✓") / erro amigável.
 * Mobile-first: input full-width, touch >=44px, cores via CSS vars do tema.
 */

import { useState } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

export interface NewsletterDestination {
  pipelineId?: string
  stageId?:    string
  assignedTo?: string
}

export function NewsletterSignup({ slug, sectionId, placeholder, ctaLabel, successMessage, destination }: {
  slug:           string
  sectionId?:     string
  placeholder:    string
  ctaLabel:       string
  successMessage: string
  destination:    NewsletterDestination
}) {
  const [email, setEmail] = useState('')
  const [busy, setBusy]   = useState(false)
  const [done, setDone]   = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const value = email.trim().toLowerCase()
    if (!value) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`${BACKEND}/public/store/by-slug/${encodeURIComponent(slug)}/lead`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          sectionId,
          formTitle:  'Newsletter',
          pipelineId: destination.pipelineId,
          stageId:    destination.stageId,
          assignedTo: destination.assignedTo,
          fields: {
            email:  value,
            // Identificação de origem — vira custom_fields no Active CRM
            custom: { Origem: 'Newsletter da loja' },
          },
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setDone(true)
    } catch {
      // Erro genérico amigável (inclui loja sem funil configurado no editor)
      setError('Não foi possível concluir a inscrição. Tente novamente mais tarde.')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 4px',
        color: 'var(--c-success, #22c55e)', fontWeight: 600, fontSize: 15,
      }}>
        <CheckCircle2 size={18} /> {successMessage || 'Inscrito! ✓'}
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
      <input
        type="email" required placeholder={placeholder} aria-label="Email"
        inputMode="email" value={email} onChange={e => setEmail(e.target.value)}
        disabled={busy}
        style={{
          flex: 1, minWidth: 0, padding: '12px 16px', minHeight: 44,
          border: '1px solid var(--c-border)', borderRadius: 'var(--r)',
          background: 'var(--c-surface)', color: 'var(--c-text)',
          fontFamily: 'var(--f-body)', fontSize: 14,
        }}
      />
      <button type="submit" disabled={busy}
        style={{
          padding: '12px 24px', minHeight: 44,
          background: 'var(--c-primary)', color: 'var(--c-on-accent)',
          borderRadius: 'var(--r)', border: 'none', fontWeight: 500,
          cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
        {busy && <Loader2 size={14} className="animate-spin" />}
        {busy ? 'Enviando…' : ctaLabel}
      </button>
      {error && (
        <p role="alert" className="sm:basis-full" style={{ margin: 0, fontSize: 13, color: 'var(--c-error, #ef4444)' }}>
          {error}
        </p>
      )}
    </form>
  )
}
