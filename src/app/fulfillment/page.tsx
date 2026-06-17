'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { PackageSearch, PackageCheck, AlertTriangle, ScanLine, RefreshCw, Warehouse as WarehouseIcon, Settings, Users, Clock, RotateCcw, Layers, Building2, Tv, Truck, Box, MapPin } from 'lucide-react'
import { fulfillmentApi, type Warehouse, type DashboardData } from './_lib/api'
import { SettingsSheet } from './_components/SettingsSheet'
import { TeamSheet } from './_components/TeamSheet'
import { CompaniesSheet } from './_components/CompaniesSheet'
import { PackagingSheet } from './_components/PackagingSheet'
import { LocationsSheet } from './_components/LocationsSheet'

const WID_KEY = 'eclick_fulfillment_wid'

export default function FulfillmentHub() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [wid, setWid] = useState<string | null>(null)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showTeam, setShowTeam] = useState(false)
  const [showCompanies, setShowCompanies] = useState(false)
  const [showPackaging, setShowPackaging] = useState(false)
  const [showLocations, setShowLocations] = useState(false)

  const load = useCallback(async (warehouseId: string | null) => {
    try {
      setErr(null)
      const dash = await fulfillmentApi.dashboard(warehouseId ?? undefined)
      setData(dash)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    (async () => {
      try {
        const whs = await fulfillmentApi.warehouses()
        setWarehouses(whs)
        const saved = typeof window !== 'undefined' ? localStorage.getItem(WID_KEY) : null
        const chosen = saved && whs.some((w) => w.id === saved) ? saved : (whs[0]?.id ?? null)
        setWid(chosen)
        await load(chosen)
      } catch (e) {
        setErr((e as Error).message)
        setLoading(false)
      }
    })()
  }, [load])

  function pickWarehouse(id: string) {
    setWid(id)
    localStorage.setItem(WID_KEY, id)
    load(id)
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Separação</h1>
          <p className="text-sm" style={{ color: '#71717a' }}>Centro de distribuição</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowCompanies(true)} className="rounded-xl p-3" style={{ background: '#18181b' }} aria-label="Empresas e contas">
            <Building2 size={18} color="#a1a1aa" />
          </button>
          <button onClick={() => setShowPackaging(true)} className="rounded-xl p-3" style={{ background: '#18181b' }} aria-label="Embalagens">
            <Box size={18} color="#a1a1aa" />
          </button>
          <button onClick={() => setShowLocations(true)} className="rounded-xl p-3" style={{ background: '#18181b' }} aria-label="Endereçamento">
            <MapPin size={18} color="#a1a1aa" />
          </button>
          <button onClick={() => setShowTeam(true)} className="rounded-xl p-3" style={{ background: '#18181b' }} aria-label="Equipe">
            <Users size={18} color="#a1a1aa" />
          </button>
          <button onClick={() => setShowSettings(true)} className="rounded-xl p-3" style={{ background: '#18181b' }} aria-label="Configurações">
            <Settings size={18} color="#a1a1aa" />
          </button>
          <Link href="/fulfillment/painel" className="rounded-xl p-3" style={{ background: '#18181b' }} aria-label="Painel ao vivo">
            <Tv size={18} color="#a78bfa" />
          </Link>
          <button onClick={() => load(wid)} className="rounded-xl p-3" style={{ background: '#18181b' }} aria-label="Atualizar">
            <RefreshCw size={18} color="#00E5FF" />
          </button>
        </div>
      </header>

      {showSettings && <SettingsSheet warehouses={warehouses} onClose={() => { setShowSettings(false); load(wid) }} />}
      {showTeam && <TeamSheet warehouseId={wid} onClose={() => setShowTeam(false)} />}
      {showCompanies && <CompaniesSheet onClose={() => setShowCompanies(false)} />}
      {showPackaging && <PackagingSheet onClose={() => setShowPackaging(false)} />}
      {showLocations && <LocationsSheet warehouses={warehouses} warehouseId={wid} onClose={() => setShowLocations(false)} />}

      {warehouses.length > 1 && (
        <select
          value={wid ?? ''}
          onChange={(e) => pickWarehouse(e.target.value)}
          className="w-full rounded-xl px-4 py-3 text-base font-medium outline-none"
          style={{ background: '#0c0c10', color: '#fafafa', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
        </select>
      )}

      {err && (
        <div className="rounded-xl p-3 text-sm" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
          {err}
        </div>
      )}

      {warehouses.length === 0 && !loading && !err && (
        <div className="rounded-xl p-5 text-center text-sm" style={{ background: '#0c0c10', border: '1px solid rgba(255,255,255,0.08)', color: '#a1a1aa' }}>
          <WarehouseIcon size={28} className="mx-auto mb-2" color="#52525b" />
          Nenhum CD cadastrado. Peça ao supervisor para criar um centro de distribuição.
        </div>
      )}

      {/* Atrasados — destaque quando houver */}
      {!loading && (data?.lateCount ?? 0) > 0 && (
        <div className="flex items-center gap-3 rounded-2xl p-4" style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid #EF444455' }}>
          <Clock size={22} color="#f87171" />
          <div className="flex-1">
            <div className="text-lg font-bold" style={{ color: '#f87171' }}>{data?.lateCount} pedido(s) atrasado(s)</div>
            <div className="text-xs" style={{ color: '#a1a1aa' }}>SLA de despacho vencido — priorize na fila</div>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Fila de separação" value={data?.pickQueue} icon={<PackageSearch size={18} color="#00E5FF" />} loading={loading} />
        <Stat label="Fila de conferência" value={data?.packQueue} icon={<PackageCheck size={18} color="#4ADE50" />} loading={loading} />
        <Stat label="Vencendo (2h)" value={data?.dueSoonCount} icon={<Clock size={18} color="#fcd34d" />} loading={loading} danger={(data?.lateCount ?? 0) > 0} />
        <Stat label="Erros bipados (24h)" value={data?.mismatch24h} icon={<ScanLine size={18} color="#f87171" />} loading={loading} danger={(data?.mismatch24h ?? 0) > 0} />
        <Stat label="Avarias hoje" value={data?.damagesToday} icon={<AlertTriangle size={18} color="#fcd34d" />} loading={loading} />
      </div>

      {/* Ações principais */}
      <div className="flex flex-col gap-3">
        <Link
          href="/fulfillment/picking"
          className="flex items-center gap-4 rounded-2xl p-5 active:scale-[0.99] transition-transform"
          style={{ background: 'linear-gradient(135deg,#062a31,#0c0c10)', border: '1px solid #00E5FF55' }}
        >
          <div className="grid h-14 w-14 place-items-center rounded-xl" style={{ background: '#00E5FF1a' }}>
            <PackageSearch size={28} color="#00E5FF" />
          </div>
          <div className="flex-1">
            <div className="text-lg font-bold">Separar pedidos</div>
            <div className="text-sm" style={{ color: '#a1a1aa' }}>Bipe os itens da fila</div>
          </div>
          {data && data.pickQueue > 0 && <Badge n={data.pickQueue} color="#00E5FF" />}
        </Link>

        <Link
          href="/fulfillment/packing"
          className="flex items-center gap-4 rounded-2xl p-5 active:scale-[0.99] transition-transform"
          style={{ background: 'linear-gradient(135deg,#0c2814,#0c0c10)', border: '1px solid #4ADE5055' }}
        >
          <div className="grid h-14 w-14 place-items-center rounded-xl" style={{ background: '#4ADE501a' }}>
            <PackageCheck size={28} color="#4ADE50" />
          </div>
          <div className="flex-1">
            <div className="text-lg font-bold">Conferir e expedir</div>
            <div className="text-sm" style={{ color: '#a1a1aa' }}>Bipe o pedido, confira e feche</div>
          </div>
          {data && data.packQueue > 0 && <Badge n={data.packQueue} color="#4ADE50" />}
        </Link>

        <Link href="/fulfillment/waves" className="flex items-center gap-3 rounded-2xl p-4 active:scale-[0.99] transition-transform" style={{ background: '#0c0c10', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="grid h-10 w-10 place-items-center rounded-lg" style={{ background: '#a78bfa1a' }}>
            <Layers size={18} color="#a78bfa" />
          </div>
          <div className="flex-1">
            <div className="font-semibold">Separação em ondas</div>
            <div className="text-xs" style={{ color: '#71717a' }}>Agrupe pedidos · coleta consolidada + IA</div>
          </div>
        </Link>

        <Link href="/fulfillment/coleta" className="flex items-center gap-3 rounded-2xl p-4 active:scale-[0.99] transition-transform" style={{ background: '#0c0c10', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="grid h-10 w-10 place-items-center rounded-lg" style={{ background: '#4ADE501a' }}>
            <Truck size={18} color="#4ADE50" />
          </div>
          <div className="flex-1">
            <div className="font-semibold">Aguardando coleta</div>
            <div className="text-xs" style={{ color: '#71717a' }}>Pronto pra transportadora · por empresa/conta</div>
          </div>
        </Link>

        <Link href="/fulfillment/returns" className="flex items-center gap-3 rounded-2xl p-4 active:scale-[0.99] transition-transform" style={{ background: '#0c0c10', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="grid h-10 w-10 place-items-center rounded-lg" style={{ background: '#a78bfa1a' }}>
            <RotateCcw size={18} color="#a78bfa" />
          </div>
          <div className="flex-1">
            <div className="font-semibold">Devoluções</div>
            <div className="text-xs" style={{ color: '#71717a' }}>Registrar retorno + reestoque</div>
          </div>
        </Link>
      </div>

      {/* Ações recentes */}
      {data && data.recentActions.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold" style={{ color: '#71717a' }}>Últimas ações (24h)</h2>
          <ul className="flex flex-col gap-1">
            {data.recentActions.slice(0, 12).map((a) => (
              <li key={a.id} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm" style={{ background: '#0c0c10' }}>
                <span className="flex items-center gap-2">
                  <ActionDot type={a.action_type} />
                  {labelAction(a.action_type)}
                </span>
                <span style={{ color: '#52525b' }}>{timeAgo(a.created_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function Stat({ label, value, icon, loading, danger }: { label: string; value?: number; icon: React.ReactNode; loading?: boolean; danger?: boolean }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: '#0c0c10', border: `1px solid ${danger ? '#EF444455' : 'rgba(255,255,255,0.08)'}` }}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs" style={{ color: '#71717a' }}>{label}</span>
        {icon}
      </div>
      {loading
        ? <div className="h-8 w-12 animate-pulse rounded" style={{ background: '#18181b' }} />
        : <div className="text-3xl font-bold tabular-nums" style={{ color: danger ? '#f87171' : '#fafafa' }}>{value ?? 0}</div>}
    </div>
  )
}

function Badge({ n, color }: { n: number; color: string }) {
  return <span className="rounded-full px-3 py-1 text-sm font-bold tabular-nums" style={{ background: `${color}22`, color }}>{n}</span>
}

function ActionDot({ type }: { type: string }) {
  const color = type === 'scan_mismatch' ? '#f87171'
    : type.startsWith('block') ? '#fcd34d'
    : type === 'damage_reported' ? '#fcd34d'
    : type.includes('complete') || type === 'label_printed' ? '#4ADE50'
    : '#00E5FF'
  return <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
}

function labelAction(t: string): string {
  const map: Record<string, string> = {
    scan_order: 'Pedido bipado', scan_item: 'Item bipado', scan_mismatch: 'Código errado',
    photo_taken: 'Foto tirada', pick_complete: 'Item separado', pack_complete: 'Pedido conferido',
    damage_reported: 'Avaria registrada', label_printed: 'Etiqueta impressa',
    block_pick: 'Separação bloqueada', block_pack: 'Conferência bloqueada', unblock: 'Desbloqueado',
  }
  return map[t] ?? t
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'agora'
  if (m < 60) return `${m}min`
  const h = Math.floor(m / 60)
  return `${h}h`
}
