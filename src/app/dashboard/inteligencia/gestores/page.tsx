'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useConfirm, useAlert } from '@/components/ui/dialog-provider'
import {
  Plus, Trash2, Edit3, Phone, ShieldCheck, RefreshCw, X, Send, AlertCircle,
  User as UserIcon, Briefcase, Clock, Check, Pause, Play,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

type ManagerDepartment = 'compras' | 'comercial' | 'marketing' | 'logistica' | 'diretoria'
type ManagerStatus = 'pending' | 'active' | 'paused' | 'inactive'

interface Manager {
  id: string
  organization_id: string
  name: string
  phone: string
  department: ManagerDepartment
  role: string | null
  channel_id: string | null
  status: ManagerStatus
  verified: boolean
  verification_expires_at: string | null
  preferences: Record<string, unknown>
  created_at: string
  updated_at: string
}

const DEPTS: { value: ManagerDepartment; label: string; color: string }[] = [
  { value: 'compras',   label: 'Compras',    color: '#a78bfa' },
  { value: 'comercial', label: 'Comercial',  color: '#4ade80' },
  { value: 'marketing', label: 'Marketing',  color: '#f472b6' },
  { value: 'logistica', label: 'Logística',  color: '#60a5fa' },
  { value: 'diretoria', label: 'Diretoria',  color: '#FFE600' },
]

const DEPT_MAP = Object.fromEntries(DEPTS.map(d => [d.value, d])) as Record<ManagerDepartment, (typeof DEPTS)[number]>

// ── Auth + API ────────────────────────────────────────────────────────────────

async function getToken() {
  const { data } = await createClient().auth.getSession()
  return data.session?.access_token ?? null
}

async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const token = await getToken()
  if (!token) throw new Error('Sessão expirada')
  const res = await fetch(`${BACKEND}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message ?? `HTTP ${res.status}`)
  }
  if (res.status === 204) return null as T
  return res.json()
}

// ── Phone format ──────────────────────────────────────────────────────────────

function formatPhoneBR(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 13)
  if (d.length <= 2) return d
  if (d.length <= 4) return `+${d.slice(0, 2)} ${d.slice(2)}`
  if (d.length <= 6) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4)}`
  if (d.length <= 11) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}${d.length > 9 ? '-' + d.slice(9) : ''}`
  return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9, 13)}`
}

function normalizePhone(raw: string): string {
  const d = raw.replace(/\D/g, '')
  return d ? `+${d}` : ''
}

// ── Badges ────────────────────────────────────────────────────────────────────

function StatusPill({ status, verified }: { status: ManagerStatus; verified: boolean }) {
  if (!verified) return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1"
      style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>
      <AlertCircle size={10} /> Não verificado
    </span>
  )
  const map: Record<ManagerStatus, { label: string; color: string }> = {
    pending:  { label: 'Pendente', color: '#f59e0b' },
    active:   { label: 'Ativo',    color: '#4ade80' },
    paused:   { label: 'Pausado',  color: '#a1a1aa' },
    inactive: { label: 'Inativo',  color: '#52525b' },
  }
  const s = map[status]
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1"
      style={{ background: `${s.color}1a`, color: s.color, border: `1px solid ${s.color}33` }}>
      {status === 'active' && <ShieldCheck size={10} />}
      {s.label}
    </span>
  )
}

function DeptPill({ value }: { value: ManagerDepartment }) {
  const d = DEPT_MAP[value]
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: `${d.color}1a`, color: d.color, border: `1px solid ${d.color}33` }}>
      {d.label}
    </span>
  )
}

// ── Manager Form Modal (create/edit) ──────────────────────────────────────────

