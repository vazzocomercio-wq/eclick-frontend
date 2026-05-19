'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase'
import {
  Home, Radio, BarChart3, Package, ShoppingBag, MessageCircle,
  Truck, DollarSign, Brain, Building2, Ship, Users, Target,
  Heart, MessageSquare, CheckSquare, Sparkles, Image as ImageIcon,
  Megaphone, ShoppingCart, TrendingUp, Settings, UserCog,
  Plug, Database, ChevronDown, Bot, Inbox, BookOpen,
  GraduationCap, LineChart, Shield, Users2, TrendingDown,
  Zap, Map as MapIcon, Bell, Wand2, Layers, Store, Palette, Link2, Calendar, FileText, Eye,
  RotateCcw, CreditCard, Scale, Trophy, AlertTriangle as AlertTriangleIcon, Sparkles as SparklesIcon,
} from 'lucide-react'
import { CORE_MODULES } from '@/lib/modules'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

// ── Types ─────────────────────────────────────────────────────────────────────

type BadgeKey = 'atendimento-perguntas' | 'atendimento-reclamacoes' | 'vinculos' | 'compras-criticos' | 'pricing-critical'
type Badges = Partial<Record<BadgeKey, number>>

type SubItem = { labelKey: string; href: string }

type NavChild = {
  labelKey: string
  href: string
  soon?: boolean
  badgeKey?: BadgeKey
  subItems?: SubItem[]
}

type NavItem = {
  labelKey: string
  href: string
  icon: React.ReactNode
  soon?: boolean
  exact?: boolean
  /** Link pra fora do SaaS (ex.: o Active) — abre em nova aba. */
  external?: boolean
  badgeKey?: BadgeKey
  children?: NavChild[]
}

type NavSection = {
  key: string
  labelKey: string
  items: NavItem[]
}

// ── Nav config ────────────────────────────────────────────────────────────────

