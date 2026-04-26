'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { MessageSquare, Plus, Code2, Loader2, X, Save, Copy, Check, Trash2, ToggleLeft, ToggleRight, Eye } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface ChatWidget {
  id:               string
  name:             string
  agent_id:         string | null
  welcome_message:  string
  placeholder_text: string
  theme_color:      string
  position:         'bottom-right' | 'bottom-left'
  require_name:     boolean
  require_email:    boolean
  require_phone:    boolean
  allowed_origins:  string[]
  is_active:        boolean
  widget_token:     string
  created_at:       string
}

interface Agent { id: string; name: string }

interface Snippet { html: string; widget_token: string; preview_url: string }

export default function WidgetPage() {
  const supabase = useMemo(() => createClient(), [])
  const [widgets, setWidgets] = useState<ChatWidget[]>([])
  const [agents, setAgents]   = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [snippetFor, setSnippetFor] = useState<{ widget: ChatWidget; snippet: Snippet | null; loading: boolean } | null>(null)

  const getHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return { Authorization: `Bearer ${session?.access_token ?? ''}` }
  }, [supabase])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const headers = await getHeaders()
      const [wRes, aRes] = await Promise.all([
        fetch(`${BACKEND}/widgets`, { headers }),
        fetch(`${BACKEND}/atendente-ia/agents`, { headers }),
      ])
      if (wRes.ok) {
        const w = await wRes.json()
        setWidgets(Array.isArray(w) ? w : [])
      }
      if (aRes.ok) {
        const a = await aRes.json()
        setAgents(Array.isArray(a) ? a : [])
      }
    } catch { /* silent */ } finally { setLoading(false) }
  }, [getHeaders])

  useEffect(() => { load() }, [load])

  async function toggleActive(w: ChatWidget) {
    const headers = await getHeaders()
    await fetch(`${BACKEND}/widgets/${w.id}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !w.is_active }),
    })
    load()
  }

  async function deleteWidget(w: ChatWidget) {
    if (!confirm(`Excluir widget "${w.name}"? Sessões e conversas associadas continuam preservadas.`)) return
    const headers = await getHeaders()
    await fetch(`${BACKEND}/widgets/${w.id}`, { method: 'DELETE', headers })
    load()
  }

  async function showSnippet(w: ChatWidget) {
    setSnippetFor({ widget: w, snippet: null, loading: true })
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/widgets/${w.id}/snippet`, { headers })
      const snippet = res.ok ? await res.json() as Snippet : null
      setSnippetFor({ widget: w, snippet, loading: false })
    } catch {
      setSnippetFor({ widget: w, snippet: null, loading: false })
    }
  }

  return (
    <div className="min-h-screen p-6 space-y-6" style={{ background: '#09090b' }}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <MessageSquare size={22} style={{ color: '#00E5FF' }} /> Widget de Chat
          </h1>
          <p className="text-zinc-500 text-sm mt-1">Cole um snippet de JS no seu site e o chat aparece pronto.</p>
        </div>
        <button onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
          style={{ background: '#00E5FF', color: '#000' }}>
          <Plus size={15} /> Criar Widget
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 size={22} className="animate-spin text-zinc-600" /></div>
      ) : widgets.length === 0 ? (
        <div className="rounded-2xl p-10 text-center" style={{ background: '#0d0d10', border: '1px dashed #2a2a3f' }}>
          <div className="flex justify-center mb-3"><MessageSquare size={40} style={{ color: '#3f3f46' }} /></div>
          <h3 className="text-base font-bold text-white mb-1">Nenhum widget criado</h3>
          <p className="text-xs text-zinc-500 max-w-md mx-auto leading-relaxed mb-4">
            Crie um widget pra cada site/landing page onde quer expor o chat com IA.
            Você gera um snippet HTML e cola antes do <code className="text-zinc-400">{'</body>'}</code>.
          </p>
          <button onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: '#00E5FF', color: '#000' }}>
            <Plus size={14} /> Criar primeiro widget
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {widgets.map(w => (
            <WidgetCard key={w.id} widget={w} agents={agents}
              onSnippet={() => showSnippet(w)}
              onToggle={() => toggleActive(w)}
              onDelete={() => deleteWidget(w)} />
          ))}
        </div>
      )}

      {createOpen && (
        <CreateWidgetModal agents={agents} onClose={() => setCreateOpen(false)}
          onCreated={(created) => { setCreateOpen(false); load(); showSnippet(created) }} />
      )}

      {snippetFor && (
        <SnippetModal data={snippetFor} onClose={() => setSnippetFor(null)} />
      )}
    </div>
  )
}

