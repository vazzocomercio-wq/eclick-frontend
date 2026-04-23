'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

// ── icon helper ───────────────────────────────────────────────────────────────

function Ico({ d, d2 }: { d: string; d2?: string }) {
  return (
    <svg className="w-[15px] h-[15px] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
      {d2 && <path strokeLinecap="round" strokeLinejoin="round" d={d2} />}
    </svg>
  )
}

// ── nav types ─────────────────────────────────────────────────────────────────

type Leaf  = { type: 'leaf';  label: string; href: string; icon: React.ReactNode; badge?: number }
type Group = { type: 'group'; key: string;   label: string; icon: React.ReactNode; children: Array<{ label: string; href: string }> }
type Sep   = { type: 'sep';   label?: string }
type Entry = Leaf | Group | Sep

// ── nav config ────────────────────────────────────────────────────────────────

const MAIN: Entry[] = [
  { type: 'leaf',  label: 'Dashboard',      href: '/dashboard',              icon: <Ico d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /> },
  { type: 'leaf',  label: 'Vendas ao Vivo', href: '/dashboard/vendas-ao-vivo', icon: <Ico d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /> },
  { type: 'sep',   label: 'COMERCIAL' },
  { type: 'group', key: 'comercial',  label: 'Comercial',   icon: <Ico d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />, children: [
    { label: 'Vendas',  href: '/dashboard/vendas' },
    { label: 'Metas',   href: '/dashboard/metas' },
    { label: 'Canais',  href: '/dashboard/canais' },
  ]},
  { type: 'sep',   label: 'CATÁLOGO' },
  { type: 'group', key: 'catalogo',   label: 'Catálogo',    icon: <Ico d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />, children: [
    { label: 'Anúncios',     href: '/dashboard/produtos' },
    { label: 'Concorrentes', href: '/dashboard/concorrentes' },
    { label: 'Preços',       href: '/dashboard/precos' },
  ]},
  { type: 'leaf',  label: 'Pedidos',        href: '/dashboard/pedidos',       icon: <Ico d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /> },
  { type: 'sep',   label: 'RELACIONAMENTO' },
  { type: 'group', key: 'atendimento', label: 'Atendimento', icon: <Ico d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />, children: [
    { label: 'Perguntas',   href: '/dashboard/atendimento/perguntas' },
    { label: 'Reclamações', href: '/dashboard/atendimento/reclamacoes' },
    { label: 'Mensagens',   href: '/dashboard/atendimento/mensagens' },
  ]},
  { type: 'leaf',  label: 'Logística',  href: '/dashboard/logistica',  icon: <Ico d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" d2="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /> },
  { type: 'leaf',  label: 'Financeiro', href: '/dashboard/financeiro',  icon: <Ico d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> },
  { type: 'sep',   label: 'CRESCIMENTO' },
  { type: 'group', key: 'marketing',  label: 'Marketing',   icon: <Ico d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />, children: [
    { label: 'Ads', href: '/dashboard/ads' },
  ]},
  { type: 'leaf',  label: 'Reputação',  href: '/dashboard/reputacao',   icon: <Ico d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /> },
  { type: 'leaf',  label: 'Relatórios', href: '/dashboard/relatorios',   icon: <Ico d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /> },
]

const BOTTOM: Leaf[] = [
  { type: 'leaf', label: 'Integrações',   href: '/dashboard/integracoes',    icon: <Ico d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /> },
  { type: 'leaf', label: 'Configurações', href: '/dashboard/configuracoes',  icon: <Ico d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" d2="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /> },
]

// ── leaf link ─────────────────────────────────────────────────────────────────

function LeafLink({ item }: { item: Leaf }) {
  const pathname = usePathname()
  const isActive = item.href === '/dashboard'
    ? pathname === '/dashboard'
    : pathname.startsWith(item.href)

  return (
    <Link
      href={item.href}
      className="flex items-center gap-2.5 px-3 py-[7px] rounded-md text-[13px] font-medium transition-colors relative"
      style={{ color: isActive ? '#fff' : '#71717a', background: isActive ? 'rgba(0,229,255,0.09)' : 'transparent' }}
      onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.color = '#a1a1aa' } }}
      onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#71717a' } }}
    >
      {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full" style={{ background: '#00E5FF' }} />}
      <span style={{ color: isActive ? '#00E5FF' : 'inherit' }}>{item.icon}</span>
      <span className="flex-1">{item.label}</span>
      {item.badge != null && (
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-[18px] text-center"
          style={{ background: '#f59e0b22', color: '#f59e0b' }}>
          {item.badge}
        </span>
      )}
    </Link>
  )
}

// ── group toggle ──────────────────────────────────────────────────────────────

function GroupNav({ item, defaultOpen }: { item: Group; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const pathname = usePathname()

  const anyActive = item.children.some(c => pathname.startsWith(c.href))

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2.5 px-3 py-[7px] rounded-md text-[13px] font-medium transition-colors"
        style={{ color: anyActive ? '#fff' : '#71717a', background: anyActive && !open ? 'rgba(0,229,255,0.05)' : 'transparent' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.color = '#a1a1aa' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = anyActive && !open ? 'rgba(0,229,255,0.05)' : 'transparent'; (e.currentTarget as HTMLElement).style.color = anyActive ? '#fff' : '#71717a' }}
      >
        <span style={{ color: anyActive ? '#00E5FF' : 'inherit' }}>{item.icon}</span>
        <span className="flex-1 text-left">{item.label}</span>
        <svg
          className="w-3 h-3 transition-transform duration-200 shrink-0"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', color: '#52525b' }}
          fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="ml-3.5 pl-3 mt-0.5 space-y-0.5" style={{ borderLeft: '1px solid #1e1e24' }}>
          {item.children.map(child => {
            const active = pathname.startsWith(child.href)
            return (
              <Link
                key={child.href}
                href={child.href}
                className="flex items-center px-2 py-1.5 rounded-md text-[12px] font-medium transition-colors"
                style={{ color: active ? '#00E5FF' : '#71717a', background: active ? 'rgba(0,229,255,0.08)' : 'transparent' }}
                onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.color = '#a1a1aa' } }}
                onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#71717a' } }}
              >
                {child.label}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── sidebar ───────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const pathname = usePathname()

  function isGroupDefaultOpen(g: Group) {
    return g.children.some(c => pathname.startsWith(c.href))
  }

  return (
    <aside
      className="hidden md:flex flex-col h-screen shrink-0 overflow-hidden"
      style={{ width: 236, background: '#0c0c0f', borderRight: '1px solid rgba(0,229,255,0.07)' }}
    >
      {/* Logo */}
      <div className="flex items-center px-4 py-4 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <img src="/logo.png" alt="e-Click" style={{ width: 130, mixBlendMode: 'screen' as const }} />
      </div>

      {/* Main nav */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto no-scrollbar">
        {MAIN.map((entry, i) => {
          if (entry.type === 'sep') return (
            <div key={i} className="px-3 pt-4 pb-1.5">
              {entry.label && (
                <p className="text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: '#3f3f46' }}>
                  {entry.label}
                </p>
              )}
              {!entry.label && <div style={{ borderTop: '1px solid #1e1e24' }} />}
            </div>
          )
          if (entry.type === 'leaf') return <LeafLink key={entry.href} item={entry} />
          return <GroupNav key={entry.key} item={entry} defaultOpen={isGroupDefaultOpen(entry)} />
        })}
      </nav>

      {/* Bottom nav */}
      <div className="px-2 py-3 shrink-0 space-y-0.5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        {BOTTOM.map(item => <LeafLink key={item.href} item={item} />)}
      </div>
    </aside>
  )
}
