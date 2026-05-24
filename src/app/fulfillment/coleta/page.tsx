'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, Building2, ChevronDown, ChevronRight, Truck, PackageCheck, Clock, Inbox } from 'lucide-react'
import { fulfillmentApi, type CollectionData, type CollectionOrder } from '../_lib/api'

const WID_KEY = 'eclick_fulfillment_wid'
const platformColor = (p: string | null) => p === 'mercadolivre' ? '#FFE600' : p === 'loja' ? '#00E5FF' : p === 'b2b' ? '#4ADE50' : '#a1a1aa'
const logisticLabel = (t: string | null) =>
  t === 'self_service' ? 'Flex' : t === 'cross_docking' ? 'Cross-docking' : t === 'xd_drop_off' ? 'Agência' : t === 'drop_off' ? 'Correios/Agência' : t === 'fulfillment' ? 'Full' : (t ?? '—')

export default function ColetaPage() {
  const [data, setData] = useState<CollectionData | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const wid = typeof window !== 'undefined' ? localStorage.getItem(WID_KEY) : null

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await fulfillmentApi.collection(wid ?? undefined)); setErr(null) }
    catch (e) { setErr((e as Error).message) } finally { setLoading(false) }
  }, [wid])

  useEffect(() => { void load() }, [load])

  const toggle = (k: string) => setOpen((p) => ({ ...p, [k]: !p[k] }))

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-3 pt-1">
        <Link href="/fulfillment" className="rounded-xl p-2.5" style={{ background: '#18181b' }}><ArrowLeft size={20} /></Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Aguardando coleta</h1>
          <p className="text-xs" style={{ color: '#71717a' }}>{data ? `${data.total} pedido(s) prontos` : 'organizado por empresa e conta'}</p>
        </div>
        <button onClick={() => void load()} className="rounded-xl p-2.5" style={{ background: '#18181b' }} aria-label="Atualizar"><RefreshCw size={18} color="#00E5FF" /></button>
      </header>

      {err && <div className="rounded-xl p-3 text-sm" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>}

      {loading && <div className="flex flex-col gap-2">{[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl" style={{ background: '#0c0c10' }} />)}</div>}

      {!loading && (data?.groups.length ?? 0) === 0 && !err && (
        <div className="rounded-2xl p-8 text-center" style={{ background: '#0c0c10', border: '1px solid rgba(255,255,255,0.08)' }}>
          <Inbox size={30} className="mx-auto mb-2" color="#52525b" />
          <p className="text-sm" style={{ color: '#a1a1aa' }}>Nenhum pedido aguardando coleta no momento.</p>
        </div>
      )}

      {data?.groups.map((g) => {
        const ck = `c:${g.companyId ?? 'none'}`
        const openC = open[ck] ?? true
        return (
          <section key={ck} className="rounded-2xl" style={{ background: '#0a0a0e', border: '1px solid rgba(255,255,255,0.06)' }}>
            <button onClick={() => toggle(ck)} className="flex w-full items-center gap-3 rounded-t-2xl px-4 py-3" style={{ background: '#111114' }}>
              <Building2 size={18} color="#00E5FF" />
              <span className="flex-1 text-left font-bold">{g.companyName}</span>
              <span className="rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums" style={{ background: '#00E5FF22', color: '#00E5FF' }}>{g.count}</span>
              {openC ? <ChevronDown size={18} color="#71717a" /> : <ChevronRight size={18} color="#71717a" />}
            </button>

            {openC && (
              <div className="flex flex-col gap-3 p-3">
                {g.accounts.map((a) => {
                  const ak = `${ck}/a:${a.accountId ?? a.platform}`
                  const openA = open[ak] ?? true
                  return (
                    <div key={ak} className="rounded-xl" style={{ background: '#0c0c10', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <button onClick={() => toggle(ak)} className="flex w-full items-center gap-2 px-3 py-2.5">
                        <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `${platformColor(a.platform)}1a`, color: platformColor(a.platform) }}>{a.platform}</span>
                        <span className="flex-1 truncate text-left text-sm font-semibold">{a.label}</span>
                        <span className="text-xs font-bold tabular-nums" style={{ color: '#a1a1aa' }}>{a.count}</span>
                        {openA ? <ChevronDown size={15} color="#52525b" /> : <ChevronRight size={15} color="#52525b" />}
                      </button>
                      {openA && (
                        <ul className="flex flex-col gap-1.5 px-2 pb-2">
                          {a.orders.map((o) => <OrderRow key={o.id} o={o} />)}
                        </ul>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

function OrderRow({ o }: { o: CollectionOrder }) {
  const shipped = o.status === 'shipped'
  return (
    <li className="rounded-lg p-2.5" style={{ background: '#121214' }}>
      <div className="flex items-center gap-2">
        <span className="font-bold">#{o.reference}</span>
        <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: shipped ? '#4ADE5022' : '#a78bfa22', color: shipped ? '#4ADE50' : '#c4b5fd' }}>
          {shipped ? <Truck size={11} /> : <PackageCheck size={11} />} {shipped ? 'Etiquetado' : 'Embalado'}
        </span>
        <span className="ml-auto text-xs" style={{ color: '#52525b' }}>{o.itemsCount} {o.itemsCount === 1 ? 'item' : 'itens'}</span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]" style={{ color: '#71717a' }}>
        <span>{logisticLabel(o.logisticType)}</span>
        {o.tracking && <span>· rastreio {o.tracking}</span>}
        {o.scheduledFrom && <span className="flex items-center gap-1" style={{ color: '#a78bfa' }}><Clock size={10} /> coleta {new Date(o.scheduledFrom).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>}
        {o.customerName && <span>· {o.customerName}</span>}
      </div>
    </li>
  )
}
