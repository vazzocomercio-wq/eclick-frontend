'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, Clock, AlertTriangle, Ban, Radio, PackageSearch, PackageCheck, Truck, Inbox } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { fulfillmentApi, type BoardData, type BoardCard, type BoardUrgency } from '../_lib/api'

const WID_KEY = 'eclick_fulfillment_wid'

const LANES: Array<{ key: keyof BoardData['lanes']; label: string; icon: React.ReactNode; color: string }> = [
  { key: 'received',        label: 'Recebido',          icon: <Inbox size={16} />,        color: '#a1a1aa' },
  { key: 'picking',         label: 'Separando',         icon: <PackageSearch size={16} />, color: '#00E5FF' },
  { key: 'packing',         label: 'Conferindo',        icon: <PackageCheck size={16} />,  color: '#4ADE50' },
  { key: 'awaiting_pickup', label: 'Aguardando coleta', icon: <Truck size={16} />,         color: '#a78bfa' },
]

const URGENCY: Record<BoardUrgency, { bg: string; border: string; text: string }> = {
  late: { bg: 'rgba(239,68,68,0.14)', border: '#EF4444', text: '#f87171' },
  soon: { bg: 'rgba(245,158,11,0.12)', border: '#F59E0B', text: '#fcd34d' },
  ok:   { bg: '#0c0c10', border: 'rgba(255,255,255,0.08)', text: '#a1a1aa' },
  none: { bg: '#0c0c10', border: 'rgba(255,255,255,0.08)', text: '#52525b' },
}

export default function PainelPage() {
  const [data, setData] = useState<BoardData | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [live, setLive] = useState(false)
  const [, setTick] = useState(0) // re-render p/ atualizar os contadores de tempo
  const wid = typeof window !== 'undefined' ? localStorage.getItem(WID_KEY) : null
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    try { setData(await fulfillmentApi.board(wid ?? undefined)); setErr(null) }
    catch (e) { setErr((e as Error).message) }
  }, [wid])

  // Carga inicial + fallback de atualização (caso o realtime caia) + tick do relógio
  useEffect(() => {
    void load()
    const poll = setInterval(() => void load(), 20_000)   // fallback
    const clock = setInterval(() => setTick((t) => t + 1), 30_000) // atualiza "faltam Xh"
    return () => { clearInterval(poll); clearInterval(clock) }
  }, [load])

  // Realtime: qualquer mudança em fulfillment_orders → recarrega (debounced)
  useEffect(() => {
    const supa = createClient()
    const ch = supa
      .channel('fulfillment-board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fulfillment_orders' }, () => {
        if (debounce.current) clearTimeout(debounce.current)
        debounce.current = setTimeout(() => void load(), 600)
      })
      .subscribe((status) => setLive(status === 'SUBSCRIBED'))
    return () => { supa.removeChannel(ch) }
  }, [load])

  const c = data?.counts

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-3 pt-1">
        <Link href="/fulfillment" className="rounded-xl p-2.5" style={{ background: '#18181b' }}><ArrowLeft size={20} /></Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Painel ao vivo</h1>
          <p className="flex items-center gap-1.5 text-xs" style={{ color: live ? '#4ADE50' : '#71717a' }}>
            <Radio size={12} /> {live ? 'tempo real' : 'atualizando…'}
          </p>
        </div>
        <button onClick={() => void load()} className="rounded-xl p-2.5" style={{ background: '#18181b' }} aria-label="Atualizar"><RefreshCw size={18} color="#00E5FF" /></button>
      </header>

      {err && <div className="rounded-xl p-3 text-sm" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>}

      {/* Alertas */}
      {(c?.late ?? 0) > 0 && (
        <div className="flex items-center gap-3 rounded-2xl p-4" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid #EF444455' }}>
          <AlertTriangle size={22} color="#f87171" />
          <div className="text-lg font-bold" style={{ color: '#f87171' }}>{c?.late} atrasado(s)</div>
          {(c?.dueSoon ?? 0) > 0 && <div className="text-sm" style={{ color: '#fcd34d' }}>· {c?.dueSoon} vencendo em 2h</div>}
        </div>
      )}
      {(c?.blocked ?? 0) > 0 && (
        <div className="flex items-center gap-2 rounded-xl p-3 text-sm" style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid #F59E0B44', color: '#fcd34d' }}>
          <Ban size={16} /> {c?.blocked} pedido(s) bloqueado(s) — precisam de atenção
        </div>
      )}

      {/* Colunas (KDS) — scroll horizontal em telas estreitas */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {LANES.map((lane) => {
          const cards = data?.lanes[lane.key] ?? []
          return (
            <div key={lane.key} className="flex flex-col rounded-2xl" style={{ background: '#0a0a0e', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center justify-between rounded-t-2xl px-3 py-2.5" style={{ background: '#111114', borderBottom: `2px solid ${lane.color}55` }}>
                <span className="flex items-center gap-2 text-sm font-bold" style={{ color: lane.color }}>{lane.icon} {lane.label}</span>
                <span className="rounded-full px-2 py-0.5 text-xs font-bold tabular-nums" style={{ background: `${lane.color}22`, color: lane.color }}>{cards.length}</span>
              </div>
              <div className="flex max-h-[62dvh] flex-col gap-2 overflow-y-auto p-2 lg:max-h-[70dvh]">
                {cards.length === 0 && <p className="px-2 py-6 text-center text-xs" style={{ color: '#3f3f46' }}>vazio</p>}
                {cards.map((card) => <Card key={card.id} card={card} />)}
              </div>
            </div>
          )
        })}
      </div>

      {data && <p className="text-center text-[11px]" style={{ color: '#3f3f46' }}>atualizado {new Date(data.generatedAt).toLocaleTimeString('pt-BR')}</p>}
    </div>
  )
}

function Card({ card }: { card: BoardCard }) {
  const u = URGENCY[card.urgency]
  return (
    <div className="rounded-xl p-3" style={{ background: u.bg, border: `1px solid ${u.border}` }}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-bold">#{card.reference}</span>
        <ChannelPill platform={card.platform} channel={card.channel} />
      </div>
      <div className="mt-0.5 truncate text-xs" style={{ color: '#a1a1aa' }}>
        {card.customerName || 'Cliente'} · {card.itemsCount} {card.itemsCount === 1 ? 'item' : 'itens'}
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: u.text }}>
          <Clock size={12} /> {fmtDeadline(card.deadline, card.urgency)}
        </span>
        {(card.companyName || card.accountLabel) && (
          <span className="truncate text-[10px]" style={{ color: '#52525b', maxWidth: '55%' }}>{card.companyName ?? card.accountLabel}</span>
        )}
      </div>
    </div>
  )
}

function ChannelPill({ platform, channel }: { platform: string | null; channel: string | null }) {
  const p = platform ?? channel ?? '—'
  const color = p === 'mercadolivre' ? '#FFE600' : p === 'loja' ? '#00E5FF' : p === 'b2b' ? '#4ADE50' : '#a1a1aa'
  return <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: `${color}1a`, color }}>{p}</span>
}

function fmtDeadline(iso: string | null, urgency: BoardUrgency): string {
  if (!iso) return 'sem prazo'
  const diff = new Date(iso).getTime() - Date.now()
  const abs = Math.abs(diff)
  const h = Math.floor(abs / 3600_000)
  const m = Math.floor((abs % 3600_000) / 60_000)
  const txt = h > 0 ? `${h}h${m > 0 ? ` ${m}min` : ''}` : `${m}min`
  if (urgency === 'late') return `atrasado ${txt}`
  return `faltam ${txt}`
}
