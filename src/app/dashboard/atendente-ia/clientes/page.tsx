'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { Users, Search, Loader2, X, Phone, Mail, Tag, MessageSquare, Save, ExternalLink, Filter } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

const CHANNEL_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  whatsapp:     { label: 'WA',    color: '#25D366', bg: 'rgba(37,211,102,0.15)' },
  mercadolivre: { label: 'ML',    color: '#FFE600', bg: 'rgba(255,230,0,0.15)' },
  widget:       { label: 'WEB',   color: '#00E5FF', bg: 'rgba(0,229,255,0.15)' },
  shopee:       { label: 'SH',    color: '#EE4D2D', bg: 'rgba(238,77,45,0.15)' },
  amazon:       { label: 'AZ',    color: '#FF9900', bg: 'rgba(255,153,0,0.15)' },
}

type Customer = {
  id: string
  display_name: string | null
  phone: string | null
  email: string | null
  whatsapp_id: string | null
  ml_buyer_id: string | null
  shopee_buyer_id: string | null
  tags: string[]
  total_conversations: number
  total_purchases: number
  first_contact_at: string
  last_contact_at: string
  last_channel: string | null
  notes: string | null
}

type CustomerFull = Customer & {
  history?: Array<{ id: string; channel: string; status: string; total_messages: number; updated_at: string; listing_title?: string | null }>
}

function formatPhone(phone: string | null): string {
  if (!phone) return '—'
  const d = phone.replace(/\D/g, '')
  if (d.length < 10) return phone
  const cc = d.length > 11 ? d.slice(0, 2) : '55'
  const ddd = d.length > 11 ? d.slice(2, 4) : d.slice(0, 2)
  const rest = d.length > 11 ? d.slice(4) : d.slice(2)
  return `+${cc} (${ddd}) ${rest.slice(0, 5)}-${rest.slice(5, 9)}`
}

function ago(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60)   return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24)   return `${h}h`
  return `${Math.floor(h / 24)}d`
}