const SECTIONS: NavSection[] = [
  {
    key: 'visaogeral',
    labelKey: 'sections.visaogeral',
    items: [
      { labelKey: 'items.dashboard',          href: '/dashboard',               icon: <Home size={15} />,      exact: true },
      {
        labelKey: 'items.executiveDashboard', href: '/dashboard/executive',     icon: <LineChart size={15} />,
        children: [
          { labelKey: 'items.executiveOverview', href: '/dashboard/executive' },
          { labelKey: 'items.executiveReputation', href: '/dashboard/executive/reputation' },
          { labelKey: 'items.executiveLogistics',  href: '/dashboard/executive/logistics' },
          { labelKey: 'items.executiveVisits',     href: '/dashboard/executive/visits' },
          { labelKey: 'items.executiveAds',        href: '/dashboard/executive/ads' },
        ],
      },
      { labelKey: 'items.vendasAoVivo',       href: '/dashboard/vendas-ao-vivo', icon: <Radio size={15} /> },
    ],
  },
  {
    key: 'active',
    labelKey: 'sections.active',
    items: [
      { labelKey: 'items.abrirActive', href: 'https://active.eclick.app.br', icon: <MessageCircle size={15} />, external: true },
    ],
  },
  {
    key: 'marketplace',
    labelKey: 'sections.marketplace',
    items: [
      {
        labelKey: 'items.comercial', href: '/dashboard/comercial', icon: <BarChart3 size={15} />,
        children: [
          { labelKey: 'items.vendas', href: '/dashboard/vendas' },
          { labelKey: 'items.metas',  href: '/dashboard/metas' },
          { labelKey: 'items.canais', href: '/dashboard/canais' },
        ],
      },
      {
        labelKey: 'items.catalogo', href: '/dashboard/catalogo', icon: <Package size={15} />,
        children: [
          {
            labelKey: 'items.produtos', href: '/dashboard/produtos',
            subItems: [
              { labelKey: 'items.produtosLista',          href: '/dashboard/produtos' },
              { labelKey: 'items.produtosOperacao',       href: '/dashboard/produtos/operacao-cadastro' },
              { labelKey: 'items.produtosAiBulk',         href: '/dashboard/produtos/ai-bulk' },
              { labelKey: 'items.produtosRecomendacoes',  href: '/dashboard/produtos/recomendacoes-ia' },
            ],
          },
          {
            labelKey: 'items.anuncios', href: '/dashboard/catalogo/anuncios',
            subItems: [
              { labelKey: 'items.anunciosMercadoLivre', href: '/dashboard/catalogo/anuncios/mercadolivre' },
              { labelKey: 'items.anunciosShopee',       href: '/dashboard/catalogo/anuncios/shopee' },
              { labelKey: 'items.anunciosAmazon',       href: '/dashboard/catalogo/anuncios/amazon' },
              { labelKey: 'items.anunciosMagalu',       href: '/dashboard/catalogo/anuncios/magalu' },
            ],
          },
          { labelKey: 'items.vinculos',  href: '/dashboard/catalogo/vinculos',  badgeKey: 'vinculos' as BadgeKey },
          {
            labelKey: 'items.estoque', href: '/dashboard/catalogo/estoque',
            subItems: [
              { labelKey: 'items.estoqueVisaoGeral',    href: '/dashboard/catalogo/estoque' },
              { labelKey: 'items.estoqueDistribuicao',  href: '/dashboard/catalogo/vinculos' },
              { labelKey: 'items.estoqueSincronizacoes', href: '/dashboard/catalogo/estoque/sincronizacoes' },
            ],
          },
          { labelKey: 'items.radar',        href: '/dashboard/radar' },
          { labelKey: 'items.precos',       href: '/dashboard/precos' },
        ],
      },
      {
        labelKey: 'items.precificacao', href: '/dashboard/pricing/analise', icon: <TrendingDown size={15} />,
        children: [
          { labelKey: 'items.precificacaoConfig',  href: '/dashboard/pricing/configuracao' },
          { labelKey: 'items.precificacaoAnalise', href: '/dashboard/pricing/analise',  badgeKey: 'pricing-critical' as BadgeKey },
          { labelKey: 'items.precificacaoChat',    href: '/dashboard/pricing/chat' },
        ],
      },
      {
        labelKey: 'items.qualityCenter', href: '/dashboard/ml-quality', icon: <Shield size={15} />,
        children: [
          { labelKey: 'items.qualityDiagnostico', href: '/dashboard/ml-quality' },
          { labelKey: 'items.qualityAnuncios',    href: '/dashboard/ml-quality/items' },
          { labelKey: 'items.qualityQuickWins',   href: '/dashboard/ml-quality/quick-wins' },
          { labelKey: 'items.qualityPenalizados', href: '/dashboard/ml-quality/penalties' },
        ],
      },
      {
        labelKey: 'items.campaignCenter', href: '/dashboard/ml-campaigns', icon: <Megaphone size={15} />,
        children: [
          { labelKey: 'items.campaignDashboard',        href: '/dashboard/ml-campaigns' },
          { labelKey: 'items.campaignList',             href: '/dashboard/ml-campaigns/list' },
          { labelKey: 'items.campaignRecommendations',  href: '/dashboard/ml-campaigns/recommendations' },
          { labelKey: 'items.campaignManagerQueue',     href: '/dashboard/ml-campaigns/manager-queue' },
          { labelKey: 'items.campaignAlerts',           href: '/dashboard/ml-campaigns/alerts' },
          { labelKey: 'items.campaignApply',            href: '/dashboard/ml-campaigns/apply' },
          { labelKey: 'items.campaignDeadlines',        href: '/dashboard/ml-campaigns/deadlines' },
          { labelKey: 'items.campaignHealth',           href: '/dashboard/ml-campaigns/health' },
          { labelKey: 'items.campaignAnalytics',        href: '/dashboard/ml-campaigns/analytics' },
          { labelKey: 'items.campaignAudit',            href: '/dashboard/ml-campaigns/audit' },
          { labelKey: 'items.campaignConfig',           href: '/dashboard/ml-campaigns/config' },
        ],
      },
      {
        labelKey: 'items.listingCenter', href: '/dashboard/listings', icon: <CheckSquare size={15} />,
        children: [
          { labelKey: 'items.listingTarefas',     href: '/dashboard/listings' },
          { labelKey: 'items.listingSemEstoque',  href: '/dashboard/listings?type=OUT_OF_STOCK' },
          { labelKey: 'items.listingPausados',    href: '/dashboard/listings?type=INACTIVE_PAUSED' },
          { labelKey: 'items.listingPricingIa',   href: '/dashboard/listings/pricing' },
          { labelKey: 'items.listingAutomacao',   href: '/dashboard/listings/pricing/automation' },
          { labelKey: 'items.listingBuyBox',      href: '/dashboard/listings?type=LOSING_BUY_BOX' },
          { labelKey: 'items.listingCatalogo',    href: '/dashboard/listings?type=CATALOG_ELIGIBLE' },
          { labelKey: 'items.listingFiscal',      href: '/dashboard/listings/fiscal' },
          { labelKey: 'items.listingPolitica',    href: '/dashboard/listings/policy' },
          { labelKey: 'items.listingHealthScore', href: '/dashboard/listings/scores' },
          { labelKey: 'items.listingAcoesMassa',  href: '/dashboard/listings/bulk' },
        ],
      },
      { labelKey: 'items.pedidos', href: '/dashboard/pedidos', icon: <ShoppingBag size={15} /> },
      {
        labelKey: 'items.atendimento', href: '/dashboard/atendimento', icon: <MessageCircle size={15} />,
        children: [
          { labelKey: 'items.atendimentoPerguntas',   href: '/dashboard/atendimento/perguntas',   badgeKey: 'atendimento-perguntas' as BadgeKey },
          { labelKey: 'items.atendimentoPosVenda',    href: '/dashboard/ml-postsale' },
          { labelKey: 'items.atendimentoReclamacoes', href: '/dashboard/atendimento/reclamacoes', badgeKey: 'atendimento-reclamacoes' as BadgeKey },
          { labelKey: 'items.atendimentoMensagens',   href: '/dashboard/atendimento/mensagens' },
        ],
      },
      { labelKey: 'items.logistica',  href: '/dashboard/logistica',  icon: <Truck size={15} /> },
      {
        labelKey: 'items.financeiro', href: '/dashboard/financeiro', icon: <DollarSign size={15} />,
        children: [
          { labelKey: 'items.financeiroResumo',      href: '/dashboard/financeiro/resumo' },
          { labelKey: 'items.financeiroContasPagar', href: '/dashboard/financeiro/contas-a-pagar' },
          { labelKey: 'items.financeiroFluxo',       href: '/dashboard/financeiro/fluxo' },
          { labelKey: 'items.financeiroDre',         href: '/dashboard/financeiro/dre' },
        ],
      },
    ],
  },
  {
    key: 'compras',
    labelKey: 'sections.compras',
    items: [
      { labelKey: 'items.comprasInteligencia', href: '/dashboard/compras/inteligencia', icon: <Brain size={15} />,    badgeKey: 'compras-criticos' as BadgeKey },
      { labelKey: 'items.comprasFornecedores', href: '/dashboard/compras/fornecedores', icon: <Building2 size={15} /> },
      { labelKey: 'items.comprasImportacoes',  href: '/dashboard/compras/importacoes',  icon: <Ship size={15} /> },
    ],
  },
  {
    key: 'dropship',
    labelKey: 'sections.dropship',
    items: [
      { labelKey: 'items.dropshipVisaoGeral',  href: '/dashboard/dropship',                   icon: <Truck size={15} /> },
      { labelKey: 'items.dropshipParceiros',   href: '/dashboard/dropship/partners',          icon: <Building2 size={15} /> },
      { labelKey: 'items.dropshipPedidos',     href: '/dashboard/dropship/orders',            icon: <ShoppingCart size={15} /> },
      { labelKey: 'items.dropshipVendasHoje',  href: '/dashboard/dropship/orders/today',      icon: <Calendar size={15} /> },
      { labelKey: 'items.dropshipOcs',         href: '/dashboard/dropship/oc',                icon: <FileText size={15} /> },
      { labelKey: 'items.dropshipPreviaOc',    href: '/dashboard/dropship/oc/preview',        icon: <Eye size={15} /> },
      { labelKey: 'items.dropshipDevolucoes',  href: '/dashboard/dropship/returns',           icon: <RotateCcw size={15} /> },
      { labelKey: 'items.dropshipCreditos',    href: '/dashboard/dropship/credits',           icon: <CreditCard size={15} /> },
      { labelKey: 'items.dropshipDisputas',    href: '/dashboard/dropship/disputes',          icon: <Scale size={15} /> },
      { labelKey: 'items.dropshipScores',      href: '/dashboard/dropship/scores',            icon: <Trophy size={15} /> },
      { labelKey: 'items.dropshipDivergencias', href: '/dashboard/dropship/divergences',      icon: <AlertTriangleIcon size={15} /> },
      { labelKey: 'items.dropshipCopiloto',    href: '/dashboard/dropship/copilot',           icon: <SparklesIcon size={15} /> },
      { labelKey: 'items.dropshipVinculoContas', href: '/dashboard/dropship/account-suppliers', icon: <Link2 size={15} /> },
    ],
  },
  {
    key: 'crm',
    labelKey: 'sections.crm',
    items: [
      { labelKey: 'items.crmClientes',    href: '/dashboard/crm/clientes',  icon: <Users size={15} /> },
      { labelKey: 'items.crmCustomerHub', href: '/dashboard/crm/customer-hub', icon: <Users2 size={15} /> },
      { labelKey: 'items.crmPipeline',    href: '/dashboard/crm/pipeline',  icon: <Target size={15} /> },
      { labelKey: 'items.crmPosVenda',    href: '/dashboard/crm/pos-venda', icon: <Heart size={15} /> },
      { labelKey: 'items.crmEnriquecimento', href: '/dashboard/enriquecimento', icon: <Database size={15} /> },
      { labelKey: 'items.crmMensageria',  href: '/dashboard/messaging',     icon: <MessageSquare size={15} /> },
      { labelKey: 'items.crmCampanhas',   href: '/dashboard/campanhas',     icon: <Megaphone size={15} /> },
      { labelKey: 'items.crmComunicacao', href: '/dashboard/comunicacao',   icon: <Zap size={15} /> },
      { labelKey: 'items.crmWhatsapp',    href: '/dashboard/crm/whatsapp',  icon: <MessageSquare size={15} />, soon: true },
    ],
  },
  {
    key: 'producao',
    labelKey: 'sections.producao',
    items: [
      { labelKey: 'items.producaoTarefas',   href: '/dashboard/producao/tarefas',    icon: <CheckSquare size={15} /> },
      { labelKey: 'items.producaoConteudoIa', href: '/dashboard/producao/conteudo',  icon: <Sparkles size={15} /> },
      { labelKey: 'items.producaoConteudoSocial', href: '/dashboard/social',         icon: <Megaphone size={15} /> },
      { labelKey: 'items.producaoAdsHub',     href: '/dashboard/ads-campaigns',       icon: <Megaphone size={15} /> },
      { labelKey: 'items.producaoPrecosIa',   href: '/dashboard/pricing-ai',          icon: <DollarSign size={15} /> },
      {
        labelKey: 'items.iaCriativo', href: '/dashboard/creative', icon: <Wand2 size={15} />,
        children: [
          { labelKey: 'items.creativeProdutos',    href: '/dashboard/creative' },
          { labelKey: 'items.creativeTemplates',   href: '/dashboard/creative/templates' },
          { labelKey: 'items.creativeReferencias', href: '/dashboard/creative/references' },
          { labelKey: 'items.creativeNovoAnuncio', href: '/dashboard/creative/new' },
        ],
      },
      { labelKey: 'items.producaoBiblioteca', href: '/dashboard/producao/biblioteca', icon: <ImageIcon size={15} /> },
    ],
  },
  {
    key: 'loja',
    labelKey: 'sections.loja',
    items: [
      { labelKey: 'items.lojaConfig',    href: '/dashboard/store/config',   icon: <Store size={15} /> },
      { labelKey: 'items.lojaDesigner',  href: '/dashboard/store/designer', icon: <Palette size={15} /> },
      { labelKey: 'items.lojaCopiloto',  href: '/dashboard/store-copilot',  icon: <Bot size={15} /> },
      { labelKey: 'items.lojaColecoes',  href: '/dashboard/collections',    icon: <Layers size={15} /> },
      { labelKey: 'items.lojaKits',      href: '/dashboard/kits',           icon: <Package size={15} /> },
      { labelKey: 'items.lojaAutomacao', href: '/dashboard/automation',     icon: <Zap size={15} /> },
      {
        labelKey: 'items.socialShop', href: '/dashboard/social-commerce', icon: <ShoppingBag size={15} />,
        children: [
          { labelKey: 'items.socialShopInstagram', href: '/dashboard/social-commerce/instagram' },
        ],
      },
    ],
  },
  {
    key: 'atendente-ia',
    labelKey: 'sections.atendenteIa',
    items: [
      { labelKey: 'items.atendenteAgentes',       href: '/dashboard/atendente-ia/agentes',       icon: <Bot size={15} /> },
      { labelKey: 'items.atendenteConversas',     href: '/dashboard/atendente-ia/conversas',     icon: <Inbox size={15} /> },
      { labelKey: 'items.atendenteConhecimento',  href: '/dashboard/atendente-ia/conhecimento',  icon: <BookOpen size={15} /> },
      { labelKey: 'items.atendenteTreinamento',   href: '/dashboard/atendente-ia/treinamento',   icon: <GraduationCap size={15} /> },
      { labelKey: 'items.atendenteAnalytics',     href: '/dashboard/atendente-ia/analytics',     icon: <LineChart size={15} /> },
      { labelKey: 'items.atendenteWidget',        href: '/dashboard/atendente-ia/widget',        icon: <MessageSquare size={15} /> },
      { labelKey: 'items.atendenteClientes',      href: '/dashboard/atendente-ia/clientes',      icon: <Users size={15} /> },
      { labelKey: 'items.atendenteConfiguracoes', href: '/dashboard/atendente-ia/configuracoes', icon: <Settings size={15} /> },
    ],
  },
  {
    key: 'ads',
    labelKey: 'sections.ads',
    items: [
      { labelKey: 'items.adsMlAds',        href: '/dashboard/ads/mercadolivre', icon: <Megaphone size={15} /> },
      { labelKey: 'items.adsInteligencia', href: '/dashboard/ads/inteligencia', icon: <Sparkles size={15} /> },
      { labelKey: 'items.adsShopee',       href: '/dashboard/ads/shopee',       icon: <ShoppingCart size={15} />, soon: true },
      { labelKey: 'items.adsPerformance',  href: '/dashboard/ads/performance',  icon: <TrendingUp size={15} /> },
    ],
  },
  {
    key: 'projeto',
    labelKey: 'sections.projeto',
    items: [
      { labelKey: 'items.roadmap', href: '/dashboard/roadmap', icon: <MapIcon size={15} /> },
    ],
  },
  {
    key: 'inteligencia',
    labelKey: 'sections.inteligencia',
    items: [
      { labelKey: 'items.inteligenciaAlertas',       href: '/dashboard/inteligencia/alertas',       icon: <Bell size={15} /> },
      { labelKey: 'items.inteligenciaMercadoLivre',  href: '/dashboard/inteligencia/ml',            icon: <Sparkles size={15} /> },
      { labelKey: 'items.inteligenciaGestores',      href: '/dashboard/inteligencia/gestores',      icon: <Users size={15} /> },
      { labelKey: 'items.inteligenciaRelatorios',    href: '/dashboard/inteligencia/relatorios',    icon: <LineChart size={15} /> },
      { labelKey: 'items.inteligenciaConfiguracoes', href: '/dashboard/inteligencia/configuracoes', icon: <Settings size={15} /> },
    ],
  },
  {
    key: 'configuracoes',
    labelKey: 'sections.configuracoes',
    items: [
      { labelKey: 'items.configGeral',         href: '/dashboard/configuracoes',             icon: <Settings size={15} />, exact: true },
      { labelKey: 'items.configPreferencias',  href: '/dashboard/configuracoes/preferencias',icon: <Shield size={15} /> },
      { labelKey: 'items.configEquipe',        href: '/dashboard/configuracoes/equipe',      icon: <UserCog size={15} /> },
      { labelKey: 'items.configIntegracoes',   href: '/dashboard/configuracoes/integracoes', icon: <Plug size={15} /> },
      { labelKey: 'items.configWhatsappRotas', href: '/dashboard/configuracoes/whatsapp-rotas', icon: <MessageSquare size={15} /> },
      { labelKey: 'items.configIa',            href: '/dashboard/configuracoes/ia',          icon: <Sparkles size={15} /> },
      { labelKey: 'items.configAgregador',     href: '/dashboard/configuracoes/aggregator',  icon: <Database size={15} /> },
    ],
  },
]

