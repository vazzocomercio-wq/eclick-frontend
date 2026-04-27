'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { Save, Settings, ScanLine, Shield, MessageCircle, Sparkles, Palette, Info } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

type Config = {
  rastreio_enabled: boolean
  rastreio_landing_title: string | null
  rastreio_incentive_text: string | null
  garantia_enabled: boolean
  garantia_cupom_code: string | null
  garantia_cupom_value: number | null
  garantia_months: number
  posvenda_enabled: boolean
  posvenda_thank_you_msg: string | null
  cpf_enrichment_enabled: boolean
  cpf_provider: string
  cpf_api_key: string | null
  whatsapp_auto_message_enabled: boolean
  whatsapp_welcome_template: string | null
  brand_color: string
  brand_logo_url: string | null
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5 space-y-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <div className="flex items-center gap-2">
        <span className="text-cyan-400">{icon}</span>
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">{title}</h3>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer">
      <span className="text-xs text-zinc-300">{label}</span>
      <button onClick={() => onChange(!value)} type="button"
        className="relative w-9 h-5 rounded-full transition-colors"
        style={{ background: value ? '#00E5FF' : '#27272a' }}>
        <span className="absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform"
          style={{ left: value ? 18 : 2 }} />
      </button>
    </label>
  )
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-medium text-zinc-400">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-zinc-600">{hint}</p>}
    </div>
  )
}

const inp = 'w-full bg-[#0c0c10] border border-[#27272a] text-zinc-200 text-sm rounded-lg px-3 py-2 outline-none focus:border-[#00E5FF]'

const CPF_PROVIDERS: Array<{ id: string; label: string; key_format: string; strength: string }> = [
  { id: 'bigdatacorp',      label: 'Big Data Corp',
    key_format: 'AccessToken:TokenId',
    strength:   'Sociodemográficos, score de crédito, vínculos familiares e empresariais.' },
  { id: 'directd',          label: 'Direct Data',
    key_format: 'token único',
    strength:   '300+ fontes consolidadas, 5000+ atributos, foco em compliance/KYC.' },
  { id: 'datastone',        label: 'Data Stone',
    key_format: 'Bearer JWT (token completo)',
    strength:   'Waterfall Enrichment — consulta cascata, telefone/WhatsApp atualizado.' },
  { id: 'assertiva',        label: 'Assertiva Soluções',
    key_format: 'client_id:client_secret',
    strength:   'Localização, telefone e endereço atualizados (recuperação de contato).' },
  { id: 'hubdesenvolvedor', label: 'Hub do Desenvolvedor',
    key_format: 'token único',
    strength:   'Barato, ideal para baixo volume e MVPs.' },
]

