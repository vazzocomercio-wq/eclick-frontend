'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { Settings, ScanLine, Shield, MessageCircle, Sparkles, Palette, Info } from 'lucide-react'

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

type Toast = { id: number; msg: string; type: 'ok' | 'err' }

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
  { id: 'ph3a',             label: 'PH3A DataBusca',
    key_format: 'email + senha (env PH3A_USER/PH3A_PASSWORD no Railway)',
    strength:   'Telefones rankeados (≥90), e-mails validados, score de crédito, dados sociodemográficos completos.' },
]

export default function LeadBridgeConfigPage() {
  const supabase = useMemo(() => createClient(), [])
  const [original, setOriginal]     = useState<Config | null>(null)
  const [c, setC]                   = useState<Config | null>(null)
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [dirtyFields, setDirty]     = useState<Set<string>>(new Set())
  const [toasts, setToasts]         = useState<Toast[]>([])

  function pushToast(msg: string, type: Toast['type'] = 'ok') {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, msg, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }

  /** Setter unificado — atualiza c + marca campo como dirty. Se valor
   * volta ao original, remove do dirty (assim "desfazer manual" também
   * limpa o badge). */
  function setField<K extends keyof Config>(key: K, value: Config[K]) {
    setC(prev => prev ? { ...prev, [key]: value } : prev)
    setDirty(prev => {
      const next = new Set(prev)
      if (original && JSON.stringify(original[key]) === JSON.stringify(value)) {
        next.delete(key as string)
      } else {
        next.add(key as string)
      }
      return next
    })
  }

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
          if (v) { setC(v); setOriginal(v) }
        } else {
          pushToast(`Falha ao carregar: ${res.status}`, 'err')
        }
      } catch (e: unknown) {
        pushToast(`Erro de rede: ${(e as Error)?.message ?? ''}`, 'err')
      } finally { setLoading(false) }
    })()
  }, [getHeaders])

  // beforeunload guard — avisa se sair com mudanças pendentes
  useEffect(() => {
    if (dirtyFields.size === 0) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = '' // exigido por alguns browsers
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirtyFields.size])

  async function save() {
    if (!c || !original || dirtyFields.size === 0) return
    setSaving(true)
    try {
      // Envia só o diff — backend faz Partial<Config> via PATCH /lead-bridge/config
      const diff: Partial<Config> = {}
      for (const k of dirtyFields) {
        const key = k as keyof Config
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(diff as any)[key] = c[key]
      }
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/lead-bridge/config`, {
        method: 'PATCH', headers, body: JSON.stringify(diff),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        pushToast(`Falha ao salvar: ${body?.message ?? body?.error ?? res.status}`, 'err')
        return
      }
      const updated = await res.json().catch(() => null)
      const fresh   = updated && typeof updated === 'object' ? updated as Config : c
      setC(fresh); setOriginal(fresh); setDirty(new Set())
      pushToast(`Configurações salvas (${dirtyFields.size} campo${dirtyFields.size === 1 ? '' : 's'})`, 'ok')
    } catch (e: unknown) {
      pushToast(`Erro de rede: ${(e as Error)?.message ?? ''}`, 'err')
    } finally { setSaving(false) }
  }

  function discard() {
    if (!original || dirtyFields.size === 0) return
    if (!confirm(`Descartar ${dirtyFields.size} alteração(ões) pendentes?`)) return
    setC(original); setDirty(new Set())
  }

  /** Testa credenciais do provedor selecionado SEM precisar salvar.
   * PH3A lê PH3A_USER/PH3A_PASSWORD direto do env do backend. */
  const [testing, setTesting] = useState(false)
  async function testProvider(code: string) {
    setTesting(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/enrichment/providers/${code}/test`, { method: 'POST', headers })
      const body = await res.json().catch(() => ({}))
      if (res.ok && body?.ok) {
        pushToast(`Teste OK: ${body.message ?? 'credenciais válidas'}`, 'ok')
      } else {
        pushToast(`Teste falhou: ${body?.message ?? body?.error ?? 'erro desconhecido'}`, 'err')
      }
    } catch (e: unknown) {
      pushToast(`Erro de rede: ${(e as Error)?.message ?? ''}`, 'err')
    } finally { setTesting(false) }
  }

  if (loading) return <div className="p-6 text-zinc-500 text-sm">Carregando…</div>
  if (!c)      return <div className="p-6 text-zinc-500 text-sm">Não foi possível carregar a configuração.</div>

  const dirtyCount = dirtyFields.size

  return (
    <div className="flex flex-col h-full" style={{ background: '#09090b' }}>
      {/* Header com indicador de status (sem botão salvar — vai pro footer) */}
      <div className="shrink-0 px-6 pt-6 pb-4 flex items-center justify-between gap-4 flex-wrap" style={{ borderBottom: '1px solid #1e1e24' }}>
        <div>
          <p className="text-zinc-500 text-xs font-medium uppercase tracking-widest">Lead Bridge</p>
          <h1 className="text-white text-xl font-semibold flex items-center gap-2"><Settings size={18} /> Configurações</h1>
        </div>
        <span className="text-xs font-medium px-3 py-1 rounded-full"
          style={dirtyCount > 0
            ? { background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }
            : { background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }}>
          {dirtyCount > 0 ? `● ${dirtyCount} alteração${dirtyCount === 1 ? '' : 'ões'} pendente${dirtyCount === 1 ? '' : 's'}` : '✓ Tudo salvo'}
        </span>
      </div>

      {/* Conteúdo scrollable + padding-bottom pra não cobrir com footer fixo */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-5 pb-24 max-w-4xl mx-auto">
          <Section icon={<ScanLine size={14} />} title="Canal: Rastreio (QR Code de pedido)">
            <Toggle label="Habilitar canal de rastreio" value={c.rastreio_enabled} onChange={v => setField('rastreio_enabled', v)} />
            <Field label="Título da landing">
              <input className={inp} value={c.rastreio_landing_title ?? ''} onChange={e => setField('rastreio_landing_title', e.target.value)} />
            </Field>
            <Field label="Incentivo (ex: '10% off na próxima compra')" hint="Aparece junto do form pra estimular conversão">
              <input className={inp} value={c.rastreio_incentive_text ?? ''} onChange={e => setField('rastreio_incentive_text', e.target.value)} />
            </Field>
          </Section>

          <Section icon={<Shield size={14} />} title="Canal: Garantia + Cupom">
            <Toggle label="Habilitar canal de garantia" value={c.garantia_enabled} onChange={v => setField('garantia_enabled', v)} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Código do cupom">
                <input className={inp} value={c.garantia_cupom_code ?? ''} onChange={e => setField('garantia_cupom_code', e.target.value)} />
              </Field>
              <Field label="Desconto (%)">
                <input type="number" className={inp + ' tabular-nums'}
                  value={c.garantia_cupom_value ?? ''} onChange={e => setField('garantia_cupom_value', e.target.value === '' ? null : Number(e.target.value))} />
              </Field>
              <Field label="Garantia estendida (meses)">
                <input type="number" className={inp + ' tabular-nums'}
                  value={c.garantia_months} onChange={e => setField('garantia_months', Number(e.target.value) || 0)} />
              </Field>
            </div>
          </Section>

          <Section icon={<MessageCircle size={14} />} title="Canal: Pós-venda">
            <Toggle label="Habilitar canal pós-venda" value={c.posvenda_enabled} onChange={v => setField('posvenda_enabled', v)} />
            <Field label="Mensagem de agradecimento" hint="Aparece após o cliente enviar o formulário">
              <textarea className={inp + ' min-h-[80px] resize-y'} value={c.posvenda_thank_you_msg ?? ''} onChange={e => setField('posvenda_thank_you_msg', e.target.value)} />
            </Field>
          </Section>

          <Section icon={<Sparkles size={14} />} title="Enriquecimento via CPF">
            <Toggle label="Habilitar enriquecimento" value={c.cpf_enrichment_enabled} onChange={v => setField('cpf_enrichment_enabled', v)} />
            {(() => {
              const sel = CPF_PROVIDERS.find(p => p.id === c.cpf_provider) ?? CPF_PROVIDERS[0]
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <label className="text-[11px] font-medium text-zinc-400">Provedor</label>
                      <span className="relative group cursor-help" tabIndex={0}>
                        <Info size={11} className="text-zinc-500 hover:text-cyan-400 transition-colors" />
                        <span
                          className="invisible group-hover:visible group-focus:visible opacity-0 group-hover:opacity-100 group-focus:opacity-100
                                     transition-opacity absolute z-20 left-1/2 -translate-x-1/2 top-full mt-1 w-72
                                     px-3 py-2 rounded-lg text-[11px] leading-relaxed text-zinc-200 pointer-events-none"
                          style={{ background: '#0c0c10', border: '1px solid #00E5FF', boxShadow: '0 6px 24px rgba(0,0,0,0.4)' }}>
                          <strong className="text-cyan-400 block mb-0.5">{sel.label}</strong>
                          {sel.strength}
                        </span>
                      </span>
                    </div>
                    <select className={inp} value={c.cpf_provider}
                      onChange={e => setField('cpf_provider', e.target.value)}>
                      {CPF_PROVIDERS.map(p => (
                        <option key={p.id} value={p.id}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                  <Field label="API Key" hint={`Formato: ${sel.key_format}`}>
                    <input type="password" className={inp + ' font-mono'}
                      value={c.cpf_api_key ?? ''}
                      onChange={e => setField('cpf_api_key', e.target.value)}
                      placeholder={sel.id === 'ph3a' ? '(usa env PH3A_USER + PH3A_PASSWORD)' : ''}
                      disabled={sel.id === 'ph3a'}
                    />
                  </Field>
                </div>
              )
            })()}

            {/* Botão Testar — funciona inline sem salvar (env-driven pra PH3A) */}
            {c.cpf_enrichment_enabled && (
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => testProvider(c.cpf_provider === 'directd' ? 'directdata' : c.cpf_provider === 'hubdesenvolvedor' ? 'hubdev' : c.cpf_provider)}
                  disabled={testing}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border disabled:opacity-50"
                  style={{ borderColor: '#00E5FF', color: '#00E5FF', background: 'rgba(0,229,255,0.05)' }}
                >
                  {testing ? 'Testando…' : '🔍 Testar credenciais'}
                </button>
                <p className="text-zinc-500 text-[11px]">
                  Não precisa salvar antes — testa direto no provedor.
                </p>
              </div>
            )}
          </Section>

          <Section icon={<MessageCircle size={14} />} title="WhatsApp automático">
            <Toggle label="Enviar mensagem de boas-vindas após captura" value={c.whatsapp_auto_message_enabled} onChange={v => setField('whatsapp_auto_message_enabled', v)} />
            <Field label="Template de boas-vindas" hint="Suporta {{nome}} e {{first_name}}">
              <textarea className={inp + ' min-h-[80px] resize-y'} placeholder="Olá {{first_name}}, recebemos seus dados! 🎉"
                value={c.whatsapp_welcome_template ?? ''} onChange={e => setField('whatsapp_welcome_template', e.target.value)} />
            </Field>
          </Section>

          <Section icon={<Palette size={14} />} title="Branding">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Cor da marca (hex)">
                <div className="flex items-center gap-2">
                  <input type="color" value={c.brand_color}
                    onChange={e => setField('brand_color', e.target.value)}
                    className="w-10 h-10 rounded-lg border border-[#27272a] bg-[#0c0c10] cursor-pointer" />
                  <input className={inp + ' font-mono'} value={c.brand_color} onChange={e => setField('brand_color', e.target.value)} />
                </div>
              </Field>
              <Field label="URL do logo">
                <input className={inp} value={c.brand_logo_url ?? ''} onChange={e => setField('brand_logo_url', e.target.value)} placeholder="https://..." />
              </Field>
            </div>
          </Section>
        </div>
      </div>

      {/* Footer fixo de salvar — sempre visível, similar a /pricing/configuracao */}
      <div
        className="shrink-0 px-6 py-4 flex items-center justify-between gap-3 flex-wrap"
        style={{
          background: '#0a0a0e',
          borderTop: `1px solid ${dirtyCount > 0 ? '#00E5FF40' : '#1e1e24'}`,
          boxShadow: dirtyCount > 0 ? '0 -4px 24px rgba(0,229,255,0.1)' : 'none',
        }}
      >
        <p className="text-zinc-500 text-xs">
          {dirtyCount > 0
            ? <>Você tem <span className="text-amber-400 font-semibold">{dirtyCount} alteração{dirtyCount === 1 ? '' : 'ões'}</span> não salva{dirtyCount === 1 ? '' : 's'}. Clique em &quot;Salvar&quot; pra persistir no servidor.</>
            : 'Nenhuma alteração pendente.'}
        </p>
        <div className="flex gap-2">
          {dirtyCount > 0 && (
            <button
              onClick={discard}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-medium border disabled:opacity-50"
              style={{ borderColor: '#3f3f46', color: '#a1a1aa', background: 'transparent' }}
            >
              Descartar
            </button>
          )}
          <button
            onClick={save}
            disabled={saving || dirtyCount === 0}
            className="px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
            style={{ background: '#00E5FF', color: '#08323b' }}
          >
            {saving ? 'Salvando…' : `Salvar alterações${dirtyCount > 0 ? ` (${dirtyCount})` : ''}`}
          </button>
        </div>
      </div>

      {/* Toasts */}
      <div className="fixed bottom-20 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id}
            className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium shadow-2xl pointer-events-auto"
            style={{
              background: t.type === 'ok' ? '#111114' : '#1a0a0a',
              border: `1px solid ${t.type === 'ok' ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`,
              color:  t.type === 'ok' ? '#34d399' : '#f87171',
            }}>
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  )
}
