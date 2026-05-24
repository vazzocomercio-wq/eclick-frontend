'use client'

import { useEffect, useState } from 'react'
import { X, Loader2, Trash2, UserPlus, Users, BarChart3, ShieldCheck } from 'lucide-react'
import { fulfillmentApi, type Operator, type OrgMember, type Productivity, type OperatorRole } from '../_lib/api'

const ROLES: Array<{ key: OperatorRole; label: string }> = [
  { key: 'picker', label: 'Separador' },
  { key: 'packer', label: 'Conferente' },
  { key: 'supervisor', label: 'Supervisor' },
  { key: 'admin', label: 'Admin' },
]
const roleColor = (r: string) => r === 'picker' ? '#00E5FF' : r === 'packer' ? '#4ADE50' : '#fcd34d'

/** Equipe (operadores + papéis) + Produtividade do CD. Supervisor. */
export function TeamSheet({ warehouseId, onClose }: { warehouseId: string | null; onClose: () => void }) {
  const [tab, setTab] = useState<'team' | 'prod'>('team')
  const [enforce, setEnforce] = useState(false)
  const [ops, setOps] = useState<Operator[]>([])
  const [members, setMembers] = useState<OrgMember[]>([])
  const [prod, setProd] = useState<Productivity | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [addUser, setAddUser] = useState('')
  const [addRole, setAddRole] = useState<OperatorRole>('picker')
  const [busy, setBusy] = useState(false)

  async function reload() {
    setLoading(true)
    try {
      const [s, o, m, p] = await Promise.all([
        fulfillmentApi.getSettings(),
        fulfillmentApi.operators(warehouseId ?? undefined),
        fulfillmentApi.orgMembers(),
        fulfillmentApi.productivity(7, warehouseId ?? undefined),
      ])
      setEnforce(s.enforce_roles); setOps(o); setMembers(m); setProd(p); setErr(null)
    } catch (e) { setErr((e as Error).message) } finally { setLoading(false) }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void reload() }, [])

  async function toggleEnforce() {
    const next = !enforce
    setEnforce(next)
    try { await fulfillmentApi.updateSettings({ enforce_roles: next }) } catch (e) { setErr((e as Error).message); setEnforce(!next) }
  }

  async function add() {
    if (!warehouseId || !addUser) return
    setBusy(true); setErr(null)
    try { await fulfillmentApi.addOperator({ warehouseId, userId: addUser, role: addRole }); setAddUser(''); await reload() }
    catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  async function remove(id: string) {
    setBusy(true); setErr(null)
    try { await fulfillmentApi.removeOperator(id); await reload() }
    catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  async function changeRole(id: string, role: OperatorRole) {
    try { await fulfillmentApi.updateOperator(id, { role }); setOps((p) => p.map((o) => o.id === id ? { ...o, role } : o)) }
    catch (e) { setErr((e as Error).message) }
  }

  const opUserIds = new Set(ops.map((o) => o.user_id))
  const availableMembers = members.filter((m) => !opUserIds.has(m.user_id))

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl p-5" style={{ background: '#121214' }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Equipe do CD</h2>
          <button onClick={onClose} className="rounded-xl p-2" style={{ background: '#0c0c10' }}><X size={18} /></button>
        </div>

        <div className="mb-4 flex gap-2">
          <Tab active={tab === 'team'} onClick={() => setTab('team')} icon={<Users size={15} />} label="Operadores" />
          <Tab active={tab === 'prod'} onClick={() => setTab('prod')} icon={<BarChart3 size={15} />} label="Produtividade" />
        </div>

        {err && <div className="mb-3 rounded-lg p-3 text-sm" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171' }}>{err}</div>}

        {loading ? (
          <div className="grid place-items-center py-10"><Loader2 size={24} className="animate-spin" color="#00E5FF" /></div>
        ) : tab === 'team' ? (
          <div className="flex flex-col gap-4">
            {/* enforce toggle */}
            <button onClick={toggleEnforce} className="flex items-center justify-between rounded-2xl p-3" style={{ background: '#0c0c10', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span className="flex items-center gap-2 text-sm"><ShieldCheck size={16} color={enforce ? '#4ADE50' : '#71717a'} /> Exigir papel pra operar</span>
              <span className="relative h-6 w-11 rounded-full" style={{ background: enforce ? '#4ADE50' : '#3f3f46' }}>
                <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all" style={{ left: enforce ? '22px' : '2px' }} />
              </span>
            </button>
            {!enforce && <p className="-mt-2 text-xs" style={{ color: '#71717a' }}>Desligado: qualquer membro da org pode separar/conferir.</p>}

            {/* adicionar operador */}
            {warehouseId && availableMembers.length > 0 && (
              <div className="rounded-2xl p-3" style={{ background: '#0c0c10', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="mb-2 text-xs font-semibold" style={{ color: '#71717a' }}>Adicionar operador</p>
                <div className="flex flex-col gap-2">
                  <select value={addUser} onChange={(e) => setAddUser(e.target.value)} className="rounded-lg px-3 py-2.5 text-sm outline-none" style={{ background: '#09090b', color: '#fafafa', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <option value="">Escolha um membro…</option>
                    {availableMembers.map((m) => <option key={m.user_id} value={m.user_id}>{m.name || m.email || m.user_id.slice(0, 8)}</option>)}
                  </select>
                  <div className="flex gap-2">
                    <select value={addRole} onChange={(e) => setAddRole(e.target.value as OperatorRole)} className="flex-1 rounded-lg px-3 py-2.5 text-sm outline-none" style={{ background: '#09090b', color: '#fafafa', border: '1px solid rgba(255,255,255,0.08)' }}>
                      {ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                    </select>
                    <button onClick={add} disabled={!addUser || busy} className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold disabled:opacity-50" style={{ background: '#00E5FF', color: '#04222a' }}>
                      <UserPlus size={16} /> Add
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* lista de operadores */}
            <div className="flex flex-col gap-2">
              {ops.length === 0 && <p className="text-sm" style={{ color: '#71717a' }}>Nenhum operador cadastrado neste CD.</p>}
              {ops.map((o) => (
                <div key={o.id} className="flex items-center gap-3 rounded-xl p-3" style={{ background: '#0c0c10' }}>
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm font-semibold">{o.name || o.email || o.user_id.slice(0, 8)}</div>
                    {o.email && o.name && <div className="truncate text-xs" style={{ color: '#71717a' }}>{o.email}</div>}
                  </div>
                  <select value={o.role} onChange={(e) => changeRole(o.id, e.target.value as OperatorRole)} className="rounded-lg px-2 py-1 text-xs font-semibold outline-none" style={{ background: '#18181b', color: roleColor(o.role), border: `1px solid ${roleColor(o.role)}44` }}>
                    {ROLES.map((r) => <option key={r.key} value={r.key} style={{ color: '#fff' }}>{r.label}</option>)}
                  </select>
                  <button onClick={() => remove(o.id)} disabled={busy} className="rounded-lg p-2" style={{ background: '#18181b' }} aria-label="Remover"><Trash2 size={15} color="#f87171" /></button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-xs" style={{ color: '#71717a' }}>Últimos {prod?.days ?? 7} dias</p>
            {(prod?.operators.length ?? 0) === 0 && <p className="text-sm" style={{ color: '#71717a' }}>Sem atividade registrada ainda.</p>}
            {prod?.operators.map((p) => (
              <div key={p.userId} className="rounded-xl p-3" style={{ background: '#0c0c10' }}>
                <div className="mb-2 truncate text-sm font-semibold">{p.name || p.email || p.userId.slice(0, 8)}</div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <Metric label="Itens" value={p.items} color="#00E5FF" />
                  <Metric label="Itens/h" value={p.itemsPerHour ?? '—'} color="#fafafa" />
                  <Metric label="Pedidos" value={p.packs} color="#4ADE50" />
                  <Metric label="Erros" value={p.mismatches} color={p.mismatches > 0 ? '#f87171' : '#52525b'} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Tab({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold"
      style={{ background: active ? '#00E5FF22' : '#0c0c10', color: active ? '#00E5FF' : '#a1a1aa', border: `1px solid ${active ? '#00E5FF55' : 'rgba(255,255,255,0.08)'}` }}>
      {icon} {label}
    </button>
  )
}
function Metric({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div>
      <div className="text-lg font-bold tabular-nums" style={{ color }}>{value}</div>
      <div className="text-[10px]" style={{ color: '#71717a' }}>{label}</div>
    </div>
  )
}