export default function LeadBridgeConfigPage() {
  const supabase = useMemo(() => createClient(), [])
  const [c, setC] = useState<Config | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const getHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return {
      Authorization: `Bearer ${session?.access_token ?? ''}`,
      'Content-Type': 'application/json',
    }
  }, [supabase])

  useEffect(() => {
    (async () => {
      try {
        const headers = await getHeaders()
        const res = await fetch(`${BACKEND}/lead-bridge/config`, { headers })
        if (res.ok) {
          const v = await res.json()
          if (v) setC(v)
        }
      } finally { setLoading(false) }
    })()
  }, [getHeaders])

  async function save() {
    if (!c) return
    setSaving(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/lead-bridge/config`, {
        method: 'PATCH', headers, body: JSON.stringify(c),
      })
      if (res.ok) setSavedAt(Date.now())
    } finally { setSaving(false) }
  }

  if (loading) return <div className="p-6 text-zinc-500 text-sm">Carregando…</div>
  if (!c) return <div className="p-6 text-zinc-500 text-sm">Não foi possível carregar a configuração.</div>

  return (
    <div className="p-6 space-y-5 min-h-full" style={{ background: '#09090b' }}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-zinc-500 text-xs font-medium uppercase tracking-widest">Lead Bridge</p>
          <h1 className="text-white text-xl font-semibold flex items-center gap-2"><Settings size={18} /> Configurações</h1>
        </div>
        <button onClick={save} disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-60"
          style={{ background: '#00E5FF', color: '#000' }}>
          <Save size={12} />
          {saving ? 'Salvando…' : savedAt ? 'Salvo ✓' : 'Salvar'}
        </button>
      </div>

      <Section icon={<ScanLine size={14} />} title="Canal: Rastreio (QR Code de pedido)">
        <Toggle label="Habilitar canal de rastreio" value={c.rastreio_enabled} onChange={v => setC({ ...c, rastreio_enabled: v })} />
        <Field label="Título da landing">
          <input className={inp} value={c.rastreio_landing_title ?? ''} onChange={e => setC({ ...c, rastreio_landing_title: e.target.value })} />
        </Field>
        <Field label="Incentivo (ex: '10% off na próxima compra')" hint="Aparece junto do form pra estimular conversão">
          <input className={inp} value={c.rastreio_incentive_text ?? ''} onChange={e => setC({ ...c, rastreio_incentive_text: e.target.value })} />
        </Field>
      </Section>

      <Section icon={<Shield size={14} />} title="Canal: Garantia + Cupom">
        <Toggle label="Habilitar canal de garantia" value={c.garantia_enabled} onChange={v => setC({ ...c, garantia_enabled: v })} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Código do cupom">
            <input className={inp} value={c.garantia_cupom_code ?? ''} onChange={e => setC({ ...c, garantia_cupom_code: e.target.value })} />
          </Field>
          <Field label="Desconto (%)">
            <input type="number" className={inp + ' tabular-nums'}
              value={c.garantia_cupom_value ?? ''} onChange={e => setC({ ...c, garantia_cupom_value: e.target.value === '' ? null : Number(e.target.value) })} />
          </Field>
          <Field label="Garantia estendida (meses)">
            <input type="number" className={inp + ' tabular-nums'}
              value={c.garantia_months} onChange={e => setC({ ...c, garantia_months: Number(e.target.value) || 0 })} />
          </Field>
        </div>
      </Section>

      <Section icon={<MessageCircle size={14} />} title="Canal: Pós-venda">
        <Toggle label="Habilitar canal pós-venda" value={c.posvenda_enabled} onChange={v => setC({ ...c, posvenda_enabled: v })} />
        <Field label="Mensagem de agradecimento" hint="Aparece após o cliente enviar o formulário">
          <textarea className={inp + ' min-h-[80px] resize-y'} value={c.posvenda_thank_you_msg ?? ''} onChange={e => setC({ ...c, posvenda_thank_you_msg: e.target.value })} />
        </Field>
      </Section>

      <Section icon={<Sparkles size={14} />} title="Enriquecimento via CPF">
        <Toggle label="Habilitar enriquecimento" value={c.cpf_enrichment_enabled} onChange={v => setC({ ...c, cpf_enrichment_enabled: v })} />
        {(() => {
          const sel = CPF_PROVIDERS.find(p => p.id === c.cpf_provider) ?? CPF_PROVIDERS[0]
          return (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Provedor">
                  <select className={inp} value={c.cpf_provider}
                    onChange={e => setC({ ...c, cpf_provider: e.target.value })}>
                    {CPF_PROVIDERS.map(p => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="API Key" hint={`Formato: ${sel.key_format}`}>
                  <input type="password" className={inp + ' font-mono'}
                    value={c.cpf_api_key ?? ''}
                    onChange={e => setC({ ...c, cpf_api_key: e.target.value })} />
                </Field>
              </div>
              <div className="flex items-start gap-2 px-3 py-2 rounded-lg"
                style={{ background: 'rgba(0,229,255,0.06)', border: '1px solid rgba(0,229,255,0.18)' }}>
                <Info size={12} className="text-cyan-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-zinc-300 leading-relaxed">
                  <strong className="text-zinc-100">{sel.label}:</strong> {sel.strength}
                </p>
              </div>
            </>
          )
        })()}
      </Section>

      <Section icon={<MessageCircle size={14} />} title="WhatsApp automático">
        <Toggle label="Enviar mensagem de boas-vindas após captura" value={c.whatsapp_auto_message_enabled} onChange={v => setC({ ...c, whatsapp_auto_message_enabled: v })} />
        <Field label="Template de boas-vindas" hint="Suporta {{nome}} e {{first_name}}">
          <textarea className={inp + ' min-h-[80px] resize-y'} placeholder="Olá {{first_name}}, recebemos seus dados! 🎉"
            value={c.whatsapp_welcome_template ?? ''} onChange={e => setC({ ...c, whatsapp_welcome_template: e.target.value })} />
        </Field>
      </Section>

      <Section icon={<Palette size={14} />} title="Branding">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Cor da marca (hex)">
            <div className="flex items-center gap-2">
              <input type="color" value={c.brand_color}
                onChange={e => setC({ ...c, brand_color: e.target.value })}
                className="w-10 h-10 rounded-lg border border-[#27272a] bg-[#0c0c10] cursor-pointer" />
              <input className={inp + ' font-mono'} value={c.brand_color} onChange={e => setC({ ...c, brand_color: e.target.value })} />
            </div>
          </Field>
          <Field label="URL do logo">
            <input className={inp} value={c.brand_logo_url ?? ''} onChange={e => setC({ ...c, brand_logo_url: e.target.value })} placeholder="https://..." />
          </Field>
        </div>
      </Section>
    </div>
  )
}
