'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Loader2, Shield, Lock, Plus, Save, X, Trash2, RefreshCw, AlertCircle,
  CheckCircle2, ChevronDown, ChevronRight, UserCircle2, Tag,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useConfirm } from '@/components/ui/dialog-provider'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL
  ?? process.env.NEXT_PUBLIC_API_URL
  ?? 'https://eclick-backend-production-2a87.up.railway.app'

interface Permission {
  id:            string
  key:           string
  name:          string
  description:   string | null
  module:        string
  action_type:   string
  display_order: number
}

interface Role {
  id:               string
  organization_id:  string | null
  key:              string
  name:             string
  description:      string | null
  is_template:      boolean
  is_system:        boolean
  display_order:    number
  permission_count: number
}

interface RoleDetail extends Role { permission_keys: string[] }

interface UserWithRoles {
  user_id:     string
  email:       string | null
  full_name:   string | null
  legacy_role: string | null
  roles:       Array<{ id: string; key: string; name: string; is_template: boolean }>
}

const CYAN = '#00E5FF'
const SURFACE = '#111113'
const BORDER = 'rgb(39 39 42)'

export function RolesPanel({ initialOrgId }: { initialOrgId: string }) {
  const confirm = useConfirm()
  const [orgId] = useState(initialOrgId)
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [roles, setRoles]             = useState<Role[]>([])
  const [users, setUsers]             = useState<UserWithRoles[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null)
  const [roleDetail, setRoleDetail]   = useState<RoleDetail | null>(null)
  const [creating, setCreating]       = useState(false)

  const getHeaders = useCallback(async () => {
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    return {
      Authorization:  `Bearer ${session?.access_token ?? ''}`,
      'Content-Type': 'application/json',
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const headers = await getHeaders()
      const [pRes, rRes, uRes] = await Promise.all([
        fetch(`${BACKEND}/access/admin/rbac/permissions`, { headers }),
        fetch(`${BACKEND}/access/admin/rbac/roles?orgId=${encodeURIComponent(orgId)}`, { headers }),
        fetch(`${BACKEND}/access/admin/rbac/users?orgId=${encodeURIComponent(orgId)}`,  { headers }),
      ])
      if (!pRes.ok) throw new Error(`permissions HTTP ${pRes.status}`)
      if (!rRes.ok) throw new Error(`roles HTTP ${rRes.status}`)
      if (!uRes.ok) throw new Error(`users HTTP ${uRes.status}`)
      setPermissions(await pRes.json())
      setRoles(await rRes.json())
      setUsers(await uRes.json())
    } catch (e) {
      setError((e as Error).message)
    } finally { setLoading(false) }
  }, [orgId, getHeaders])

  useEffect(() => { void load() }, [load])

  // Quando seleciona uma role, busca detalhes (perm keys)
  useEffect(() => {
    if (!selectedRoleId) { setRoleDetail(null); return }
    void (async () => {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/access/admin/rbac/roles/${selectedRoleId}`, { headers })
      if (res.ok) setRoleDetail(await res.json() as RoleDetail)
    })()
  }, [selectedRoleId, getHeaders])

  // Permissions agrupadas por module
  const permsByModule = useMemo(() => {
    const m = new Map<string, Permission[]>()
    for (const p of permissions) {
      const arr = m.get(p.module) ?? []
      arr.push(p); m.set(p.module, arr)
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [permissions])

  async function refreshRoles() {
    const headers = await getHeaders()
    const r = await fetch(`${BACKEND}/access/admin/rbac/roles?orgId=${encodeURIComponent(orgId)}`, { headers })
    if (r.ok) setRoles(await r.json())
  }

  async function refreshUsers() {
    const headers = await getHeaders()
    const r = await fetch(`${BACKEND}/access/admin/rbac/users?orgId=${encodeURIComponent(orgId)}`, { headers })
    if (r.ok) setUsers(await r.json())
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-2 text-zinc-400">
        <Loader2 size={18} className="animate-spin" />
        Carregando RBAC…
      </div>
    )
  }
  if (error) {
    return (
      <div className="rounded-xl border p-4 flex items-start gap-3"
           style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.30)' }}>
        <AlertCircle size={18} className="shrink-0 mt-0.5 text-red-400" />
        <div className="flex-1">
          <p className="font-medium text-red-300">Erro ao carregar</p>
          <p className="text-sm text-red-400/70 mt-0.5">{error}</p>
        </div>
        <button onClick={() => void load()}
                className="px-3 py-1.5 rounded-lg text-sm text-white border"
                style={{ borderColor: BORDER }}>
          <RefreshCw size={14} className="inline mr-1.5" />
          Tentar de novo
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
            <Shield size={22} style={{ color: CYAN }} />
            RBAC — Roles & Permissões
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Templates fixos + roles customizadas. Backend é a fonte de verdade do enforcement.
          </p>
        </div>
        <button onClick={() => setCreating(true)}
                className="px-4 py-2 rounded-lg text-black font-semibold text-sm flex items-center gap-2 transition-all hover:opacity-90"
                style={{ background: CYAN }}>
          <Plus size={14} />
          Nova role customizada
        </button>
      </div>

      {/* Grid: roles à esquerda, editor à direita */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px,1fr] gap-4">
        {/* Lista de roles */}
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wider text-zinc-500 px-1">
            Roles ({roles.length})
          </div>
          {roles.map(r => (
            <button key={r.id}
                    onClick={() => setSelectedRoleId(r.id)}
                    className="w-full text-left rounded-xl border p-3 transition-all"
                    style={{
                      background: SURFACE,
                      borderColor: selectedRoleId === r.id ? CYAN : BORDER,
                      boxShadow:   selectedRoleId === r.id ? `0 0 0 1px ${CYAN}40` : 'none',
                    }}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-white text-sm font-medium truncate">{r.name}</span>
                {r.is_template && (
                  <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full text-zinc-400 border" style={{ borderColor: BORDER }}>
                    <Lock size={9} /> Template
                  </span>
                )}
              </div>
              <div className="text-xs text-zinc-500 mt-0.5">
                <code className="text-zinc-400">{r.key}</code> · {r.permission_count} perms
              </div>
              {r.description && (
                <div className="text-xs text-zinc-500 mt-1 line-clamp-2">{r.description}</div>
              )}
            </button>
          ))}
        </div>

        {/* Editor de permissions da role */}
        <div className="rounded-xl border p-4 sm:p-5" style={{ background: SURFACE, borderColor: BORDER }}>
          {!roleDetail ? (
            <div className="flex items-center justify-center py-16 text-zinc-500 text-sm gap-2">
              <ChevronRight size={14} />
              Selecione uma role à esquerda pra ver/editar as permissões.
            </div>
          ) : (
            <RoleEditor
              role={roleDetail}
              permsByModule={permsByModule}
              onSaved={async () => {
                await refreshRoles()
                // Re-fetch detail
                const headers = await getHeaders()
                const res = await fetch(`${BACKEND}/access/admin/rbac/roles/${roleDetail.id}`, { headers })
                if (res.ok) setRoleDetail(await res.json() as RoleDetail)
              }}
              onDeleted={async () => {
                setSelectedRoleId(null)
                setRoleDetail(null)
                await refreshRoles()
              }}
              getHeaders={getHeaders}
              confirm={confirm}
            />
          )}
        </div>
      </div>

      {/* Lista de usuários da org */}
      <div>
        <div className="text-xs uppercase tracking-wider text-zinc-500 px-1 mb-2 flex items-center gap-2">
          <UserCircle2 size={12} />
          Usuários da org ({users.length})
        </div>
        <div className="rounded-xl border overflow-hidden" style={{ background: SURFACE, borderColor: BORDER }}>
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-zinc-500 border-b" style={{ borderColor: BORDER }}>
              <tr>
                <th className="text-left p-3 font-medium">Usuário</th>
                <th className="text-left p-3 font-medium">Legacy</th>
                <th className="text-left p-3 font-medium">Roles RBAC</th>
                <th className="text-right p-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <UserRow key={u.user_id}
                         user={u}
                         availableRoles={roles}
                         onChange={refreshUsers}
                         getHeaders={getHeaders}
                         confirm={confirm}
                         orgId={orgId} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {creating && (
        <CreateRoleModal
          onClose={() => setCreating(false)}
          onCreated={async (id) => {
            setCreating(false)
            await refreshRoles()
            setSelectedRoleId(id)
          }}
          templates={roles.filter(r => r.is_template)}
          getHeaders={getHeaders}
          orgId={orgId}
        />
      )}
    </div>
  )
}

// ─── Editor de role ───────────────────────────────────────────────────────

function RoleEditor({
  role, permsByModule, onSaved, onDeleted, getHeaders, confirm,
}: {
  role:          RoleDetail
  permsByModule: Array<[string, Permission[]]>
  onSaved:       () => Promise<void>
  onDeleted:     () => Promise<void>
  getHeaders:    () => Promise<HeadersInit>
  confirm:       (opts: { title?: string; message: string; confirmLabel?: string; variant?: 'default' | 'danger' | 'warning' | 'info' }) => Promise<boolean>
}) {
  const readOnly = role.is_template || role.is_system
  const [name, setName] = useState(role.name)
  const [description, setDescription] = useState(role.description ?? '')
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set(role.permission_keys))
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  useEffect(() => {
    setName(role.name)
    setDescription(role.description ?? '')
    setSelectedKeys(new Set(role.permission_keys))
  }, [role])

  function toggle(key: string) {
    if (readOnly) return
    const next = new Set(selectedKeys)
    if (next.has(key)) next.delete(key); else next.add(key)
    setSelectedKeys(next)
  }

  function toggleModule(mod: string, perms: Permission[]) {
    if (readOnly) return
    const allOn = perms.every(p => selectedKeys.has(p.key))
    const next = new Set(selectedKeys)
    for (const p of perms) {
      if (allOn) next.delete(p.key); else next.add(p.key)
    }
    setSelectedKeys(next)
  }

  function toggleCollapsed(mod: string) {
    const next = new Set(collapsed)
    if (next.has(mod)) next.delete(mod); else next.add(mod)
    setCollapsed(next)
  }

  async function save() {
    setSaving(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/access/admin/rbac/roles/${role.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          name:            name.trim() !== role.name ? name.trim() : undefined,
          description:     description !== (role.description ?? '') ? description : undefined,
          permissionKeys:  [...selectedKeys],
        }),
      })
      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        throw new Error(`HTTP ${res.status} ${txt.slice(0, 200)}`)
      }
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 1500)
      await onSaved()
    } catch (e) {
      alert('Erro ao salvar: ' + (e as Error).message)
    } finally { setSaving(false) }
  }

  async function deleteRole() {
    const ok = await confirm({
      title:        'Deletar role',
      message:      `Tem certeza que quer deletar a role "${role.name}"? Usuários que tinham essa role perdem as permissões.`,
      confirmLabel: 'Deletar',
      variant:      'danger',
    })
    if (!ok) return
    const headers = await getHeaders()
    const res = await fetch(`${BACKEND}/access/admin/rbac/roles/${role.id}`, {
      method: 'DELETE', headers,
    })
    if (res.ok) await onDeleted()
    else alert('Erro ao deletar: HTTP ' + res.status)
  }

  const dirty = name.trim() !== role.name
    || description !== (role.description ?? '')
    || [...selectedKeys].sort().join() !== [...role.permission_keys].sort().join()

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <input value={name} onChange={e => setName(e.target.value)}
                   readOnly={readOnly}
                   className="text-lg font-semibold bg-transparent text-white outline-none border-b border-transparent focus:border-zinc-700 px-1 -mx-1"
                   style={{ borderBottomColor: readOnly ? 'transparent' : undefined }} />
            {role.is_template && (
              <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full text-zinc-400 border" style={{ borderColor: BORDER }}>
                <Lock size={9} /> Template imutável
              </span>
            )}
          </div>
          <div className="text-xs text-zinc-500 mt-1">
            <code>{role.key}</code> · {selectedKeys.size}/{permsByModule.reduce((a, [, ps]) => a + ps.length, 0)} perms
          </div>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            readOnly={readOnly}
            placeholder={readOnly ? '' : 'Descrição (opcional)'}
            rows={2}
            className="w-full mt-2 bg-transparent text-sm text-zinc-300 outline-none border rounded px-2 py-1 resize-none"
            style={{ borderColor: readOnly ? 'transparent' : BORDER }}
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!readOnly && (
            <>
              <button onClick={save} disabled={!dirty || saving}
                      className="px-3 py-2 rounded-lg text-sm text-black font-semibold flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: CYAN }}>
                {saving
                  ? <Loader2 size={14} className="animate-spin" />
                  : savedFlash
                    ? <CheckCircle2 size={14} />
                    : <Save size={14} />}
                {saving ? 'Salvando…' : savedFlash ? 'Salvo!' : 'Salvar'}
              </button>
              <button onClick={deleteRole}
                      className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 border" style={{ borderColor: BORDER }}>
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Matriz de permissions por module */}
      <div className="space-y-2">
        {permsByModule.map(([mod, perms]) => {
          const onCount = perms.filter(p => selectedKeys.has(p.key)).length
          const isCollapsed = collapsed.has(mod)
          return (
            <div key={mod} className="rounded-lg border" style={{ borderColor: BORDER }}>
              <div className="flex items-center justify-between p-2.5 hover:bg-zinc-900/40 cursor-pointer"
                   onClick={() => toggleCollapsed(mod)}>
                <div className="flex items-center gap-2">
                  {isCollapsed ? <ChevronRight size={14} className="text-zinc-500" /> : <ChevronDown size={14} className="text-zinc-500" />}
                  <span className="text-sm font-medium text-white capitalize">{mod}</span>
                  <span className="text-xs text-zinc-500">{onCount}/{perms.length}</span>
                </div>
                {!readOnly && (
                  <button onClick={e => { e.stopPropagation(); toggleModule(mod, perms) }}
                          className="text-xs px-2 py-1 rounded border text-zinc-300 hover:text-white"
                          style={{ borderColor: BORDER }}>
                    {onCount === perms.length ? 'Desmarcar todas' : 'Marcar todas'}
                  </button>
                )}
              </div>
              {!isCollapsed && (
                <div className="border-t px-2 py-2 grid grid-cols-1 sm:grid-cols-2 gap-1" style={{ borderColor: BORDER }}>
                  {perms.map(p => {
                    const on = selectedKeys.has(p.key)
                    return (
                      <label key={p.id}
                             className="flex items-start gap-2 p-1.5 rounded cursor-pointer hover:bg-zinc-900/40"
                             style={{ cursor: readOnly ? 'default' : 'pointer' }}>
                        <input type="checkbox" checked={on}
                               onChange={() => toggle(p.key)}
                               disabled={readOnly}
                               className="mt-0.5 accent-cyan-400" />
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-white">{p.name}</div>
                          <div className="text-[11px] text-zinc-500"><code>{p.key}</code></div>
                          {p.description && <div className="text-[11px] text-zinc-500 mt-0.5">{p.description}</div>}
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── User row com chips de roles ──────────────────────────────────────────

function UserRow({
  user, availableRoles, orgId, onChange, getHeaders, confirm,
}: {
  user:           UserWithRoles
  availableRoles: Role[]
  orgId:          string
  onChange:       () => Promise<void>
  getHeaders:     () => Promise<HeadersInit>
  confirm:        (opts: { title?: string; message: string; confirmLabel?: string; variant?: 'default' | 'danger' | 'warning' | 'info' }) => Promise<boolean>
}) {
  const [assigning, setAssigning] = useState(false)
  const [newRoleKey, setNewRoleKey] = useState('')

  async function assign() {
    if (!newRoleKey) return
    const headers = await getHeaders()
    const res = await fetch(`${BACKEND}/access/admin/rbac/users/${user.user_id}/roles`, {
      method: 'POST', headers,
      body: JSON.stringify({ orgId, roleKey: newRoleKey }),
    })
    if (res.ok) { setAssigning(false); setNewRoleKey(''); await onChange() }
    else        { alert('Erro ao atribuir: HTTP ' + res.status) }
  }

  async function revoke(roleId: string, roleName: string) {
    const ok = await confirm({
      title:        'Remover role',
      message:      `Remover "${roleName}" de ${user.email ?? user.user_id}?`,
      confirmLabel: 'Remover',
      variant:      'danger',
    })
    if (!ok) return
    const headers = await getHeaders()
    const res = await fetch(`${BACKEND}/access/admin/rbac/users/${user.user_id}/roles/${roleId}?orgId=${encodeURIComponent(orgId)}`, {
      method: 'DELETE', headers,
    })
    if (res.ok) await onChange()
    else        alert('Erro ao revogar: HTTP ' + res.status)
  }

  const currentKeys = new Set(user.roles.map(r => r.key))
  const candidates = availableRoles.filter(r => !currentKeys.has(r.key))

  return (
    <tr className="border-b last:border-0" style={{ borderColor: BORDER }}>
      <td className="p-3 align-top">
        <div className="text-sm text-white">{user.full_name ?? user.email ?? user.user_id}</div>
        {user.full_name && user.email && (
          <div className="text-xs text-zinc-500">{user.email}</div>
        )}
      </td>
      <td className="p-3 align-top">
        {user.legacy_role && (
          <span className="text-[11px] px-1.5 py-0.5 rounded-full text-zinc-300 border" style={{ borderColor: BORDER }}>
            {user.legacy_role}
          </span>
        )}
      </td>
      <td className="p-3 align-top">
        <div className="flex flex-wrap gap-1.5">
          {user.roles.length === 0 && <span className="text-xs text-zinc-500">—</span>}
          {user.roles.map(r => (
            <span key={r.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border"
                  style={{ borderColor: CYAN + '60', background: CYAN + '15', color: CYAN }}>
              <Tag size={9} />
              {r.name}
              <button onClick={() => revoke(r.id, r.name)}
                      className="ml-0.5 opacity-60 hover:opacity-100">
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      </td>
      <td className="p-3 align-top text-right">
        {assigning ? (
          <div className="flex items-center justify-end gap-1.5">
            <select value={newRoleKey} onChange={e => setNewRoleKey(e.target.value)}
                    className="bg-zinc-900 text-white border rounded px-2 py-1 text-xs"
                    style={{ borderColor: BORDER }}>
              <option value="">— escolher —</option>
              {candidates.map(r => (
                <option key={r.id} value={r.key}>{r.name}{r.is_template ? ' (tpl)' : ''}</option>
              ))}
            </select>
            <button onClick={assign} disabled={!newRoleKey}
                    className="px-2 py-1 rounded text-xs text-black font-semibold disabled:opacity-40"
                    style={{ background: CYAN }}>OK</button>
            <button onClick={() => { setAssigning(false); setNewRoleKey('') }}
                    className="px-2 py-1 rounded text-xs text-zinc-400 border"
                    style={{ borderColor: BORDER }}>
              <X size={12} />
            </button>
          </div>
        ) : (
          <button onClick={() => setAssigning(true)}
                  className="text-xs px-2 py-1 rounded border text-zinc-300 hover:text-white"
                  style={{ borderColor: BORDER }}>
            <Plus size={11} className="inline mr-1" />
            Atribuir
          </button>
        )}
      </td>
    </tr>
  )
}

// ─── Modal de criação de role ────────────────────────────────────────────

function CreateRoleModal({
  onClose, onCreated, templates, getHeaders, orgId,
}: {
  onClose:    () => void
  onCreated:  (id: string) => Promise<void> | void
  templates:  Role[]
  getHeaders: () => Promise<HeadersInit>
  orgId:      string
}) {
  const [key, setKey] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [baseTemplateKey, setBaseTemplateKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function create() {
    setErr(null); setSaving(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/access/admin/rbac/roles`, {
        method: 'POST', headers,
        body: JSON.stringify({
          orgId, key, name,
          description:     description || undefined,
          baseTemplateKey: baseTemplateKey || undefined,
        }),
      })
      if (!res.ok) {
        const t = await res.text().catch(() => '')
        throw new Error(`HTTP ${res.status} — ${t.slice(0, 200)}`)
      }
      const body = await res.json() as { id: string }
      await onCreated(body.id)
    } catch (e) {
      setErr((e as Error).message)
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-md rounded-2xl border p-5"
           style={{ background: SURFACE, borderColor: BORDER }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Nova role customizada</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white"><X size={18} /></button>
        </div>

        {err && (
          <div className="mb-3 px-3 py-2 rounded border text-xs flex items-start gap-2"
               style={{ background: 'rgba(239,68,68,0.10)', borderColor: 'rgba(239,68,68,0.30)', color: '#fca5a5' }}>
            <AlertCircle size={12} className="mt-0.5 shrink-0" />
            {err}
          </div>
        )}

        <div className="space-y-3">
          <Field label="Nome">
            <input value={name} onChange={e => setName(e.target.value)}
                   placeholder="Ex: Operador de Estoque"
                   className="w-full bg-zinc-900 text-white border rounded px-3 py-2 text-sm outline-none"
                   style={{ borderColor: BORDER }} />
          </Field>
          <Field label="Key (slug interno)">
            <input value={key} onChange={e => setKey(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                   placeholder="ex: estoque_operator"
                   className="w-full bg-zinc-900 text-white border rounded px-3 py-2 text-sm font-mono outline-none"
                   style={{ borderColor: BORDER }} />
          </Field>
          <Field label="Descrição (opcional)">
            <textarea value={description} onChange={e => setDescription(e.target.value)}
                      rows={2}
                      className="w-full bg-zinc-900 text-white border rounded px-3 py-2 text-sm outline-none resize-none"
                      style={{ borderColor: BORDER }} />
          </Field>
          <Field label="Copiar permissões de (opcional)">
            <select value={baseTemplateKey} onChange={e => setBaseTemplateKey(e.target.value)}
                    className="w-full bg-zinc-900 text-white border rounded px-3 py-2 text-sm outline-none"
                    style={{ borderColor: BORDER }}>
              <option value="">— começar vazia —</option>
              {templates.map(t => (
                <option key={t.id} value={t.key}>{t.name} ({t.permission_count} perms)</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose}
                  className="px-3 py-2 rounded-lg text-sm text-zinc-300 border"
                  style={{ borderColor: BORDER }}>Cancelar</button>
          <button onClick={create} disabled={!name || !key || saving}
                  className="px-4 py-2 rounded-lg text-sm text-black font-semibold flex items-center gap-2 disabled:opacity-40"
                  style={{ background: CYAN }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Criar role
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-zinc-400 mb-1">{label}</label>
      {children}
    </div>
  )
}