function ManagerFormModal({
  manager, onClose, onSaved,
}: {
  manager: Manager | null
  onClose: () => void
  onSaved: (m: Manager) => void
}) {
  const isEdit = !!manager
  const [name, setName]             = useState(manager?.name ?? '')
  const [phone, setPhone]           = useState(manager?.phone ?? '')
  const [department, setDepartment] = useState<ManagerDepartment>(manager?.department ?? 'comercial')
  const [role, setRole]             = useState(manager?.role ?? '')
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState<string | null>(null)

  const phoneValid = phone.replace(/\D/g, '').length >= 10
  const canSave = name.trim().length >= 2 && phoneValid

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const body = {
        name: name.trim(),
        phone: normalizePhone(phone),
        department,
        role: role.trim() || null,
      }
      const result = isEdit
        ? await api<Manager>(`/alert-managers/${manager.id}`, { method: 'PATCH', body: JSON.stringify(body) })
        : await api<Manager>('/alert-managers', { method: 'POST', body: JSON.stringify(body) })
      onSaved(result)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ background: '#111114', border: '1px solid #27272a' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold text-base">
            {isEdit ? 'Editar Gestor' : 'Novo Gestor'}
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/5 transition-colors" style={{ color: '#71717a' }}>
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 block mb-1">Nome</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Maria Silva"
              autoFocus
              className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none transition-colors"
              style={{ background: '#18181b', border: '1px solid #27272a' }}
              onFocus={e => (e.currentTarget.style.borderColor = '#00E5FF')}
              onBlur={e => (e.currentTarget.style.borderColor = '#27272a')}
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 block mb-1">Telefone (WhatsApp)</label>
            <input
              type="tel"
              value={formatPhoneBR(phone)}
              onChange={e => setPhone(e.target.value)}
              placeholder="+55 (11) 99999-9999"
              className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none transition-colors font-mono"
              style={{ background: '#18181b', border: '1px solid #27272a' }}
              onFocus={e => (e.currentTarget.style.borderColor = '#00E5FF')}
              onBlur={e => (e.currentTarget.style.borderColor = '#27272a')}
            />
            {phone && !phoneValid && (
              <p className="text-[10px] text-rose-400 mt-1">Telefone precisa ter pelo menos 10 dígitos com DDI.</p>
            )}
          </div>

          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 block mb-1">Departamento</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {DEPTS.map(d => {
                const active = department === d.value
                return (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => setDepartment(d.value)}
                    className="px-2 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: active ? `${d.color}1a` : '#18181b',
                      color:      active ? d.color : '#a1a1aa',
                      border:     `1px solid ${active ? d.color + '55' : '#27272a'}`,
                    }}>
                    {d.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 block mb-1">
              Cargo <span className="text-zinc-600 normal-case">(opcional)</span>
            </label>
            <input
              type="text"
              value={role}
              onChange={e => setRole(e.target.value)}
              placeholder="Diretora de Compras"
              className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none transition-colors"
              style={{ background: '#18181b', border: '1px solid #27272a' }}
              onFocus={e => (e.currentTarget.style.borderColor = '#00E5FF')}
              onBlur={e => (e.currentTarget.style.borderColor = '#27272a')}
            />
          </div>
        </div>

        {error && (
          <div className="px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}>
            {error}
          </div>
        )}

        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg text-xs font-semibold transition-colors"
            style={{ background: '#18181b', color: '#a1a1aa', border: '1px solid #27272a' }}>
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
            style={{ background: 'rgba(0,229,255,0.12)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.3)' }}>
            {saving ? 'Salvando…' : (isEdit ? 'Salvar alterações' : 'Criar gestor')}
          </button>
        </div>

        {!isEdit && (
          <p className="text-[10px] text-zinc-600 leading-relaxed">
            Após criar, vamos enviar um código de 6 dígitos pelo WhatsApp pra confirmar
            que o número é do gestor real.
          </p>
        )}
      </div>
    </div>
  )
}

// ── Verify Phone Modal ────────────────────────────────────────────────────────

