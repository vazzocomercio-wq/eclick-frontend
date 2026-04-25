'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import {
  Home, Radio, BarChart3, Package, ShoppingBag, MessageCircle,
  Truck, DollarSign, Brain, Building2, Ship, Users, Target,
  Heart, MessageSquare, CheckSquare, Sparkles, Image as ImageIcon,
  Megaphone, ShoppingCart, TrendingUp, Settings, UserCog,
  Plug, Database, Wand2, ChevronDown,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

// ── Types ─────────────────────────────────────────────────────────────────────

type BadgeKey = 'atendimento-perguntas' | 'atendimento-reclamacoes' | 'vinculos' | 'compras-criticos'
type Badges = Partial<Record<BadgeKey, number>>

type SubItem = { label: string; href: string }

type NavChild = {
  label: string
  href: string
  soon?: boolean
  badgeKey?: BadgeKey
  subItems?: SubItem[]
}

type NavItem = {
  label: string
  href: string
  icon: React.ReactNode
  soon?: boolean
  exact?: boolean
  badgeKey?: BadgeKey
  children?: NavChild[]
}

type NavSection = {
  key: string
  label: string
  items: NavItem[]
}

// ── Nav config ────────────────────────────────────────────────────────────────

const SECTIONS: NavSection[] = [
  {
    key: 'visaogeral',
    label: 'VISÃO GERAL',
    items: [
      { label: 'Dashboard',      href: '/dashboard',               icon: <Home size={15} />,  exact: true },
      { label: 'Vendas ao Vivo', href: '/dashboard/vendas-ao-vivo', icon: <Radio size={15} /> },
    ],
  },
  {
    key: 'marketplace',
    label: 'MARKETPLACE',
    items: [
      {
        label: 'Comercial', href: '/dashboard/comercial', icon: <BarChart3 size={15} />,
        children: [
          { label: 'Vendas', href: '/dashboard/vendas' },
          { label: 'Metas',  href: '/dashboard/metas' },
          { label: 'Canais', href: '/dashboard/canais' },
        ],
      },
      {
        label: 'Catálogo', href: '/dashboard/catalogo', icon: <Package size={15} />,
        children: [
          { label: 'Produtos', href: '/dashboard/produtos' },
          {
            label: 'Anúncios', href: '/dashboard/catalogo/anuncios',
            subItems: [
              { label: 'Mercado Livre', href: '/dashboard/catalogo/anuncios/mercadolivre' },
              { label: 'Shopee',        href: '/dashboard/catalogo/anuncios/shopee' },
              { label: 'Amazon',        href: '/dashboard/catalogo/anuncios/amazon' },
              { label: 'Magalu',        href: '/dashboard/catalogo/anuncios/magalu' },
            ],
          },
          { label: 'Vínculos',     href: '/dashboard/catalogo/vinculos',  badgeKey: 'vinculos' as BadgeKey },
          { label: 'Estoque',      href: '/dashboard/catalogo/estoque' },
          { label: 'Concorrentes', href: '/dashboard/concorrentes' },
          { label: 'Preços',       href: '/dashboard/precos' },
        ],
      },
      { label: 'Pedidos', href: '/dashboard/pedidos', icon: <ShoppingBag size={15} /> },
      {
        label: 'Atendimento', href: '/dashboard/atendimento', icon: <MessageCircle size={15} />,
        children: [
          { label: 'Perguntas',   href: '/dashboard/atendimento/perguntas',   badgeKey: 'atendimento-perguntas' as BadgeKey },
          { label: 'Reclamações', href: '/dashboard/atendimento/reclamacoes', badgeKey: 'atendimento-reclamacoes' as BadgeKey },
          { label: 'Mensagens',   href: '/dashboard/atendimento/mensagens' },
        ],
      },
      { label: 'Logística',  href: '/dashboard/logistica',  icon: <Truck size={15} /> },
      {
        label: 'Financeiro', href: '/dashboard/financeiro', icon: <DollarSign size={15} />,
        children: [
          { label: 'Resumo Financeiro', href: '/dashboard/financeiro/resumo' },
          { label: 'Fluxo de Caixa',   href: '/dashboard/financeiro/fluxo' },
          { label: 'DRE',              href: '/dashboard/financeiro/dre' },
        ],
      },
    ],
  },
  {
    key: 'compras',
    label: 'COMPRAS',
    items: [
      { label: 'Inteligência', href: '/dashboard/compras/inteligencia', icon: <Brain size={15} />,    badgeKey: 'compras-criticos' as BadgeKey },
      { label: 'Fornecedores', href: '/dashboard/compras/fornecedores', icon: <Building2 size={15} /> },
      { label: 'Importações',  href: '/dashboard/compras/importacoes',  icon: <Ship size={15} /> },
    ],
  },
  {
    key: 'crm',
    label: 'CRM',
    items: [
      { label: 'Clientes',  href: '/dashboard/crm/clientes',  icon: <Users size={15} /> },
      { label: 'Pipeline',  href: '/dashboard/crm/pipeline',  icon: <Target size={15} />,        soon: true },
      { label: 'Pós-venda', href: '/dashboard/crm/pos-venda', icon: <Heart size={15} />,         soon: true },
      { label: 'WhatsApp',  href: '/dashboard/crm/whatsapp',  icon: <MessageSquare size={15} />, soon: true },
    ],
  },
  {
    key: 'producao',
    label: 'PRODUÇÃO',
    items: [
      { label: 'Tarefas',         href: '/dashboard/producao/tarefas',    icon: <CheckSquare size={15} /> },
      { label: 'Conteúdo com IA', href: '/dashboard/producao/conteudo',   icon: <Sparkles size={15} /> },
      { label: 'Biblioteca',      href: '/dashboard/producao/biblioteca',  icon: <ImageIcon size={15} />,   soon: true },
    ],
  },
  {
    key: 'ads',
    label: 'ADS',
    items: [
      { label: 'ML Ads',      href: '/dashboard/ads/mercadolivre', icon: <Megaphone size={15} />,    soon: true },
      { label: 'Shopee Ads',  href: '/dashboard/ads/shopee',       icon: <ShoppingCart size={15} />, soon: true },
      { label: 'Performance', href: '/dashboard/ads/performance',  icon: <TrendingUp size={15} />,   soon: true },
    ],
  },
  {
    key: 'configuracoes',
    label: 'CONFIGURAÇÕES',
    items: [
      { label: 'Geral',       href: '/dashboard/configuracoes',            icon: <Settings size={15} />, exact: true },
      { label: 'Equipe',      href: '/dashboard/configuracoes/equipe',     icon: <UserCog size={15} />,  soon: true },
      { label: 'Integrações', href: '/dashboard/configuracoes/integracoes', icon: <Plug size={15} />,    soon: true },
      { label: 'Agregador',   href: '/dashboard/configuracoes/aggregator', icon: <Database size={15} /> },
      { label: 'IA',          href: '/dashboard/configuracoes/ia',         icon: <Wand2 size={15} />,    soon: true },
    ],
  },
]

