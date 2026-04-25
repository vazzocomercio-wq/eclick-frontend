'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import {
  CheckCircle2, XCircle, Clock, RefreshCw, Plug, Zap,
  Key, Eye, EyeOff, Plus, Trash2, TestTube2, Loader2,
  X, ExternalLink, AlertCircle, Bot, MessageCircle,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

// ── Types ─────────────────────────────────────────────────────────────────────

type MlConn     = { seller_id: number; nickname: string | null; expires_at: string }
type IntegStatus = 'connected' | 'expired' | 'disconnected' | 'soon'

interface Credential {
  id: string
  provider: string
  key_name: string
  key_preview: string
  is_active: boolean
  last_tested_at?: string
  last_test_status?: string
  last_test_message?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function connStatus(conn: MlConn): IntegStatus {
  return new Date(conn.expires_at).getTime() - Date.now() < 0 ? 'expired' : 'connected'
}

function timeAgo(iso?: string) {
  if (!iso) return null
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60000)   return 'agora'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}min atrás`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h atrás`
  return `${Math.floor(diff / 86400000)}d atrás`
}

const STATUS_CFG: Record<IntegStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  connected:    { label: 'Conectado',      color: '#4ade80', bg: 'rgba(74,222,128,0.1)',   icon: <CheckCircle2 size={11} /> },
  expired:      { label: 'Token expirado', color: '#f87171', bg: 'rgba(248,113,113,0.1)',  icon: <XCircle size={11} /> },
  disconnected: { label: 'Desconectado',   color: '#71717a', bg: 'rgba(113,113,122,0.12)', icon: <XCircle size={11} /> },
  soon:         { label: 'Em breve',       color: '#52525b', bg: 'rgba(82,82,91,0.15)',    icon: <Clock size={11} /> },
}

function StatusBadge({ status }: { status: IntegStatus }) {
  const c = STATUS_CFG[status]
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ background: c.bg, color: c.color }}>
      {c.icon} {c.label}
    </span>
  )
}

// ── Key input modal ───────────────────────────────────────────────────────────

interface AIProviderDef {
  id: string
  name: string
  keyName: string
  placeholder: string
  helpUrl: string
  helpLabel: string
  helpText: string
}

const AI_PROVIDERS_DEF: AIProviderDef[] = [
  {
    id: 'anthropic', name: 'Anthropic (Claude)', keyName: 'ANTHROPIC_API_KEY',
    placeholder: 'sk-ant-api03-...',
    helpUrl: 'https://console.anthropic.com/settings/keys',
    helpLabel: 'console.anthropic.com',
    helpText: 'Console Anthropic → API Keys → Create Key',
  },
  {
    id: 'openai', name: 'OpenAI (ChatGPT)', keyName: 'OPENAI_API_KEY',
    placeholder: 'sk-proj-...',
    helpUrl: 'https://platform.openai.com/api-keys',
    helpLabel: 'platform.openai.com',
    helpText: 'Platform OpenAI → API Keys → Create new secret key',
  },
]