export default function ClientesPage() {
  const supabase = useMemo(() => createClient(), [])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [channelFilter, setChannelFilter] = useState<string>('')
  const [selected, setSelected] = useState<string | null>(null)

  const getHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return { Authorization: `Bearer ${session?.access_token ?? ''}`, 'Content-Type': 'application/json' }
  }, [supabase])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const headers = await getHeaders()
      const params = new URLSearchParams()
      if (search.trim())   params.set('search', search.trim())
      if (channelFilter)   params.set('channel', channelFilter)
      const res = await fetch(`${BACKEND}/customers?${params}`, { headers })
      if (res.ok) {
        const v = await res.json()
        setCustomers(Array.isArray(v) ? v : [])
      }
    } catch { /* silent */ } finally { setLoading(false) }
  }, [getHeaders, search, channelFilter])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen p-6 space-y-5" style={{ background: '#09090b' }}>
      <div>
        <p className="text-zinc-500 text-xs font-medium tracking-widest uppercase mb-1">Atendente IA</p>
        <h1 className="text-white text-2xl font-semibold flex items-center gap-2"><Users size={22} style={{ color: '#00E5FF' }} /> Clientes</h1>
        <p className="text-zinc-500 text-sm mt-1">Perfis unificados cross-canal — WhatsApp, ML, Widget, etc.</p>
      </div>

      {/* Search + filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load()}
            placeholder="Nome, telefone ou email…"
            className="w-full pl-9 pr-3 py-2 rounded-xl text-sm text-white placeholder-zinc-600"
            style={{ background: '#111114', border: '1px solid #1e1e24' }} />
        </div>
        <div className="flex items-center gap-1 px-2 py-2 rounded-xl" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
          <Filter size={11} className="text-zinc-500" />
          <button onClick={() => setChannelFilter('')}
            className="px-2 py-0.5 rounded text-[11px] font-medium"
            style={{ background: !channelFilter ? '#1e1e24' : 'transparent', color: !channelFilter ? '#fff' : '#71717a' }}>
            Todos
          </button>
          {Object.entries(CHANNEL_LABEL).slice(0, 4).map(([id, cfg]) => (
            <button key={id} onClick={() => setChannelFilter(id)}
              className="px-2 py-0.5 rounded text-[11px] font-bold"
              style={{ background: channelFilter === id ? cfg.bg : 'transparent', color: channelFilter === id ? cfg.color : '#52525b' }}>
              {cfg.label}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-zinc-600 ml-auto">{customers.length} cliente{customers.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr style={{ borderBottom: '1px solid #1a1a1f', background: '#0c0c10' }}>
                <th className="text-left px-4 py-3 text-zinc-500 font-medium">Nome</th>
                <th className="text-left px-4 py-3 text-zinc-500 font-medium">Telefone</th>
                <th className="text-left px-4 py-3 text-zinc-500 font-medium">Canais</th>
                <th className="text-right px-4 py-3 text-zinc-500 font-medium">Conversas</th>
                <th className="text-left px-4 py-3 text-zinc-500 font-medium">Tags</th>
                <th className="text-right px-4 py-3 text-zinc-500 font-medium">Último contato</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #0f0f12' }}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-3.5 rounded animate-pulse" style={{ background: '#1a1a1f', width: '70%' }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center">
                    <Users size={32} className="mx-auto mb-2" style={{ color: '#27272a' }} />
                    <p className="text-zinc-600 text-sm">Nenhum cliente encontrado</p>
                    <p className="text-zinc-700 text-[11px] mt-1">
                      Os clientes aparecem aqui quando recebem mensagens via WhatsApp, ML ou Widget.
                    </p>
                  </td>
                </tr>
              ) : (
                customers.map(c => {
                  const channels: string[] = []
                  if (c.whatsapp_id)     channels.push('whatsapp')
                  if (c.ml_buyer_id)     channels.push('mercadolivre')
                  if (c.shopee_buyer_id) channels.push('shopee')
                  return (
                    <tr key={c.id}
                      onClick={() => setSelected(c.id)}
                      className="cursor-pointer hover:bg-white/[0.02] transition-colors"
                      style={{ borderBottom: '1px solid #0f0f12' }}>
                      <td className="px-4 py-3 text-zinc-200 font-medium">{c.display_name ?? '(sem nome)'}</td>
                      <td className="px-4 py-3 text-zinc-400 font-mono text-[11px]">{formatPhone(c.phone)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {channels.length === 0 ? (
                            <span className="text-zinc-700 text-[10px]">—</span>
                          ) : channels.map(ch => {
                            const cfg = CHANNEL_LABEL[ch]
                            return cfg ? (
                              <span key={ch} className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                                style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                            ) : null
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-300 tabular-nums">{c.total_conversations}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1 max-w-[160px]">
                          {c.tags.slice(0, 2).map(t => (
                            <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: '#1e1e24', color: '#a1a1aa' }}>{t}</span>
                          ))}
                          {c.tags.length > 2 && <span className="text-[10px] text-zinc-600">+{c.tags.length - 2}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-500 text-[11px]">há {ago(c.last_contact_at)}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <CustomerProfileModal customerId={selected} onClose={() => setSelected(null)} onSaved={load} getHeaders={getHeaders} />
      )}
    </div>
  )
}

// ── Profile modal ──────────────────────────────────────────────────────────

function CustomerProfileModal({ customerId, onClose, onSaved, getHeaders }: {
  customerId: string
  onClose: () => void
  onSaved: () => void
  getHeaders: () => Promise<Record<string, string>>
}) {
  const [profile, setProfile] = useState<CustomerFull | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [editName, setEditName] = useState('')
  const [editTags, setEditTags] = useState('')
  const [editNotes, setEditNotes] = useState('')

  useEffect(() => {
    setLoading(true)
    getHeaders()
      .then(h => fetch(`${BACKEND}/customers/${customerId}`, { headers: h }))
      .then(r => r.ok ? r.json() : null)
      .then((p: CustomerFull | null) => {
        setProfile(p)
        if (p) {
          setEditName(p.display_name ?? '')
          setEditTags((p.tags ?? []).join(', '))
          setEditNotes(p.notes ?? '')
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [customerId, getHeaders])

  async function save() {
    setSaving(true)
    try {
      const headers = await getHeaders()
      await fetch(`${BACKEND}/customers/${customerId}`, {
        method: 'PATCH', headers,
        body: JSON.stringify({
          display_name: editName || null,
          tags: editTags.split(',').map(t => t.trim()).filter(Boolean),
          notes: editNotes || null,
        }),
      })
      onSaved()
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        style={{ background: '#111114', border: '1px solid #1e1e24', maxHeight: '85vh' }}>
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: '1px solid #1e1e24' }}>
          <p className="text-sm font-semibold text-white">Perfil do Cliente</p>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={16} /></button>
        </div>

        {loading || !profile ? (
          <div className="flex items-center justify-center py-20"><Loader2 size={20} className="animate-spin text-zinc-600" /></div>
        ) : (
          <div className="overflow-y-auto p-5 space-y-4">
            {/* Avatar + name */}
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold"
                style={{ background: '#00E5FF', color: '#000' }}>
                {(profile.display_name ?? '?').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Nome do cliente"
                  className="w-full bg-transparent text-lg font-bold text-white outline-none border-b border-transparent focus:border-cyan-400" />
                <p className="text-xs text-zinc-500 font-mono">{profile.id.slice(0, 8)}…</p>
              </div>
            </div>

            {/* Contact */}
            <div className="grid grid-cols-2 gap-3">
              <ContactRow icon={<Phone size={12} />} label="Telefone" value={formatPhone(profile.phone)}
                action={profile.phone ? { href: `tel:+${profile.phone.replace(/\D/g, '')}`, label: 'Ligar' } : undefined} />
              <ContactRow icon={<Mail size={12} />} label="Email" value={profile.email ?? '—'} />
            </div>

            {/* Channel IDs */}
            <div className="rounded-xl p-3 space-y-1.5" style={{ background: '#0d0d10', border: '1px solid #1e1e24' }}>
              <p className="text-[10px] uppercase tracking-widest text-zinc-500">Vínculos por canal</p>
              {profile.whatsapp_id     && <ChannelLine label="WhatsApp"     value={profile.whatsapp_id}     color="#25D366" />}
              {profile.ml_buyer_id     && <ChannelLine label="Mercado Livre" value={profile.ml_buyer_id}    color="#FFE600" />}
              {profile.shopee_buyer_id && <ChannelLine label="Shopee"        value={profile.shopee_buyer_id} color="#EE4D2D" />}
              {!profile.whatsapp_id && !profile.ml_buyer_id && !profile.shopee_buyer_id && (
                <p className="text-[11px] text-zinc-600">Nenhum vínculo registrado.</p>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Conversas"  value={String(profile.total_conversations)} />
              <Stat label="Compras"    value={`R$ ${Number(profile.total_purchases ?? 0).toFixed(2)}`} />
              <Stat label="Primeira"   value={ago(profile.first_contact_at)} sub="atrás" />
            </div>

            {/* Timeline */}
            <div>
              <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2 inline-flex items-center gap-1.5">
                <MessageSquare size={10} /> Histórico ({profile.history?.length ?? 0})
              </p>
              <div className="space-y-1.5">
                {(profile.history ?? []).slice(0, 10).map(h => {
                  const cfg = CHANNEL_LABEL[h.channel]
                  return (
                    <div key={h.id} className="flex items-center gap-2 px-3 py-2 rounded-lg"
                      style={{ background: '#0d0d10', border: '1px solid #1e1e24' }}>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0"
                        style={cfg ? { background: cfg.bg, color: cfg.color } : { background: '#1e1e24', color: '#71717a' }}>
                        {cfg?.label ?? h.channel}
                      </span>
                      <span className="flex-1 text-[11px] text-zinc-400 truncate">{h.listing_title ?? h.status}</span>
                      <span className="text-[10px] text-zinc-600 shrink-0">{h.total_messages} msgs</span>
                      <span className="text-[10px] text-zinc-600 shrink-0">{new Date(h.updated_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                  )
                })}
                {(profile.history?.length ?? 0) === 0 && (
                  <p className="text-[11px] text-zinc-600">Sem conversas anteriores.</p>
                )}
              </div>
            </div>

            {/* Tags + notes */}
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-1.5 inline-flex items-center gap-1.5">
                <Tag size={10} /> Tags (separadas por vírgula)
              </label>
              <input value={editTags} onChange={e => setEditTags(e.target.value)} placeholder="vip, lead-quente, sp"
                className="w-full bg-[#0d0d10] border border-[#27272a] text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-[#00E5FF]" />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-1.5">Notas</label>
              <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={3}
                placeholder="Anotações internas sobre este cliente"
                className="w-full bg-[#0d0d10] border border-[#27272a] text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-[#00E5FF] resize-none" />
            </div>
          </div>
        )}

        <div className="flex justify-between gap-2 px-5 py-4 shrink-0" style={{ borderTop: '1px solid #1e1e24' }}>
          {profile?.phone && (
            <a href={`https://wa.me/${profile.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors"
              style={{ background: 'rgba(37,211,102,0.1)', color: '#25D366', border: '1px solid rgba(37,211,102,0.25)' }}>
              <ExternalLink size={11} /> Iniciar WhatsApp
            </a>
          )}
          <div className="ml-auto flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-zinc-400 hover:text-white"
              style={{ background: '#1e1e24', border: '1px solid #27272a' }}>Cancelar</button>
            <button onClick={save} disabled={saving || !profile}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
              style={{ background: '#00E5FF', color: '#000' }}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── helpers ────────────────────────────────────────────────────────────────

function ContactRow({ icon, label, value, action }: { icon: React.ReactNode; label: string; value: string; action?: { href: string; label: string } }) {
  return (
    <div className="rounded-xl p-3" style={{ background: '#0d0d10', border: '1px solid #1e1e24' }}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-zinc-500 mb-1">{icon} {label}</div>
      <p className="text-sm text-zinc-200 font-mono">{value}</p>
      {action && (
        <a href={action.href} className="inline-flex items-center gap-1 text-[11px] mt-1.5"
          style={{ color: '#00E5FF' }}>{action.label}</a>
      )}
    </div>
  )
}

function ChannelLine({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between text-[11px]">
      <span style={{ color }}>{label}</span>
      <span className="text-zinc-400 font-mono truncate ml-2">{value}</span>
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl p-3 text-center" style={{ background: '#0d0d10', border: '1px solid #1e1e24' }}>
      <p className="text-lg font-bold text-white tabular-nums">{value}</p>
      <p className="text-[10px] text-zinc-500 mt-0.5">{label} {sub && <span className="text-zinc-600">{sub}</span>}</p>
    </div>
  )
}
