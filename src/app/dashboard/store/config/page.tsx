'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import {
  Store, Loader2, Save, AlertCircle, Globe, Palette, Search,
  Share2, Check, ExternalLink, Settings,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface StoreTheme {
  primary_color?: string
  secondary_color?: string
  accent_color?: string
  layout?: string
  hero_style?: string
  product_card_style?: string
}

interface StoreConfig {
  id: string
  organization_id: string
  store_name: string
  store_slug: string
  store_description: string | null
  logo_url: string | null
  custom_domain: string | null
  domain_verified: boolean
  ssl_status: string
  theme: StoreTheme
  seo_title: string | null
  seo_description: string | null
  seo_keywords: string[]
  google_analytics_id: string | null
  meta_pixel_id: string | null
  currency: string
  language: string
  whatsapp_widget_enabled: boolean
  whatsapp_number: string | null
  ai_seller_widget_enabled: boolean
  social_links: Record<string, string>
  status: 'setup' | 'active' | 'paused' | 'suspended'
}

async function token(): Promise<string | null> {
  const sb = createClient()
  const { data } = await sb.auth.getSession()
  return data.session?.access_token ?? null
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const t = await token()
  const res = await fetch(`${BACKEND}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}), ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(`[${res.status}] ${(body as { message?: string }).message ?? 'erro'}`)
  }
  return (await res.json()) as T
}

export default function StoreConfigPage() {
  const [config, setConfig] = useState<StoreConfig | null>(null)
  const [draft, setDraft]   = useState<Partial<StoreConfig>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [presets, setPresets] = useState<Record<string, StoreTheme> | null>(null)
  const [createName, setCreateName] = useState('')
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const c = await api<StoreConfig | null>('/store/config')
      setConfig(c); setDraft({})
      const p = await api<Record<string, StoreTheme>>('/store/config/theme-presets')
      setPresets(p)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  function setVal<K extends keyof StoreConfig>(k: K, v: StoreConfig[K]) {
    setDraft(prev => ({ ...prev, [k]: v }))
  }
  function getVal<K extends keyof StoreConfig>(k: K): StoreConfig[K] | undefined {
    return (draft[k] !== undefined ? draft[k] : config?.[k]) as StoreConfig[K] | undefined
  }

  async function createConfig() {
    if (!createName.trim()) return
    setCreating(true); setError(null)
    try {
      await api('/store/config', {
        method: 'POST', body: JSON.stringify({ store_name: createName }),
      })
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCreating(false)
    }
  }

  async function save() {
    if (Object.keys(draft).length === 0) return
    setSaving(true); setError(null)
    try {
      const c = await api<StoreConfig>('/store/config', {
        method: 'PATCH', body: JSON.stringify(draft),
      })
      setConfig(c); setDraft({})
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function applyPreset(key: string) {
    if (!presets?.[key]) return
    setVal('theme', { ...((getVal('theme') as StoreTheme) ?? {}), ...presets[key] } as StoreConfig['theme'])
  }

  async function verify() {
    setVerifying(true); setError(null)
    try {
      const r = await api<{ verified: boolean; reason?: string; expected_target?: string }>(
        '/store/config/verify-domain', { method: 'POST' },
      )
      if (r.verified) alert(`Domínio verificado! CNAME aponta corretamente pra ${r.expected_target}`)
      else alert(`Não verificado: ${r.reason}\n\nConfigure CNAME apontando pra ${r.expected_target}`)
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setVerifying(false)
    }
  }

  if (loading) return (
    <div className="p-6 flex items-center gap-2 text-zinc-500 text-sm">
      <Loader2 size={14} className="animate-spin" /> carregando…
    </div>
  )

  if (!config) return (
    <div className="p-4 sm:p-6 space-y-4 max-w-md mx-auto">
      <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
        <Store size={20} className="text-cyan-400" />
        Configurar sua Loja
      </h1>
      <p className="text-xs text-zinc-500">
        Sua loja ainda não foi configurada. Defina um nome pra começar.
      </p>
      <input
        value={createName}
        onChange={e => setCreateName(e.target.value)}
        placeholder="Nome da loja"
        className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-200 outline-none focus:border-cyan-400/60"
      />
      <button
        onClick={createConfig}
        disabled={creating || !createName.trim()}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-black text-sm font-medium"
      >
        {creating ? <Loader2 size={14} className="animate-spin" /> : <Store size={14} />}
        Criar configuração
      </button>
      {error && <p className="text-xs text-red-300">⚠ {error}</p>}
    </div>
  )

  const theme = (getVal('theme') as StoreTheme) ?? {}

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-100 flex items-center gap-2">
          <Store size={20} className="text-cyan-400" />
          Configuração da Loja
        </h1>
        <p className="text-xs text-zinc-500 mt-1">
          Identidade visual, domínio, SEO, integrações. White-label completo.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300 flex items-center gap-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* Status banner */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs text-zinc-400">URL da loja:</p>
          <p className="text-sm text-cyan-300 font-mono">/loja/{config.store_slug}</p>
          {config.custom_domain && (
            <p className="text-[11px] text-zinc-500 mt-1">
              Domínio: <span className="font-mono text-zinc-300">{config.custom_domain}</span>
              {config.domain_verified
                ? <span className="ml-2 text-emerald-300">✓ verificado</span>
                : <span className="ml-2 text-amber-300">⚠ não verificado</span>}
            </p>
          )}
        </div>
        <select
          value={String(getVal('status') ?? 'setup')}
          onChange={e => setVal('status', e.target.value as StoreConfig['status'])}
          className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-200 outline-none"
        >
          <option value="setup">Em configuração</option>
          <option value="active">Ativa (público)</option>
          <option value="paused">Pausada</option>
        </select>
      </div>

      {/* Identity */}
      <Section title="Identidade" icon={<Store size={12} className="text-cyan-400" />}>
        <Field label="Nome da loja">
          <input value={String(getVal('store_name') ?? '')} onChange={e => setVal('store_name', e.target.value)}
                 className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-cyan-400/60" />
        </Field>
        <Field label="Slug (URL)">
          <input value={String(getVal('store_slug') ?? '')} onChange={e => setVal('store_slug', e.target.value)}
                 className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-cyan-400/60 font-mono" />
        </Field>
        <Field label="Descrição curta">
          <textarea value={String(getVal('store_description') ?? '')} onChange={e => setVal('store_description', e.target.value)}
                    rows={2} className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-cyan-400/60 resize-none" />
        </Field>
        <Field label="Logo URL">
          <input value={String(getVal('logo_url') ?? '')} onChange={e => setVal('logo_url', e.target.value)} placeholder="https://..."
                 className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-cyan-400/60" />
        </Field>
      </Section>

      {/* Domain */}
      <Section title="Domínio custom" icon={<Globe size={12} className="text-cyan-400" />}>
        <Field label="Domínio">
          <input
            value={String(getVal('custom_domain') ?? '')}
            onChange={e => setVal('custom_domain', e.target.value)}
            placeholder="loja.minhamarca.com.br"
            className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-cyan-400/60"
          />
        </Field>
        {config.custom_domain && (
          <button
            onClick={verify}
            disabled={verifying}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-cyan-400/40 text-zinc-300 hover:text-cyan-300 text-xs"
          >
            {verifying ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            Verificar DNS
          </button>
        )}
        <p className="text-[10px] text-zinc-500">
          Configure CNAME apontando pra <code className="text-cyan-300">storefront.eclick.app.br</code> e clique em "Verificar DNS".
        </p>
      </Section>

      {/* Theme */}
      <Section title="Tema visual" icon={<Palette size={12} className="text-cyan-400" />}>
        {presets && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Presets</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(presets).map(([k, p]) => (
                <button
                  key={k}
                  onClick={() => applyPreset(k)}
                  className="rounded border border-zinc-800 hover:border-cyan-400/60 px-3 py-2 text-xs text-zinc-300 transition-colors flex items-center gap-2"
                >
                  <div className="flex gap-1">
                    <span className="w-3 h-3 rounded-full" style={{ background: p.primary_color }} />
                    <span className="w-3 h-3 rounded-full" style={{ background: p.secondary_color }} />
                    <span className="w-3 h-3 rounded-full" style={{ background: p.accent_color }} />
                  </div>
                  {k}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <ColorField label="Primária" value={theme.primary_color ?? '#00E5FF'}
            onChange={v => setVal('theme', { ...theme, primary_color: v })} />
          <ColorField label="Secundária" value={theme.secondary_color ?? '#09090B'}
            onChange={v => setVal('theme', { ...theme, secondary_color: v })} />
          <ColorField label="Accent" value={theme.accent_color ?? '#22C55E'}
            onChange={v => setVal('theme', { ...theme, accent_color: v })} />
        </div>
      </Section>

      {/* SEO */}
      <Section title="SEO" icon={<Search size={12} className="text-cyan-400" />}>
        <Field label="Título SEO (max 60)">
          <input value={String(getVal('seo_title') ?? '')} onChange={e => setVal('seo_title', e.target.value)}
                 maxLength={60} className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-cyan-400/60" />
        </Field>
        <Field label="Descrição SEO (max 160)">
          <textarea value={String(getVal('seo_description') ?? '')} onChange={e => setVal('seo_description', e.target.value)}
                    maxLength={160} rows={2} className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-cyan-400/60 resize-none" />
        </Field>
        <Field label="Google Analytics ID">
          <input value={String(getVal('google_analytics_id') ?? '')} onChange={e => setVal('google_analytics_id', e.target.value)}
                 placeholder="G-XXXXXXXX" className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-cyan-400/60 font-mono" />
        </Field>
        <Field label="Meta Pixel ID">
          <input value={String(getVal('meta_pixel_id') ?? '')} onChange={e => setVal('meta_pixel_id', e.target.value)}
                 placeholder="123456789" className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-cyan-400/60 font-mono" />
        </Field>
      </Section>

      {/* Widgets + Social */}
      <Section title="Widgets & Social" icon={<Share2 size={12} className="text-cyan-400" />}>
        <Field label="Widget WhatsApp">
          <input type="checkbox" checked={Boolean(getVal('whatsapp_widget_enabled'))}
                 onChange={e => setVal('whatsapp_widget_enabled', e.target.checked)} className="w-4 h-4 accent-cyan-400" />
        </Field>
        <Field label="Número WhatsApp">
          <input value={String(getVal('whatsapp_number') ?? '')} onChange={e => setVal('whatsapp_number', e.target.value)}
                 placeholder="+55..." className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-cyan-400/60 font-mono" />
        </Field>
        <Field label="Widget Vendedor IA">
          <input type="checkbox" checked={Boolean(getVal('ai_seller_widget_enabled'))}
                 onChange={e => setVal('ai_seller_widget_enabled', e.target.checked)} className="w-4 h-4 accent-cyan-400" />
        </Field>
      </Section>

      {/* Save */}
      <div className="sticky bottom-4 flex justify-between items-center bg-zinc-950/95 p-2 rounded-lg border border-zinc-800">
        <a href={`/loja/${config.store_slug}`} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-400 hover:underline flex items-center gap-1">
          Ver loja pública <ExternalLink size={10} />
        </a>
        <button
          onClick={save}
          disabled={saving || Object.keys(draft).length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-black text-sm font-medium"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Salvar
        </button>
      </div>
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
      <h2 className="text-xs uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
        {icon}{title}
      </h2>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-zinc-300">{label}</p>
      <div>{children}</div>
    </div>
  )
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] text-zinc-500">{label}</p>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-8 h-8 rounded border border-zinc-800 bg-transparent cursor-pointer"
        />
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[11px] text-zinc-200 font-mono outline-none focus:border-cyan-400/60"
        />
      </div>
    </div>
  )
}