const SECTION_DEFAULT_OPEN: Record<string, boolean> = {
  visaogeral:     true,
  marketplace:    true,
  compras:        false,
  crm:            false,
  producao:       false,
  ads:            false,
  configuracoes:  false,
}

// ── Small badge ───────────────────────────────────────────────────────────────

function BadgePill({ count, color = '#f87171' }: { count: number; color?: string }) {
  return (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shrink-0"
      style={{ background: color + '22', color, border: `1px solid ${color}33` }}>
      {count > 99 ? '99+' : count}
    </span>
  )
}

// ── Sub-group (e.g. Anúncios) ─────────────────────────────────────────────────

function NavSubGroup({ child }: { child: NavChild }) {
  const pathname = usePathname()
  const anyActive = (child.subItems ?? []).some(s => pathname.startsWith(s.href))
  const [open, setOpen] = useState(anyActive)

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-[12px] font-medium transition-colors"
        style={{ color: anyActive ? '#00E5FF' : '#a1a1aa' }}
        onMouseEnter={e => { if (!anyActive) (e.currentTarget as HTMLElement).style.color = '#e4e4e7' }}
        onMouseLeave={e => { if (!anyActive) (e.currentTarget as HTMLElement).style.color = '#a1a1aa' }}
      >
        <span>{child.label}</span>
        <ChevronDown size={10} style={{ color: '#71717a', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 150ms' }} />
      </button>
      {open && (
        <div className="ml-2 pl-2 mt-0.5 space-y-0.5" style={{ borderLeft: '1px solid #1e1e24' }}>
          {(child.subItems ?? []).map(s => {
            const active = pathname.startsWith(s.href)
            return (
              <Link key={s.href} href={s.href}
                className="flex items-center px-2 py-1.5 rounded-md text-[11px] font-medium transition-colors"
                style={{ color: active ? '#00E5FF' : '#a1a1aa', background: active ? 'rgba(0,229,255,0.08)' : 'transparent' }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = '#e4e4e7' }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = '#a1a1aa' }}
              >
                {s.label}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Group item (toggle with children) ────────────────────────────────────────

function NavGroupItem({ item, badges }: { item: NavItem; badges: Badges }) {
  const pathname = usePathname()
  const children = item.children ?? []

  const anyActive = children.some(c =>
    c.subItems ? c.subItems.some(s => pathname.startsWith(s.href)) : pathname.startsWith(c.href)
  )

  const [open, setOpen] = useState(anyActive)

  const parentBadgeTotal = children.reduce((sum, c) => {
    if (!c.badgeKey) return sum
    return sum + (badges[c.badgeKey] ?? 0)
  }, 0)

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2.5 px-3 py-[7px] rounded-md text-[13px] font-medium transition-colors"
        style={{ color: anyActive ? '#fff' : '#a1a1aa', background: anyActive && !open ? 'rgba(0,229,255,0.05)' : 'transparent' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.color = '#e4e4e7' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = anyActive && !open ? 'rgba(0,229,255,0.05)' : 'transparent'; (e.currentTarget as HTMLElement).style.color = anyActive ? '#fff' : '#a1a1aa' }}
      >
        <span style={{ color: anyActive ? '#00E5FF' : 'inherit' }}>{item.icon}</span>
        <span className="flex-1 text-left">{item.label}</span>
        {parentBadgeTotal > 0 && <BadgePill count={parentBadgeTotal} />}
        <ChevronDown size={12} style={{ color: '#71717a', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 150ms', flexShrink: 0 }} />
      </button>

      {open && (
        <div className="ml-3.5 pl-3 mt-0.5 space-y-0.5" style={{ borderLeft: '1px solid #1e1e24' }}>
          {children.map((child, idx) => {
            if (child.subItems) return <NavSubGroup key={idx} child={child} />
            if (child.soon) return (
              <div key={child.href}
                className="flex items-center gap-1 px-2 py-1.5 rounded-md text-[12px] font-medium"
                style={{ opacity: 0.45, cursor: 'not-allowed' }}
                title="Em breve"
              >
                <span className="flex-1" style={{ color: '#71717a' }}>{child.label}</span>
                <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: '#27272a', color: '#52525b' }}>soon</span>
              </div>
            )
            const active = pathname.startsWith(child.href)
            const badge = child.badgeKey ? badges[child.badgeKey] : undefined
            return (
              <Link key={child.href} href={child.href}
                className="flex items-center gap-1 px-2 py-1.5 rounded-md text-[12px] font-medium transition-colors"
                style={{ color: active ? '#00E5FF' : '#a1a1aa', background: active ? 'rgba(0,229,255,0.08)' : 'transparent' }}
                onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.color = '#e4e4e7' } }}
                onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#a1a1aa' } }}
              >
                <span className="flex-1">{child.label}</span>
                {badge != null && <BadgePill count={badge} />}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Leaf item ─────────────────────────────────────────────────────────────────

function NavLeafItem({ item, badges }: { item: NavItem; badges: Badges }) {
  const pathname = usePathname()

  if (item.soon) return (
    <div
      className="flex items-center gap-2.5 px-3 py-[7px] rounded-md text-[13px] font-medium"
      style={{ opacity: 0.45, cursor: 'not-allowed' }}
      title="Em breve"
    >
      <span style={{ color: '#71717a' }}>{item.icon}</span>
      <span style={{ color: '#71717a', flex: 1 }}>{item.label}</span>
      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded" style={{ background: '#27272a', color: '#52525b' }}>soon</span>
    </div>
  )

  const isActive = item.exact
    ? pathname === item.href
    : item.href === '/dashboard'
      ? pathname === '/dashboard'
      : pathname.startsWith(item.href)

  const badge = item.badgeKey ? badges[item.badgeKey] : undefined

  return (
    <Link
      href={item.href}
      className="flex items-center gap-2.5 px-3 py-[7px] rounded-md text-[13px] font-medium transition-colors relative"
      style={{ color: isActive ? '#fff' : '#a1a1aa', background: isActive ? 'rgba(0,229,255,0.09)' : 'transparent' }}
      onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.color = '#e4e4e7' } }}
      onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#a1a1aa' } }}
    >
      {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full" style={{ background: '#00E5FF' }} />}
      <span style={{ color: isActive ? '#00E5FF' : 'inherit' }}>{item.icon}</span>
      <span className="flex-1">{item.label}</span>
      {badge != null && <BadgePill count={badge} color="#ef4444" />}
    </Link>
  )
}

// ── NavItem dispatcher ────────────────────────────────────────────────────────

function NavItemRow({ item, badges }: { item: NavItem; badges: Badges }) {
  if (item.children) return <NavGroupItem item={item} badges={badges} />
  return <NavLeafItem item={item} badges={badges} />
}

// ── Section (collapsible group) ───────────────────────────────────────────────

function SidebarSection({ section, open, onToggle, badges, first }: {
  section: NavSection; open: boolean; onToggle: () => void; badges: Badges; first?: boolean
}) {
  return (
    <div className={first ? '' : 'mt-1'}>
      {!first && <div style={{ borderTop: '1px solid #1a1a1f', margin: '6px 0 4px' }} />}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-1"
      >
        <span className="text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: '#71717a' }}>
          {section.label}
        </span>
        <ChevronDown
          size={10}
          style={{ color: '#52525b', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 150ms' }}
        />
      </button>
      {open && (
        <div className="mt-0.5 space-y-0.5">
          {section.items.map(item => (
            <NavItemRow key={item.href} item={item} badges={badges} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const [badges, setBadges]             = useState<Badges>({})
  const [collapsed, setCollapsed]       = useState(false)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(SECTION_DEFAULT_OPEN)
  const mounted = useRef(true)

  // Restore persisted state from localStorage
  useEffect(() => {
    if (localStorage.getItem('sidebar-collapsed') === 'true') setCollapsed(true)
    const restored: Record<string, boolean> = { ...SECTION_DEFAULT_OPEN }
    SECTIONS.forEach(s => {
      const v = localStorage.getItem(`sidebar-section-${s.key}`)
      if (v !== null) restored[s.key] = v === 'true'
    })
    setOpenSections(restored)
  }, [])

  const toggleCollapsed = () => {
    setCollapsed(c => {
      const next = !c
      localStorage.setItem('sidebar-collapsed', String(next))
      return next
    })
  }

  const toggleSection = (key: string) => {
    setOpenSections(prev => {
      const next = { ...prev, [key]: !prev[key] }
      localStorage.setItem(`sidebar-section-${key}`, String(next[key]))
      return next
    })
  }

  // Fetch badges in background
  useEffect(() => {
    mounted.current = true

    const fetchAll = async () => {
      try {
        const sb = createClient()
        const { data: { session } } = await sb.auth.getSession()
        if (!session || !mounted.current) return
        const headers = { Authorization: `Bearer ${session.access_token}` }

        const [qRes, cRes, comprasRes] = await Promise.allSettled([
          fetch(`${BACKEND}/ml/questions`,                      { headers }),
          fetch(`${BACKEND}/ml/claims`,                         { headers }),
          fetch(`${BACKEND}/compras/inteligencia/summary`,      { headers }),
        ])

        if (!mounted.current) return

        const next: Badges = {}

        if (qRes.status === 'fulfilled' && qRes.value.ok) {
          const d = await qRes.value.json()
          const n = d?.total ?? (d?.questions ?? []).filter((q: { status: string }) => q.status === 'unanswered').length
          if (n > 0) next['atendimento-perguntas'] = n
        }
        if (cRes.status === 'fulfilled' && cRes.value.ok) {
          const d = await cRes.value.json()
          const n = d?.paging?.total ?? d?.data?.length ?? 0
          if (n > 0) next['atendimento-reclamacoes'] = n
        }
        if (comprasRes.status === 'fulfilled' && comprasRes.value.ok) {
          const d = await comprasRes.value.json()
          if (d?.produtos_criticos > 0) next['compras-criticos'] = d.produtos_criticos
        }

        const [{ data: allProds }, { data: linked }] = await Promise.all([
          sb.from('products').select('id'),
          sb.from('product_listings').select('product_id'),
        ])
        if (mounted.current) {
          const linkedIds = new Set((linked ?? []).map((r: { product_id: string }) => r.product_id))
          const sem = (allProds ?? []).filter((p: { id: string }) => !linkedIds.has(p.id)).length
          if (sem > 0) next['vinculos'] = sem
        }

        if (mounted.current) setBadges(next)
      } catch { /* silent */ }
    }

    fetchAll()
    const id = setInterval(fetchAll, 2 * 60 * 1000)
    return () => { mounted.current = false; clearInterval(id) }
  }, [])

  return (
    <aside
      className="hidden md:flex flex-col h-screen shrink-0 overflow-hidden"
      style={{ width: collapsed ? 44 : 236, background: '#0c0c0f', borderRight: '1px solid rgba(0,229,255,0.07)', transition: 'width 200ms ease' }}
    >
      {/* Logo + collapse toggle */}
      <div
        className="flex items-center shrink-0"
        style={{
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          padding: collapsed ? '16px 0' : '16px 12px',
          justifyContent: collapsed ? 'center' : 'space-between',
        }}
      >
        {!collapsed && <img src="/logo.png" alt="e-Click" style={{ width: 130, mixBlendMode: 'screen' as const }} />}
        <button
          onClick={toggleCollapsed}
          className="flex items-center justify-center w-7 h-7 rounded-md transition-colors"
          style={{ color: '#71717a', flexShrink: 0 }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#a1a1aa'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#71717a'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            {collapsed
              ? <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              : <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7M19 19l-7-7 7-7" />
            }
          </svg>
        </button>
      </div>

      {/* Navigation */}
      {!collapsed && (
        <nav className="flex-1 px-2 py-2 overflow-y-auto no-scrollbar">
          {SECTIONS.map((section, i) => (
            <SidebarSection
              key={section.key}
              section={section}
              open={openSections[section.key] ?? (SECTION_DEFAULT_OPEN[section.key] ?? false)}
              onToggle={() => toggleSection(section.key)}
              badges={badges}
              first={i === 0}
            />
          ))}
        </nav>
      )}
    </aside>
  )
}