// ── Widget card ─────────────────────────────────────────────────────────────

function WidgetCard({ widget, agents, onSnippet, onToggle, onDelete }: {
  widget: ChatWidget
  agents: Agent[]
  onSnippet: () => void
  onToggle: () => void
  onDelete: () => void
}) {
  const agentName = agents.find(a => a.id === widget.agent_id)?.name ?? '— sem agente —'
  return (
    <div className="rounded-2xl p-4 space-y-3" style={{ background: '#111114', border: `1px solid ${widget.is_active ? 'rgba(0,229,255,0.15)' : '#1e1e24'}` }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: widget.theme_color }}>
            <MessageSquare size={16} color="#000" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{widget.name}</p>
            <p className="text-[11px] text-zinc-500 truncate">Agente: {agentName}</p>
          </div>
        </div>
        <button onClick={onToggle} title={widget.is_active ? 'Desativar' : 'Ativar'} className="text-zinc-500 hover:text-white shrink-0">
          {widget.is_active ? <ToggleRight size={20} style={{ color: '#00E5FF' }} /> : <ToggleLeft size={20} />}
        </button>
      </div>

      <div className="text-[11px] text-zinc-600 space-y-0.5">
        <div>Posição: <span className="text-zinc-400">{widget.position}</span></div>
        <div>Cor: <span className="font-mono" style={{ color: widget.theme_color }}>{widget.theme_color}</span></div>
        <div>Campos obrigatórios: <span className="text-zinc-400">
          {[widget.require_name && 'nome', widget.require_email && 'email', widget.require_phone && 'telefone'].filter(Boolean).join(', ') || 'nenhum'}
        </span></div>
      </div>

      <div className="flex gap-2 pt-1">
        <button onClick={onSnippet}
          className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
          style={{ background: 'rgba(0,229,255,0.08)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.25)' }}>
          <Code2 size={12} /> Ver snippet
        </button>
        <button onClick={onDelete} title="Excluir"
          className="p-1.5 rounded-lg transition-colors text-zinc-500 hover:text-red-400 hover:bg-red-400/10">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

// ── Create widget modal ─────────────────────────────────────────────────────

function CreateWidgetModal({ agents, onClose, onCreated }: { agents: Agent[]; onClose: () => void; onCreated: (w: ChatWidget) => void }) {
  const supabase = useMemo(() => createClient(), [])
  const [name,        setName]        = useState('')
  const [agentId,     setAgentId]     = useState(agents[0]?.id ?? '')
  const [welcome,     setWelcome]     = useState('Olá! Como posso ajudar?')
  const [placeholder, setPlaceholder] = useState('Digite sua mensagem...')
  const [color,       setColor]       = useState('#00E5FF')
  const [position,    setPosition]    = useState<'bottom-right' | 'bottom-left'>('bottom-right')
  const [reqName,     setReqName]     = useState(false)
  const [reqEmail,    setReqEmail]    = useState(false)
  const [reqPhone,    setReqPhone]    = useState(false)
  const [origins,     setOrigins]     = useState('')
  const [saving,      setSaving]      = useState(false)
  const [err,         setErr]         = useState<string | null>(null)

  async function save() {
    if (!name.trim()) { setErr('Informe um nome'); return }
    setSaving(true); setErr(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${BACKEND}/widgets`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, agent_id: agentId || null,
          welcome_message: welcome, placeholder_text: placeholder,
          theme_color: color, position,
          require_name: reqName, require_email: reqEmail, require_phone: reqPhone,
          allowed_origins: origins.split(',').map(s => s.trim()).filter(Boolean),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`)
      onCreated(data as ChatWidget)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erro ao criar')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #1e1e24' }}>
          <p className="text-sm font-semibold text-white">Novo Widget</p>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={16} /></button>
        </div>
        <div className="px-5 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <Field label="Nome">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Chat Loja Principal"
              className="w-full bg-[#0d0d10] border border-[#27272a] text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-[#00E5FF]" />
          </Field>

          <Field label="Agente">
            <select value={agentId} onChange={e => setAgentId(e.target.value)}
              className="w-full bg-[#0d0d10] border border-[#27272a] text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-[#00E5FF] cursor-pointer">
              <option value="">— sem agente —</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>

          <Field label="Mensagem de boas-vindas">
            <textarea value={welcome} onChange={e => setWelcome(e.target.value)} rows={2}
              className="w-full bg-[#0d0d10] border border-[#27272a] text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-[#00E5FF] resize-none" />
          </Field>

          <Field label="Placeholder do input">
            <input value={placeholder} onChange={e => setPlaceholder(e.target.value)}
              className="w-full bg-[#0d0d10] border border-[#27272a] text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-[#00E5FF]" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Cor principal">
              <div className="flex gap-2">
                <input type="color" value={color} onChange={e => setColor(e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer" />
                <input value={color} onChange={e => setColor(e.target.value)}
                  className="flex-1 bg-[#0d0d10] border border-[#27272a] text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-[#00E5FF] font-mono" />
              </div>
            </Field>
            <Field label="Posição">
              <div className="grid grid-cols-2 gap-1.5">
                {(['bottom-right', 'bottom-left'] as const).map(p => (
                  <button key={p} onClick={() => setPosition(p)}
                    className="py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                    style={{
                      background: position === p ? 'rgba(0,229,255,0.12)' : '#0d0d10',
                      color:      position === p ? '#00E5FF' : '#71717a',
                      border:    `1px solid ${position === p ? 'rgba(0,229,255,0.3)' : '#27272a'}`,
                    }}>
                    {p === 'bottom-right' ? '↘ Direita' : '↙ Esquerda'}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          <Field label="Campos obrigatórios antes do chat">
            <div className="flex gap-3">
              <Toggle value={reqName}  onChange={setReqName}  label="Nome" />
              <Toggle value={reqEmail} onChange={setReqEmail} label="Email" />
              <Toggle value={reqPhone} onChange={setReqPhone} label="Telefone" />
            </div>
          </Field>

          <Field label="Origens permitidas (separadas por vírgula)" hint="Vazio = qualquer origem. Ex: minhaloja.com.br, www.minhaloja.com.br">
            <input value={origins} onChange={e => setOrigins(e.target.value)}
              placeholder="exemplo.com, www.exemplo.com"
              className="w-full bg-[#0d0d10] border border-[#27272a] text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-[#00E5FF]" />
          </Field>

          {err && <p className="text-[11px] text-red-400">{err}</p>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4" style={{ borderTop: '1px solid #1e1e24' }}>
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-zinc-400 hover:text-white transition-colors"
            style={{ background: '#1e1e24', border: '1px solid #27272a' }}>Cancelar</button>
          <button onClick={save} disabled={saving || !name.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-50"
            style={{ background: '#00E5FF', color: '#000' }}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {saving ? 'Criando…' : 'Criar widget'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Snippet modal ───────────────────────────────────────────────────────────

function SnippetModal({ data, onClose }: {
  data: { widget: ChatWidget; snippet: Snippet | null; loading: boolean }
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  function copy() {
    if (!data.snippet) return
    navigator.clipboard.writeText(data.snippet.html).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #1e1e24' }}>
          <div className="flex items-center gap-2">
            <Code2 size={15} style={{ color: '#00E5FF' }} />
            <p className="text-sm font-semibold text-white">Snippet — {data.widget.name}</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          {data.loading || !data.snippet ? (
            <div className="flex items-center justify-center py-12"><Loader2 size={20} className="animate-spin text-zinc-600" /></div>
          ) : (
            <>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Código</p>
                <div className="relative">
                  <pre className="p-4 rounded-lg text-[11px] font-mono text-zinc-300 overflow-x-auto leading-relaxed"
                    style={{ background: '#0d0d10', border: '1px solid #1e1e24' }}>{data.snippet.html}</pre>
                  <button onClick={copy}
                    className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold transition-colors"
                    style={{ background: copied ? 'rgba(74,222,128,0.15)' : 'rgba(0,229,255,0.1)', color: copied ? '#4ade80' : '#00E5FF' }}>
                    {copied ? <Check size={10} /> : <Copy size={10} />}
                    {copied ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
                <p className="text-[11px] text-zinc-500 mt-2">
                  Cole esse código antes do <code className="text-zinc-400">{'</body>'}</code> da sua página.
                </p>
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Preview</p>
                <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #1e1e24' }}>
                  <iframe src={data.snippet.preview_url} title="Widget preview" className="w-full" style={{ height: 540, background: '#09090b' }} />
                </div>
                <a href={data.snippet.preview_url} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] mt-2"
                  style={{ color: '#00E5FF' }}>
                  <Eye size={11} /> Abrir preview em nova aba
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── helpers ────────────────────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-zinc-600 mt-1">{hint}</p>}
    </div>
  )
}

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button onClick={() => onChange(!value)}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
      style={{
        background: value ? 'rgba(0,229,255,0.1)' : '#0d0d10',
        color:      value ? '#00E5FF' : '#71717a',
        border:    `1px solid ${value ? 'rgba(0,229,255,0.3)' : '#27272a'}`,
      }}>
      {value ? <Check size={11} /> : <X size={11} />}
      {label}
    </button>
  )
}