function AddKeyModal({ provider, onClose, onSaved }: {
  provider: AIProviderDef
  onClose: () => void
  onSaved: (cred: Credential) => void
}) {
  const [value, setValue]   = useState('')
  const [show, setShow]     = useState(false)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  async function save() {
    if (!value.trim()) return
    setSaving(true); setResult(null)
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      const headers = { Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' }

      // Save credential
      const saveRes = await fetch(`${BACKEND}/credentials`, {
        method: 'POST', headers,
        body: JSON.stringify({ provider: provider.id, key_name: provider.keyName, key_value: value }),
      })
      if (!saveRes.ok) throw new Error('Falha ao salvar')
      const cred: Credential = await saveRes.json()

      // Test it
      const testRes = await fetch(`${BACKEND}/credentials/${cred.id}/test`, { method: 'POST', headers })
      const testData: { ok: boolean; message: string } = await testRes.json()
      setResult(testData)

      if (testData.ok) {
        setTimeout(() => { onSaved({ ...cred, last_test_status: 'ok', last_test_message: testData.message, last_tested_at: new Date().toISOString() }); onClose() }, 1200)
      }
    } catch (e) {
      setResult({ ok: false, message: (e as Error).message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #1e1e24' }}>
          <div className="flex items-center gap-2">
            <Key size={15} style={{ color: '#00E5FF' }} />
            <p className="text-sm font-semibold text-white">Adicionar chave {provider.name}</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors"><X size={16} /></button>
        </div>

        <div className="px-5 py-5 space-y-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Cole sua API Key</label>
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                value={value}
                onChange={e => setValue(e.target.value)}
                placeholder={provider.placeholder}
                className="w-full pl-3 pr-10 py-2.5 rounded-xl text-sm text-white placeholder-zinc-600 font-mono"
                style={{ background: '#0d0d10', border: '1px solid #27272a' }}
                autoFocus
              />
              <button onClick={() => setShow(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors">
                {show ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div className="rounded-xl p-3 space-y-1" style={{ background: '#0d0d10', border: '1px solid #1e1e24' }}>
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide">Como obter sua chave</p>
            <p className="text-xs text-zinc-400">{provider.helpText}</p>
            <a href={provider.helpUrl} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 text-[11px] transition-colors"
              style={{ color: '#00E5FF' }}>
              <ExternalLink size={10} />{provider.helpLabel}
            </a>
          </div>

          {result && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-sm"
              style={{ background: result.ok ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', color: result.ok ? '#4ade80' : '#f87171', border: `1px solid ${result.ok ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
              {result.ok ? <CheckCircle2 size={14} className="shrink-0 mt-0.5" /> : <AlertCircle size={14} className="shrink-0 mt-0.5" />}
              <span>{result.message}</span>
            </div>
          )}
        </div>

        <div className="flex justify-between px-5 py-4" style={{ borderTop: '1px solid #1e1e24' }}>
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-zinc-400 transition-colors"
            style={{ background: '#1e1e24' }}>
            Cancelar
          </button>
          <button onClick={save} disabled={!value.trim() || saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40"
            style={{ background: '#00E5FF', color: '#000' }}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : <TestTube2 size={13} />}
            Salvar e testar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── AI provider card ──────────────────────────────────────────────────────────

function AIProviderCard({ def, cred, onAdd, onTest, onRemove, testing }: {
  def: AIProviderDef
  cred?: Credential
  onAdd: () => void
  onTest: () => void
  onRemove: () => void
  testing: boolean
}) {
  const hasKey = !!cred
  const testOk = cred?.last_test_status === 'ok'

  return (
    <div className="rounded-2xl p-4 space-y-3 transition-colors"
      style={{ background: '#111114', border: `1px solid ${hasKey && testOk ? 'rgba(74,222,128,0.15)' : '#1e1e24'}` }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: '#1e1e24' }}>
            <Bot size={15} style={{ color: '#00E5FF' }} />
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-200">{def.name}</p>
            <p className="text-[10px] text-zinc-600 font-mono mt-0.5">{def.keyName}</p>
          </div>
        </div>
        {hasKey
          ? <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
              style={{ background: testOk ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)', color: testOk ? '#4ade80' : '#f87171' }}>
              {testOk ? <CheckCircle2 size={10} /> : <AlertCircle size={10} />}
              {testOk ? 'Conectada' : 'Erro'}
            </span>
          : <span className="text-[10px] text-zinc-600">Não configurada</span>}
      </div>

      {hasKey && (
        <div className="px-3 py-2 rounded-xl space-y-1" style={{ background: '#0d0d10' }}>
          <div className="flex items-center gap-2">
            <Key size={10} style={{ color: '#52525b' }} />
            <span className="text-[11px] font-mono text-zinc-400">{cred.key_preview}</span>
          </div>
          {cred.last_tested_at && (
            <p className="text-[10px] text-zinc-600">
              Testada {timeAgo(cred.last_tested_at)}
              {cred.last_test_message && ` · ${cred.last_test_message}`}
            </p>
          )}
        </div>
      )}

      <div className="flex gap-2">
        {!hasKey ? (
          <button onClick={onAdd}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-colors"
            style={{ background: 'rgba(0,229,255,0.1)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.25)' }}>
            <Plus size={12} /> Adicionar chave
          </button>
        ) : (
          <>
            <button onClick={onTest} disabled={testing}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-colors disabled:opacity-50"
              style={{ background: '#1e1e24', color: '#a1a1aa' }}>
              {testing ? <Loader2 size={11} className="animate-spin" /> : <TestTube2 size={11} />}
              Testar
            </button>
            <button onClick={onRemove}
              className="flex items-center justify-center p-2 rounded-xl text-zinc-600 transition-colors"
              style={{ background: '#1e1e24' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#71717a'; e.currentTarget.style.background = '#1e1e24' }}>
              <Trash2 size={12} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── Marketplace / messenger card ──────────────────────────────────────────────

function IntegCard({
  name, abbr, abbrBg, abbrColor, status, description, accounts, onConnect, onDisconnect,
}: {
  name: string; abbr: string; abbrBg: string; abbrColor: string
  status: IntegStatus; description: string
  accounts?: MlConn[]
  onConnect?: () => void
  onDisconnect?: (sellerId: number) => void
}) {
  const isSoon = status === 'soon'
  return (
    <div className="rounded-2xl p-4 space-y-3" style={{ background: '#111114', border: '1px solid #1e1e24', opacity: isSoon ? 0.6 : 1 }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center text-xs font-black"
            style={{ background: abbrBg, color: abbrColor }}>
            {abbr}
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-200">{name}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5 leading-snug">{description}</p>
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      {accounts && accounts.length > 0 && (
        <div className="space-y-1">
          {accounts.map(acc => {
            const st  = connStatus(acc)
            const cfg = STATUS_CFG[st]
            return (
              <div key={acc.seller_id} className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                style={{ background: '#18181b', border: '1px solid #27272a' }}>
                <div className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[9px] font-bold"
                  style={{ background: 'rgba(255,230,0,0.12)', color: '#FFE600' }}>
                  {(acc.nickname ?? `${acc.seller_id}`).charAt(0).toUpperCase()}
                </div>
                <span className="text-[10px] font-medium text-zinc-300 flex-1 truncate">{acc.nickname ?? `Conta #${acc.seller_id}`}</span>
                <span className="text-[9px] font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
                {onDisconnect && (
                  <button onClick={() => onDisconnect(acc.seller_id)}
                    className="text-[9px] px-1.5 py-0.5 rounded transition-colors"
                    style={{ color: '#71717a', border: '1px solid #2e2e33' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#71717a')}>
                    Remover
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {!isSoon && onConnect && (
        <button onClick={onConnect}
          className="flex items-center gap-1.5 w-full justify-center py-2 rounded-xl text-xs font-semibold transition-all"
          style={{
            background: accounts && accounts.length > 0 ? 'rgba(255,255,255,0.04)' : 'rgba(0,229,255,0.1)',
            color:      accounts && accounts.length > 0 ? '#71717a' : '#00E5FF',
            border:    `1px solid ${accounts && accounts.length > 0 ? '#2e2e33' : 'rgba(0,229,255,0.25)'}`,
          }}>
          <Plug size={11} />
          {accounts && accounts.length > 0 ? 'Adicionar conta' : 'Conectar'}
        </button>
      )}
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-zinc-600">{icon}</span>
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">{title}</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">{children}</div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function IntegracoesPage() {
  const [mlConns, setMlConns]         = useState<MlConn[]>([])
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [loading, setLoading]         = useState(true)
  const [connecting, setConnecting]   = useState(false)
  const [addingFor, setAddingFor]     = useState<AIProviderDef | null>(null)
  const [testingId, setTestingId]     = useState<string | null>(null)

  const getHeaders = useCallback(async () => {
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    return { Authorization: `Bearer ${session?.access_token}` }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const headers = await getHeaders()
      const [mlRes, credRes] = await Promise.allSettled([
        fetch(`${BACKEND}/ml/connections`,  { headers }),
        fetch(`${BACKEND}/credentials`,     { headers }),
      ])
      if (mlRes.status === 'fulfilled'   && mlRes.value.ok)   setMlConns(await mlRes.value.json())
      if (credRes.status === 'fulfilled' && credRes.value.ok) setCredentials(await credRes.value.json())
    } catch { /* silent */ }
    setLoading(false)
  }, [getHeaders])

  useEffect(() => { load() }, [load])

  async function connectML() {
    setConnecting(true)
    const headers = await getHeaders()
    const redirectUri = `${window.location.origin}/dashboard/integracoes/ml/callback`
    try {
      const res = await fetch(`${BACKEND}/ml/auth-url?redirect_uri=${encodeURIComponent(redirectUri)}`, { headers })
      if (res.ok) { const { url } = await res.json(); window.location.href = url }
    } finally { setConnecting(false) }
  }

  async function disconnectML(sellerId: number) {
    if (!confirm(`Remover integração ML ${sellerId}?`)) return
    const headers = await getHeaders()
    await fetch(`${BACKEND}/ml/disconnect?seller_id=${sellerId}`, { method: 'DELETE', headers })
    setMlConns(cs => cs.filter(c => c.seller_id !== sellerId))
  }

  async function testCredential(id: string) {
    setTestingId(id)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/credentials/${id}/test`, { method: 'POST', headers })
      if (res.ok) {
        const result: { ok: boolean; message: string } = await res.json()
        setCredentials(prev => prev.map(c => c.id === id
          ? { ...c, last_test_status: result.ok ? 'ok' : 'error', last_test_message: result.message, last_tested_at: new Date().toISOString() }
          : c
        ))
      }
    } finally { setTestingId(null) }
  }

  async function removeCredential(id: string) {
    if (!confirm('Remover esta chave de API?')) return
    const headers = await getHeaders()
    await fetch(`${BACKEND}/credentials/${id}`, { method: 'DELETE', headers })
    setCredentials(prev => prev.filter(c => c.id !== id))
  }

  const overallMlStatus: IntegStatus = loading ? 'disconnected'
    : mlConns.length === 0 ? 'disconnected'
    : mlConns.some(c => new Date(c.expires_at).getTime() - Date.now() < 0) ? 'expired'
    : 'connected'

  const credByProvider = (provider: string) => credentials.find(c => c.provider === provider)

  return (
    <div className="p-6 space-y-7 min-h-full" style={{ background: '#09090b' }}>

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-zinc-500 text-xs">Configurações</p>
          <h2 className="text-white text-lg font-semibold mt-0.5">Integrações</h2>
          <p className="text-zinc-500 text-xs mt-1">Conecte marketplaces, mensageiros e ferramentas de IA ao eClick.</p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all disabled:opacity-60"
          style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {/* ── Inteligência Artificial ──────────────────────────────────────── */}
      <Section title="Inteligência Artificial" icon={<Bot size={13} />}>
        {AI_PROVIDERS_DEF.map(def => (
          <AIProviderCard
            key={def.id}
            def={def}
            cred={credByProvider(def.id)}
            onAdd={() => setAddingFor(def)}
            onTest={() => { const c = credByProvider(def.id); if (c) testCredential(c.id) }}
            onRemove={() => { const c = credByProvider(def.id); if (c) removeCredential(c.id) }}
            testing={testingId === credByProvider(def.id)?.id}
          />
        ))}
      </Section>

      {/* ── Marketplaces ─────────────────────────────────────────────────── */}
      <Section title="Marketplaces" icon={<Zap size={13} />}>
        <IntegCard
          name="Mercado Livre" abbr="ML" abbrBg="rgba(255,230,0,0.15)" abbrColor="#FFE600"
          status={connecting ? 'disconnected' : overallMlStatus}
          description="OAuth 2.0 · token renovado automaticamente pelo backend."
          accounts={mlConns} onConnect={connectML} onDisconnect={disconnectML}
        />
        {([
          { name: 'Shopee',     abbr: 'SH', bg: 'rgba(238,77,45,0.15)',  fg: '#EE4D2D', desc: 'Sincronize pedidos, estoque e anúncios.' },
          { name: 'Amazon',     abbr: 'AZ', bg: 'rgba(255,153,0,0.15)',  fg: '#FF9900', desc: 'Amazon Seller Central via SP-API.' },
          { name: 'Magalu',     abbr: 'MG', bg: 'rgba(0,134,255,0.15)',  fg: '#0086FF', desc: 'Magazine Luiza Marketplace.' },
          { name: 'Americanas', abbr: 'AM', bg: 'rgba(232,0,45,0.15)',   fg: '#e8002d', desc: 'Marketplace Americanas.' },
        ] as const).map(m => (
          <IntegCard key={m.name} name={m.name} abbr={m.abbr} abbrBg={m.bg} abbrColor={m.fg}
            status="soon" description={m.desc} />
        ))}
      </Section>

      {/* ── Mensageiros ──────────────────────────────────────────────────── */}
      <Section title="Mensageiros" icon={<MessageCircle size={13} />}>
        {([
          { name: 'WhatsApp Business', abbr: 'WA', bg: 'rgba(37,211,102,0.15)', fg: '#25D366', desc: 'Atendimento via WhatsApp Business API (Meta).' },
          { name: 'Instagram',         abbr: 'IG', bg: 'rgba(228,64,95,0.15)',  fg: '#E4405F', desc: 'DMs e comentários via Instagram Graph API.' },
          { name: 'TikTok',            abbr: 'TT', bg: 'rgba(255,0,80,0.15)',   fg: '#ff0050', desc: 'Mensagens via TikTok Business API.' },
          { name: 'Telegram',          abbr: 'TG', bg: 'rgba(0,136,204,0.15)', fg: '#0088cc', desc: 'Bot Telegram via Bot API.' },
        ] as const).map(m => (
          <IntegCard key={m.name} name={m.name} abbr={m.abbr} abbrBg={m.bg} abbrColor={m.fg}
            status="soon" description={m.desc} />
        ))}
      </Section>

      {/* ── ERP ──────────────────────────────────────────────────────────── */}
      <Section title="ERP & Gestão" icon={<Plug size={13} />}>
        {([
          { name: 'Bling',     abbr: 'BL', bg: 'rgba(0,85,165,0.15)',  fg: '#0055A5', desc: 'NF-e, pedidos e estoque via Bling ERP.' },
          { name: 'Omie',      abbr: 'OM', bg: 'rgba(255,107,53,0.15)', fg: '#FF6B35', desc: 'Integração bidirecional com Omie.' },
          { name: 'ContaAzul', abbr: 'CA', bg: 'rgba(30,144,255,0.15)', fg: '#1E90FF', desc: 'Financeiro e conciliação via ContaAzul.' },
          { name: 'Tiny ERP',  abbr: 'TN', bg: 'rgba(0,193,110,0.15)', fg: '#00C16E', desc: 'Emissão de NF-e e gestão via Tiny.' },
        ] as const).map(m => (
          <IntegCard key={m.name} name={m.name} abbr={m.abbr} abbrBg={m.bg} abbrColor={m.fg}
            status="soon" description={m.desc} />
        ))}
      </Section>

      {/* ── Frete ────────────────────────────────────────────────────────── */}
      <Section title="Frete & Logística" icon={<Plug size={13} />}>
        {([
          { name: 'Melhor Envio', abbr: 'ME', bg: 'rgba(108,78,242,0.15)', fg: '#6C4EF2', desc: 'Cotação automática e etiquetas.' },
          { name: 'Frenet',       abbr: 'FR', bg: 'rgba(26,86,219,0.15)',  fg: '#1a56db', desc: 'Multi-transportadora em tempo real.' },
          { name: 'ClickPost',    abbr: 'CP', bg: 'rgba(6,182,212,0.15)',  fg: '#06b6d4', desc: 'Rastreamento unificado de encomendas.' },
        ] as const).map(m => (
          <IntegCard key={m.name} name={m.name} abbr={m.abbr} abbrBg={m.bg} abbrColor={m.fg}
            status="soon" description={m.desc} />
        ))}
      </Section>

      {/* ── Fiscal ───────────────────────────────────────────────────────── */}
      <Section title="Fiscal & NF-e" icon={<Plug size={13} />}>
        {([
          { name: 'Focus NFe', abbr: 'FN', bg: 'rgba(124,58,237,0.15)', fg: '#7c3aed', desc: 'Emissão automática de NF-e e NFC-e.' },
          { name: 'Nfe.io',    abbr: 'NI', bg: 'rgba(5,150,105,0.15)',  fg: '#059669', desc: 'API de emissão de notas fiscais.' },
          { name: 'eNotas',    abbr: 'EN', bg: 'rgba(2,132,199,0.15)',  fg: '#0284c7', desc: 'NFS-e e NF-e em escala.' },
        ] as const).map(m => (
          <IntegCard key={m.name} name={m.name} abbr={m.abbr} abbrBg={m.bg} abbrColor={m.fg}
            status="soon" description={m.desc} />
        ))}
      </Section>

      <p className="text-[10px] text-zinc-700">
        Novas integrações são adicionadas continuamente. Entre em contato para priorizar uma integração específica.
      </p>

      {/* Add key modal */}
      {addingFor && (
        <AddKeyModal
          provider={addingFor}
          onClose={() => setAddingFor(null)}
          onSaved={cred => { setCredentials(prev => [...prev.filter(c => c.provider !== cred.provider), cred]); setAddingFor(null) }}
        />
      )}
    </div>
  )
}
