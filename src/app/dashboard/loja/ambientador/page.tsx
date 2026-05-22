'use client'

/**
 * Ambientador IA — admin UI da Loja Própria (AH5).
 *
 * O lojista liga/desliga o recurso "Veja no seu ambiente", configura o
 * funil de atendimento + cupom + nº de créditos + prompt extra, vê os
 * clientes (e concede créditos extras) e a galeria de ambientações geradas.
 *
 * Endpoints:
 *   GET  /storefront-visualizer
 *   PUT  /storefront-visualizer/settings
 *   POST /storefront-visualizer/customers/:id/grant-credits  { amount }
 *   (funil: /products/active-config/{pipelines,pipelines/:id/stages,agents})
 */

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import {
  Sparkles, Loader2, ChevronLeft, AlertCircle, Save, Users, ImageIcon,
  Send, Gift, Phone, CheckCircle2, Clock,
} from 'lucide-react'
import { useAlert, usePrompt } from '@/components/ui/dialog-provider'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

interface Settings {
  enabled?: boolean
  button_label?: string
  coupon_code?: string
  default_generations?: number
  daily_cost_cap_usd?: number
  prompt_extra?: string
  pipeline_id?: string
  stage_id?: string
  assigned_to?: string
}
interface Customer {
  id: string; name: string | null; email: string | null; phone: string
  whatsapp_validated: boolean; generations_allowed: number; generations_used: number
  last_renewed_at: string | null; created_at: string
}
interface Generation {
  id: string; product_name: string | null; scene_image_url: string
  output_urls: string[]; status: string; whatsapp_sent: boolean; created_at: string
}
interface Pipeline { id: string; name: string; is_default: boolean }
interface Stage { id: string; name: string }
interface Agent { member_id: string; display_name: string | null }

