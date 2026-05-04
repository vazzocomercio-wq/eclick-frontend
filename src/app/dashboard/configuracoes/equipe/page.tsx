'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { UserCog, Crown, User, Copy, Check, Mail, Shield, Trash2, Plus, RefreshCw } from 'lucide-react'
import { useConfirm } from '@/components/ui/dialog-provider'

// ── Types ─────────────────────────────────────────────────────────────────────

type Role = 'owner' | 'admin' | 'member' | 'viewer'

type Member = {
  user_id: string
  organization_id: string
  role: Role | null
  created_at: string | null
  email?: string | null
  name?: string | null
}

type CurrentUser = {
  id: string
  email: string
  name: string | null
}

// ── Role config ───────────────────────────────────────────────────────────────

const ROLE_CFG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  owner:  { label: 'Proprietário', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  icon: <Crown size={11} /> },
  admin:  { label: 'Admin',        color: '#00E5FF', bg: 'rgba(0,229,255,0.10)',   icon: <Shield size={11} /> },
  member: { label: 'Membro',       color: '#a1a1aa', bg: 'rgba(161,161,170,0.12)', icon: <User size={11} /> },
  viewer: { label: 'Visualizador', color: '#71717a', bg: 'rgba(113,113,122,0.12)', icon: <User size={11} /> },
}

function RoleBadge({ role }: { role: string | null }) {
  const r = role ?? 'member'
  const c = ROLE_CFG[r] ?? ROLE_CFG.member
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ background: c.bg, color: c.color }}>
      {c.icon} {c.label}
    </span>
  )
}

function initials(name: string | null | undefined, email: string | null | undefined) {
  if (name) return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  if (email) return email.slice(0, 2).toUpperCase()
  return '??'
}

const AVATAR_COLORS = ['#00E5FF', '#a78bfa', '#fb923c', '#4ade80', '#f472b6', '#60a5fa']
function avatarColor(id: string) { return AVATAR_COLORS[id.charCodeAt(0) % AVATAR_COLORS.length] }

// ── Main page ─────────────────────────────────────────────────────────────────

