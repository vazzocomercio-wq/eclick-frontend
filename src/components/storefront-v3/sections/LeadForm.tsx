'use client'

/**
 * LeadForm v3 — formulário editável de captação de leads na vitrine.
 *
 * Client Component (estado + submit). Os campos e o destino (funil do
 * Active) vêm de section.settings, configurados no Designer. Ao enviar,
 * faz POST /public/store/by-slug/:slug/lead → backend grava + empurra
 * pro Active CRM (contato + card no funil).
 *
 * Cores via CSS vars do tema (respeita override de tipografia da seção).
 * Mobile-first: campos full-width, touch >=44px.
 */

import { useState } from 'react'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import type { LeadFormSection } from '@/lib/storefront/v3/types'
import type { RenderCtx } from '../RenderCtx'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

export function LeadForm({ ctx, section }: { ctx: RenderCtx; section: LeadFormSection }) {
  const { title, description, fields, submitLabel, successMessage } = section.settings
  const enabledFields = (fields ?? []).filter(f => f.enabled)

  const [values, setValues] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (key: string, v: string) => setValues(prev => ({ ...prev, [key]: v }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    // valida obrigatórios
    for (const f of enabledFields) {
      if (f.required && !(values[f.key] ?? '').trim()) {
        setError(`Preencha: ${f.label}`)
        return
      }
    }
    // monta payload (campos padrão + custom)
    const std = { name: values.name, email: values.email, phone: values.phone, message: values.message }
    const custom: Record<string, string> = {}
    for (const f of enabledFields) {
      if (!['name', 'email', 'phone', 'message'].includes(f.key)) {
        const v = (values[f.key] ?? '').trim()
        if (v) custom[f.label] = v
      }
    }
    setBusy(true)
    try {
      const res = await fetch(`${BACKEND}/public/store/by-slug/${encodeURIComponent(ctx.slug)}/lead`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          sectionId:  section.id,
          formTitle:  title,
          pipelineId: section.settings.pipelineId,
          stageId:    section.settings.stageId,
          assignedTo: section.settings.assignedTo,
          fields: {
            name:    std.name?.trim() || undefined,
            email:   std.email?.trim() || undefined,
            phone:   std.phone?.trim() || undefined,
            message: std.message?.trim() || undefined,
            custom:  Object.keys(custom).length > 0 ? custom : undefined,
          },
        }),
      })
      if (!res.ok) {
        const e2 = await res.json().catch(() => null)
        throw new Error(e2?.message ?? `Erro ${res.status}`)
      }
      setDone(true)
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : 'Não foi possível enviar. Tente de novo.')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="container mx-auto px-4">
        <div style={{
          maxWidth: 560, margin: '0 auto', padding: 32, textAlign: 'center',
          background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 'var(--r)',
          color: 'var(--c-text)',
        }}>
          <CheckCircle2 size={40} style={{ color: 'var(--c-success, #22c55e)', margin: '0 auto 12px' }} />
          <p style={{ fontFamily: 'var(--f-heading)', fontSize: '1.25rem' }}>
            {successMessage || 'Recebemos seus dados! Em breve entramos em contato.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4">
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        {title && (
          <h2 style={{ fontFamily: 'var(--f-heading)', color: 'var(--c-text)', fontSize: '1.875rem', textAlign: 'center' }}>
            {title}
          </h2>
        )}
        {description && (
          <p style={{ color: 'var(--c-text-muted)', textAlign: 'center', marginTop: 8, marginBottom: 8, lineHeight: 1.5 }}>
            {description}
          </p>
        )}
        <form onSubmit={submit} style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {enabledFields.map(f => (
            <div key={f.key}>
              <label style={{ display: 'block', fontSize: 13, color: 'var(--c-text-muted)', marginBottom: 4 }}>
                {f.label}{f.required && ' *'}
              </label>
              {f.type === 'textarea' ? (
                <textarea
                  value={values[f.key] ?? ''} onChange={e => set(f.key, e.target.value)}
                  rows={4} required={f.required} disabled={busy}
                  style={inputStyle()} />
              ) : (
                <input
                  type={f.type} value={values[f.key] ?? ''} onChange={e => set(f.key, e.target.value)}
                  required={f.required} disabled={busy}
                  style={inputStyle()} />
              )}
            </div>
          ))}

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--c-error, #ef4444)', fontSize: 13 }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <button type="submit" disabled={busy}
            style={{
              marginTop: 4, padding: '14px 24px', minHeight: 48,
              background: 'var(--c-primary)', color: 'var(--c-on-accent)',
              border: 'none', borderRadius: 'var(--r)',
              fontWeight: 600, fontSize: 15, cursor: busy ? 'wait' : 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: busy ? 0.7 : 1,
            }}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : null}
            {busy ? 'Enviando…' : (submitLabel || 'Enviar')}
          </button>
        </form>
      </div>
    </div>
  )
}

function inputStyle(): React.CSSProperties {
  return {
    width: '100%', padding: '12px 14px', minHeight: 48,
    background: 'var(--c-bg)', color: 'var(--c-text)',
    border: '1px solid var(--c-border)', borderRadius: 'var(--r)',
    fontSize: 15, fontFamily: 'var(--f-body)', resize: 'vertical',
  }
}