export default function AmbientadorPage() {
  const [settings, setSettings] = useState<Settings>({})
  const [stats, setStats] = useState<{ customers: number; generations: number; whatsappSent: number } | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [generations, setGenerations] = useState<Generation[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const showAlert = useAlert()
  const showPrompt = usePrompt()

  const fetchToken = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token
  }, [])

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const token = await fetchToken()
      const res = await fetch(`${BACKEND}/storefront-visualizer`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const d = await res.json()
      setSettings(d.settings ?? {})
      setStats(d.stats ?? null)
      setCustomers(d.customers ?? [])
      setGenerations(d.generations ?? [])
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }, [fetchToken])

  useEffect(() => { void load() }, [load])

  const save = async () => {
    setSaving(true); setError(null)
    try {
      const token = await fetchToken()
      const res = await fetch(`${BACKEND}/storefront-visualizer/settings`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(settings),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const d = await res.json()
      setSettings(d)
      await showAlert({ message: 'Configurações salvas!', variant: 'info' })
    } catch (e) { await showAlert({ message: (e as Error).message, variant: 'danger' }) }
    finally { setSaving(false) }
  }

  const grant = async (c: Customer) => {
    const amount = await showPrompt({ message: `Quantas gerações conceder a ${c.name ?? c.phone}?`, defaultValue: '3' })
    if (!amount) return
    const n = Number(amount)
    if (!Number.isFinite(n) || n <= 0) { await showAlert({ message: 'Quantidade inválida.', variant: 'warning' }); return }
    try {
      const token = await fetchToken()
      const res = await fetch(`${BACKEND}/storefront-visualizer/customers/${c.id}/grant-credits`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: n }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await load()
    } catch (e) { await showAlert({ message: (e as Error).message, variant: 'danger' }) }
  }

  const set = (patch: Partial<Settings>) => setSettings(s => ({ ...s, ...patch }))

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-5">
      <div>
        <Link href="/dashboard/loja" className="text-xs text-zinc-500 hover:text-cyan-400 inline-flex items-center gap-1 mb-2">
          <ChevronLeft size={12} /> Voltar pro hub
        </Link>
        <h1 className="text-white text-3xl font-semibold flex items-center gap-2">
          <Sparkles size={24} /> Ambientador IA
        </h1>
        <p className="text-xs text-zinc-500 mt-1">
          O cliente fotografa o ambiente e a IA mostra seu produto no espaço dele · vira contato + card no Active
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
          <p className="text-sm text-red-400 flex items-center gap-2"><AlertCircle size={14} /> {error}</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-zinc-500"><Loader2 className="animate-spin inline-block" size={20} /></div>
      ) : (
        <>
          {stats && (
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard icon={<Users size={16} />} label="Clientes" value={stats.customers} color="#06b6d4" />
              <StatCard icon={<ImageIcon size={16} />} label="Ambientações geradas" value={stats.generations} color="#22c55e" />
              <StatCard icon={<Send size={16} />} label="Enviadas no WhatsApp" value={stats.whatsappSent} color="#a78bfa" />
            </div>
          )}

          {/* Config */}
          <div className="rounded-lg p-5 space-y-4" style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
            <div className="flex items-center justify-between">
              <h2 className="text-white font-semibold">Configuração</h2>
              <label className="inline-flex items-center gap-2 text-sm" style={{ color: '#a1a1aa' }}>
                <input type="checkbox" checked={settings.enabled ?? false} onChange={e => set({ enabled: e.target.checked })} />
                {settings.enabled ? 'Ativo na vitrine' : 'Desativado'}
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Texto do botão" hint="Aparece no detalhe do produto.">
                <Input value={settings.button_label ?? ''} onChange={v => set({ button_label: v })} placeholder="Veja no seu ambiente" />
              </Field>
              <Field label="Gerações por cliente" hint="Cada geração cria 2 imagens.">
                <Input type="number" value={String(settings.default_generations ?? 3)} onChange={v => set({ default_generations: Number(v) })} />
              </Field>
              <Field label="Teto de custo por dia (US$)" hint="Limite de gasto com IA por dia. Atingiu, pausa até amanhã.">
                <Input type="number" value={String(settings.daily_cost_cap_usd ?? 15)} onChange={v => set({ daily_cost_cap_usd: Number(v) })} />
              </Field>
              <Field label="Cupom de incentivo" hint="Enviado junto das imagens no WhatsApp.">
                <Input value={settings.coupon_code ?? ''} onChange={v => set({ coupon_code: v })} placeholder="(opcional) ex: AMBIENTE10" />
              </Field>
              <FunnelPicker settings={settings} onChange={set} fetchToken={fetchToken} />
              <Field label="Instrução extra pra IA" hint="Opcional. Ex: 'priorize iluminação quente'." full>
                <Textarea value={settings.prompt_extra ?? ''} onChange={v => set({ prompt_extra: v })} />
              </Field>
            </div>

            <button onClick={save} disabled={saving}
              className="text-sm font-semibold px-4 py-2.5 rounded inline-flex items-center gap-2 disabled:opacity-50"
              style={{ background: '#00E5FF', color: '#0a0a0e', minHeight: 40 }}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar configuração
            </button>
          </div>

          {/* Clientes */}
          <div className="rounded-lg p-5" style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
            <h2 className="text-white font-semibold mb-3 flex items-center gap-2"><Users size={16} /> Clientes ({customers.length})</h2>
            {customers.length === 0 ? (
              <p className="text-sm text-zinc-500">Nenhum cliente ainda.</p>
            ) : (
              <div className="space-y-2">
                {customers.map(c => {
                  const left = Math.max(0, c.generations_allowed - c.generations_used)
                  return (
                    <div key={c.id} className="flex items-center justify-between gap-3 flex-wrap p-2.5 rounded" style={{ background: '#18181b' }}>
                      <div className="min-w-0">
                        <div className="text-sm text-white font-medium flex items-center gap-2">
                          {c.name ?? 'Sem nome'}
                          {c.whatsapp_validated
                            ? <CheckCircle2 size={12} style={{ color: '#22c55e' }} />
                            : <Clock size={12} style={{ color: '#eab308' }} />}
                        </div>
                        <div className="text-xs flex items-center gap-2" style={{ color: '#71717a' }}>
                          <Phone size={10} /> {c.phone}{c.email ? ` · ${c.email}` : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs" style={{ color: left > 0 ? '#22c55e' : '#ef4444' }}>
                          {left}/{c.generations_allowed} restantes
                        </span>
                        <button onClick={() => grant(c)}
                          className="text-xs font-semibold px-2.5 py-1.5 rounded inline-flex items-center gap-1"
                          style={{ background: 'rgba(0,229,255,0.1)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.3)', minHeight: 32 }}>
                          <Gift size={11} /> Dar créditos
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Galeria */}
          <div className="rounded-lg p-5" style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
            <h2 className="text-white font-semibold mb-3 flex items-center gap-2"><ImageIcon size={16} /> Ambientações recentes</h2>
            {generations.length === 0 ? (
              <p className="text-sm text-zinc-500">Nenhuma ambientação gerada ainda.</p>
            ) : (
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
                {generations.map(g => (
                  <div key={g.id} className="rounded overflow-hidden" style={{ background: '#18181b', border: '1px solid #27272a' }}>
                    <div className="grid grid-cols-2 gap-px" style={{ background: '#27272a' }}>
                      {(g.output_urls ?? []).slice(0, 2).map((u, i) => (
                        <a key={i} href={u} target="_blank" rel="noopener noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={u} alt="Ambientação" style={{ width: '100%', height: 90, objectFit: 'cover', display: 'block' }} />
                        </a>
                      ))}
                    </div>
                    <div className="p-2">
                      <div className="text-xs text-white truncate">{g.product_name ?? 'Produto'}</div>
                      <div className="text-[10px] flex items-center gap-1 mt-0.5" style={{ color: g.whatsapp_sent ? '#22c55e' : '#71717a' }}>
                        {g.whatsapp_sent ? <><Send size={9} /> enviado</> : 'não enviado'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg p-4" style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
      <p className="text-xs uppercase tracking-wide font-medium flex items-center gap-1.5" style={{ color: '#71717a' }}>
        <span style={{ color }}>{icon}</span> {label}
      </p>
      <p className="text-2xl font-bold mt-1" style={{ color }}>{value}</p>
    </div>
  )
}

function Field({ label, hint, full, children }: { label: string; hint?: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <label className="block text-xs font-medium mb-1" style={{ color: '#a1a1aa' }}>{label}</label>
      {children}
      {hint && <p className="text-[11px] mt-1" style={{ color: '#52525b' }}>{hint}</p>}
    </div>
  )
}
function Input({ value, onChange, placeholder, type = 'text' }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} type={type}
    className="w-full text-sm" style={{ padding: '9px 11px', minHeight: 38, background: '#18181b', color: '#fafafa', border: '1px solid #27272a', borderRadius: 6 }} />
}
function Textarea({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <textarea value={value} onChange={e => onChange(e.target.value)} rows={2}
    className="w-full text-sm" style={{ padding: '9px 11px', background: '#18181b', color: '#fafafa', border: '1px solid #27272a', borderRadius: 6, resize: 'vertical' }} />
}

function FunnelPicker({ settings, onChange, fetchToken }: {
  settings: Settings; onChange: (p: Partial<Settings>) => void; fetchToken: () => Promise<string | undefined>
}) {
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [stages, setStages] = useState<Stage[]>([])
  const [agents, setAgents] = useState<Agent[]>([])

  const getJson = useCallback(async <T,>(path: string): Promise<T | null> => {
    try {
      const t = await fetchToken()
      const res = await fetch(`${BACKEND}${path}`, { headers: { Authorization: `Bearer ${t}` } })
      if (!res.ok) return null
      return await res.json() as T
    } catch { return null }
  }, [fetchToken])

  useEffect(() => {
    void (async () => {
      const [pl, ag] = await Promise.all([getJson<Pipeline[]>('/products/active-config/pipelines'), getJson<Agent[]>('/products/active-config/agents')])
      setPipelines(pl ?? []); setAgents(ag ?? [])
    })()
  }, [getJson])

  useEffect(() => {
    if (!settings.pipeline_id) { setStages([]); return }
    void (async () => setStages((await getJson<Stage[]>(`/products/active-config/pipelines/${settings.pipeline_id}/stages`)) ?? []))()
  }, [settings.pipeline_id, getJson])

  return (
    <Field label="Funil de atendimento" hint="Vazio = cria/usa o funil padrão 'Atendimento da Loja'.">
      <select value={settings.pipeline_id ?? ''} onChange={e => onChange({ pipeline_id: e.target.value || undefined, stage_id: undefined })}
        className="w-full text-sm" style={{ padding: '9px 11px', minHeight: 38, background: '#18181b', color: '#fafafa', border: '1px solid #27272a', borderRadius: 6 }}>
        <option value="">Funil padrão (automático)</option>
        {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      {settings.pipeline_id && (
        <select value={settings.stage_id ?? ''} onChange={e => onChange({ stage_id: e.target.value || undefined })}
          className="w-full text-sm mt-2" style={{ padding: '9px 11px', minHeight: 38, background: '#18181b', color: '#fafafa', border: '1px solid #27272a', borderRadius: 6 }}>
          <option value="">Etapa de entrada…</option>
          {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      )}
      <select value={settings.assigned_to ?? ''} onChange={e => onChange({ assigned_to: e.target.value || undefined })}
        className="w-full text-sm mt-2" style={{ padding: '9px 11px', minHeight: 38, background: '#18181b', color: '#fafafa', border: '1px solid #27272a', borderRadius: 6 }}>
        <option value="">Responsável: dono da loja</option>
        {agents.map(a => <option key={a.member_id} value={a.member_id}>{a.display_name ?? a.member_id.slice(0, 8)}</option>)}
      </select>
    </Field>
  )
}
