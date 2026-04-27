'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import {
  QrCode, RefreshCw, ScanLine, UserCheck, Percent,
  TrendingUp, Settings, Send, BarChart3,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

type Funnel = {
  links: number; scans: number; conversions: number;
  converted_links: number; scan_rate: number; conversion_rate: number
}
type ChannelRow = { channel: string; links: number; conversions: number }
type Conversion = {
  id: string; channel: string; full_name: string | null
  phone: string | null; email: string | null; cpf: string | null
  consent_marketing: boolean; consent_whatsapp: boolean; consent_enrichment: boolean
  enriched: boolean
  created_at: string
  link?: { channel?: string; order_id?: string; product_name?: string; marketplace?: string } | null
}

const CHANNEL_LABEL: Record<string, { label: string; color: string }> = {
  rastreio: { label: 'Rastreio', color: '#00E5FF' },
  garantia: { label: 'Garantia', color: '#facc15' },
  posvenda: { label: 'Pós-venda', color: '#a78bfa' },
}

function fmtPct(n: number) { return `${((n ?? 0) * 100).toFixed(1)}%` }
function fmtNum(n: number) { return (n ?? 0).toLocaleString('pt-BR') }
function ago(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

function KpiCard({ label, value, icon, color = '#a1a1aa' }: { label: string; value: string; icon: React.ReactNode; color?: string }) {
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-2 min-h-[110px] justify-between"
      style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <div className="flex items-center gap-2">
        <span style={{ color }}>{icon}</span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">{label}</span>
      </div>
      <p className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</p>
    </div>
  )
}

