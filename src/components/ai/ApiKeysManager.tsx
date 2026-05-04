'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import {
  Bot, Key, Trash2, TestTube2, Plus, Loader2, X,
  CheckCircle2, AlertCircle, Eye, EyeOff, ExternalLink,
} from 'lucide-react'
import { useConfirm } from '@/components/ui/dialog-provider'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

// ── Types ────────────────────────────────────────────────────────────────

export interface ApiKeysCredential {
  id: string
  provider: string
  key_name: string
  key_preview: string
  is_active: boolean
  last_tested_at?: string
  last_test_status?: string
  last_test_message?: string
}

interface ProviderDef {
  id:          string
  name:        string
  keyName:     string
  placeholder: string
  helpUrl:     string
  helpLabel:   string
  helpText:    string
}

const PROVIDERS: ProviderDef[] = [
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

interface Toast { id: number; message: string; type: 'success' | 'error' }

// ── Component ────────────────────────────────────────────────────────────

/** Standalone manager pras API keys de IA (Anthropic + OpenAI). Lê/grava
 * em api_credentials via /credentials. Self-contained — pode ser embed
 * em qualquer página. Foi extraído de /configuracoes/integracoes
 * pra reutilização em /configuracoes/ia (Sprint AI-ABS-1). */
export default function ApiKeysManager() {
  const supabase = useMemo(() => createClient(), [])
  const [credentials, setCredentials] = useState<ApiKeysCredential[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState<ProviderDef | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const confirm = useConfirm()

  function showToast(message: string, type: Toast['type'] = 'success') {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }

  const getHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return {
      Authorization: `Bearer ${session?.access_token ?? ''}`,
      'Content-Type': 'application/json',
    }
  }, [supabase])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/credentials`, { headers })
      if (res.ok) {
        const v = await res.json()
        setCredentials(Array.isArray(v) ? v : [])
      }
    } finally { setLoading(false) }
  }, [getHeaders])

  useEffect(() => { load() }, [load])

  async function testCred(id: string) {
    setTestingId(id)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/credentials/${id}/test`, { method: 'POST', headers })
      const result: { ok: boolean; message: string } = await res.json()
      setCredentials(prev => prev.map(c => c.id === id
        ? { ...c, last_test_status: result.ok ? 'ok' : 'error', last_test_message: result.message, last_tested_at: new Date().toISOString() }
        : c))
      showToast(result.ok ? `✅ ${result.message}` : `❌ ${result.message}`, result.ok ? 'success' : 'error')
    } catch (e) {
      showToast(`❌ Erro: ${(e as Error).message}`, 'error')
    } finally { setTestingId(null) }
  }

  async function removeCred(id: string, providerName: string) {
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
    showToast('Chave removida', 'success')
  }

  const credByProvider = (provider: string) => credentials.find(c => c.provider === provider)

  return (
    <div className="space-y-3">
      <div className="rounded-xl px-4 py-3 text-[11px] flex items-start gap-2"
        style={{ background: 'rgba(0,229,255,0.05)', border: '1px solid rgba(0,229,255,0.2)', color: '#a5f3fc' }}>
        <AlertCircle size={12} className="mt-0.5 shrink-0" />
        <span>As chaves são criptografadas (AES-256-CBC) antes de salvar. Você pode trocá-las a qualquer momento — todas as features que usam IA pegam a chave nova automaticamente.</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {PROVIDERS.map(def => {
          const cred = credByProvider(def.id)
          const hasKey = !!cred
          const testOk = cred?.last_test_status === 'ok'
          return (
            <div key={def.id} className="rounded-2xl p-4 space-y-3"
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

              <div className="flex gap-2">
                {!hasKey ? (
                  <button onClick={() => setAdding(def)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold"
                    style={{ background: 'rgba(0,229,255,0.1)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.25)' }}>
                    <Plus size={12} /> Adicionar chave
                  </button>
                ) : (
                  <>
                    <button onClick={() => testCred(cred.id)} disabled={testingId === cred.id}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium disabled:opacity-50"
                      style={{ background: '#1e1e24', color: '#a1a1aa' }}>
                      {testingId === cred.id ? <Loader2 size={11} className="animate-spin" /> : <TestTube2 size={11} />}
                      Testar
                    </button>
                    <button onClick={() => removeCred(cred.id, def.name)}
                      className="flex items-center justify-center p-2 rounded-xl text-zinc-600"
                      style={{ background: '#1e1e24' }}>
                      <Trash2 size={12} />
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {loading && <p className="text-zinc-600 text-xs text-center py-2">Carregando…</p>}

      {adding && (
        <AddKeyModal provider={adding}
          onClose={() => setAdding(null)}
          onSaved={cred => {
            setCredentials(prev => [...prev.filter(c => c.id !== cred.id), cred])
            setAdding(null)
            showToast('Chave salva', 'success')
          }} />
      )}

      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id}
            className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium shadow-2xl pointer-events-auto"
            style={{
              background: t.type === 'error' ? '#1a0a0a' : '#111114',
              border: `1px solid ${t.type === 'error' ? 'rgba(248,113,113,0.3)' : 'rgba(74,222,128,0.3)'}`,
              color: t.type === 'error' ? '#f87171' : '#4ade80',
            }}>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Add key modal ─────────────────────────────────────────────────────────

function AddKeyModal({ provider, onClose, onSaved }: {
  provider: ProviderDef
  onClose: () => void
  onSaved: (cred: ApiKeysCredential) => void
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

      const saveRes = await fetch(`${BACKEND}/credentials`, {
        method: 'POST', headers,
        body: JSON.stringify({ provider: provider.id, key_name: provider.keyName, key_value: value }),
      })
      if (!saveRes.ok) throw new Error('Falha ao salvar')
      const cred: ApiKeysCredential = await saveRes.json()

      const testRes = await fetch(`${BACKEND}/credentials/${cred.id}/test`, { method: 'POST', headers })
      const testData: { ok: boolean; message: string } = await testRes.json()
      setResult(testData)

      if (testData.ok) {
        setTimeout(() => onSaved({ ...cred, last_test_status: 'ok', last_test_message: testData.message, last_tested_at: new Date().toISOString() }), 1000)
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
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300"><X size={16} /></button>
        </div>

        <div className="px-5 py-5 space-y-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Cole sua API Key</label>
            <div className="relative">
              <input type={show ? 'text' : 'password'} value={value}
                onChange={e => setValue(e.target.value)}
                placeholder={provider.placeholder}
                className="w-full pl-3 pr-10 py-2.5 rounded-xl text-sm text-white placeholder-zinc-600 font-mono"
                style={{ background: '#0d0d10', border: '1px solid #27272a' }}
                autoFocus />
              <button onClick={() => setShow(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                {show ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div className="rounded-xl p-3 space-y-1" style={{ background: '#0d0d10', border: '1px solid #1e1e24' }}>
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide">Como obter sua chave</p>
            <p className="text-xs text-zinc-400">{provider.helpText}</p>
            <a href={provider.helpUrl} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 text-[11px]" style={{ color: '#00E5FF' }}>
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
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-zinc-400"
            style={{ background: '#1e1e24' }}>Cancelar</button>
          <button onClick={save} disabled={!value.trim() || saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
            style={{ background: '#00E5FF', color: '#000' }}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : <TestTube2 size={13} />}
            Salvar e testar
          </button>
        </div>
      </div>
    </div>
  )
}
