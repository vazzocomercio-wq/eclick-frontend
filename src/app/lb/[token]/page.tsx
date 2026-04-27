'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, Check, ScanLine, Shield, MessageCircle } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

type Meta = {
  ok: boolean
  channel?: 'rastreio' | 'garantia' | 'posvenda'
  order_id?: string | null
  product_name?: string | null
  marketplace?: string | null
  config?: {
    brand_color?: string
    brand_logo_url?: string | null
    rastreio_landing_title?: string | null
    rastreio_incentive_text?: string | null
    garantia_cupom_code?: string | null
    garantia_cupom_value?: number | null
    garantia_months?: number
    posvenda_thank_you_msg?: string | null
  }
  error?: string
}

const CHANNEL_TITLES: Record<string, string> = {
  rastreio: 'Acompanhe seu pedido',
  garantia: 'Ative sua garantia + cupom',
  posvenda: 'Obrigado pela compra!',
}

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  rastreio: <ScanLine size={28} />,
  garantia: <Shield size={28} />,
  posvenda: <MessageCircle size={28} />,
}

export default function PublicLeadBridgePage() {
  const params = useParams<{ token: string }>()
  const token  = params?.token

  const [meta, setMeta]       = useState<Meta | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone]       = useState<{ message: string } | null>(null)

  // Form state
  const [fullName, setFullName]   = useState('')
  const [phone,    setPhone]      = useState('')
  const [email,    setEmail]      = useState('')
  const [cpf,      setCpf]        = useState('')
  const [consMkt,  setConsMkt]    = useState(true)
  const [consWa,   setConsWa]     = useState(true)
  const [consCpf,  setConsCpf]    = useState(false)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await fetch(`${BACKEND}/lb/${token}`)
      if (res.ok) setMeta(await res.json())
      else setMeta({ ok: false, error: 'Link inválido ou expirado' })
    } catch {
      setMeta({ ok: false, error: 'Erro ao carregar página' })
    } finally { setLoading(false) }
  }, [token])

  useEffect(() => { load() }, [load])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    setSubmitting(true)
    try {
      const res = await fetch(`${BACKEND}/lb/${token}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName, phone, email, cpf,
          whatsapp: consWa ? phone : undefined,
          consent_marketing:  consMkt,
          consent_whatsapp:   consWa,
          consent_enrichment: consCpf,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (data?.success) setDone({ message: data.message ?? 'Recebemos seus dados!' })
      else setDone({ message: data?.message ?? 'Não conseguimos registrar — tente novamente.' })
    } catch {
      setDone({ message: 'Erro de conexão. Tente novamente.' })
    } finally { setSubmitting(false) }
  }

  // ── Render states ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-500">
        <Loader2 className="animate-spin" size={28} />
      </div>
    )
  }

  if (!meta?.ok) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <p className="text-zinc-300 text-base">{meta?.error ?? 'Link não encontrado'}</p>
          <p className="text-zinc-600 text-xs">Verifique o QR Code ou peça um novo ao vendedor.</p>
        </div>
      </div>
    )
  }

  const brandColor = meta.config?.brand_color ?? '#00E5FF'
  const channel    = meta.channel ?? 'posvenda'
  const title      = (channel === 'rastreio' && meta.config?.rastreio_landing_title)
                      ? meta.config.rastreio_landing_title
                      : CHANNEL_TITLES[channel]

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-4 rounded-3xl p-8"
          style={{ background: '#111114', border: '1px solid #1e1e24' }}>
          <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center"
            style={{ background: brandColor + '20' }}>
            <Check size={28} style={{ color: brandColor }} />
          </div>
          <h1 className="text-white text-xl font-semibold">Tudo certo!</h1>
          <p className="text-zinc-400 text-sm leading-relaxed">{done.message}</p>
          {channel === 'garantia' && meta.config?.garantia_cupom_code && (
            <div className="rounded-xl p-4" style={{ background: '#18181b', border: '1px dashed ' + brandColor }}>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Seu cupom</p>
              <p className="text-2xl font-bold tabular-nums" style={{ color: brandColor }}>{meta.config.garantia_cupom_code}</p>
              {meta.config.garantia_cupom_value && (
                <p className="text-xs text-zinc-400 mt-1">{meta.config.garantia_cupom_value}% de desconto</p>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full space-y-5">

        {/* Brand header */}
        <div className="text-center space-y-3">
          {meta.config?.brand_logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={meta.config.brand_logo_url} alt="" className="h-12 mx-auto" />
          ) : (
            <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center"
              style={{ background: brandColor + '20', color: brandColor }}>
              {CHANNEL_ICONS[channel]}
            </div>
          )}
          <h1 className="text-white text-xl font-semibold">{title}</h1>
          {meta.product_name && (
            <p className="text-zinc-500 text-xs">{meta.product_name}{meta.order_id ? ` · pedido ${meta.order_id}` : ''}</p>
          )}
          {channel === 'rastreio' && meta.config?.rastreio_incentive_text && (
            <p className="rounded-lg px-3 py-2 text-xs font-medium inline-block"
              style={{ background: brandColor + '15', color: brandColor }}>
              {meta.config.rastreio_incentive_text}
            </p>
          )}
          {channel === 'garantia' && (meta.config?.garantia_months ?? 0) > 0 && (
            <p className="rounded-lg px-3 py-2 text-xs font-medium inline-block"
              style={{ background: brandColor + '15', color: brandColor }}>
              Garantia estendida de {meta.config!.garantia_months} meses
            </p>
          )}
        </div>

        {/* Form */}
        <form onSubmit={submit} className="space-y-3 rounded-2xl p-5"
          style={{ background: '#111114', border: '1px solid #1e1e24' }}>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-zinc-400">Nome completo</label>
            <input required value={fullName} onChange={e => setFullName(e.target.value)}
              className="w-full bg-[#0c0c10] border border-[#27272a] text-zinc-200 text-sm rounded-lg px-3 py-2.5 outline-none focus:border-[var(--brand)]"
              style={{ '--brand': brandColor } as React.CSSProperties} />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-zinc-400">WhatsApp</label>
            <input required type="tel" inputMode="tel" placeholder="(11) 99999-9999"
              value={phone} onChange={e => setPhone(e.target.value)}
              className="w-full bg-[#0c0c10] border border-[#27272a] text-zinc-200 text-sm rounded-lg px-3 py-2.5 outline-none focus:border-[var(--brand)]"
              style={{ '--brand': brandColor } as React.CSSProperties} />
          </div>

          {channel !== 'rastreio' && (
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-zinc-400">E-mail</label>
              <input type="email" inputMode="email" placeholder="seu@email.com"
                value={email} onChange={e => setEmail(e.target.value)}
                className="w-full bg-[#0c0c10] border border-[#27272a] text-zinc-200 text-sm rounded-lg px-3 py-2.5 outline-none focus:border-[var(--brand)]"
                style={{ '--brand': brandColor } as React.CSSProperties} />
            </div>
          )}

          {channel === 'garantia' && (
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-zinc-400">CPF (para emitir o cupom)</label>
              <input inputMode="numeric" placeholder="000.000.000-00"
                value={cpf} onChange={e => setCpf(e.target.value)}
                className="w-full bg-[#0c0c10] border border-[#27272a] text-zinc-200 text-sm rounded-lg px-3 py-2.5 outline-none focus:border-[var(--brand)] font-mono"
                style={{ '--brand': brandColor } as React.CSSProperties} />
            </div>
          )}

          {/* Consents */}
          <div className="space-y-2 pt-1">
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={consWa} onChange={e => setConsWa(e.target.checked)}
                className="mt-0.5 accent-cyan-400" />
              <span className="text-[11px] text-zinc-400 leading-relaxed">
                Aceito receber atualizações e ofertas via <strong className="text-zinc-200">WhatsApp</strong>.
              </span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={consMkt} onChange={e => setConsMkt(e.target.checked)}
                className="mt-0.5 accent-cyan-400" />
              <span className="text-[11px] text-zinc-400 leading-relaxed">
                Aceito receber comunicações de marketing.
              </span>
            </label>
            {channel === 'garantia' && (
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={consCpf} onChange={e => setConsCpf(e.target.checked)}
                  className="mt-0.5 accent-cyan-400" />
                <span className="text-[11px] text-zinc-400 leading-relaxed">
                  Autorizo consulta dos meus dados públicos via CPF para personalizar a experiência.
                </span>
              </label>
            )}
          </div>

          <button type="submit" disabled={submitting}
            className="w-full py-3 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-60 mt-2"
            style={{ background: brandColor, color: '#000' }}>
            {submitting ? 'Enviando…' : 'Confirmar'}
          </button>

          <p className="text-[10px] text-zinc-600 text-center pt-1">
            Seus dados estão seguros e protegidos pela LGPD.
          </p>
        </form>
      </div>
    </div>
  )
}
