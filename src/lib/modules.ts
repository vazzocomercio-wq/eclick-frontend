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
