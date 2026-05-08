'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Truck, Building2, Link2, ChevronRight, Package, AlertTriangle } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

interface Partner {
  id: string
  dropship_status: string
  cutoff_time: string
  oc_generation_time: string
  active_dropship_skus: number
  orders_30d: number
  pending_payable: number
  partner_score: number | null
  suppliers: { id: string; name: string }
}

export default function DropshipHomePage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      const res = await fetch(`${BACKEND}/dropship/partners`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setPartners(await res.json())
    } catch { setPartners([]) }
    finally { setLoading(false) }
  }, [supabase])

  useEffect(() => { load() }, [load])

  const total = partners.length
  const active = partners.filter(p => p.dropship_status === 'active').length
  const totalSkus = partners.reduce((s, p) => s + (p.active_dropship_skus || 0), 0)
  const totalPayable = partners.reduce((s, p) => s + (p.pending_payable || 0), 0)

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--background)', color: '#fff' }}>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Dropship Center</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Gerencie parceiros, OCs diárias, devoluções e abatimentos do fluxo dropship
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Parceiros Ativos" value={loading ? '…' : `${active}/${total}`} />
        <KpiCard label="SKUs Dropship" value={loading ? '…' : totalSkus} />
        <KpiCard label="A Pagar (pendente)" value={loading ? '…' : fmtBrl(totalPayable)} />
        <KpiCard label="OCs hoje" value="—" sub="Sprint 4" />
      </div>

      {/* Nav cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <NavCard
          href="/dashboard/dropship/partners"
          icon={<Building2 size={20} />}
          title="Parceiros"
          description="Cadastre e configure fornecedores dropship: cutoff, integração, estratégia comercial"
        />
        <NavCard
          href="/dashboard/dropship/account-suppliers"
          icon={<Link2 size={20} />}
          title="Vínculo Contas"
          description="Mapeie qual parceiro despacha pelos pedidos de cada conta de marketplace"
        />
        <NavCard
          href="/dashboard/dropship/partners"
          icon={<Truck size={20} />}
          title="Pedidos & OCs"
          description="Em desenvolvimento (Sprint 3+4): identificação de pedidos dropship + geração diária de OC"
          disabled
        />
      </div>

      {/* Lista resumida de parceiros */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1a1a1f' }}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ background: '#111114', borderBottom: '1px solid #1a1a1f' }}>
          <h2 className="text-sm font-medium text-white">Parceiros recentes</h2>
          <Link
            href="/dashboard/dropship/partners"
            className="text-xs font-medium"
            style={{ color: '#00E5FF' }}
          >
            Ver todos →
          </Link>
        </div>
        {loading ? (
          <div className="px-4 py-12 text-center text-zinc-500 text-sm">Carregando...</div>
        ) : partners.length === 0 ? (
          <div className="px-4 py-12 text-center text-zinc-500 text-sm">
            Nenhum parceiro cadastrado.{' '}
            <Link href="/dashboard/dropship/partners" style={{ color: '#00E5FF' }}>Cadastrar o primeiro</Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#0d0d10' }}>
                {['Parceiro', 'Status', 'Cutoff', 'SKUs', 'Pedidos 30d', 'A Pagar', 'Score', ''].map(h => (
                  <th key={h} className="text-left px-4 py-2 text-xs font-medium text-zinc-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {partners.slice(0, 5).map(p => (
                <tr
                  key={p.id}
                  onClick={() => router.push(`/dashboard/dropship/partners/${p.id}`)}
                  className="cursor-pointer transition-colors"
                  style={{ borderBottom: '1px solid #1a1a1f' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#111114'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <td className="px-4 py-3 font-medium text-white">{p.suppliers?.name ?? '—'}</td>
                  <td className="px-4 py-3"><StatusPill status={p.dropship_status} /></td>
                  <td className="px-4 py-3 text-zinc-300 text-xs">{(p.cutoff_time || '').slice(0, 5)}</td>
                  <td className="px-4 py-3 text-zinc-300">{p.active_dropship_skus ?? 0}</td>
                  <td className="px-4 py-3 text-zinc-300">{p.orders_30d ?? 0}</td>
                  <td className="px-4 py-3 text-zinc-300 text-xs">{fmtBrl(p.pending_payable ?? 0)}</td>
                  <td className="px-4 py-3"><ScorePill score={p.partner_score} /></td>
                  <td className="px-4 py-3 text-right">
                    <ChevronRight size={14} className="inline text-zinc-600" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ── Components ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className="text-2xl font-semibold text-white">{value}</p>
      {sub && <p className="text-xs text-zinc-500 mt-0.5">{sub}</p>}
    </div>
  )
}

function NavCard({
  href, icon, title, description, disabled,
}: {
  href: string; icon: React.ReactNode; title: string; description: string; disabled?: boolean
}) {
  const content = (
    <div
      className="rounded-xl p-5 h-full transition-all"
      style={{
        background: '#111114',
        border: '1px solid #1a1a1f',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(0,229,255,0.10)', color: '#00E5FF' }}
        >
          {icon}
        </div>
        <h3 className="font-semibold text-white text-sm">{title}</h3>
      </div>
      <p className="text-xs text-zinc-500 leading-relaxed">{description}</p>
      {disabled && (
        <span className="inline-block mt-3 px-2 py-0.5 rounded-full text-xs"
          style={{ background: 'rgba(252,211,77,0.10)', color: '#fcd34d', border: '1px solid rgba(252,211,77,0.3)' }}>
          Em breve
        </span>
      )}
    </div>
  )
  if (disabled) return content
  return <Link href={href}>{content}</Link>
}

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, { bg: string; fg: string; label: string }> = {
    active:        { bg: 'rgba(34,197,94,0.10)',   fg: '#22c55e', label: 'Ativo' },
    paused:        { bg: 'rgba(252,211,77,0.10)',  fg: '#fcd34d', label: 'Pausado' },
    inactive:      { bg: 'rgba(113,113,122,0.10)', fg: '#71717a', label: 'Inativo' },
    pending_setup: { bg: 'rgba(0,229,255,0.10)',   fg: '#00E5FF', label: 'Setup pendente' },
  }
  const c = colors[status] ?? colors.inactive
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: c.bg, color: c.fg, border: `1px solid ${c.fg}33` }}>
      {c.label}
    </span>
  )
}

function ScorePill({ score }: { score: number | null }) {
  if (score == null) return <span className="text-zinc-600 text-xs">—</span>
  let bg = 'rgba(34,197,94,0.10)', fg = '#22c55e'
  if (score < 60) { bg = 'rgba(248,113,113,0.10)'; fg = '#f87171' }
  else if (score < 80) { bg = 'rgba(252,211,77,0.10)'; fg = '#fcd34d' }
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: bg, color: fg, border: `1px solid ${fg}33` }}>
      {score}
    </span>
  )
}

function fmtBrl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