export default function LeadBridgePage() {
  const supabase = useMemo(() => createClient(), [])
  const [funnel, setFunnel] = useState<Funnel | null>(null)
  const [byChannel, setByChannel] = useState<ChannelRow[]>([])
  const [recent, setRecent] = useState<Conversion[]>([])
  const [loading, setLoading] = useState(true)

  const getHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return { Authorization: `Bearer ${session?.access_token ?? ''}` }
  }, [supabase])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const headers = await getHeaders()
      const [fRes, cRes, rRes] = await Promise.all([
        fetch(`${BACKEND}/lead-bridge/analytics/funnel`,     { headers }),
        fetch(`${BACKEND}/lead-bridge/analytics/by-channel`, { headers }),
        fetch(`${BACKEND}/lead-bridge/conversions`,          { headers }),
      ])
      if (fRes.ok) setFunnel(await fRes.json())
      if (cRes.ok) {
        const v = await cRes.json()
        setByChannel(Array.isArray(v) ? v : [])
      }
      if (rRes.ok) {
        const v = await rRes.json()
        setRecent(Array.isArray(v) ? v.slice(0, 20) : [])
      }
    } finally { setLoading(false) }
  }, [getHeaders])

  useEffect(() => { load() }, [load])

  return (
    <div className="p-6 space-y-6 min-h-full" style={{ background: '#09090b' }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(0,229,255,0.12)' }}>
            <QrCode size={18} style={{ color: '#00E5FF' }} />
          </div>
          <div>
            <p className="text-zinc-500 text-xs font-medium uppercase tracking-widest">CRM</p>
            <h1 className="text-white text-xl font-semibold">Lead Bridge</h1>
            <p className="text-zinc-500 text-xs mt-0.5">Capture telefone e WhatsApp dos compradores via QR/landing</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold transition-all disabled:opacity-60"
            style={{ background: '#111114', color: '#a1a1aa', border: '1px solid #27272a' }}>
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Sub-nav */}
      <div className="flex items-center gap-2 flex-wrap text-[12px]">
        {[
          { href: '/dashboard/lead-bridge',                label: 'Visão geral',  icon: <BarChart3 size={12} /> },
          { href: '/dashboard/lead-bridge/links',          label: 'Links',         icon: <QrCode size={12} /> },
          { href: '/dashboard/lead-bridge/jornadas',       label: 'Jornadas',      icon: <Send size={12} /> },
          { href: '/dashboard/lead-bridge/configuracoes',  label: 'Configurações', icon: <Settings size={12} /> },
        ].map(t => (
          <Link key={t.href} href={t.href}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors"
            style={{ background: '#111114', color: '#a1a1aa', border: '1px solid #1e1e24' }}>
            {t.icon}{t.label}
          </Link>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Links gerados" value={loading ? '…' : fmtNum(funnel?.links ?? 0)}    icon={<QrCode size={13} />}    color="#00E5FF" />
        <KpiCard label="Scans"         value={loading ? '…' : fmtNum(funnel?.scans ?? 0)}    icon={<ScanLine size={13} />}  color="#60a5fa" />
        <KpiCard label="Conversões"    value={loading ? '…' : fmtNum(funnel?.conversions ?? 0)} icon={<UserCheck size={13} />} color="#4ade80" />
        <KpiCard label="Taxa de conversão" value={loading ? '…' : fmtPct(funnel?.conversion_rate ?? 0)} icon={<Percent size={13} />} color="#a78bfa" />
      </div>

      {/* Por canal */}
      <div className="rounded-2xl p-5 space-y-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <div className="flex items-center gap-2">
          <TrendingUp size={13} className="text-emerald-400" />
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Captura por canal</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {byChannel.length === 0 ? (
            <p className="text-zinc-600 text-xs italic">Sem dados ainda — gere alguns links para começar.</p>
          ) : byChannel.map(row => {
            const meta = CHANNEL_LABEL[row.channel] ?? { label: row.channel, color: '#a1a1aa' }
            const rate = row.links > 0 ? row.conversions / row.links : 0
            return (
              <div key={row.channel} className="rounded-xl p-3 flex flex-col gap-2"
                style={{ background: '#18181b', border: '1px solid #27272a' }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold" style={{ color: meta.color }}>{meta.label}</span>
                  <span className="text-[10px] text-zinc-500">{fmtPct(rate)}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold text-white tabular-nums">{fmtNum(row.conversions)}</span>
                  <span className="text-[11px] text-zinc-600">/ {fmtNum(row.links)} links</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Últimas capturas */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid #1a1a1f' }}>
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Últimas capturas</h3>
          <span className="text-[11px] text-zinc-600">{recent.length} recentes</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wide text-zinc-600"
                style={{ borderBottom: '1px solid #1a1a1f' }}>
                <th className="px-3 py-2 font-semibold">Nome</th>
                <th className="px-3 py-2 font-semibold">Canal</th>
                <th className="px-3 py-2 font-semibold">Telefone</th>
                <th className="px-3 py-2 font-semibold">CPF</th>
                <th className="px-3 py-2 font-semibold">Consents</th>
                <th className="px-3 py-2 font-semibold text-right">Quando</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-xs text-zinc-600">Carregando…</td></tr>
              ) : recent.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-xs text-zinc-600 italic">Nenhuma captura ainda.</td></tr>
              ) : recent.map(c => {
                const meta = CHANNEL_LABEL[c.channel] ?? { label: c.channel, color: '#a1a1aa' }
                return (
                  <tr key={c.id} className="hover:bg-[#161618] transition-colors">
                    <td className="px-3 py-2.5">
                      <p className="text-xs text-zinc-200 font-medium truncate max-w-[180px]">{c.full_name ?? '—'}</p>
                      {c.email && <p className="text-[10px] text-zinc-600 truncate max-w-[180px]">{c.email}</p>}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded"
                        style={{ color: meta.color, background: meta.color + '15' }}>{meta.label}</span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-zinc-300 font-mono">{c.phone ?? '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-zinc-400 font-mono">
                      {c.cpf ?? '—'}
                      {c.enriched && <span className="ml-1 text-[9px] text-emerald-400">✓ enriq</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1">
                        {c.consent_marketing  && <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">MKT</span>}
                        {c.consent_whatsapp   && <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">WA</span>}
                        {c.consent_enrichment && <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400">CPF</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right text-[11px] text-zinc-500">{ago(c.created_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