function VerifyPhoneModal({
  manager, onClose, onVerified,
}: {
  manager: Manager
  onClose: () => void
  onVerified: (m: Manager) => void
}) {
  const [stage, setStage]       = useState<'send' | 'confirm'>('send')
  const [code, setCode]         = useState('')
  const [busy, setBusy]         = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [sentAt, setSentAt]     = useState<number | null>(null)

  async function handleSend() {
    setBusy(true)
    setError(null)
    try {
      await api(`/alert-managers/${manager.id}/verify-phone`, { method: 'POST' })
      setStage('confirm')
      setSentAt(Date.now())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao enviar código')
    } finally {
      setBusy(false)
    }
  }

  async function handleConfirm() {
    if (code.replace(/\D/g, '').length !== 6) {
      setError('O código tem 6 dígitos.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const updated = await api<Manager>(`/alert-managers/${manager.id}/confirm-phone`, {
        method: 'POST',
        body: JSON.stringify({ code: code.replace(/\D/g, '') }),
      })
      onVerified(updated)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Código inválido')
    } finally {
      setBusy(false)
    }
  }

  const ttlSec = sentAt ? Math.max(0, 600 - Math.floor((Date.now() - sentAt) / 1000)) : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ background: '#111114', border: '1px solid #27272a' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold text-base flex items-center gap-2">
            <ShieldCheck size={16} style={{ color: '#00E5FF' }} />
            Verificar telefone
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/5 transition-colors" style={{ color: '#71717a' }}>
            <X size={16} />
          </button>
        </div>

        <div className="px-3 py-2 rounded-lg" style={{ background: '#18181b', border: '1px solid #27272a' }}>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Gestor</p>
          <p className="text-sm text-white font-medium mt-0.5">{manager.name}</p>
          <p className="text-xs text-zinc-400 font-mono mt-0.5">{formatPhoneBR(manager.phone)}</p>
        </div>

        {stage === 'send' ? (
          <>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Vamos enviar um código de 6 dígitos para o WhatsApp acima.
              O gestor precisa abrir o WhatsApp e nos passar o código pra confirmar.
            </p>
            {error && (
              <div className="px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}>
                {error}
              </div>
            )}
            <button
              onClick={handleSend}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
              style={{ background: 'rgba(0,229,255,0.12)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.3)' }}>
              <Send size={13} />
              {busy ? 'Enviando…' : 'Enviar código por WhatsApp'}
            </button>
          </>
        ) : (
          <>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Código enviado. Digite os 6 dígitos que o gestor recebeu no WhatsApp.
              {ttlSec > 0 && (
                <span className="block mt-1 text-zinc-500 inline-flex items-center gap-1">
                  <Clock size={11} /> Expira em {Math.floor(ttlSec / 60)}:{String(ttlSec % 60).padStart(2, '0')}
                </span>
              )}
            </p>
            <input
              type="text"
              inputMode="numeric"
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              autoFocus
              className="w-full px-3 py-3 rounded-lg text-2xl text-center font-mono tracking-[0.5em] text-white outline-none transition-colors"
              style={{ background: '#18181b', border: '1px solid #27272a' }}
              onFocus={e => (e.currentTarget.style.borderColor = '#00E5FF')}
              onBlur={e => (e.currentTarget.style.borderColor = '#27272a')}
            />
            {error && (
              <div className="px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}>
                {error}
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setStage('send'); setCode(''); setError(null) }}
                className="px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
                style={{ background: '#18181b', color: '#a1a1aa', border: '1px solid #27272a' }}>
                Reenviar
              </button>
              <button
                onClick={handleConfirm}
                disabled={busy || code.length !== 6}
                className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
                style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}>
                {busy ? 'Verificando…' : 'Confirmar código'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Manager Card ──────────────────────────────────────────────────────────────

function ManagerCard({
  m, onEdit, onDelete, onVerify, selected, onToggleSelect,
}: {
  m: Manager
  onEdit: (m: Manager) => void
  onDelete: (m: Manager) => void
  onVerify: (m: Manager) => void
  selected: boolean
  onToggleSelect: (m: Manager) => void
}) {
  const dept = DEPT_MAP[m.department]

  return (
    <div className="rounded-2xl p-4 flex flex-col gap-3 transition-colors"
      style={{
        background: selected ? 'rgba(0,229,255,0.04)' : '#111114',
        border: `1px solid ${selected ? 'rgba(0,229,255,0.4)' : '#1e1e24'}`,
      }}>

      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => onToggleSelect(m)}
          className="w-5 h-5 rounded shrink-0 flex items-center justify-center transition-all mt-1"
          style={{
            background: selected ? '#00E5FF' : 'transparent',
            border: `1px solid ${selected ? '#00E5FF' : '#3f3f46'}`,
          }}
          title={selected ? 'Desmarcar' : 'Selecionar'}>
          {selected && <Check size={12} style={{ color: '#000' }} strokeWidth={3} />}
        </button>
        <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-base font-bold"
          style={{ background: `${dept.color}1a`, color: dept.color, border: `1px solid ${dept.color}33` }}>
          {m.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold text-sm truncate">{m.name}</h3>
          {m.role && <p className="text-[11px] text-zinc-500 truncate">{m.role}</p>}
        </div>
      </div>

      {/* Pills */}
      <div className="flex flex-wrap gap-1.5">
        <DeptPill value={m.department} />
        <StatusPill status={m.status} verified={m.verified} />
      </div>

      {/* Phone */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
        style={{ background: '#18181b', border: '1px solid #27272a' }}>
        <Phone size={12} style={{ color: '#71717a' }} />
        <span className="text-xs font-mono text-zinc-300 flex-1 truncate">{formatPhoneBR(m.phone)}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 pt-1">
        {!m.verified && (
          <button
            onClick={() => onVerify(m)}
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
            style={{ background: 'rgba(0,229,255,0.1)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.25)' }}>
            <ShieldCheck size={12} />
            Verificar
          </button>
        )}
        <button
          onClick={() => onEdit(m)}
          className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
          style={{ background: '#18181b', color: '#a1a1aa', border: '1px solid #27272a' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#e4e4e7')}
          onMouseLeave={e => (e.currentTarget.style.color = '#a1a1aa')}
          title="Editar">
          <Edit3 size={12} />
        </button>
        <button
          onClick={() => onDelete(m)}
          className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
          style={{ background: '#18181b', color: '#71717a', border: '1px solid #27272a' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
          onMouseLeave={e => (e.currentTarget.style.color = '#71717a')}
          title="Remover">
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-2xl p-10 flex flex-col items-center text-center gap-3"
      style={{ background: '#111114', border: '1px dashed #27272a' }}>
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.2)' }}>
        <UserIcon size={22} style={{ color: '#00E5FF' }} />
      </div>
      <div>
        <h3 className="text-white font-semibold text-sm">Nenhum gestor cadastrado</h3>
        <p className="text-xs text-zinc-500 mt-1 max-w-xs">
          Cadastre os gestores que vão receber alertas inteligentes do hub. Cada departamento
          pode ter um ou mais gestores.
        </p>
      </div>
      <button
        onClick={onCreate}
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all"
        style={{ background: 'rgba(0,229,255,0.12)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.3)' }}>
        <Plus size={13} />
        Cadastrar primeiro gestor
      </button>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GestoresPage() {
  const [managers, setManagers]     = useState<Manager[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [editing, setEditing]       = useState<Manager | null>(null)
  const [creating, setCreating]     = useState(false)
  const [verifying, setVerifying]   = useState<Manager | null>(null)
  const [filter, setFilter]         = useState<ManagerDepartment | 'all'>('all')
  const [selected, setSelected]     = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy]     = useState(false)
  const confirm = useConfirm()
  const alert   = useAlert()

  function toggleSelect(m: Manager) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(m.id)) next.delete(m.id)
      else                next.add(m.id)
      return next
    })
  }
  function clearSelection() { setSelected(new Set()) }
  function selectAllFiltered(ids: string[]) {
    setSelected(new Set(ids))
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await api<Manager[]>('/alert-managers')
      setManagers(list)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar gestores')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function handleSaved(m: Manager) {
    setManagers(prev => {
      const idx = prev.findIndex(x => x.id === m.id)
      if (idx >= 0) {
        const copy = [...prev]
        copy[idx] = m
        return copy
      }
      return [m, ...prev]
    })
    setEditing(null)
    setCreating(false)
  }

  function handleVerified(m: Manager) {
    setManagers(prev => prev.map(x => x.id === m.id ? m : x))
    setVerifying(null)
  }

  async function handleDelete(m: Manager) {
    const ok = await confirm({
      title:        'Remover gestor',
      message:      `Remover "${m.name}"? Essa ação não pode ser desfeita.`,
      confirmLabel: 'Remover',
      variant:      'danger',
    })
    if (!ok) return
    try {
      await api(`/alert-managers/${m.id}`, { method: 'DELETE' })
      setManagers(prev => prev.filter(x => x.id !== m.id))
    } catch (e: unknown) {
      await alert({
        title:   'Erro ao remover',
        message: e instanceof Error ? e.message : 'Erro desconhecido',
        variant: 'danger',
      })
    }
  }

  async function bulkSetStatus(status: 'active' | 'paused') {
    const ids = [...selected]
    if (ids.length === 0) return
    const verb = status === 'active' ? 'reativar' : 'pausar'
    const ok = await confirm({
      title:        status === 'active' ? 'Reativar gestores' : 'Pausar gestores',
      message:      `${verb.charAt(0).toUpperCase() + verb.slice(1)} ${ids.length} gestor${ids.length !== 1 ? 'es' : ''}?`,
      confirmLabel: verb.charAt(0).toUpperCase() + verb.slice(1),
      variant:      status === 'paused' ? 'warning' : 'default',
    })
    if (!ok) return
    setBulkBusy(true)
    try {
      const results = await Promise.allSettled(ids.map(id =>
        api<Manager>(`/alert-managers/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
      ))
      const updates = new Map<string, Manager>()
      let failed = 0
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') updates.set(ids[i], r.value)
        else                          failed++
      })
      setManagers(prev => prev.map(m => updates.get(m.id) ?? m))
      clearSelection()
      if (failed > 0) {
        await alert({ title: 'Bulk parcialmente concluído', message: `${failed} gestor(es) falharam.`, variant: 'warning' })
      }
    } finally { setBulkBusy(false) }
  }

  async function bulkDelete() {
    const ids = [...selected]
    if (ids.length === 0) return
    const ok = await confirm({
      title:        'Remover gestores',
      message:      `Remover ${ids.length} gestor${ids.length !== 1 ? 'es' : ''}? Essa ação não pode ser desfeita.`,
      confirmLabel: 'Remover',
      variant:      'danger',
    })
    if (!ok) return
    setBulkBusy(true)
    try {
      const results = await Promise.allSettled(ids.map(id =>
        api(`/alert-managers/${id}`, { method: 'DELETE' }),
      ))
      const successIds = new Set<string>()
      let failed = 0
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') successIds.add(ids[i])
        else                          failed++
      })
      setManagers(prev => prev.filter(m => !successIds.has(m.id)))
      clearSelection()
      if (failed > 0) {
        await alert({ title: 'Bulk parcialmente concluído', message: `${failed} gestor(es) não puderam ser removidos.`, variant: 'warning' })
      }
    } finally { setBulkBusy(false) }
  }

  const filtered = useMemo(
    () => filter === 'all' ? managers : managers.filter(m => m.department === filter),
    [managers, filter],
  )

  const counts = useMemo(() => {
    const c: Record<ManagerDepartment, number> = { compras: 0, comercial: 0, marketing: 0, logistica: 0, diretoria: 0 }
    managers.forEach(m => { c[m.department]++ })
    return c
  }, [managers])

  const verifiedCount = managers.filter(m => m.verified).length

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 sm:p-6 space-y-5 min-h-full" style={{ background: '#09090b' }}>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-zinc-500 text-xs">Inteligência</p>
          <h2 className="text-white text-lg font-semibold mt-0.5">Gestores</h2>
          <p className="text-[11px] text-zinc-600 mt-1">
            {managers.length} gestor{managers.length !== 1 ? 'es' : ''} cadastrado{managers.length !== 1 ? 's' : ''}
            {' · '}
            {verifiedCount} verificado{verifiedCount !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all disabled:opacity-60"
            style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
          <button onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
            style={{ background: 'rgba(0,229,255,0.12)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.3)' }}>
            <Plus size={13} />
            Novo gestor
          </button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}>
          {error}
        </div>
      )}

      {/* Department filter */}
      {managers.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          <button
            onClick={() => setFilter('all')}
            className="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all"
            style={{
              background: filter === 'all' ? 'rgba(255,255,255,0.08)' : '#111114',
              color:      filter === 'all' ? '#fff' : '#a1a1aa',
              border:     '1px solid #27272a',
            }}>
            Todos · {managers.length}
          </button>
          {DEPTS.map(d => {
            const active = filter === d.value
            return (
              <button
                key={d.value}
                onClick={() => setFilter(d.value)}
                className="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all flex items-center gap-1.5"
                style={{
                  background: active ? `${d.color}1a` : '#111114',
                  color:      active ? d.color : '#a1a1aa',
                  border:     `1px solid ${active ? d.color + '55' : '#27272a'}`,
                }}>
                <Briefcase size={11} />
                {d.label}
                {counts[d.value] > 0 && (
                  <span className="text-[10px] opacity-70">· {counts[d.value]}</span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Bulk toolbar (sticky no topo quando há seleção) */}
      {selected.size > 0 && (
        <div className="sticky top-2 z-10 rounded-2xl px-4 py-2.5 flex items-center gap-2 flex-wrap"
          style={{
            background: 'rgba(0,229,255,0.08)',
            border:     '1px solid rgba(0,229,255,0.3)',
            backdropFilter: 'blur(8px)',
          }}>
          <span className="text-xs font-semibold" style={{ color: '#00E5FF' }}>
            {selected.size} selecionado{selected.size !== 1 ? 's' : ''}
          </span>
          <div className="flex-1" />
          <button onClick={() => selectAllFiltered(filtered.map(m => m.id))} disabled={bulkBusy}
            className="text-[11px] px-2.5 py-1 rounded-md transition-colors disabled:opacity-40"
            style={{ color: '#a1a1aa' }}>
            Selecionar todos ({filtered.length})
          </button>
          <button onClick={() => bulkSetStatus('active')} disabled={bulkBusy}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all disabled:opacity-40"
            style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.25)' }}>
            <Play size={11} /> Reativar
          </button>
          <button onClick={() => bulkSetStatus('paused')} disabled={bulkBusy}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all disabled:opacity-40"
            style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }}>
            <Pause size={11} /> Pausar
          </button>
          <button onClick={bulkDelete} disabled={bulkBusy}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all disabled:opacity-40"
            style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.25)' }}>
            <Trash2 size={11} /> Remover
          </button>
          <button onClick={clearSelection} disabled={bulkBusy}
            className="p-1 rounded-md transition-colors disabled:opacity-40"
            style={{ color: '#71717a' }}
            title="Limpar seleção">
            <X size={13} />
          </button>
        </div>
      )}

      {/* Cards grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-44 rounded-2xl animate-pulse" style={{ background: '#111114' }} />
          ))}
        </div>
      ) : managers.length === 0 ? (
        <EmptyState onCreate={() => setCreating(true)} />
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl px-4 py-8 text-center text-xs text-zinc-500"
          style={{ background: '#111114', border: '1px solid #27272a' }}>
          Nenhum gestor em <strong style={{ color: DEPT_MAP[filter as ManagerDepartment].color }}>
            {DEPT_MAP[filter as ManagerDepartment].label}
          </strong>.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(m => (
            <ManagerCard
              key={m.id}
              m={m}
              onEdit={setEditing}
              onDelete={handleDelete}
              onVerify={setVerifying}
              selected={selected.has(m.id)}
              onToggleSelect={toggleSelect}
            />
          ))}
        </div>
      )}

      {/* Footer info */}
      <p className="text-[10px] text-zinc-700 leading-relaxed pt-2">
        Os gestores cadastrados aqui recebem alertas inteligentes do hub via WhatsApp.
        Após cadastrar, é necessário verificar o telefone — o sistema envia um código de 6
        dígitos pra confirmar que o número é do gestor real. Só gestores verificados
        recebem alertas em produção.
      </p>

      {/* Modals */}
      {(creating || editing) && (
        <ManagerFormModal
          manager={editing}
          onClose={() => { setEditing(null); setCreating(false) }}
          onSaved={handleSaved}
        />
      )}
      {verifying && (
        <VerifyPhoneModal
          manager={verifying}
          onClose={() => setVerifying(null)}
          onVerified={handleVerified}
        />
      )}
    </div>
  )
}
