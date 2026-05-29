'use client'

import { useState } from 'react'
import { CheckCircle2, Loader2, Sparkles } from 'lucide-react'

/** F18 F4.3 — Página pública de self-signup do afiliado (opt-in LGPD).
 *  Sem auth. POST /shopee-affiliate/public/register. PT inline (landing BR,
 *  segue precedente das landings públicas do projeto). */

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL
  ?? process.env.NEXT_PUBLIC_API_URL
  ?? 'https://eclick-backend-production-2a87.up.railway.app'

const CYAN = '#00E5FF'
const SHOPEE = '#EE4D2D'

const NICHES = ['iluminacao', 'decoracao', 'casa', 'eletronicos', 'moda', 'beleza', 'pet', 'esporte', 'infantil', 'ferramentas']
const CHANNELS = [
  { key: 'instagram', label: 'Instagram' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'shopee_video', label: 'Shopee Video' },
  { key: 'shopee_live', label: 'Shopee Live' },
  { key: 'blog', label: 'Blog' },
]

export default function Page() {
  const [name, setName]       = useState('')
  const [email, setEmail]     = useState('')
  const [phone, setPhone]     = useState('')
  const [reach, setReach]     = useState(0)
  const [niches, setNiches]   = useState<string[]>([])
  const [channels, setChannels] = useState<string[]>([])
  const [waOptin, setWaOptin] = useState(true)
  const [consent, setConsent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [done, setDone]       = useState(false)

  const toggle = (arr: string[], set: (v: string[]) => void, val: string) =>
    set(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val])

  const submit = async () => {
    setError(null)
    if (!consent) { setError('Você precisa autorizar para entrar no diretório.'); return }
    if (!name.trim()) { setError('Informe seu nome.'); return }
    if (niches.length === 0) { setError('Escolha ao menos 1 nicho.'); return }
    if (channels.length === 0) { setError('Escolha ao menos 1 canal.'); return }
    setLoading(true)
    try {
      const res = await fetch(`${BACKEND}/shopee-affiliate/public/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: name, email, phone, reach_estimate: reach,
          niches, channels, whatsapp_optin: waOptin, consent_given: consent,
        }),
      })
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b?.message ?? `Erro ${res.status}`) }
      setDone(true)
    } catch (e) { setError((e as Error).message) } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#09090b' }}>
      <div className="w-full max-w-lg">
        {/* Brand */}
        <div className="flex items-center gap-3 mb-6 justify-center">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black" style={{ background: 'rgba(238,77,45,0.15)', color: SHOPEE }}>SH</div>
          <div>
            <h1 className="text-white text-xl font-bold">Seja Afiliado e-Click Shopee</h1>
            <p className="text-zinc-500 text-xs">Conecte-se a vendedores reais e ganhe comissão promovendo produtos que convertem.</p>
          </div>
        </div>

        {done ? (
          <div className="rounded-2xl p-8 text-center" style={{ background: '#111114', border: '1px solid #1a2e22' }}>
            <CheckCircle2 size={36} className="mx-auto text-emerald-400" />
            <h2 className="text-white font-semibold text-lg mt-3">Cadastro confirmado!</h2>
            <p className="text-zinc-400 text-sm mt-2 max-w-sm mx-auto">
              Você já está no diretório de afiliados. Vendedores com produtos do seu nicho podem te propor parcerias — você decide aceitar.
            </p>
            <div className="mt-4 inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full" style={{ background: `${CYAN}15`, color: CYAN }}>
              <Sparkles size={12} /> Ranqueado por fit real, não só comissão
            </div>
          </div>
        ) : (
          <div className="rounded-2xl p-6 space-y-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
            <Field label="Seu nome ou marca">
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Ju Decora"
                className="inp" style={inpStyle} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="E-mail"><input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="voce@email.com" className="inp" style={inpStyle} /></Field>
              <Field label="WhatsApp"><input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(11) 9...." className="inp" style={inpStyle} /></Field>
            </div>

            <Field label="Nichos que você cobre">
              <div className="flex flex-wrap gap-1.5">
                {NICHES.map(n => (
                  <button key={n} type="button" onClick={() => toggle(niches, setNiches, n)}
                    className="text-[11px] px-2.5 py-1 rounded-full transition-all capitalize"
                    style={chip(niches.includes(n), '#a78bfa')}>{n}</button>
                ))}
              </div>
            </Field>

            <Field label="Canais ativos">
              <div className="flex flex-wrap gap-1.5">
                {CHANNELS.map(c => (
                  <button key={c.key} type="button" onClick={() => toggle(channels, setChannels, c.key)}
                    className="text-[11px] px-2.5 py-1 rounded-full transition-all"
                    style={chip(channels.includes(c.key), CYAN)}>{c.label}</button>
                ))}
              </div>
            </Field>

            <Field label="Alcance estimado (seguidores/audiência total)">
              <input value={reach || ''} onChange={e => setReach(Math.max(0, Number(e.target.value) || 0))} type="number" placeholder="Ex: 25000" className="inp" style={inpStyle} />
            </Field>

            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={waOptin} onChange={e => setWaOptin(e.target.checked)} className="mt-0.5" style={{ accentColor: CYAN }} />
              <span className="text-[11px] text-zinc-400">Aceito receber propostas de parceria por WhatsApp.</span>
            </label>

            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-0.5" style={{ accentColor: SHOPEE }} />
              <span className="text-[11px] text-zinc-400">
                <span className="text-zinc-200 font-medium">Autorizo</span> meus dados a aparecerem no diretório de afiliados e-Click pra vendedores me proporem parcerias (LGPD — base legal: consentimento). Posso revogar a qualquer momento.
              </span>
            </label>

            {error && (
              <div className="rounded-lg p-2.5 text-xs" style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}>{error}</div>
            )}

            <button onClick={submit} disabled={loading || !consent}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-40"
              style={{ background: CYAN, color: '#08080a' }}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {loading ? 'Enviando…' : 'Entrar no diretório'}
            </button>
            <p className="text-[10px] text-zinc-600 text-center">Sem custo. Sem exclusividade. Você só aceita as parcerias que quiser.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-medium text-zinc-400 block mb-1.5">{label}</label>
      {children}
    </div>
  )
}

const inpStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 14,
  color: '#e4e4e7', background: '#0a0a0e', border: '1px solid #1e1e24', outline: 'none',
}

function chip(active: boolean, color: string): React.CSSProperties {
  return {
    background: active ? `${color}1f` : '#18181b',
    color: active ? color : '#a1a1aa',
    border: `1px solid ${active ? `${color}66` : '#27272a'}`,
  }
}
