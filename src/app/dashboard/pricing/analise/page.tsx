'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { api } from './_components/api'
import {
  PricingSignal, Severity, SignalType, SignalsSummary,
  SEVERITY_META, SIGNAL_TYPE_META, fmtRelativeTime,
} from './_components/types'
import { SignalCard }    from './_components/SignalCard'
import { SignalDrawer }  from './_components/SignalDrawer'
import { SettingsModal } from './_components/SettingsModal'

interface NotifSettings { whatsapp_enabled: boolean }

type SeverityFilter = Severity | 'all'
type TypeFilter     = SignalType | 'all'
type StatusFilter   = 'active' | 'actioned' | 'expired'

type Toast = { id: number; msg: string; type: 'success' | 'error' }

const TYPE_FILTERS: Array<{ value: TypeFilter; label: string }> = [
  { value: 'all',            label: 'Todos' },
  { value: 'decrease_price', label: '↓ Baixar' },
  { value: 'increase_price', label: '↑ Subir' },
  { value: 'do_not_touch',   label: '⏸ Não mexer' },
  { value: 'review_needed',  label: '🔍 Revisar' },
  { value: 'low_confidence', label: '❓ Baixa confiança' },
]

export default function PricingAnalisePage() {
  const [signals, setSignals]       = useState<PricingSignal[]>([])
  const [summary, setSummary]       = useState<SignalsSummary | null>(null)
  const [notif, setNotif]           = useState<NotifSettings | null>(null)
  const [loading, setLoading]       = useState(true)
  const [scanning, setScanning]     = useState(false)
  const [toasts, setToasts]         = useState<Toast[]>([])
  const [drawer, setDrawer]         = useState<PricingSignal | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [filterSeverity, setSev]    = useState<SeverityFilter>('all')
  const [filterType, setType]       = useState<TypeFilter>('all')
  const [filterChannel, setChannel] = useState<string>('all')
  const [filterStatus, setStatus]   = useState<StatusFilter>('active')

  function pushToast(msg: string, type: Toast['type'] = 'success') {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, msg, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ status: filterStatus, limit: '200' })
      if (filterSeverity !== 'all') params.set('severity', filterSeverity)
      if (filterType     !== 'all') params.set('signal_type', filterType)
      if (filterChannel  !== 'all') params.set('channel', filterChannel)

      const [list, sum, notifSet] = await Promise.all([
        api<{ signals: PricingSignal[]; total: number }>(`/pricing/signals?${params.toString()}`),
        api<SignalsSummary>('/pricing/signals/summary'),
        api<NotifSettings>('/pricing/notifications/settings').catch(() => ({ whatsapp_enabled: false })),
      ])
      setSignals(list.signals); setSummary(sum); setNotif(notifSet)
    } catch (e) { pushToast((e as Error).message, 'error') }
    setLoading(false)
  }, [filterSeverity, filterType, filterChannel, filterStatus])

  useEffect(() => { load() }, [load])

  async function handleScan() {
    setScanning(true)
    try {
      const r = await api<{ products: number; newSignals: number }>('/pricing/signals/scan', { method: 'POST' })
      pushToast(`Varredura: ${r.products} produtos, ${r.newSignals} sinais novos`, 'success')
      await load()
    } catch (e) { pushToast((e as Error).message, 'error') }
    setScanning(false)
  }

  async function quickAction(signal: PricingSignal, action: 'approve' | 'dismiss') {
    try {
      await api(`/pricing/signals/${signal.id}/action`, {
        method: 'POST',
        body:   JSON.stringify({ action }),
      })
      pushToast(action === 'approve' ? 'Sinal aprovado' : 'Sinal dispensado', 'success')
      setSignals(prev => prev.filter(s => s.id !== signal.id))
      // Atualiza summary localmente sem refetch
      if (summary) {
        const sum = { ...summary, total: Math.max(0, summary.total - 1) }
        sum.by_severity = { ...sum.by_severity, [signal.severity]: Math.max(0, (sum.by_severity[signal.severity] ?? 0) - 1) }
        sum.by_type     = { ...sum.by_type,     [signal.signal_type]: Math.max(0, (sum.by_type[signal.signal_type] ?? 0) - 1) }
        setSummary(sum)
      }
    } catch (e) { pushToast((e as Error).message, 'error') }
  }

  const lastScanAt = useMemo(() => {
    if (signals.length === 0) return null
    return signals.reduce<string | null>((latest, s) => {
      if (!latest) return s.created_at
      return s.created_at > latest ? s.created_at : latest
    }, null)
  }, [signals])

  const totalActive = summary?.total ?? 0
  const waEnabled   = !!notif?.whatsapp_enabled

  return (
    <div className="flex flex-col h-full" style={{ background: '#09090b' }}>
      {/* Header */}
      <div className="shrink-0 px-6 pt-6 pb-4" style={{ borderBottom: '1px solid #1e1e24' }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-white text-lg font-semibold">Radar de Preços</h1>
            <p className="text-zinc-400 text-sm mt-0.5">
              {totalActive > 0
                ? <><span className="text-cyan-400 font-semibold">{totalActive}</span> produto{totalActive === 1 ? '' : 's'} precisa{totalActive === 1 ? '' : 'm'} de atenção</>
                : 'Tudo certo — nenhum produto precisa de atenção'}
            </p>
            {lastScanAt && <p className="text-zinc-500 text-xs mt-0.5">Última varredura: {fmtRelativeTime(lastScanAt)}</p>}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
              style={waEnabled
                ? { background: 'rgba(52,211,153,0.1)', color: '#34d399' }
                : { background: 'rgba(161,161,170,0.1)', color: '#a1a1aa' }}>
              🔔 WhatsApp: <span className="font-semibold">{waEnabled ? '● ATIVO' : '○ Inativo'}</span>
            </span>
            <a href="/dashboard/precos"
              className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:border-cyan-500 hover:text-cyan-400"
              style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}
              title="Tabela manual de preços × concorrentes">
              Tabela de preços →
            </a>
            <button
              onClick={() => setShowSettings(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border"
              style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}
            >Configurar</button>
            <button
              onClick={handleScan}
              disabled={scanning}
              className="relative px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
              style={{ background: '#00E5FF', color: '#08323b', boxShadow: scanning ? '0 0 18px rgba(0,229,255,0.6)' : 'none' }}
            >
              {scanning && <span className="absolute inset-0 rounded-lg animate-pulse" style={{ background: 'rgba(0,229,255,0.3)' }} />}
              <span className="relative">{scanning ? 'Varrendo…' : 'Varrer agora'}</span>
            </button>
          </div>
        </div>

        {/* KPI bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
          {(['critical', 'high', 'medium', 'low'] as Severity[]).map(sev => {
            const meta  = SEVERITY_META[sev]
            const count = summary?.by_severity?.[sev] ?? 0
            const isActive = filterSeverity === sev
            return (
              <button
                key={sev}
                onClick={() => setSev(isActive ? 'all' : sev)}
                className="rounded-xl p-3 text-left transition"
                style={{
                  background: isActive ? `${meta.color}10` : '#111114',
                  border:     `1px solid ${isActive ? meta.color : '#1e1e24'}`,
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm">{meta.emoji} {meta.label}</span>
                  <span className="text-2xl font-bold" style={{ color: meta.color }}>{count}</span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="shrink-0 px-6 py-3 flex items-center gap-2 flex-wrap" style={{ background: '#0a0a0e', borderBottom: '1px solid #1e1e24' }}>
        <span className="text-zinc-500 text-xs uppercase tracking-wider">Tipo:</span>
        {TYPE_FILTERS.map(f => (
          <button key={f.value}
            onClick={() => setType(f.value)}
            className="px-2.5 py-1 rounded-full text-xs font-medium border transition"
            style={{
              borderColor: filterType === f.value ? '#00E5FF' : '#27272a',
              color:       filterType === f.value ? '#00E5FF' : '#a1a1aa',
              background:  filterType === f.value ? 'rgba(0,229,255,0.05)' : 'transparent',
            }}
          >{f.label}</button>
        ))}

        <span className="text-zinc-500 text-xs uppercase tracking-wider ml-3">Canal:</span>
        {(['all','mercadolivre','shopee','magalu','amazon'] as const).map(c => (
          <button key={c}
            onClick={() => setChannel(c)}
            className="px-2.5 py-1 rounded-full text-xs font-medium border transition"
            style={{
              borderColor: filterChannel === c ? '#00E5FF' : '#27272a',
              color:       filterChannel === c ? '#00E5FF' : '#a1a1aa',
              background:  filterChannel === c ? 'rgba(0,229,255,0.05)' : 'transparent',
            }}
          >{c === 'all' ? 'Todos' : c.charAt(0).toUpperCase() + c.slice(1)}</button>
        ))}

        <span className="text-zinc-500 text-xs uppercase tracking-wider ml-3">Status:</span>
        {(['active','actioned','expired'] as StatusFilter[]).map(s => (
          <button key={s}
            onClick={() => setStatus(s)}
            className="px-2.5 py-1 rounded-full text-xs font-medium border transition"
            style={{
              borderColor: filterStatus === s ? '#00E5FF' : '#27272a',
              color:       filterStatus === s ? '#00E5FF' : '#a1a1aa',
              background:  filterStatus === s ? 'rgba(0,229,255,0.05)' : 'transparent',
            }}
          >{s === 'active' ? 'Ativos' : s === 'actioned' ? 'Resolvidos' : 'Expirados'}</button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6">
          {loading
            ? <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-32 rounded-xl animate-pulse" style={{ background: '#111114' }} />)}</div>
            : signals.length === 0
              ? <EmptyState onScan={handleScan} scanning={scanning} />
              : <div className="space-y-3">
                  {signals.map(s => (
                    <SignalCard
                      key={s.id}
                      signal={s}
                      onAction={(a) => quickAction(s, a)}
                      onOpen={() => setDrawer(s)}
                    />
                  ))}
                </div>}
        </div>
      </div>

      {drawer && (
        <SignalDrawer
          signal={drawer}
          onClose={() => setDrawer(null)}
          onActionTaken={(msg) => { setDrawer(null); pushToast(msg, 'success'); load() }}
          onError={(m) => pushToast(m, 'error')}
        />
      )}

      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onSaved={(msg) => { pushToast(msg, 'success'); load() }}
          onError={(m) => pushToast(m, 'error')}
        />
      )}

      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id}
            className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium shadow-2xl pointer-events-auto"
            style={{
              background: t.type === 'success' ? '#111114' : '#1a0a0a',
              border: `1px solid ${t.type === 'success' ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`,
              color:  t.type === 'success' ? '#34d399' : '#f87171',
            }}>
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  )
}

function EmptyState({ onScan, scanning }: { onScan: () => void; scanning: boolean }) {
  return (
    <div className="rounded-2xl px-6 py-16 text-center" style={{ background: '#111114', border: '1px dashed #27272a' }}>
      <p className="text-4xl mb-3">🎯</p>
      <p className="text-white text-lg font-semibold mb-2">Tudo certo por aqui!</p>
      <p className="text-zinc-500 text-sm mb-5">
        Nenhum produto precisa de atenção no momento. Scanner roda automaticamente a cada 2h.
      </p>
      <button
        onClick={onScan}
        disabled={scanning}
        className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
        style={{ background: '#00E5FF', color: '#08323b' }}
      >
        {scanning ? 'Varrendo…' : 'Varrer agora'}
      </button>
    </div>
  )
}
