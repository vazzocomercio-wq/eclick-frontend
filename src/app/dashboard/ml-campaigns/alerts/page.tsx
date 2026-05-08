'use client'

/**
 * Log de alertas + dispara varredura manual.
 * Útil pra confirmar config (telefones, threshold) sem esperar 9h do cron.
 */

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Bell, Loader2, Play, CheckCircle2, AlertOctagon, Clock,
  ChevronRight, Send, Sparkles, ShieldAlert,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import AccountSelector, { useMlAccount, getStoredSellerId } from '@/components/ml/AccountSelector'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

interface AlertLog {
  id:                string
  campaign_id:       string | null
  alert_type:        string
  severity:          string
  recipient_user_id: string | null
  recipient_phone:   string | null
  message:           string
  deeplink:          string | null
  status:            string
  skip_reason:       string | null
  dedup_key:         string
  created_at:        string
}

async function getToken(): Promise<string | null> {
  const sb = createClient()
  const { data } = await sb.auth.getSession()
  return data.session?.access_token ?? null
}

const TYPE_CFG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  deadline_warning:         { label: 'Deadline',     color: '#fbbf24', icon: <Clock size={11} /> },
  subsidy_opportunity:      { label: 'Oportunidade', color: '#67e8f9', icon: <Sparkles size={11} /> },
  manager_pending_queue:    { label: 'Fila gestor',  color: '#c4b5fd', icon: <ShieldAlert size={11} /> },
  audit_threshold_exceeded: { label: 'Audit alerta', color: '#f87171', icon: <AlertOctagon size={11} /> },
}

const SEV_COLOR: Record<string, string> = {
  low: '#a1a1aa', medium: '#fbbf24', high: '#fb923c', critical: '#ef4444',
}

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  sent:               { label: 'Enviado',      color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  skipped_dedup:      { label: 'Dedup',        color: '#71717a', bg: 'rgba(113,113,122,0.12)' },
  skipped_no_action:  { label: 'Sem ação',     color: '#71717a', bg: 'rgba(113,113,122,0.12)' },
  failed:             { label: 'Falhou',       color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
}

export default function AlertsPage() {
  const { selected: selectedSellerId } = useMlAccount()
  const [alerts, setAlerts]   = useState<AlertLog[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [toast, setToast]     = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const t = await getToken()
      const sid = getStoredSellerId()
      const sidQ = sid != null ? `?seller_id=${sid}&limit=100` : '?limit=100'
      const r = await fetch(`${BACKEND}/ml-campaigns/alerts/log${sidQ}`, { headers: { Authorization: `Bearer ${t}` } })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      setAlerts(await r.json())
    } catch (e) {
      showToast(`❌ ${(e as Error).message}`, 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load, selectedSellerId])

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  async function runNow() {
    setRunning(true)
    try {
      const t = await getToken()
      const sid = getStoredSellerId()
      const sidQ = sid != null ? `?seller_id=${sid}` : ''
      const r = await fetch(`${BACKEND}/ml-campaigns/alerts/run${sidQ}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}` },
      })
      if (!r.ok) {
        const errBody = await r.json().catch(() => ({} as { message?: string }))
        throw new Error(errBody.message ?? `HTTP ${r.status}`)
      }
      const data = await r.json() as { sent: number; skipped: number }
      showToast(`✅ ${data.sent} alerta${data.sent === 1 ? '' : 's'} enviado${data.sent === 1 ? '' : 's'} · ${data.skipped} pulado${data.skipped === 1 ? '' : 's'}`, 'success')
      void load()
    } catch (e) {
      showToast(`❌ ${(e as Error).message}`, 'error')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="p-6 space-y-4 max-w-6xl mx-auto" style={{ background: 'var(--background)', minHeight: '100vh', color: 'var(--text)' }}>
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Link href="/dashboard/ml-campaigns" className="hover:text-cyan-400">Campaign Center</Link>
            <span>/</span>
            <span className="text-zinc-300">Alertas WhatsApp</span>
          </div>
          <h1 className="text-2xl font-bold mt-1 flex items-center gap-2">
            <Bell size={22} className="text-amber-400" />
            Alertas WhatsApp
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Cron 9h SP varre campanhas próximas do deadline + oportunidades de subsídio + fila do gestor.
            Configure responsáveis em <Link href="/dashboard/ml-campaigns/config" className="text-cyan-400 hover:underline">Configuração</Link>.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <AccountSelector compact hideWhenEmpty />
          <button onClick={runNow} disabled={running}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-50"
            style={{ background: '#22c55e', color: '#000' }}>
            {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            {running ? 'Rodando…' : 'Rodar agora'}
          </button>
        </div>
      </div>

      {loading && (
        <div className="text-zinc-500 text-sm flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" /> Carregando…
        </div>
      )}

      {!loading && alerts.length === 0 && (
        <div className="rounded-xl p-8 text-center" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
          <Bell size={28} className="text-zinc-600 mx-auto mb-2" />
          <p className="text-sm text-zinc-300 font-semibold">Nenhum alerta ainda</p>
          <p className="text-xs text-zinc-500 mt-1">
            Clica em "Rodar agora" pra disparar a varredura. Sem campanhas próximas do deadline + sem oportunidades não vai aparecer nada.
          </p>
        </div>
      )}

      {alerts.map(a => {
        const cfg = TYPE_CFG[a.alert_type] ?? { label: a.alert_type, color: '#a1a1aa', icon: <Bell size={11} /> }
        const sevColor = SEV_COLOR[a.severity] ?? '#a1a1aa'
        const stCfg = STATUS_BADGE[a.status] ?? { label: a.status, color: '#a1a1aa', bg: 'rgba(0,0,0,0.1)' }
        return (
          <div key={a.id} className="rounded-lg p-3 space-y-2" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider"
                  style={{ background: `${cfg.color}15`, color: cfg.color, border: `1px solid ${cfg.color}40` }}>
                  {cfg.icon} {cfg.label}
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider"
                  style={{ background: `${sevColor}15`, color: sevColor, border: `1px solid ${sevColor}40` }}>
                  {a.severity}
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold"
                  style={{ background: stCfg.bg, color: stCfg.color }}>
                  {stCfg.label}
                </span>
                {a.recipient_phone && (
                  <span className="text-[10px] text-zinc-500 inline-flex items-center gap-1">
                    <Send size={9} /> {a.recipient_phone}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-zinc-600">{new Date(a.created_at).toLocaleString('pt-BR')}</span>
            </div>
            <p className="text-xs text-zinc-300 whitespace-pre-line">{a.message}</p>
            {a.skip_reason && (
              <p className="text-[10px] text-zinc-500 italic">skip: {a.skip_reason}</p>
            )}
            {a.deeplink && a.campaign_id && a.status === 'sent' && (
              <Link href={a.deeplink}
                className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:underline">
                Abrir <ChevronRight size={11} />
              </Link>
            )}
          </div>
        )
      })}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-xl"
          style={{
            background: toast.type === 'success' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
            color:      toast.type === 'success' ? '#4ade80' : '#f87171',
            border:     `1px solid ${toast.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
            backdropFilter: 'blur(8px)',
          }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
