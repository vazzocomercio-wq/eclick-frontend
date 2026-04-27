'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, Truck, Check, ScanLine } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

type Track = {
  ok: boolean
  channel?: string
  link?: { product_name?: string; order_id?: string; marketplace?: string } | null
  order?: {
    external_order_id?: string
    status?: string
    sold_at?: string
    sale_price?: number
    product_name?: string
  } | null
  error?: string
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  paid:       { label: 'Pagamento confirmado', color: '#4ade80' },
  processing: { label: 'Em separação',         color: '#facc15' },
  shipped:    { label: 'A caminho',            color: '#60a5fa' },
  delivered:  { label: 'Entregue',             color: '#4ade80' },
  cancelled:  { label: 'Cancelado',            color: '#f87171' },
}

export default function PublicRastreioPage() {
  const params = useParams<{ token: string }>()
  const token  = params?.token

  const [data, setData] = useState<Track | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [phone, setPhone] = useState('')
  const [name, setName]   = useState('')

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await fetch(`${BACKEND}/lb/${token}/track`)
      if (res.ok) setData(await res.json())
      else setData({ ok: false, error: 'Link inválido' })
    } catch { setData({ ok: false, error: 'Erro de conexão' }) }
    finally { setLoading(false) }
  }, [token])

  useEffect(() => { load() }, [load])

  async function optIn(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    setSubmitting(true)
    try {
      const res = await fetch(`${BACKEND}/lb/${token}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: name, phone, whatsapp: phone,
          consent_marketing: true, consent_whatsapp: true,
        }),
      })
      const v = await res.json().catch(() => ({}))
      if (v?.success) setDone(true)
    } finally { setSubmitting(false) }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-500">
        <Loader2 className="animate-spin" size={28} />
      </div>
    )
  }

  if (!data?.ok) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <p className="text-zinc-300 text-base">{data?.error ?? 'Link não encontrado'}</p>
      </div>
    )
  }

  const status = (data.order?.status ?? 'paid').toLowerCase()
  const stMeta = STATUS_LABEL[status] ?? { label: status, color: '#a1a1aa' }
  const productName = data.order?.product_name ?? data.link?.product_name ?? null

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-5">

        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(0,229,255,0.12)', color: '#00E5FF' }}>
            <Truck size={26} />
          </div>
          <h1 className="text-white text-xl font-semibold">Acompanhe seu pedido</h1>
        </div>

        {/* Order card */}
        <div className="rounded-2xl p-5 space-y-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
          {productName && (
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Produto</p>
              <p className="text-white text-sm font-medium">{productName}</p>
            </div>
          )}
          {data.order?.external_order_id && (
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Pedido</p>
              <p className="text-zinc-300 text-xs font-mono">{data.order.external_order_id}</p>
            </div>
          )}
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Status</p>
            <p className="text-sm font-semibold" style={{ color: stMeta.color }}>{stMeta.label}</p>
          </div>
        </div>

        {/* Opt-in for updates */}
        {done ? (
          <div className="text-center rounded-2xl p-6 space-y-3"
            style={{ background: '#111114', border: '1px solid #1e1e24' }}>
            <div className="w-12 h-12 mx-auto rounded-full flex items-center justify-center"
              style={{ background: 'rgba(74,222,128,0.15)' }}>
              <Check size={20} className="text-emerald-400" />
            </div>
            <p className="text-zinc-200 text-sm">Pronto! Você vai receber atualizações no WhatsApp.</p>
          </div>
        ) : (
          <form onSubmit={optIn} className="rounded-2xl p-5 space-y-3"
            style={{ background: '#111114', border: '1px solid #1e1e24' }}>
            <div className="flex items-center gap-2">
              <ScanLine size={14} className="text-cyan-400" />
              <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Receba atualizações no WhatsApp</p>
            </div>
            <input required placeholder="Seu nome" value={name} onChange={e => setName(e.target.value)}
              className="w-full bg-[#0c0c10] border border-[#27272a] text-zinc-200 text-sm rounded-lg px-3 py-2.5 outline-none focus:border-cyan-400" />
            <input required type="tel" placeholder="(11) 99999-9999" value={phone} onChange={e => setPhone(e.target.value)}
              className="w-full bg-[#0c0c10] border border-[#27272a] text-zinc-200 text-sm rounded-lg px-3 py-2.5 outline-none focus:border-cyan-400" />
            <button type="submit" disabled={submitting}
              className="w-full py-3 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-60"
              style={{ background: '#00E5FF', color: '#000' }}>
              {submitting ? 'Enviando…' : 'Quero receber'}
            </button>
            <p className="text-[10px] text-zinc-600 text-center">
              Você pode cancelar a qualquer momento. Dados protegidos pela LGPD.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