/** Seção do painel de gestão — só renderiza pra admin da plataforma e-Click. */
const ADMIN_SECTION: NavSection = {
  key: 'admin',
  labelKey: 'sections.admin',
  items: [
    { labelKey: 'items.adminClientes', href: '/dashboard/admin', icon: <Building2 size={15} /> },
  ],
}

const SECTION_DEFAULT_OPEN: Record<string, boolean> = {
  visaogeral:      true,
  active:          true,
  marketplace:     true,
  admin:           true,
  compras:         false,
  dropship:        false,
  crm:             false,
  producao:        false,
  loja:            false,
  'atendente-ia':  false,
  ads:             false,
  inteligencia:    false,
  configuracoes:   false,
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
  const t = useTranslations('nav')
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
        <span>{t(child.labelKey)}</span>
        <ChevronDown size={10} style={{ color: '#71717a', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 150ms' }} />
      </button>
      {open && (
        <div className="ml-2 pl-2 mt-0.5 space-y-0.5" style={{ borderLeft: '1px solid var(--border)' }}>
          {(child.subItems ?? []).map(s => {
            const active = pathname.startsWith(s.href)
            return (
              <Link key={s.href} href={s.href}
                className="flex items-center px-2 py-1.5 rounded-md text-[11px] font-medium transition-colors"
                style={{ color: active ? '#00E5FF' : '#a1a1aa', background: active ? 'rgba(0,229,255,0.08)' : 'transparent' }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = '#e4e4e7' }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = '#a1a1aa' }}
              >
                {t(s.labelKey)}
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
  const t = useTranslations('nav')
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
        className="sidebar-nav-row w-full flex items-center gap-2.5 px-3 py-[7px] rounded-md text-[13px] font-medium transition-colors"
        style={{ color: anyActive ? '#fff' : '#a1a1aa', background: anyActive && !open ? 'rgba(0,229,255,0.05)' : 'transparent' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.color = '#e4e4e7' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = anyActive && !open ? 'rgba(0,229,255,0.05)' : 'transparent'; (e.currentTarget as HTMLElement).style.color = anyActive ? '#fff' : '#a1a1aa' }}
      >
        <span className="sidebar-icon" style={{ color: anyActive ? '#00E5FF' : 'inherit' }}>{item.icon}</span>
        <span className="flex-1 text-left">{t(item.labelKey)}</span>
        {parentBadgeTotal > 0 && <BadgePill count={parentBadgeTotal} />}
        <ChevronDown size={12} style={{ color: '#71717a', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 150ms', flexShrink: 0 }} />
      </button>

      {open && (
        <div className="ml-3.5 pl-3 mt-0.5 space-y-0.5" style={{ borderLeft: '1px solid var(--border)' }}>
          {children.map((child, idx) => {
            if (child.subItems) return <NavSubGroup key={idx} child={child} />
            if (child.soon) return (
              <div key={child.href}
                className="flex items-center gap-1 px-2 py-1.5 rounded-md text-[12px] font-medium"
                style={{ opacity: 0.45, cursor: 'not-allowed' }}
                title={t('misc.comingSoon')}
              >
                <span className="flex-1" style={{ color: '#71717a' }}>{t(child.labelKey)}</span>
                <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: '#27272a', color: '#52525b' }}>{t('misc.soonBadge')}</span>
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
                <span className="flex-1">{t(child.labelKey)}</span>
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
  const t = useTranslations('nav')
  const pathname = usePathname()

  if (item.soon) return (
    <div
      className="flex items-center gap-2.5 px-3 py-[7px] rounded-md text-[13px] font-medium"
      style={{ opacity: 0.45, cursor: 'not-allowed' }}
      title={t('misc.comingSoon')}
    >
      <span className="sidebar-icon" style={{ color: '#71717a' }}>{item.icon}</span>
      <span style={{ color: '#71717a', flex: 1 }}>{t(item.labelKey)}</span>
      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded" style={{ background: '#27272a', color: '#52525b' }}>{t('misc.soonBadge')}</span>
    </div>
  )

  if (item.external) return (
    <a
      href={item.href}
      target="_blank"
      rel="noopener noreferrer"
      className="sidebar-nav-row flex items-center gap-2.5 px-3 py-[7px] rounded-md text-[13px] font-medium transition-colors"
      style={{ color: '#a1a1aa' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.color = '#e4e4e7' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#a1a1aa' }}
    >
      <span className="sidebar-icon">{item.icon}</span>
      <span className="flex-1">{t(item.labelKey)}</span>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"
        style={{ color: '#52525b' }} aria-hidden>
        <path d="M7 17 17 7M9 7h8v8" />
      </svg>
    </a>
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
      className="sidebar-nav-row flex items-center gap-2.5 px-3 py-[7px] rounded-md text-[13px] font-medium transition-colors relative"
      style={{ color: isActive ? '#fff' : '#a1a1aa', background: isActive ? 'rgba(0,229,255,0.09)' : 'transparent' }}
      onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.color = '#e4e4e7' } }}
      onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#a1a1aa' } }}
    >
      {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full" style={{ background: '#00E5FF' }} />}
      <span className="sidebar-icon" style={{ color: isActive ? '#00E5FF' : 'inherit' }}>{item.icon}</span>
      <span className="flex-1">{t(item.labelKey)}</span>
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
  const t = useTranslations('nav')
  return (
    <div className={first ? '' : 'mt-1'}>
      {!first && <div style={{ borderTop: '1px solid var(--border)', margin: '6px 0 4px' }} />}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-1"
      >
        <span className="text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: '#71717a' }}>
          {t(section.labelKey)}
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

export default function Sidebar({ enabledModules = null, platformAdmin = false }: {
  enabledModules?: string[] | null
  platformAdmin?:  boolean
}) {
  const t                               = useTranslations('nav')
  const pathname                        = usePathname()
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

        const [qRes, cRes, comprasRes, pricingRes] = await Promise.allSettled([
          fetch(`${BACKEND}/ml/questions`,                      { headers }),
          fetch(`${BACKEND}/ml/claims`,                         { headers }),
          fetch(`${BACKEND}/compras/inteligencia/summary`,      { headers }),
          fetch(`${BACKEND}/pricing/signals/summary`,           { headers }),
        ])

        if (!mounted.current) return

        const next: Badges = {}

        if (qRes.status === 'fulfilled' && qRes.value.ok) {
          const d = await qRes.value.json()
          const qs = Array.isArray(d?.questions) ? d.questions : []
          const n = d?.total ?? qs.filter((q: { status: string }) => q.status === 'unanswered').length
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
        if (pricingRes.status === 'fulfilled' && pricingRes.value.ok) {
          const d = await pricingRes.value.json()
          const critical = d?.by_severity?.critical ?? 0
          const high     = d?.by_severity?.high     ?? 0
          const total    = critical + high
          if (total > 0) next['pricing-critical'] = total
        }

        const [{ data: allProds }, { data: linked }] = await Promise.all([
          sb.from('products').select('id'),
          sb.from('product_listings').select('product_id'),
        ])
        if (mounted.current) {
          const linkedArr = Array.isArray(linked) ? linked : []
          const prodArr   = Array.isArray(allProds) ? allProds : []
          const linkedIds = new Set(linkedArr.map((r: { product_id: string }) => r.product_id))
          const sem = prodArr.filter((p: { id: string }) => !linkedIds.has(p.id)).length
          if (sem > 0) next['vinculos'] = sem
        }

        if (mounted.current) setBadges(next)
      } catch { /* silent */ }
    }

    fetchAll()
    const id = setInterval(fetchAll, 2 * 60 * 1000)
    return () => { mounted.current = false; clearInterval(id) }
  }, [])

  // Módulos liberados pra esta organização (núcleo sempre visível).
  // enabledModules null = todos liberados (orgs sem config, ex.: Vazzo).
  const visible = enabledModules == null
    ? SECTIONS
    : SECTIONS.filter(s => CORE_MODULES.includes(s.key) || enabledModules.includes(s.key))
  // Painel de gestão só aparece pra equipe e-Click.
  const sections = platformAdmin ? [...visible, ADMIN_SECTION] : visible

  return (
    <aside
      className="hidden md:flex flex-col h-screen shrink-0 overflow-hidden"
      style={{
        width: collapsed ? 56 : 236,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        color: 'var(--text-muted)',
        transition: 'width 200ms ease, background-color 0.2s ease',
      }}
    >
      {/* Logo + collapse toggle */}
      <div
        className="flex items-center shrink-0"
        style={{
          borderBottom: '1px solid var(--border)',
          padding: collapsed ? '14px 0' : '14px 12px',
          justifyContent: collapsed ? 'center' : 'space-between',
          minHeight: 60,
        }}
      >
        {collapsed ? (
          <button onClick={toggleCollapsed} title={t('misc.expandMenu')}
            className="flex items-center justify-center w-10 h-10 rounded-xl transition-colors"
            style={{ background: 'transparent' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--hover-bg)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            <span style={{ color: '#00E5FF', fontSize: 26, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.04em' }}>e</span>
          </button>
        ) : (
          <>
            {/* Logo oficial — classe 'logo-themed' aplica blend correto por
                tema (screen no escuro, invert no claro) via globals.css. */}
            <img
              src="/logo.png"
              alt="e-Click"
              className="logo-themed"
              style={{ width: 160 }}
            />
            <button
              onClick={toggleCollapsed}
              className="flex items-center justify-center w-7 h-7 rounded-md transition-colors"
              style={{ color: '#71717a', flexShrink: 0 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#a1a1aa'; (e.currentTarget as HTMLElement).style.background = 'var(--hover-bg)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#71717a'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              title={t('misc.collapseMenu')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7M19 19l-7-7 7-7" />
              </svg>
            </button>
          </>
        )}
      </div>

      {/* Navigation — expanded */}
      {!collapsed && (
        <nav className="flex-1 px-2 py-2 overflow-y-auto no-scrollbar">
          {sections.map((section, i) => (
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

      {/* Navigation — collapsed (icons only) */}
      {collapsed && (
        <nav className="flex-1 py-2 overflow-y-auto no-scrollbar flex flex-col items-center gap-0.5">
          {sections.map((section, si) => (
            <div key={section.key} className="w-full flex flex-col items-center">
              {si > 0 && <div style={{ borderTop: '1px solid var(--border)', width: '70%', margin: '4px 0' }} />}
              {section.items.map(item => {
                const isActive = item.exact
                  ? pathname === item.href
                  : item.href === '/dashboard'
                    ? pathname === '/dashboard'
                    : pathname.startsWith(item.href)
                const bigIcon = React.isValidElement(item.icon)
                  ? React.cloneElement(item.icon as React.ReactElement<{ size?: number }>, { size: 22 })
                  : item.icon
                const cCls = 'flex items-center justify-center w-10 h-10 rounded-xl transition-colors'
                const cStyle = { color: isActive ? '#00E5FF' : '#52525b', background: isActive ? 'rgba(0,229,255,0.09)' : 'transparent' }
                const cEnter = (e: React.MouseEvent<HTMLElement>) => { if (!isActive) { e.currentTarget.style.background = 'var(--hover-bg)'; e.currentTarget.style.color = '#a1a1aa' } }
                const cLeave = (e: React.MouseEvent<HTMLElement>) => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#52525b' } }
                if (item.external) return (
                  <a key={item.href} href={item.href} target="_blank" rel="noopener noreferrer" title={t(item.labelKey)}
                    className={cCls} style={cStyle} onMouseEnter={cEnter} onMouseLeave={cLeave}>
                    {bigIcon}
                  </a>
                )
                return (
                  <Link key={item.href} href={item.href} title={t(item.labelKey)}
                    className={cCls} style={cStyle} onMouseEnter={cEnter} onMouseLeave={cLeave}>
                    {bigIcon}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>
      )}
    </aside>
  )
}
