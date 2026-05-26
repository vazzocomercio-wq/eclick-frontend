'use client'

/**
 * Formulário de captura da landing "Auditoria GEO Grátis".
 * Lead deixa nome completo + email + WhatsApp (obrigatórios) + URL pra auditar.
 * No submit: POST /public/audits/start → lead nasce no funil "Captação GEO"
 * e redirecionamos pra tela de loading (polling) → resultado.
 */

import { useState, useEffect, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Loader2, ShieldCheck, Sparkles } from 'lucide-react'

const BACKEND =
  process.env.NEXT_PUBLIC_BACKEND_URL ??
  'https://eclick-backend-production-2a87.up.railway.app'

const CYAN = '#00E5FF'
const GREEN = '#4ADE80'
const RED = '#f87171'

const CATEGORIES = [
  'Casa & Decoração', 'Iluminação', 'Móveis', 'Eletrônicos', 'Moda',
  'Beleza & Saúde', 'Esporte & Lazer', 'Ferramentas', 'Pet', 'Outra',
]

interface FieldErrors {
  url?: string; name?: string; email?: string; whatsapp?: string; lgpd?: string
}

function validate(v: {
  url: string; name: string; email: string; whatsapp: string; lgpd: boolean
}): FieldErrors {
  const e: FieldErrors = {}
  if (!/^https?:\/\/.+\..+/i.test(v.url.trim())) e.url = 'Cole um link válido (começando com http).'
  if (v.name.trim().length < 3 || !v.name.trim().includes(' ')) e.name = 'Informe nome e sobrenome.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) e.email = 'Email inválido.'
  const digits = v.whatsapp.replace(/\D/g, '')
  if (digits.length < 10 || digits.length > 13) e.whatsapp = 'WhatsApp com DDD (ex.: 11 91234-5678).'
  if (!v.lgpd) e.lgpd = 'Você precisa aceitar para continuar.'
  return e
}

