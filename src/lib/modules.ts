/**
 * Catálogo de módulos do SaaS e controle de acesso da plataforma.
 *
 * As `key` espelham EXATAMENTE as `key` das seções do Sidebar
 * (`components/layout/Sidebar.tsx`) — é o que liga o gating ao menu.
 */

export interface ModuleDef {
  key:   string
  label: string
}

export const MODULE_CATALOG: ModuleDef[] = [
  { key: 'visaogeral',    label: 'Visão Geral' },
  { key: 'active',        label: 'Active' },
  { key: 'marketplace',   label: 'Marketplace' },
  { key: 'compras',       label: 'Compras' },
  { key: 'dropship',      label: 'Dropship' },
  { key: 'crm',           label: 'CRM' },
  { key: 'producao',      label: 'Produção' },
  { key: 'loja',          label: 'Loja' },
  { key: 'atendente-ia',  label: 'Atendente IA' },
  { key: 'ads',           label: 'Ads' },
  { key: 'projeto',       label: 'Projeto' },
  { key: 'inteligencia',  label: 'Inteligência' },
  { key: 'configuracoes', label: 'Configurações' },
]

/** Módulos núcleo — sempre visíveis; não entram no gating. */
export const CORE_MODULES = ['visaogeral', 'configuracoes']

/** Módulos liberáveis pelo painel de gestão (todos menos o núcleo). */
export const GATEABLE_MODULES: ModuleDef[] =
  MODULE_CATALOG.filter(m => !CORE_MODULES.includes(m.key))

/** E-mails da equipe e-Click com acesso ao painel de gestão de clientes. */
export const PLATFORM_ADMIN_EMAILS = ['vazzocomercio@gmail.com']

export function isPlatformAdmin(email: string | null | undefined): boolean {
  return !!email && PLATFORM_ADMIN_EMAILS.includes(email.toLowerCase())
}

/**
 * Prefixos de rota → chave de módulo. Espelha as seções do Sidebar.
 * Só os módulos gateáveis entram aqui — rotas de núcleo (visaogeral,
 * configuracoes) ficam de fora e nunca são bloqueadas.
 */
const ROUTE_MODULES: ReadonlyArray<readonly [string, string]> = [
  // marketplace
  ['/dashboard/comercial', 'marketplace'], ['/dashboard/vendas', 'marketplace'],
  ['/dashboard/metas', 'marketplace'], ['/dashboard/canais', 'marketplace'],
  ['/dashboard/catalogo', 'marketplace'], ['/dashboard/produtos', 'marketplace'],
  ['/dashboard/precos', 'marketplace'], ['/dashboard/pricing', 'marketplace'],
  ['/dashboard/ml-quality', 'marketplace'], ['/dashboard/ml-campaigns', 'marketplace'],
  ['/dashboard/listings', 'marketplace'], ['/dashboard/pedidos', 'marketplace'],
  ['/dashboard/atendimento', 'marketplace'], ['/dashboard/ml-postsale', 'marketplace'],
  ['/dashboard/logistica', 'marketplace'], ['/dashboard/financeiro', 'marketplace'],
  ['/dashboard/radar', 'marketplace'],
  // compras / dropship
  ['/dashboard/compras', 'compras'],
  ['/dashboard/dropship', 'dropship'],
  // crm
  ['/dashboard/crm', 'crm'], ['/dashboard/enriquecimento', 'crm'],
  ['/dashboard/messaging', 'crm'], ['/dashboard/campanhas', 'crm'],
  ['/dashboard/comunicacao', 'crm'],
  // producao
  ['/dashboard/producao', 'producao'], ['/dashboard/social', 'producao'],
  ['/dashboard/ads-campaigns', 'producao'], ['/dashboard/pricing-ai', 'producao'],
  ['/dashboard/creative', 'producao'],
  // loja
  ['/dashboard/store', 'loja'], ['/dashboard/store-copilot', 'loja'],
  ['/dashboard/collections', 'loja'], ['/dashboard/kits', 'loja'],
  ['/dashboard/automation', 'loja'], ['/dashboard/social-commerce', 'loja'],
  // demais
  ['/dashboard/atendente-ia', 'atendente-ia'],
  ['/dashboard/ads', 'ads'],
  ['/dashboard/roadmap', 'projeto'],
  ['/dashboard/inteligencia', 'inteligencia'],
  ['/dashboard/admin', 'admin'],
]

/**
 * Qual módulo cobre este pathname. Casa por segmento exato (`/x` ou
 * `/x/...`), nunca por prefixo parcial. null = rota de núcleo ou não
 * mapeada — nesses casos não há bloqueio.
 */
export function moduleForPath(pathname: string): string | null {
  for (const [prefix, mod] of ROUTE_MODULES) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) return mod
  }
  return null
}
