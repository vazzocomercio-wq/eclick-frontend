'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import {
  CheckCircle2, XCircle, Clock, RefreshCw, Plug, Zap,
  Key, Eye, EyeOff, Plus, Trash2, TestTube2, Loader2,
  X, ExternalLink, AlertCircle, Bot, MessageCircle, BarChart2, Save, Check, Settings, Mail,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, Legend,
} from 'recharts'
import { getSocket } from '@/lib/socket'
import { toDataURL as qrToDataUrl } from 'qrcode'
import { useConfirm } from '@/components/ui/dialog-provider'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

// ── Types ─────────────────────────────────────────────────────────────────────

type MlConn     = { seller_id: number; nickname: string | null; expires_at: string }
type IntegStatus = 'connected' | 'expired' | 'disconnected' | 'not_connected' | 'soon'

type ChannelRow = {
  id: string
  name: string
  api_status: 'available' | 'coming_soon' | 'deprecated'
  is_integrated: boolean
  integration_status: 'connected' | 'expired' | 'error' | 'never_connected' | null
  last_token_check: string | null
}

interface Toast { id: number; message: string; type: 'success' | 'error' }

interface ModelUsage   { model: string;   tokens: number; cost: number }
interface FeatureUsage { feature: string; tokens: number; cost: number }
interface ProviderUsage {
  total_tokens: number; total_cost_usd: number
  today_tokens: number; today_cost_usd: number
  by_model:   ModelUsage[]
  by_feature: FeatureUsage[]
}
interface DayUsage { date: string; anthropic_cost: number; openai_cost: number }

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
  connected:     { label: 'Conectado',      color: '#4ade80', bg: 'rgba(74,222,128,0.1)',   icon: <CheckCircle2 size={11} /> },
  expired:       { label: 'Token expirado', color: '#f87171', bg: 'rgba(248,113,113,0.1)',  icon: <XCircle size={11} /> },
  disconnected:  { label: 'Desconectado',   color: '#71717a', bg: 'rgba(113,113,122,0.12)', icon: <XCircle size={11} /> },
  not_connected: { label: 'Não integrado',  color: '#fb923c', bg: 'rgba(251,146,60,0.1)',   icon: <Plug size={11} /> },
  soon:          { label: 'Em breve',       color: '#52525b', bg: 'rgba(82,82,91,0.15)',    icon: <Clock size={11} /> },
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

function fmtTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000)      return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function AIProviderCard({ def, cred, usage, onAdd, onTest, onRemove, testing }: {
  def: AIProviderDef
  cred?: Credential
  usage?: ProviderUsage
  onAdd: () => void
  onTest: () => void
  onRemove: () => void
  testing: boolean
}) {
  const hasKey = !!cred
  const testOk = cred?.last_test_status === 'ok'
  const maxModelTokens = usage?.by_model?.[0]?.tokens ?? 1

  return (
    <div className="rounded-2xl p-4 space-y-3 transition-colors"
      style={{ background: '#111114', border: `1px solid ${hasKey && testOk ? 'rgba(74,222,128,0.15)' : '#1e1e24'}` }}>

      {/* Provider header */}
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

      {/* Key preview + test status */}
      {hasKey && (
        <div className="px-3 py-2 rounded-xl space-y-1" style={{ background: '#0d0d10' }}>
          <div className="flex items-center gap-2">
            <Key size={10} style={{ color: '#52525b' }} />
            <span className="text-[11px] font-mono text-zinc-400">{cred.key_preview}</span>
          </div>
          {cred.last_test_status && (
            <p className="flex items-center gap-1 text-[10px] flex-wrap"
              style={{ color: cred.last_test_status === 'ok' ? '#4ade80' : '#f87171' }}>
              {cred.last_test_status === 'ok' ? '✅' : '❌'}
              <span>{cred.last_test_message}</span>
              {cred.last_tested_at && (
                <span className="text-zinc-600">
                  · {new Date(cred.last_tested_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </p>
          )}
        </div>
      )}

      {/* Usage block */}
      {usage && usage.total_tokens > 0 && (
        <div className="space-y-2.5 pt-1" style={{ borderTop: '1px solid #1e1e24' }}>
          {/* Month totals */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 mb-1.5">Uso do mês</p>
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-300">{fmtTokens(usage.total_tokens)} tokens</span>
              <span className="font-semibold" style={{ color: '#00E5FF' }}>US$ {usage.total_cost_usd.toFixed(4)}</span>
            </div>
          </div>

          {/* Per-model bars */}
          {usage.by_model.length > 0 && (
            <div className="space-y-1.5">
              {usage.by_model.slice(0, 3).map(m => (
                <div key={m.model}>
                  <div className="flex items-center justify-between text-[10px] mb-0.5">
                    <span className="text-zinc-500 truncate max-w-[140px]">
                      {m.model.replace('claude-', '').replace('-20251001', '')}
                    </span>
                    <span className="text-zinc-600 shrink-0">{fmtTokens(m.tokens)}</span>
                  </div>
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: '#1e1e24' }}>
                    <div className="h-full rounded-full"
                      style={{ width: `${Math.round((m.tokens / maxModelTokens) * 100)}%`, background: '#00E5FF', opacity: 0.6 }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Today + feature breakdown */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg px-2 py-1.5" style={{ background: '#0d0d10' }}>
              <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 mb-0.5">Hoje</p>
              <p className="text-xs font-semibold text-white">{fmtTokens(usage.today_tokens)}</p>
              <p className="text-[10px] text-zinc-600">US$ {usage.today_cost_usd.toFixed(4)}</p>
            </div>
            {usage.by_feature.length > 0 && (
              <div className="rounded-lg px-2 py-1.5 overflow-hidden" style={{ background: '#0d0d10' }}>
                <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 mb-0.5">Por feature</p>
                {usage.by_feature.slice(0, 2).map(f => (
                  <p key={f.feature} className="text-[10px] text-zinc-500 truncate">
                    {f.feature.replace(/_/g, ' ')}: {fmtTokens(f.tokens)}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action buttons */}
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

function Section({ id, title, subtitle, icon, children }: {
  id?: string
  title: string
  subtitle?: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div id={id} className="space-y-3" style={{ scrollMarginTop: '5rem' }}>
      <div className="flex items-center gap-2">
        <span className="text-zinc-600">{icon}</span>
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">{title}</h3>
      </div>
      {subtitle && <p className="text-zinc-500 text-[11px] -mt-1">{subtitle}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">{children}</div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function IntegracoesPage() {
  const [mlConns, setMlConns]         = useState<MlConn[]>([])
  const [channels, setChannels]       = useState<ChannelRow[]>([])
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [loading, setLoading]         = useState(true)
  const [connecting, setConnecting]   = useState(false)
  const [addingFor, setAddingFor]     = useState<AIProviderDef | null>(null)
  const [testingId, setTestingId]     = useState<string | null>(null)
  const [toasts, setToasts]           = useState<Toast[]>([])
  const [usageSummary, setUsageSummary] = useState<Record<string, ProviderUsage>>({})
  const [chartData, setChartData]       = useState<DayUsage[]>([])
  const confirm = useConfirm()

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }

  const getHeaders = useCallback(async () => {
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    return { Authorization: `Bearer ${session?.access_token}` }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const headers = await getHeaders()
      const [mlRes, credRes, chRes] = await Promise.allSettled([
        fetch(`${BACKEND}/ml/connections`,  { headers }),
        fetch(`${BACKEND}/credentials`,     { headers }),
        fetch(`${BACKEND}/marketplace-channels`, { headers }),
      ])
      const [sumRes, chartRes] = await Promise.allSettled([
        fetch(`${BACKEND}/ai-usage/summary`,    { headers }),
        fetch(`${BACKEND}/ai-usage/last30days`, { headers }),
      ])
      if (mlRes.status === 'fulfilled'    && mlRes.value.ok)    setMlConns(await mlRes.value.json())
      if (credRes.status === 'fulfilled'  && credRes.value.ok)  setCredentials(await credRes.value.json())
      if (chRes.status === 'fulfilled'    && chRes.value.ok)    setChannels(await chRes.value.json())
      if (sumRes.status === 'fulfilled'   && sumRes.value.ok)   setUsageSummary(await sumRes.value.json())
      if (chartRes.status === 'fulfilled' && chartRes.value.ok) setChartData(await chartRes.value.json())
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
    const ok = await confirm({
      title:        'Remover integração ML',
      message:      `Remover integração ML ${sellerId}?`,
      confirmLabel: 'Remover',
      variant:      'danger',
    })
    if (!ok) return
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
        showToast(result.ok ? `✅ ${result.message}` : `❌ ${result.message}`, result.ok ? 'success' : 'error')
      }
    } catch (e) {
      showToast(`❌ Erro: ${(e as Error).message}`, 'error')
    } finally { setTestingId(null) }
  }

  async function removeCredential(id: string, providerName: string) {
    const ok = await confirm({
      title:        'Remover chave',
      message:      `Tem certeza que deseja remover a chave ${providerName}? Esta ação não pode ser desfeita.`,
      confirmLabel: 'Remover',
      variant:      'danger',
    })
    if (!ok) return
    const headers = await getHeaders()
    await fetch(`${BACKEND}/credentials/${id}`, { method: 'DELETE', headers })
    setCredentials(prev => prev.filter(c => c.id !== id))
    showToast('Chave removida com sucesso', 'success')
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
          <p className="text-zinc-500 text-xs mt-1">Configure provedores de IA, marketplaces e mensageiros em um só lugar.</p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all disabled:opacity-60"
          style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {/* Anchor nav */}
      <div className="flex flex-wrap gap-2 sticky top-0 z-30 -mx-6 px-6 py-3" style={{ background: 'rgba(9,9,11,0.85)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #1e1e24' }}>
        {[
          { href: '#ia',           label: 'IA',           emoji: '🤖' },
          { href: '#marketplaces', label: 'Marketplaces', emoji: '🏪' },
          { href: '#mensageiros',  label: 'Mensageiros',  emoji: '💬' },
          { href: '#email',        label: 'Email',        emoji: '📧' },
        ].map(a => (
          <a key={a.href} href={a.href}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:bg-white/5"
            style={{ background: '#111114', color: '#a1a1aa', border: '1px solid #1e1e24' }}>
            <span>{a.emoji}</span> {a.label}
          </a>
        ))}
      </div>

      {/* ── Inteligência Artificial ──────────────────────────────────────── */}
      <Section id="ia" title="Inteligência Artificial" subtitle="Provedores de modelos de linguagem usados pelas features de IA do app." icon={<Bot size={13} />}>
        {AI_PROVIDERS_DEF.map(def => (
          <AIProviderCard
            key={def.id}
            def={def}
            cred={credByProvider(def.id)}
            usage={usageSummary[def.id]}
            onAdd={() => setAddingFor(def)}
            onTest={() => { const c = credByProvider(def.id); if (c) testCredential(c.id) }}
            onRemove={() => { const c = credByProvider(def.id); if (c) removeCredential(c.id, def.name) }}
            testing={testingId === credByProvider(def.id)?.id}
          />
        ))}
      </Section>

      {/* ── Custo IA — últimos 30 dias ──────────────────────────────────── */}
      {chartData.length > 0 && (
        <div className="rounded-2xl p-5 space-y-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
          <div className="flex items-center gap-2">
            <BarChart2 size={13} style={{ color: '#00E5FF' }} />
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Custo IA — últimos 30 dias (USD)</p>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: -24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e24" />
              <XAxis dataKey="date" tick={{ fill: '#52525b', fontSize: 9 }}
                tickFormatter={d => d.slice(5)} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#52525b', fontSize: 9 }}
                tickFormatter={v => `$${(v as number).toFixed(3)}`} />
              <Tooltip
                contentStyle={{ background: '#111114', border: '1px solid #1e1e24', borderRadius: 10 }}
                labelStyle={{ color: '#a1a1aa', fontSize: 10 }}
                itemStyle={{ fontSize: 10 }}
                formatter={(v) => [`$${(v as number).toFixed(5)}`, undefined]}
              />
              <Legend wrapperStyle={{ fontSize: 10, color: '#71717a' }} />
              <Line type="monotone" dataKey="anthropic_cost" stroke="#00E5FF" strokeWidth={1.5} dot={false} name="Claude" />
              <Line type="monotone" dataKey="openai_cost"    stroke="#22c55e" strokeWidth={1.5} dot={false} name="ChatGPT" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Marketplaces ─────────────────────────────────────────────────── */}
      <Section id="marketplaces" title="Marketplaces" subtitle="Conecte suas contas de marketplace para sincronizar estoque, preços e pedidos automaticamente." icon={<Zap size={13} />}>
        {/* ML uses the rich OAuth flow (multiple accounts, token expiry tracking). */}
        <IntegCard
          name="Mercado Livre" abbr="ML" abbrBg="rgba(255,230,0,0.15)" abbrColor="#FFE600"
          status={connecting ? 'disconnected' : overallMlStatus}
          description="OAuth 2.0 · token renovado automaticamente pelo backend."
          accounts={mlConns} onConnect={connectML} onDisconnect={disconnectML}
        />
        {/* Other channels — driven by marketplace_channels rows. */}
        {([
          { id: 'shopee',     name: 'Shopee',         abbr: 'SH', bg: 'rgba(238,77,45,0.15)',  fg: '#EE4D2D', desc: 'Sincronize pedidos, estoque e anúncios.' },
          { id: 'amazon',     name: 'Amazon',         abbr: 'AZ', bg: 'rgba(255,153,0,0.15)',  fg: '#FF9900', desc: 'Amazon Seller Central via SP-API.' },
          { id: 'magalu',     name: 'Magazine Luiza', abbr: 'MG', bg: 'rgba(0,134,255,0.15)',  fg: '#0086FF', desc: 'Magazine Luiza Marketplace.' },
          { id: 'americanas', name: 'Americanas',     abbr: 'AM', bg: 'rgba(232,0,45,0.15)',   fg: '#e8002d', desc: 'Marketplace Americanas.' },
          { id: 'netshoes',   name: 'Netshoes',       abbr: 'NS', bg: 'rgba(255,107,0,0.15)',  fg: '#FF6B00', desc: 'Marketplace Netshoes.' },
        ] as const).map(m => {
          const ch = channels.find(c => c.id === m.id)
          // Default to 'soon' if backend hasn't returned this channel yet (e.g. migration not run);
          // 'coming_soon' from API → soon; everything else available + not integrated → not_connected.
          const status: IntegStatus =
            !ch                                  ? 'soon'
            : ch.api_status === 'coming_soon'    ? 'soon'
            : ch.is_integrated && ch.integration_status === 'connected' ? 'connected'
            : ch.integration_status === 'expired' ? 'expired'
            : 'not_connected'
          const onConnect = status === 'soon'
            ? undefined
            : () => showToast(`OAuth para ${m.name} ainda não disponível — em breve`, 'error')
          return (
            <IntegCard key={m.id} name={m.name} abbr={m.abbr} abbrBg={m.bg} abbrColor={m.fg}
              status={status} description={m.desc} onConnect={onConnect} />
          )
        })}
      </Section>

      {/* ── Mensageiros ──────────────────────────────────────────────────── */}
      <Section id="mensageiros" title="Mensageiros" subtitle="Atendimento omnichannel em apps de mensagem." icon={<MessageCircle size={13} />}>
        <WhatsAppIntegCard onToast={showToast} />
        <WhatsAppFreeCard onToast={showToast} />
        {([
          { name: 'Instagram', abbr: 'IG', bg: 'rgba(228,64,95,0.15)',  fg: '#E4405F', desc: 'DMs e comentários via Instagram Graph API.' },
          { name: 'TikTok',    abbr: 'TT', bg: 'rgba(255,0,80,0.15)',   fg: '#ff0050', desc: 'Mensagens via TikTok Business API.' },
          { name: 'Telegram',  abbr: 'TG', bg: 'rgba(0,136,204,0.15)', fg: '#0088cc', desc: 'Bot Telegram via Bot API.' },
        ] as const).map(m => (
          <IntegCard key={m.name} name={m.name} abbr={m.abbr} abbrBg={m.bg} abbrColor={m.fg}
            status="soon" description={m.desc} />
        ))}
      </Section>

      {/* ── Email (Sprint EM-1) ──────────────────────────────────────────── */}
      <Section id="email" title="Email" subtitle="Provedor SMTP usado nas jornadas de comunicação pós-venda quando o canal escolhido é email." icon={<Mail size={13} />}>
        <EmailProviderCard onToast={showToast} />
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

      {/* Toast stack */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium shadow-xl"
            style={{
              background: t.type === 'success' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
              color:      t.type === 'success' ? '#4ade80' : '#f87171',
              border:     `1px solid ${t.type === 'success' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
              backdropFilter: 'blur(8px)',
            }}>
            {t.message}
          </div>
        ))}
      </div>

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

// ── WhatsApp Integration Card (Onda 2) ───────────────────────────────────

interface WaConfig {
  id:                   string
  phone_number_id:      string
  business_account_id:  string
  access_token:         string
  display_phone:        string | null
  display_name:         string | null
  verify_token:         string
  is_active:            boolean
  is_verified:          boolean
  last_verified_at:     string | null
}

type WizardStep = 'requirements' | 'credentials' | 'webhook' | 'done'

function WhatsAppIntegCard({ onToast }: { onToast: (msg: string, t?: 'success' | 'error') => void }) {
  const supabase = useMemo(() => createClient(), [])
  const [config, setConfig] = useState<WaConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<WizardStep>('requirements')
  const [wizardOpen, setWizardOpen] = useState(false)
  const [webhookInfo, setWebhookInfo] = useState<{ webhook_url: string; verify_token: string; is_verified: boolean } | null>(null)
  const [phoneNumberId, setPhoneNumberId] = useState('')
  const [wabaId, setWabaId]               = useState('')
  const [token, setToken]                 = useState('')
  const [displayPhone, setDisplayPhone]   = useState('')
  const [displayName, setDisplayName]     = useState('')
  const [saving, setSaving]               = useState(false)
  const [validating, setValidating]       = useState(false)
  const confirm = useConfirm()

  const getHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return { Authorization: `Bearer ${session?.access_token ?? ''}`, 'Content-Type': 'application/json' }
  }, [supabase])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/whatsapp/config`, { headers })
      const data = res.ok ? await res.json() as WaConfig | null : null
      setConfig(data)
      if (data) {
        const wRes = await fetch(`${BACKEND}/whatsapp/config/${data.id}/webhook-info`, { headers })
        if (wRes.ok) setWebhookInfo(await wRes.json())
      }
    } catch { /* silent */ } finally { setLoading(false) }
  }, [getHeaders])

  useEffect(() => { load() }, [load])

  async function save() {
    if (!phoneNumberId || !wabaId || !token) {
      onToast('Preencha phone_number_id, business_account_id e access_token', 'error'); return
    }
    setSaving(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/whatsapp/config`, {
        method: 'POST', headers,
        body: JSON.stringify({
          phone_number_id: phoneNumberId,
          business_account_id: wabaId,
          access_token: token,
          display_phone: displayPhone || undefined,
          display_name:  displayName  || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`)
      setConfig(data as WaConfig)
      const wRes = await fetch(`${BACKEND}/whatsapp/config/${data.id}/webhook-info`, { headers })
      if (wRes.ok) setWebhookInfo(await wRes.json())
      setPhoneNumberId(''); setWabaId(''); setToken(''); setDisplayPhone(''); setDisplayName('')
      setStep('webhook') // advance wizard
      onToast('Credenciais salvas — agora configure o webhook na Meta', 'success')
    } catch (e: unknown) {
      onToast(e instanceof Error ? e.message : 'Erro ao salvar', 'error')
    } finally { setSaving(false) }
  }

  async function validate() {
    if (!config) return
    setValidating(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/whatsapp/config/${config.id}/test`, { method: 'POST', headers })
      const data = await res.json() as { ok: boolean; display_phone_number?: string; verified_name?: string; error?: string }
      if (data.ok) onToast(`✅ Credenciais válidas — ${data.display_phone_number ?? ''} (${data.verified_name ?? ''})`, 'success')
      else         onToast(`❌ ${data.error ?? 'Falha na validação'}`, 'error')
    } catch (e: unknown) {
      onToast(e instanceof Error ? e.message : 'Erro ao validar', 'error')
    } finally { setValidating(false) }
  }

  async function checkWebhookVerified() {
    if (!config) return
    const headers = await getHeaders()
    const res = await fetch(`${BACKEND}/whatsapp/config/${config.id}/webhook-info`, { headers })
    if (res.ok) {
      const info = await res.json() as { is_verified: boolean }
      setWebhookInfo(prev => prev ? { ...prev, is_verified: info.is_verified } : prev)
      if (info.is_verified) {
        await load() // refresh config.is_verified too
        setStep('done')
        onToast('✅ Webhook verificado pela Meta!', 'success')
      } else {
        onToast('⏳ Ainda não verificado. Confirme que colou URL + token no painel da Meta e tente de novo.', 'error')
      }
    }
  }

  async function disconnect() {
    if (!config) return
    const ok = await confirm({
      title:        'Desconectar WhatsApp',
      message:      'Desconectar WhatsApp? As conversas existentes não são apagadas.',
      confirmLabel: 'Desconectar',
      variant:      'warning',
    })
    if (!ok) return
    const headers = await getHeaders()
    await fetch(`${BACKEND}/whatsapp/config/${config.id}`, { method: 'DELETE', headers })
    setConfig(null); setWebhookInfo(null); setWizardOpen(false); setStep('requirements')
    onToast('WhatsApp desconectado', 'success')
  }

  const isConnected = !!config?.is_active
  const isVerified  = !!config?.is_verified

  // Auto-advance wizard step based on current state when user opens wizard
  function openWizard() {
    setWizardOpen(true)
    if (config && webhookInfo) setStep(isVerified ? 'done' : 'webhook')
    else setStep('requirements')
  }

  return (
    <div className="rounded-2xl p-4 space-y-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center text-xs font-black"
            style={{ background: 'rgba(37,211,102,0.15)', color: '#25D366' }}>WA</div>
          <div>
            <p className="text-xs font-semibold text-zinc-200">WhatsApp Business</p>
            <p className="text-[10px] text-zinc-500 mt-0.5 leading-snug">
              {isConnected ? `Conectado · ${config.display_phone ?? config.phone_number_id}` : 'Atendimento via WhatsApp Business API (Meta).'}
            </p>
          </div>
        </div>
        {loading ? (
          <Loader2 size={12} className="animate-spin text-zinc-600 mt-2" />
        ) : isConnected ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
            style={{ background: isVerified ? 'rgba(74,222,128,0.1)' : 'rgba(251,191,36,0.1)', color: isVerified ? '#4ade80' : '#fbbf24' }}>
            <CheckCircle2 size={10} />{isVerified ? 'Conectado' : 'Aguardando webhook'}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
            style={{ background: 'rgba(251,146,60,0.1)', color: '#fb923c' }}>
            <Plug size={10} />Não integrado
          </span>
        )}
      </div>

      {/* Compact "open wizard" button when collapsed */}
      {!wizardOpen && (
        isConnected ? (
          <div className="flex gap-2 pt-1">
            <button onClick={openWizard} className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-semibold"
              style={{ background: '#1a1a1f', color: '#a1a1aa', border: '1px solid #27272a' }}>
              <Settings size={11} /> Configurações
            </button>
            <button onClick={disconnect}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold"
              style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.25)' }}>
              Desconectar
            </button>
          </div>
        ) : (
          <button onClick={openWizard}
            className="flex items-center gap-1.5 w-full justify-center py-2 rounded-xl text-xs font-semibold transition-all"
            style={{ background: 'rgba(37,211,102,0.1)', color: '#25D366', border: '1px solid rgba(37,211,102,0.25)' }}>
            <Plug size={11} /> Conectar WhatsApp
          </button>
        )
      )}

      {/* Wizard */}
      {wizardOpen && (
        <div className="space-y-3 pt-3" style={{ borderTop: '1px solid #1e1e24' }}>
          {/* Stepper */}
          <div className="flex items-center justify-between gap-1">
            {(['requirements', 'credentials', 'webhook', 'done'] as const).map((s, i) => {
              const ix = ['requirements', 'credentials', 'webhook', 'done'].indexOf(step)
              const labels = ['Requisitos', 'Credenciais', 'Webhook', 'Concluído']
              const passed = i < ix
              const current = i === ix
              const color = passed ? '#25D366' : current ? '#25D366' : '#3f3f46'
              return (
                <div key={s} className="flex items-center gap-1 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                      style={{ background: passed || current ? '#25D36633' : '#1a1a1f', color, border: `1px solid ${color}55` }}>
                      {passed ? '✓' : i + 1}
                    </span>
                    <span className="text-[10px] font-semibold whitespace-nowrap" style={{ color: current ? '#fff' : '#52525b' }}>
                      {labels[i]}
                    </span>
                  </div>
                  {i < 3 && <div className="flex-1 h-px" style={{ background: passed ? '#25D36655' : '#27272a' }} />}
                </div>
              )
            })}
          </div>

          {/* Step content */}
          {step === 'requirements' && (
            <div className="space-y-2 pt-1">
              <p className="text-[11px] text-zinc-400">Antes de conectar, verifique:</p>
              <ul className="space-y-1.5 text-[11px] text-zinc-500">
                <li className="flex items-start gap-2"><Check size={10} className="mt-0.5 text-zinc-600 shrink-0" /> Conta Meta Business verificada</li>
                <li className="flex items-start gap-2"><Check size={10} className="mt-0.5 text-zinc-600 shrink-0" /> App criado em developers.facebook.com com produto WhatsApp adicionado</li>
                <li className="flex items-start gap-2"><Check size={10} className="mt-0.5 text-zinc-600 shrink-0" /> Número dedicado (não pode ser WhatsApp pessoal)</li>
                <li className="flex items-start gap-2"><Check size={10} className="mt-0.5 text-zinc-600 shrink-0" /> Access Token <strong className="text-zinc-400">permanente</strong> gerado (não temporário)</li>
              </ul>
              <a href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started" target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-semibold mt-1" style={{ color: '#25D366' }}>
                <ExternalLink size={11} /> Como criar meu App Meta
              </a>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setWizardOpen(false)} className="flex-1 py-2 rounded-lg text-xs text-zinc-400 hover:text-white"
                  style={{ background: '#1e1e24', border: '1px solid #27272a' }}>Cancelar</button>
                <button onClick={() => setStep('credentials')}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold"
                  style={{ background: '#25D366', color: '#000' }}>Já tenho, continuar</button>
              </div>
            </div>
          )}

          {step === 'credentials' && (
            <div className="space-y-2.5 pt-1">
              <p className="text-[10px] uppercase tracking-widest text-zinc-500">Credenciais Meta</p>
              <input value={phoneNumberId} onChange={e => setPhoneNumberId(e.target.value)} placeholder="Phone Number ID"
                className="w-full bg-[#0d0d10] border border-[#27272a] text-white text-xs rounded-lg px-3 py-2 outline-none focus:border-[#25D366] font-mono" />
              <input value={wabaId} onChange={e => setWabaId(e.target.value)} placeholder="Business Account ID (WABA)"
                className="w-full bg-[#0d0d10] border border-[#27272a] text-white text-xs rounded-lg px-3 py-2 outline-none focus:border-[#25D366] font-mono" />
              <input type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="Access Token (permanente)"
                className="w-full bg-[#0d0d10] border border-[#27272a] text-white text-xs rounded-lg px-3 py-2 outline-none focus:border-[#25D366] font-mono" />
              <div className="grid grid-cols-2 gap-2">
                <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Nome (opcional)"
                  className="bg-[#0d0d10] border border-[#27272a] text-white text-xs rounded-lg px-3 py-2 outline-none focus:border-[#25D366]" />
                <input value={displayPhone} onChange={e => setDisplayPhone(e.target.value)} placeholder="+55 11 9..."
                  className="bg-[#0d0d10] border border-[#27272a] text-white text-xs rounded-lg px-3 py-2 outline-none focus:border-[#25D366]" />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setStep('requirements')} className="flex-1 py-2 rounded-lg text-xs text-zinc-400 hover:text-white"
                  style={{ background: '#1e1e24', border: '1px solid #27272a' }}>← Voltar</button>
                <button onClick={save} disabled={saving}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold disabled:opacity-50"
                  style={{ background: '#25D366', color: '#000' }}>
                  {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                  Salvar e continuar
                </button>
              </div>
            </div>
          )}

          {step === 'webhook' && webhookInfo && (
            <div className="space-y-2 pt-1">
              <p className="text-[11px] text-zinc-400">Configure este webhook no painel da Meta:</p>
              <CopyField label="URL do webhook" value={webhookInfo.webhook_url} />
              <CopyField label="Verify Token" value={webhookInfo.verify_token} />
              <p className="text-[10px] text-zinc-600">
                developers.facebook.com → seu app → WhatsApp → Configuration → Webhook.
                Assine: <code className="text-zinc-400">messages, message_statuses</code>.
              </p>
              <div className="flex gap-2 pt-1">
                <button onClick={validate} disabled={validating}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-semibold disabled:opacity-50"
                  style={{ background: '#1a1a1f', color: '#a1a1aa', border: '1px solid #27272a' }}>
                  {validating ? <Loader2 size={11} className="animate-spin" /> : <TestTube2 size={11} />}
                  Validar credenciais
                </button>
                <button onClick={checkWebhookVerified}
                  className="flex-1 py-2 rounded-lg text-[11px] font-semibold"
                  style={{ background: '#25D366', color: '#000' }}>
                  Webhook configurado, verificar
                </button>
              </div>
            </div>
          )}

          {step === 'done' && config && (
            <div className="space-y-3 pt-1 text-center">
              <div className="flex justify-center">
                <div className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.4)' }}>
                  <Check size={24} style={{ color: '#4ade80' }} />
                </div>
              </div>
              <div>
                <p className="text-sm font-bold text-white">WhatsApp conectado!</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">{config.display_phone ?? config.phone_number_id}</p>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setWizardOpen(false)} className="flex-1 py-2 rounded-lg text-xs text-zinc-400 hover:text-white"
                  style={{ background: '#1e1e24', border: '1px solid #27272a' }}>Fechar</button>
                <a href="/dashboard/atendente-ia/conversas"
                  className="flex-1 inline-flex items-center justify-center py-2 rounded-lg text-xs font-semibold"
                  style={{ background: '#25D366', color: '#000' }}>
                  Ver conversas →
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div>
      <p className="text-[10px] text-zinc-500 mb-0.5">{label}</p>
      <div className="flex items-center gap-1">
        <input readOnly value={value}
          className="flex-1 bg-[#0d0d10] border border-[#27272a] text-white text-[11px] rounded-lg px-2 py-1.5 font-mono" />
        <button onClick={() => navigator.clipboard.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })}
          className="px-2 py-1.5 rounded-lg text-[10px] font-semibold transition-colors shrink-0"
          style={{ background: copied ? 'rgba(74,222,128,0.15)' : '#1a1a1f', color: copied ? '#4ade80' : '#a1a1aa' }}>
          {copied ? '✓' : 'Copiar'}
        </button>
      </div>
    </div>
  )
}

// ── Email Integration Card (Sprint EM-1) ─────────────────────────────────

type EmailProvider = 'resend' | 'sendgrid'

interface EmailSettingsView {
  id:              string
  provider:        EmailProvider
  api_key_preview: string
  from_name:       string
  from_address:    string
  is_verified:     boolean
  last_tested_at:  string | null
  last_test_error: string | null
  updated_at:      string
}

const EMAIL_PROVIDERS: Array<{
  id: EmailProvider; name: string; abbr: string; bg: string; fg: string
  helpUrl: string; helpLabel: string; placeholder: string
}> = [
  {
    id: 'resend', name: 'Resend', abbr: 'RS', bg: 'rgba(0,0,0,0.4)', fg: '#fff',
    helpUrl: 'https://resend.com/api-keys', helpLabel: 'resend.com/api-keys',
    placeholder: 're_xxxxxxxxxxxx',
  },
  {
    id: 'sendgrid', name: 'SendGrid', abbr: 'SG', bg: 'rgba(30,168,242,0.15)', fg: '#1ea8f2',
    helpUrl: 'https://app.sendgrid.com/settings/api_keys', helpLabel: 'app.sendgrid.com',
    placeholder: 'SG.xxxxxxxxxxxx',
  },
]

function EmailProviderCard({ onToast }: { onToast: (msg: string, t?: 'success' | 'error') => void }) {
  const [config, setConfig] = useState<EmailSettingsView | null>(null)
  const [loading, setLoading] = useState(true)
  const [setupOpen, setSetupOpen] = useState(false)
  const [testing, setTesting] = useState(false)
  const confirm = useConfirm()

  const getHeaders = useCallback(async () => {
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    return { Authorization: `Bearer ${session?.access_token ?? ''}`, 'Content-Type': 'application/json' }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/email-settings`, { headers })
      if (res.ok) {
        const data = await res.json() as EmailSettingsView | null
        setConfig(data)
      }
    } catch { /* silent */ } finally { setLoading(false) }
  }, [getHeaders])

  useEffect(() => { load() }, [load])

  async function test() {
    if (!config) return
    setTesting(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/email-settings/test`, { method: 'POST', headers })
      const data = await res.json() as { ok: boolean; error?: string; recipient?: string }
      if (data.ok) onToast(`✅ Teste enviado pra ${data.recipient ?? 'você'}`, 'success')
      else         onToast(`❌ ${data.error ?? 'Falha no envio'}`, 'error')
      await load()
    } catch (e: unknown) {
      onToast(e instanceof Error ? e.message : 'Erro de rede', 'error')
    } finally { setTesting(false) }
  }

  async function remove() {
    const ok = await confirm({
      title:        'Remover configuração de email',
      message:      'Remover configuração de email? Templates de email param de funcionar até reconfigurar.',
      confirmLabel: 'Remover',
      variant:      'danger',
    })
    if (!ok) return
    const headers = await getHeaders()
    await fetch(`${BACKEND}/email-settings`, { method: 'DELETE', headers })
    setConfig(null)
    onToast('Configuração removida', 'success')
  }

  const providerDef = config ? EMAIL_PROVIDERS.find(p => p.id === config.provider) : null

  return (
    <div className="rounded-2xl p-4 space-y-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center"
            style={{ background: providerDef?.bg ?? 'rgba(0,229,255,0.15)' }}>
            <Mail size={15} style={{ color: providerDef?.fg ?? '#00E5FF' }} />
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-200">
              {config ? `Email · ${providerDef?.name ?? config.provider}` : 'Email transacional'}
            </p>
            <p className="text-[10px] text-zinc-500 mt-0.5 leading-snug">
              {config
                ? `${config.from_name} <${config.from_address}>`
                : 'Resend ou SendGrid · usado pelas jornadas de comunicação.'}
            </p>
          </div>
        </div>
        {loading ? (
          <Loader2 size={12} className="animate-spin text-zinc-600 mt-2" />
        ) : config ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
            style={{
              background: config.is_verified ? 'rgba(74,222,128,0.1)' : 'rgba(251,191,36,0.1)',
              color:      config.is_verified ? '#4ade80' : '#fbbf24',
            }}>
            <CheckCircle2 size={10} />{config.is_verified ? 'Conectado' : 'Sem teste'}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
            style={{ background: 'rgba(251,146,60,0.1)', color: '#fb923c' }}>
            <Plug size={10} />Não integrado
          </span>
        )}
      </div>

      {config && (
        <div className="px-3 py-2 rounded-xl space-y-1" style={{ background: '#0d0d10' }}>
          <div className="flex items-center gap-2">
            <Key size={10} style={{ color: '#52525b' }} />
            <span className="text-[11px] font-mono text-zinc-400">{config.api_key_preview}</span>
          </div>
          {config.last_tested_at && (
            <p className="flex items-center gap-1 text-[10px] flex-wrap"
              style={{ color: config.is_verified ? '#4ade80' : '#f87171' }}>
              {config.is_verified ? '✅' : '❌'}
              <span>{config.is_verified ? 'Teste OK' : config.last_test_error ?? 'falhou'}</span>
              <span className="text-zinc-600">· {timeAgo(config.last_tested_at) ?? 'agora'}</span>
            </p>
          )}
        </div>
      )}

      {!config ? (
        <button onClick={() => setSetupOpen(true)}
          className="flex items-center gap-1.5 w-full justify-center py-2 rounded-xl text-xs font-semibold transition-all"
          style={{ background: 'rgba(0,229,255,0.1)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.25)' }}>
          <Plug size={11} /> Configurar
        </button>
      ) : (
        <div className="flex gap-2">
          <button onClick={test} disabled={testing}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium disabled:opacity-50"
            style={{ background: '#1e1e24', color: '#a1a1aa' }}>
            {testing ? <Loader2 size={11} className="animate-spin" /> : <TestTube2 size={11} />}
            Testar envio
          </button>
          <button onClick={() => setSetupOpen(true)}
            className="inline-flex items-center justify-center p-2 rounded-xl"
            style={{ background: '#1e1e24', color: '#a1a1aa' }}
            title="Editar">
            <Settings size={12} />
          </button>
          <button onClick={remove}
            className="inline-flex items-center justify-center p-2 rounded-xl text-zinc-600"
            style={{ background: '#1e1e24' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#71717a'; e.currentTarget.style.background = '#1e1e24' }}>
            <Trash2 size={12} />
          </button>
        </div>
      )}

      {setupOpen && (
        <EmailSetupModal
          existing={config}
          onClose={() => setSetupOpen(false)}
          onSaved={(saved, testResult) => {
            setConfig(saved)
            setSetupOpen(false)
            if (testResult?.ok) onToast(`✅ Email salvo e teste enviado pra ${testResult.recipient ?? 'você'}`, 'success')
            else if (testResult)  onToast(`⚠ Salvo, mas teste falhou: ${testResult.error}`, 'error')
            else                  onToast('Configuração salva', 'success')
            void load()
          }}
        />
      )}
    </div>
  )
}

function EmailSetupModal({ existing, onClose, onSaved }: {
  existing: EmailSettingsView | null
  onClose:  () => void
  onSaved:  (saved: EmailSettingsView, test: { ok: boolean; error?: string; recipient?: string } | null) => void
}) {
  const [provider, setProvider] = useState<EmailProvider>(existing?.provider ?? 'resend')
  const [apiKey, setApiKey]     = useState('')
  const [showKey, setShowKey]   = useState(false)
  const [fromName, setFromName] = useState(existing?.from_name ?? '')
  const [fromAddress, setFromAddress] = useState(existing?.from_address ?? '')
  const [step, setStep]   = useState<'pick' | 'fill'>(existing ? 'fill' : 'pick')
  const [saving, setSaving] = useState(false)

  const def = EMAIL_PROVIDERS.find(p => p.id === provider)!

  async function save() {
    if (!apiKey.trim() || !fromName.trim() || !fromAddress.trim()) return
    setSaving(true)
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      const headers = { Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' }

      const saveRes = await fetch(`${BACKEND}/email-settings`, {
        method: 'POST', headers,
        body: JSON.stringify({ provider, api_key: apiKey, from_name: fromName, from_address: fromAddress }),
      })
      if (!saveRes.ok) {
        const err = await saveRes.json().catch(() => ({})) as { message?: string }
        onSaved(existing as EmailSettingsView, { ok: false, error: err.message ?? `HTTP ${saveRes.status}` })
        return
      }
      const saved = await saveRes.json() as EmailSettingsView

      const testRes = await fetch(`${BACKEND}/email-settings/test`, { method: 'POST', headers })
      const testData = await testRes.json() as { ok: boolean; error?: string; recipient?: string }
      onSaved(saved, testData)
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
            <Mail size={15} style={{ color: '#00E5FF' }} />
            <p className="text-sm font-semibold text-white">
              {existing ? 'Editar configuração de email' : 'Configurar email'}
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300"><X size={16} /></button>
        </div>

        {step === 'pick' && (
          <div className="px-5 py-5 space-y-3">
            <p className="text-xs text-zinc-400">Escolha o provedor:</p>
            <div className="grid grid-cols-2 gap-3">
              {EMAIL_PROVIDERS.map(p => (
                <button key={p.id} onClick={() => { setProvider(p.id); setStep('fill') }}
                  className="rounded-xl p-3 transition-colors text-left"
                  style={{ background: '#0d0d10', border: `1px solid ${provider === p.id ? '#00E5FF' : '#27272a'}` }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black"
                      style={{ background: p.bg, color: p.fg }}>{p.abbr}</div>
                    <p className="text-xs font-semibold text-zinc-200">{p.name}</p>
                  </div>
                  <a href={p.helpUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                    className="text-[10px] flex items-center gap-1" style={{ color: '#00E5FF' }}>
                    <ExternalLink size={9} />{p.helpLabel}
                  </a>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'fill' && (
          <div className="px-5 py-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-400">Provider: <span className="text-zinc-200 font-semibold">{def.name}</span></p>
              {!existing && (
                <button onClick={() => setStep('pick')} className="text-[10px] text-zinc-500 hover:text-zinc-300">← Trocar</button>
              )}
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">API Key {existing && <span className="text-zinc-600">· deixe em branco pra manter atual</span>}</label>
              <div className="relative">
                <input type={showKey ? 'text' : 'password'} value={apiKey} onChange={e => setApiKey(e.target.value)}
                  placeholder={def.placeholder}
                  className="w-full pl-3 pr-10 py-2.5 rounded-xl text-sm text-white placeholder-zinc-600 font-mono"
                  style={{ background: '#0d0d10', border: '1px solid #27272a' }} />
                <button onClick={() => setShowKey(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Nome remetente</label>
                <input value={fromName} onChange={e => setFromName(e.target.value)}
                  placeholder="e-Click Comercio"
                  className="w-full px-3 py-2 rounded-xl text-xs text-white placeholder-zinc-600"
                  style={{ background: '#0d0d10', border: '1px solid #27272a' }} />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Email remetente</label>
                <input type="email" value={fromAddress} onChange={e => setFromAddress(e.target.value)}
                  placeholder="noreply@seudominio.com.br"
                  className="w-full px-3 py-2 rounded-xl text-xs text-white placeholder-zinc-600"
                  style={{ background: '#0d0d10', border: '1px solid #27272a' }} />
              </div>
            </div>

            <p className="text-[10px] text-zinc-600">
              Após salvar, dispara um email de teste pro endereço da sua conta. SPF/DKIM precisam estar OK no domínio do remetente.
            </p>
          </div>
        )}

        <div className="flex justify-between px-5 py-4" style={{ borderTop: '1px solid #1e1e24' }}>
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-zinc-400"
            style={{ background: '#1e1e24' }}>Cancelar</button>
          {step === 'fill' && (
            <button onClick={save}
              disabled={!apiKey.trim() || !fromName.trim() || !fromAddress.trim() || saving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
              style={{ background: '#00E5FF', color: '#000' }}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : <TestTube2 size={13} />}
              Salvar e testar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── WhatsApp Gratuito (Baileys) — refatorado pra channels + Socket.IO ─────

interface WaChannel {
  id: string
  channel_type: 'whatsapp_free'
  name: string
  status: 'pending' | 'active' | 'paused' | 'error' | 'disconnected'
  phone_number: string | null
  external_id: string | null  // displayName quando active
  error_message: string | null
  created_at: string
}

function WhatsAppFreeCard({ onToast }: { onToast: (msg: string, t?: 'success' | 'error') => void }) {
  const supabase = useMemo(() => createClient(), [])
  const [channel, setChannel] = useState<WaChannel | null>(null)
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [qrBase64, setQrBase64] = useState<string | null>(null)
  const [qrExpired, setQrExpired] = useState(false)
  const [busy, setBusy] = useState(false)
  const confirm = useConfirm()

  const getHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession()
    return {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    }
  }, [supabase])

  const fetchChannel = useCallback(async () => {
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/channels`, { headers })
      if (res.ok) {
        const rows = (await res.json()) as WaChannel[]
        const wa = rows.find(c => c.channel_type === 'whatsapp_free') ?? null
        setChannel(wa)
      }
    } finally {
      setLoading(false)
    }
  }, [getHeaders])

  useEffect(() => { fetchChannel() }, [fetchChannel])

  // Socket.IO listener — eventos do worker via /internal/realtime
  useEffect(() => {
    let active = true
    const handlers: Array<{ event: string; handler: (...a: unknown[]) => void }> = []
    void (async () => {
      try {
        const socket = await getSocket()
        if (!active) return

        const onQr = async (payload: { channel_id: string; qr: string }) => {
          if (channel && payload.channel_id !== channel.id) return
          const dataUrl = await qrToDataUrl(payload.qr).catch(() => null)
          if (dataUrl) {
            setQrBase64(dataUrl)
            setQrExpired(false)
          }
        }
        const onConnected = (payload: { channel_id: string; phone_number: string; display_name?: string }) => {
          setChannel(prev => prev ? {
            ...prev,
            status: 'active',
            phone_number: payload.phone_number || prev.phone_number,
            external_id: payload.display_name ?? prev.external_id,
            error_message: null,
          } : prev)
          onToast(`WhatsApp Gratuito conectado: ${payload.display_name ?? payload.phone_number}`, 'success')
          setTimeout(() => setDialogOpen(false), 1500)
        }
        const onDisconnected = (payload: { channel_id: string; reason: string; needs_reauth?: boolean }) => {
          setChannel(prev => prev ? { ...prev, status: 'disconnected', error_message: payload.reason } : prev)
          if (payload.needs_reauth) onToast('WhatsApp desconectado — reescaneie o QR', 'error')
        }

        socket.on('whatsapp:qr', onQr)
        socket.on('whatsapp:connected', onConnected)
        socket.on('whatsapp:disconnected', onDisconnected)
        handlers.push(
          { event: 'whatsapp:qr',           handler: onQr as (...a: unknown[]) => void },
          { event: 'whatsapp:connected',    handler: onConnected as (...a: unknown[]) => void },
          { event: 'whatsapp:disconnected', handler: onDisconnected as (...a: unknown[]) => void },
        )
      } catch {
        // socket falhou — fallback é polling no fetchChannel
      }
    })()
    return () => {
      active = false
      // Não disconnect — singleton compartilhado. Só remove handlers.
      void (async () => {
        try {
          const socket = await getSocket()
          for (const { event, handler } of handlers) socket.off(event, handler)
        } catch { /* ignore */ }
      })()
    }
  }, [channel, onToast])

  // QR timeout 90s
  useEffect(() => {
    if (!dialogOpen || !qrBase64 || channel?.status === 'active') return
    const t = setTimeout(() => setQrExpired(true), 90_000)
    return () => clearTimeout(t)
  }, [dialogOpen, qrBase64, channel?.status])

  async function connect() {
    setBusy(true)
    setQrBase64(null)
    setQrExpired(false)
    setDialogOpen(true)
    try {
      const headers = await getHeaders()
      // Se já existe canal disconnected/error, recria do zero (DELETE → POST)
      if (channel && channel.status !== 'pending' && channel.status !== 'active') {
        await fetch(`${BACKEND}/channels/${channel.id}`, { method: 'DELETE', headers })
      }
      // Cria canal pending — worker pega no polling e gera QR
      const res = await fetch(`${BACKEND}/channels`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ channel_type: 'whatsapp_free', name: 'WhatsApp Gratuito' }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({} as { message?: string }))
        throw new Error(err.message ?? 'Falha ao conectar')
      }
      const created = (await res.json()) as WaChannel
      setChannel(created)
    } catch (e) {
      onToast((e as Error).message, 'error')
      setDialogOpen(false)
    } finally {
      setBusy(false)
    }
  }

  async function disconnect() {
    const ok = await confirm({
      title:        'Desconectar WhatsApp Gratuito',
      message:      'Desconectar WhatsApp Gratuito? Você precisará escanear o QR novamente.',
      confirmLabel: 'Desconectar',
      variant:      'warning',
    })
    if (!ok) return
    if (!channel) return
    setBusy(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/channels/${channel.id}`, { method: 'DELETE', headers })
      if (!res.ok) throw new Error('Falha ao desconectar')
      setChannel(null)
      onToast('WhatsApp Gratuito desconectado', 'success')
    } catch (e) {
      onToast((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  function closeDialog() {
    setDialogOpen(false)
    fetchChannel()
  }

  const isActive = channel?.status === 'active'
  // worker_online não é mais consultável diretamente — assumimos true até prova contrária
  const workerOffline = false

  return (
    <>
      <div className="rounded-2xl p-4 space-y-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center text-xs font-black"
              style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>WG</div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold text-zinc-200">WhatsApp Gratuito</p>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                  style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>GRÁTIS</span>
              </div>
              <p className="text-[10px] text-zinc-500 mt-0.5 leading-snug">
                {isActive
                  ? `Conectado · ${channel?.external_id ?? channel?.phone_number ?? '—'}`
                  : 'Conecte seu WhatsApp direto, sem custo. Uso interno recomendado.'}
              </p>
            </div>
          </div>
          {loading ? (
            <Loader2 size={12} className="animate-spin text-zinc-600 mt-2" />
          ) : workerOffline ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
              style={{ background: 'rgba(113,113,122,0.15)', color: '#a1a1aa' }}>
              <AlertCircle size={10} />Serviço offline
            </span>
          ) : isActive ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
              style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80' }}>
              <CheckCircle2 size={10} />Ativo
            </span>
          ) : channel?.status === 'error' ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
              style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171' }}>
              <XCircle size={10} />Erro
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
              style={{ background: 'rgba(251,146,60,0.1)', color: '#fb923c' }}>
              <Plug size={10} />Não conectado
            </span>
          )}
        </div>

        {!isActive && !workerOffline && (
          <p className="text-[10px] text-zinc-600 leading-snug">
            ⚠️ Uso intenso pode levar a restrição pelo WhatsApp. Recomendamos para volume baixo/atendimento manual.
          </p>
        )}

        {workerOffline ? (
          <div className="text-[11px] text-zinc-500 px-3 py-2 rounded-lg" style={{ background: '#0d0d10', border: '1px solid #27272a' }}>
            Serviço temporariamente indisponível.
          </div>
        ) : isActive ? (
          <button onClick={disconnect} disabled={busy}
            className="inline-flex items-center justify-center gap-1.5 w-full py-2 rounded-xl text-xs font-semibold disabled:opacity-40"
            style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.25)' }}>
            {busy ? <Loader2 size={11} className="animate-spin" /> : null}
            Desconectar
          </button>
        ) : (
          <button onClick={connect} disabled={busy}
            className="flex items-center gap-1.5 w-full justify-center py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-40"
            style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)' }}>
            {busy ? <Loader2 size={11} className="animate-spin" /> : <Plug size={11} />}
            Conectar
          </button>
        )}
      </div>

      {/* Dialog QR */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="relative w-full max-w-sm rounded-2xl overflow-hidden"
            style={{ background: '#111114', border: '1px solid #1e1e24' }}>
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid #1e1e24' }}>
              <p className="text-sm font-semibold text-zinc-200">Conectar WhatsApp Gratuito</p>
              <button onClick={closeDialog} className="text-zinc-500 hover:text-white"><X size={16} /></button>
            </div>

            <div className="px-5 py-6 flex flex-col items-center gap-4">
              {channel?.status === 'active' ? (
                <>
                  <CheckCircle2 size={48} style={{ color: '#22c55e' }} />
                  <p className="text-sm font-bold text-white">Conectado!</p>
                  <p className="text-xs text-zinc-400 text-center">
                    {channel.external_id ?? '—'}<br/>
                    {channel.phone_number ?? ''}
                  </p>
                  <button onClick={closeDialog}
                    className="w-full py-2 rounded-xl text-xs font-semibold"
                    style={{ background: '#22c55e', color: '#000' }}>Fechar</button>
                </>
              ) : qrExpired ? (
                <>
                  <AlertCircle size={36} style={{ color: '#fb923c' }} />
                  <p className="text-sm text-zinc-300 text-center">QR expirado.</p>
                  <button onClick={connect} disabled={busy}
                    className="w-full py-2 rounded-xl text-xs font-semibold disabled:opacity-40"
                    style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}>
                    Gerar novo QR
                  </button>
                </>
              ) : qrBase64 ? (
                <>
                  <div className="rounded-xl p-2" style={{ background: '#fff' }}>
                    <img src={qrBase64} alt="QR Code" width={250} height={250} />
                  </div>
                  <div className="text-[11px] text-zinc-400 text-center leading-relaxed">
                    Abra o WhatsApp no celular →<br/>
                    <strong className="text-zinc-200">⋮ → Aparelhos conectados → Conectar aparelho</strong>
                  </div>
                </>
              ) : (
                <>
                  <Loader2 size={36} className="animate-spin text-zinc-500" />
                  <p className="text-xs text-zinc-400">Gerando QR code...</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
