'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, AlertTriangle, Ban, ChevronRight, PackageSearch } from 'lucide-react'
import { Scanner } from '../_components/Scanner'
import { CameraCapture } from '../_components/CameraCapture'
import { fulfillmentApi, ApiError, type PickTask } from '../_lib/api'
import { sendOrQueue } from '../_lib/offline'
import { feedbackOk, feedbackError, feedbackDone } from '../_lib/feedback'

const WID_KEY = 'eclick_fulfillment_wid'

interface OrderGroup {
  foId: string
  reference: string
  channel: string
  accountLabel: string | null
  platform: string | null
  company: string | null
  customer: string
  tasks: PickTask[]
}

export default function PickingPage() {
  const [groups, setGroups] = useState<OrderGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFo, setActiveFo] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const wid = typeof window !== 'undefined' ? localStorage.getItem(WID_KEY) : null

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const tasks = await fulfillmentApi.pickQueue(wid ?? undefined)
      const map = new Map<string, OrderGroup>()
      for (const t of tasks) {
        const g = map.get(t.fulfillment_order_id) ?? {
          foId: t.fulfillment_order_id,
          reference: t.order?.reference ?? t.fulfillment_order_id.slice(0, 8),
          channel: t.order?.channel ?? '—',
          accountLabel: t.order?.accountLabel ?? null,
          platform: t.order?.platform ?? null,
          company: t.order?.companyName ?? null,
          customer: t.order?.customer?.name ?? '',
          tasks: [],
        }
        g.tasks.push(t)
        map.set(t.fulfillment_order_id, g)
      }
      setGroups([...map.values()])
      setErr(null)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [wid])

  useEffect(() => { load() }, [load])

  const active = useMemo(() => groups.find((g) => g.foId === activeFo) ?? null, [groups, activeFo])

  if (active) {
    return <PickSession group={active} onExit={() => { setActiveFo(null); load() }} onChange={load} />
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-3 pt-1">
        <Link href="/fulfillment" className="rounded-xl p-2.5" style={{ background: '#18181b' }}><ArrowLeft size={20} /></Link>
        <h1 className="text-xl font-bold">Separar pedidos</h1>
      </header>

      {err && <ErrBox msg={err} />}

      {loading && <SkeletonList />}

      {!loading && groups.length === 0 && !err && (
        <Empty icon={<PackageSearch size={30} color="#52525b" />} text="Nenhum pedido na fila de separação." />
      )}

      <ul className="flex flex-col gap-2">
        {groups.map((g) => {
          const total = g.tasks.length
          const done = g.tasks.filter((t) => t.status === 'picked').length
          const late = g.tasks.some((t) => t.sla_deadline && t.status !== 'picked' && new Date(t.sla_deadline).getTime() < Date.now())
          return (
            <li key={g.foId}>
              <button
                onClick={() => setActiveFo(g.foId)}
                className="flex w-full items-center gap-3 rounded-2xl p-4 text-left active:scale-[0.99] transition-transform"
                style={{ background: '#0c0c10', border: `1px solid ${late ? '#EF444455' : 'rgba(255,255,255,0.08)'}` }}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">#{g.reference}</span>
                    <ChannelPill platform={g.platform} channel={g.channel} label={g.accountLabel} />
                    {late && <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: '#EF444422', color: '#f87171' }}>ATRASADO</span>}
                  </div>
                  <div className="text-sm" style={{ color: '#a1a1aa' }}>{g.customer || 'Cliente'} · {total} {total === 1 ? 'item' : 'itens'}{g.company ? ` · ${g.company}` : ''}</div>
                </div>
                <div className="text-sm font-semibold tabular-nums" style={{ color: done === total ? '#4ADE50' : '#71717a' }}>{done}/{total}</div>
                <ChevronRight size={18} color="#52525b" />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function PickSession({ group, onExit, onChange }: { group: OrderGroup; onExit: () => void; onChange: () => void }) {
  const [tasks, setTasks] = useState<PickTask[]>(group.tasks)
  const [flash, setFlash] = useState<'ok' | 'err' | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showDamage, setShowDamage] = useState(false)

  // Item atual = primeiro não-concluído
  const idx = tasks.findIndex((t) => t.status !== 'picked' && t.status !== 'cancelled')
  const current = idx >= 0 ? tasks[idx] : null
  const allDone = idx < 0

  const flashFx = (kind: 'ok' | 'err') => { setFlash(kind); setTimeout(() => setFlash(null), 450) }

  async function onScan(code: string) {
    if (!current || busy) return
    setBusy(true); setMsg(null)
    try {
      const r = await fulfillmentApi.scanItem(current.id, code)
      setTasks((prev) => prev.map((t) => t.id === current.id ? { ...t, picked_qty: r.picked_qty, status: r.status } : t))
      if (r.status === 'picked') {
        feedbackOk()
        const remaining = tasks.filter((t) => t.id !== current.id && t.status !== 'picked' && t.status !== 'cancelled').length
        if (remaining === 0) { feedbackDone(); setMsg('Pedido separado! ✓') }
      } else {
        feedbackOk()
      }
      flashFx('ok')
    } catch (e) {
      feedbackError(); flashFx('err')
      setMsg(e instanceof ApiError ? e.message : (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function block(reason: string) {
    if (!current) return
    try { await sendOrQueue(`/fulfillment/pick-tasks/${current.id}/block`, 'POST', { reason }); onChange(); onExit() }
    catch (e) { setMsg((e as Error).message) }
  }

  async function reportDamage(base64: string, mime: string, severity: string) {
    if (!current) return
    try {
      const r = await sendOrQueue('/fulfillment/damage-reports', 'POST', { pickTaskId: current.id, fulfillmentOrderId: group.foId, sku: current.sku, severity, photosBase64: [base64] })
      setShowDamage(false); setMsg(r.queued ? 'Avaria salva na fila (offline).' : 'Avaria registrada.')
    } catch (e) { setMsg((e as Error).message) }
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-3 pt-1">
        <button onClick={onExit} className="rounded-xl p-2.5" style={{ background: '#18181b' }}><ArrowLeft size={20} /></button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold">#{group.reference}</h1>
            <ChannelPill platform={group.platform} channel={group.channel} label={group.accountLabel} />
          </div>
          <p className="text-xs" style={{ color: '#71717a' }}>{group.customer || 'Cliente'}{group.company ? ` · ${group.company}` : ''}</p>
        </div>
      </header>

      {/* progresso */}
      <div className="flex gap-1.5">
        {tasks.map((t) => (
          <div key={t.id} className="h-1.5 flex-1 rounded-full" style={{ background: t.status === 'picked' ? '#4ADE50' : t.id === current?.id ? '#00E5FF' : '#27272a' }} />
        ))}
      </div>

      {allDone ? (
        <div className="rounded-2xl p-6 text-center" style={{ background: '#0c2814', border: '1px solid #4ADE5055' }}>
          <Check size={42} className="mx-auto mb-2" color="#4ADE50" />
          <div className="text-lg font-bold">Pedido separado!</div>
          <p className="mt-1 text-sm" style={{ color: '#a1a1aa' }}>Seguiu para a fila de conferência.</p>
          <button onClick={onExit} className="mt-4 w-full rounded-xl py-3 font-bold" style={{ background: '#4ADE50', color: '#06210d' }}>Próximo pedido</button>
        </div>
      ) : current && (
        <>
          <div
            className="rounded-2xl p-5 transition-colors"
            style={{
              background: flash === 'ok' ? '#0c2814' : flash === 'err' ? '#2a0d0d' : '#0c0c10',
              border: `1px solid ${flash === 'ok' ? '#4ADE50' : flash === 'err' ? '#EF4444' : 'rgba(255,255,255,0.08)'}`,
            }}
          >
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-semibold" style={{ color: '#71717a' }}>ITEM {idx + 1} DE {tasks.length}</span>
              <span className="text-sm font-bold tabular-nums" style={{ color: '#00E5FF' }}>{current.picked_qty}/{current.expected_qty}</span>
            </div>
            <div className="font-mono text-2xl font-bold tracking-wide">{current.sku}</div>
            {current.title && <div className="mt-1 text-sm" style={{ color: '#a1a1aa' }}>{current.title}</div>}
            {current.expected_barcode && <div className="mt-2 text-xs" style={{ color: '#52525b' }}>EAN {current.expected_barcode}</div>}
          </div>

          <Scanner onScan={onScan} disabled={busy} hint="Bipe o produto (SKU, EAN ou QR)" />

          {msg && (
            <div className="rounded-xl p-3 text-center text-sm font-semibold" style={{ background: flash === 'err' ? 'rgba(239,68,68,0.12)' : 'rgba(74,222,80,0.10)', color: flash === 'err' ? '#f87171' : '#4ADE50' }}>
              {msg}
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => setShowDamage(true)} className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold" style={{ background: '#18181b', color: '#fcd34d' }}>
              <AlertTriangle size={16} /> Avaria
            </button>
            <button onClick={() => block('Item em falta / problema')} className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold" style={{ background: '#18181b', color: '#f87171' }}>
              <Ban size={16} /> Bloquear
            </button>
          </div>
        </>
      )}

      {showDamage && current && (
        <DamageSheet sku={current.sku} onClose={() => setShowDamage(false)} onSubmit={reportDamage} />
      )}
    </div>
  )
}

function DamageSheet({ sku, onClose, onSubmit }: { sku: string; onClose: () => void; onSubmit: (b64: string, mime: string, sev: string) => void }) {
  const [severity, setSeverity] = useState('minor')
  const [shoot, setShoot] = useState(false)
  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="w-full rounded-t-3xl p-5" style={{ background: '#121214' }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Registrar avaria</h2>
          <span className="font-mono text-sm" style={{ color: '#71717a' }}>{sku}</span>
        </div>
        <div className="mb-3 grid grid-cols-3 gap-2">
          {[['minor', 'Leve'], ['major', 'Grave'], ['total_loss', 'Perda total']].map(([v, l]) => (
            <button key={v} onClick={() => setSeverity(v)} className="rounded-xl py-3 text-sm font-semibold"
              style={{ background: severity === v ? '#fcd34d22' : '#0c0c10', color: severity === v ? '#fcd34d' : '#a1a1aa', border: `1px solid ${severity === v ? '#fcd34d55' : 'rgba(255,255,255,0.08)'}` }}>
              {l}
            </button>
          ))}
        </div>
        {shoot
          ? <CameraCapture label="Foto da avaria" onCapture={(b64, mime) => onSubmit(b64, mime, severity)} onCancel={() => setShoot(false)} />
          : <button onClick={() => setShoot(true)} className="w-full rounded-xl py-3 font-bold" style={{ background: '#fcd34d', color: '#241c02' }}>Tirar foto e registrar</button>}
      </div>
    </div>
  )
}

function ChannelPill({ platform, channel, label }: { platform?: string | null; channel?: string | null; label?: string | null }) {
  const key = (platform ?? channel ?? '').toLowerCase()
  const c = key.includes('mercado') ? '#FFE600'
    : key === 'loja' || key === 'storefront' ? '#00E5FF'
    : key === 'b2b' ? '#4ADE50'
    : key.includes('shopee') ? '#EE4D2D'
    : key.includes('tiktok') ? '#fafafa'
    : '#a1a1aa'
  // Mostra o apelido da conta (ex.: VAZZO_) quando houver — nunca só "mercadolivre".
  const text = label || channel || platform || '—'
  return <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `${c}1a`, color: c }}>{text}</span>
}
function ErrBox({ msg }: { msg: string }) {
  return <div className="rounded-xl p-3 text-sm" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{msg}</div>
}
function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <div className="rounded-2xl p-8 text-center" style={{ background: '#0c0c10', border: '1px solid rgba(255,255,255,0.08)' }}><div className="mb-2 flex justify-center">{icon}</div><p className="text-sm" style={{ color: '#a1a1aa' }}>{text}</p></div>
}
function SkeletonList() {
  return <div className="flex flex-col gap-2">{[0, 1, 2].map((i) => <div key={i} className="h-[72px] animate-pulse rounded-2xl" style={{ background: '#0c0c10' }} />)}</div>
}