export default function EquipePage() {
  const [me, setMe]             = useState<CurrentUser | null>(null)
  const [members, setMembers]   = useState<Member[]>([])
  const [orgId, setOrgId]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(true)
  const [inviteEmail, setInvite] = useState('')
  const [inviteRole, setInviteRole] = useState<Role>('member')
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [copied, setCopied]     = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const confirm = useConfirm()

  const load = useCallback(async () => {
    setLoading(true)
    const sb = createClient()

    const { data: { user } } = await sb.auth.getUser()
    if (!user) { setLoading(false); return }

    setMe({
      id:    user.id,
      email: user.email ?? '',
      name:  user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    })

    // Get org
    const { data: mem } = await sb
      .from('organization_members')
      .select('organization_id, role, created_at')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    if (!mem) { setLoading(false); return }
    setOrgId(mem.organization_id)

    // Get all members
    const { data: allMem } = await sb
      .from('organization_members')
      .select('user_id, organization_id, role, created_at')
      .eq('organization_id', mem.organization_id)
      .order('created_at', { ascending: true })

    setMembers((allMem ?? []).map((m: any) => ({
      ...m,
      email: m.user_id === user.id ? user.email : null,
      name:  m.user_id === user.id ? (user.user_metadata?.full_name ?? null) : null,
    })))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleInvite() {
    if (!inviteEmail.trim()) return
    setInviting(true); setInviteMsg(null)
    try {
      const sb  = createClient()
      const { data: { session } } = await sb.auth.getSession()
      const res = await fetch('/api/teams/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole, organization_id: orgId }),
      })
      if (res.ok) {
        setInviteMsg({ ok: true, text: `Convite enviado para ${inviteEmail.trim()}` })
        setInvite('')
        load()
      } else {
        const err = await res.json().catch(() => ({}))
        setInviteMsg({ ok: false, text: err.message ?? `Endpoint /api/teams/invite não configurado ainda.` })
      }
    } catch {
      setInviteMsg({ ok: false, text: 'Endpoint /api/teams/invite não configurado ainda. Adicione membros via Supabase Dashboard → Authentication → Users.' })
    } finally {
      setInviting(false)
    }
  }

  async function handleRemove(userId: string) {
    if (userId === me?.id) return
    const ok = await confirm({
      title:        'Remover membro',
      message:      'Remover este membro da organização?',
      confirmLabel: 'Remover',
      variant:      'danger',
    })
    if (!ok) return
    setRemoving(userId)
    const sb = createClient()
    await sb.from('organization_members').delete().eq('user_id', userId).eq('organization_id', orgId!)
    setMembers(ms => ms.filter(m => m.user_id !== userId))
    setRemoving(null)
  }

  function copyOrgId() {
    if (!orgId) return
    navigator.clipboard.writeText(orgId).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 min-h-full" style={{ background: '#09090b' }}>

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-zinc-500 text-xs">Configurações</p>
          <h2 className="text-white text-lg font-semibold mt-0.5">Equipe</h2>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all disabled:opacity-60"
          style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Members list */}
        <div className="xl:col-span-2 space-y-4">
          <div className="rounded-2xl overflow-hidden" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #1e1e24' }}>
              <p className="text-xs font-semibold text-zinc-300">Membros da equipe</p>
              {!loading && <span className="text-[10px] text-zinc-600">{members.length} membro{members.length !== 1 ? 's' : ''}</span>}
            </div>

            {loading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full animate-pulse" style={{ background: '#1e1e24' }} />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-36 rounded animate-pulse" style={{ background: '#1e1e24' }} />
                      <div className="h-2.5 w-48 rounded animate-pulse" style={{ background: '#1e1e24' }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : members.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <UserCog size={28} className="mx-auto mb-2 text-zinc-700" />
                <p className="text-zinc-600 text-sm">Nenhum membro encontrado</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: '#1a1a1f' }}>
                {members.map(m => {
                  const isMe   = m.user_id === me?.id
                  const color  = avatarColor(m.user_id)
                  const label  = isMe ? (me?.name ?? me?.email ?? m.user_id) : m.name ?? `Usuário ${m.user_id.slice(0, 8)}…`
                  const sub    = isMe ? me?.email : null
                  return (
                    <div key={m.user_id} className="flex items-center gap-3 px-4 py-3">
                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-xs font-bold"
                        style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}>
                        {initials(isMe ? me?.name : m.name, isMe ? me?.email : null)}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold text-zinc-200 truncate">{label}</p>
                          {isMe && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(0,229,255,0.1)', color: '#00E5FF' }}>Você</span>}
                        </div>
                        {sub && <p className="text-[10px] text-zinc-500 truncate">{sub}</p>}
                        {m.created_at && <p className="text-[9px] text-zinc-700">Desde {new Date(m.created_at).toLocaleDateString('pt-BR')}</p>}
                      </div>

                      <RoleBadge role={m.role} />

                      {/* Remove (not self) */}
                      {!isMe && (
                        <button onClick={() => handleRemove(m.user_id)} disabled={removing === m.user_id}
                          className="p-1.5 rounded-lg text-zinc-700 hover:text-red-400 transition-colors disabled:opacity-40"
                          title="Remover membro">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Invite form */}
          <div className="rounded-2xl p-5 space-y-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
            <div className="flex items-center gap-2">
              <Plus size={14} className="text-zinc-400" />
              <h3 className="text-sm font-semibold text-white">Convidar membro</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-medium text-zinc-500 mb-1.5">E-mail</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInvite(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleInvite()}
                  placeholder="colega@empresa.com"
                  className="w-full rounded-lg px-3 py-2 text-xs text-white outline-none transition-all"
                  style={{ background: '#1c1c1f', border: '1px solid #3f3f46' }}
                  onFocus={e => (e.target.style.borderColor = '#00E5FF')}
                  onBlur={e => (e.target.style.borderColor  = '#3f3f46')}
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-zinc-500 mb-1.5">Função</label>
                <select value={inviteRole} onChange={e => setInviteRole(e.target.value as Role)}
                  className="w-full rounded-lg px-3 py-2 text-xs text-white outline-none cursor-pointer"
                  style={{ background: '#1c1c1f', border: '1px solid #3f3f46' }}>
                  <option value="admin">Admin</option>
                  <option value="member">Membro</option>
                  <option value="viewer">Visualizador</option>
                </select>
              </div>
            </div>

            {inviteMsg && (
              <p className="text-xs" style={{ color: inviteMsg.ok ? '#4ade80' : '#fb923c' }}>
                {inviteMsg.text}
              </p>
            )}

            <button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
              style={{ background: '#00E5FF', color: '#000' }}>
              <Mail size={13} />
              {inviting ? 'Enviando…' : 'Enviar convite'}
            </button>

            <p className="text-[10px] text-zinc-700 leading-relaxed">
              O convite é enviado via Supabase Auth (magic link). Se o endpoint ainda não estiver configurado,
              adicione usuários diretamente em <strong className="text-zinc-600">Supabase Dashboard → Authentication → Users</strong>.
            </p>
          </div>
        </div>

        {/* Right: org info */}
        <div className="space-y-4">
          <div className="rounded-2xl p-5 space-y-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-600">Organização</h3>

            {me && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold"
                  style={{ background: 'rgba(0,229,255,0.1)', color: '#00E5FF' }}>
                  {initials(me.name, me.email)}
                </div>
                <div>
                  <p className="text-xs font-semibold text-zinc-200">{me.name ?? me.email}</p>
                  <p className="text-[10px] text-zinc-500">{me.email}</p>
                </div>
              </div>
            )}

            {orgId && (
              <div>
                <p className="text-[10px] font-medium text-zinc-600 mb-1">ID da organização</p>
                <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg" style={{ background: '#18181b', border: '1px solid #27272a' }}>
                  <p className="text-[10px] font-mono text-zinc-400 flex-1 truncate">{orgId}</p>
                  <button onClick={copyOrgId} className="shrink-0 text-zinc-600 hover:text-zinc-300 transition-colors">
                    {copied ? <Check size={12} style={{ color: '#4ade80' }} /> : <Copy size={12} />}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2 pt-1">
              {[
                { label: 'Total de membros', value: members.length },
                { label: 'Admins',           value: members.filter(m => m.role === 'admin' || m.role === 'owner').length },
              ].map(r => (
                <div key={r.label} className="flex items-center justify-between">
                  <span className="text-[11px] text-zinc-500">{r.label}</span>
                  <span className="text-xs font-bold text-zinc-200">{r.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl p-5 space-y-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-600">Funções disponíveis</h3>
            <div className="space-y-2">
              {Object.entries(ROLE_CFG).map(([key, cfg]) => (
                <div key={key} className="flex items-center gap-2">
                  <RoleBadge role={key} />
                  <span className="text-[10px] text-zinc-600">
                    {key === 'owner'  && 'Acesso total, não pode ser removido'}
                    {key === 'admin'  && 'Gerencia membros e integrações'}
                    {key === 'member' && 'Acesso completo às funcionalidades'}
                    {key === 'viewer' && 'Somente leitura'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