/** Máscara leve de telefone BR pra exibição. */
function maskPhone(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

export function CaptureForm() {
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [category, setCategory] = useState('')
  const [lgpd, setLgpd] = useState(false)
  const [honeypot, setHoneypot] = useState('')   // anti-bot (invisível)

  const [utm, setUtm] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search)
      const captured: Record<string, string> = {}
      for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
        const val = p.get(k)
        if (val) captured[k.replace('utm_', '')] = val.slice(0, 120)
      }
      if (Object.keys(captured).length) setUtm(captured)
    } catch { /* ignore */ }
  }, [])

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault()
    setServerError(null)
    const e = validate({ url, name, email, whatsapp, lgpd })
    setErrors(e)
    if (Object.keys(e).length > 0) return

    setSubmitting(true)
    try {
      const res = await fetch(`${BACKEND}/public/audits/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(), name: name.trim(), email: email.trim(),
          whatsapp: whatsapp.replace(/\D/g, ''),
          category: category || undefined, lgpd, honeypot,
          utm: Object.keys(utm).length ? utm : undefined,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({} as { message?: string }))
        const msg = (body as { message?: string }).message
        setServerError(
          res.status === 429
            ? (msg ?? 'Você já fez algumas auditorias hoje. Tente novamente amanhã.')
            : (msg ?? 'Não foi possível iniciar a auditoria. Tente de novo em instantes.'),
        )
        setSubmitting(false)
        return
      }
      const ok = (await res.json().catch(() => null)) as { audit_id?: string } | null
      if (ok?.audit_id) { router.push(`/auditoria-gratis/loading/${ok.audit_id}`); return }
      setServerError('Não foi possível iniciar a auditoria. Tente de novo.')
      setSubmitting(false)
    } catch {
      setServerError('Falha de conexão. Verifique sua internet e tente de novo.')
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      style={{
        background: 'rgba(18,18,21,0.72)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 18,
        padding: 'clamp(20px, 3vw, 28px)',
        boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
      }}
    >
      <Field
        label="Link do seu anúncio ou loja"
        error={errors.url}
        input={
          <input
            type="url" inputMode="url" placeholder="https://produto.mercadolivre.com.br/..."
            value={url} onChange={(e) => setUrl(e.target.value)}
            aria-invalid={!!errors.url} style={inputStyle(!!errors.url)} autoComplete="url"
          />
        }
      />
      <Field
        label="Seu nome completo"
        error={errors.name}
        input={
          <input
            type="text" placeholder="Maria Silva" value={name}
            onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name}
            style={inputStyle(!!errors.name)} autoComplete="name"
          />
        }
      />
      <div className="au-two-col">
        <Field
          label="Email"
          error={errors.email}
          input={
            <input
              type="email" inputMode="email" placeholder="voce@email.com" value={email}
              onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email}
              style={inputStyle(!!errors.email)} autoComplete="email"
            />
          }
        />
        <Field
          label="WhatsApp"
          error={errors.whatsapp}
          input={
            <input
              type="tel" inputMode="tel" placeholder="(11) 91234-5678" value={whatsapp}
              onChange={(e) => setWhatsapp(maskPhone(e.target.value))} aria-invalid={!!errors.whatsapp}
              style={inputStyle(!!errors.whatsapp)} autoComplete="tel"
            />
          }
        />
      </div>
      <Field
        label="Categoria (opcional)"
        input={
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle(false)}>
            <option value="">Selecione…</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        }
      />

      {/* Honeypot anti-bot — invisível pra humanos, ignorado por leitores de tela */}
      <input
        type="text" name="empresa" tabIndex={-1} autoComplete="off" aria-hidden="true"
        value={honeypot} onChange={(e) => setHoneypot(e.target.value)}
        style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
      />

      <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', margin: '4px 0 18px', cursor: 'pointer' }}>
        <input
          type="checkbox" checked={lgpd} onChange={(e) => setLgpd(e.target.checked)}
          style={{ marginTop: 3, width: 16, height: 16, accentColor: CYAN, flexShrink: 0 }}
        />
        <span style={{ fontSize: 13, color: '#a1a1aa', lineHeight: 1.5 }}>
          Aceito receber a auditoria por email e WhatsApp e concordo com o tratamento dos meus
          dados conforme a <a href="https://eclick.app.br/privacidade" target="_blank" rel="noopener noreferrer" style={{ color: CYAN }}>política de privacidade</a> (LGPD).
        </span>
      </label>
      {errors.lgpd && <p style={errStyle}>{errors.lgpd}</p>}

      {serverError && (
        <div style={{
          background: 'rgba(239,68,68,0.10)', color: RED, border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 10, padding: '10px 12px', fontSize: 13, marginBottom: 14,
        }}>
          {serverError}
        </div>
      )}

      <button
        type="submit" disabled={submitting} className="submit-glow"
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          background: CYAN, color: '#04141a', border: 'none', borderRadius: 12,
          padding: '15px 20px', fontSize: 16, fontWeight: 800, letterSpacing: '0.01em',
          cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.8 : 1,
        }}
      >
        {submitting
          ? (<><Loader2 size={18} className="au-spin" /> Analisando…</>)
          : (<><Sparkles size={18} /> ANALISAR AGORA <ArrowRight size={18} /></>)}
      </button>

      <p style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        marginTop: 14, fontSize: 12.5, color: '#71717a',
      }}>
        <ShieldCheck size={14} color={GREEN} /> Sem cartão · Sem cadastro · Resultado por email e WhatsApp
      </p>
    </form>
  )
}

function Field({ label, error, input }: { label: string; error?: string; input: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#d4d4d8', marginBottom: 6 }}>
        {label}
      </label>
      {input}
      {error && <p style={errStyle}>{error}</p>}
    </div>
  )
}

function inputStyle(invalid: boolean): React.CSSProperties {
  return {
    width: '100%',
    background: '#0a0a0e',
    border: `1px solid ${invalid ? 'rgba(239,68,68,0.55)' : 'rgba(255,255,255,0.12)'}`,
    borderRadius: 10,
    padding: '12px 14px',
    fontSize: 15,
    color: '#fafafa',
    outline: 'none',
  }
}

const errStyle: React.CSSProperties = {
  color: '#f87171', fontSize: 12.5, margin: '6px 0 0',
}
