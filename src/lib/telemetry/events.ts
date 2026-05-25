/**
 * Catálogo de telemetria — espelho do backend
 * (eclick-backend/src/modules/product-telemetry/catalog/events-catalog.ts).
 *
 * Fonte da verdade é o backend (rejeita evento fora do catálogo). Este mirror
 * existe pro client ter tipagem + validação em dev (console.warn em typo).
 * Ao adicionar evento novo, atualizar OS DOIS arquivos.
 */

export const TELEMETRY_EVENTS = {
  PAGE_VIEW:                'page_view',
  MODULE_ENTERED:           'module_entered',
  MODULE_EXITED:            'module_exited',

  DASHBOARD_KPI_VIEWED:     'dashboard.kpi_viewed',
  DASHBOARD_DRILL_DOWN:     'dashboard.drill_down',
  DASHBOARD_PERIOD_CHANGED: 'dashboard.period_changed',

  CAMPAIGN_CREATED:         'campaign.created',
  CAMPAIGN_PUBLISHED:       'campaign.published',
  CAMPAIGN_PRICE_SUGGESTED: 'campaign.price_suggested',
  CAMPAIGN_AI_ACCEPTED:     'campaign.ai_suggestion_accepted',
  CAMPAIGN_AI_REJECTED:     'campaign.ai_suggestion_rejected',

  LISTING_VIEWED:           'listing.viewed',
  LISTING_EDITED:           'listing.edited',
  LISTING_QUALITY_CHECKED:  'listing.quality_checked',
  LISTING_BUYBOX_VIEWED:    'listing.buybox_viewed',

  QUALITY_REPORT_OPENED:    'quality.report_opened',
  QUALITY_ISSUE_RESOLVED:   'quality.issue_resolved',

  DROPSHIP_SUPPLIER_VIEWED: 'dropship.supplier_viewed',
  DROPSHIP_PRODUCT_IMPORTED:'dropship.product_imported',

  CREATIVE_GENERATED:       'creative.generated',
  CREATIVE_DOWNLOADED:      'creative.downloaded',
  CREATIVE_PUBLISHED:       'creative.published',

  RADAR_OPPORTUNITY_VIEWED: 'radar.opportunity_viewed',
  RADAR_OPPORTUNITY_ACTED:  'radar.opportunity_acted',

  CUSTOMER_SEARCHED:        'customer.searched',
  CUSTOMER_ENRICHED:        'customer.enriched',

  ACTIVE_INBOX_OPENED:      'active.inbox_opened',
  ACTIVE_MESSAGE_SENT:      'active.message_sent',
  ACTIVE_COPILOT_USED:      'active.copilot_used',

  TASK_STARTED:             'task.started',
  TASK_COMPLETED:           'task.completed',
  TASK_ABANDONED:           'task.abandoned',

  // AI Visibility — GEO Score (ciclo de auditoria, emitidos pelo backend)
  GEO_SCORE_AUDIT_QUEUED:         'geo_score.audit_queued',
  GEO_SCORE_PROCESSING_STARTED:   'geo_score.processing_started',
  GEO_SCORE_PROCESSING_COMPLETED: 'geo_score.processing_completed',
  GEO_SCORE_PROCESSING_FAILED:    'geo_score.processing_failed',
  GEO_SCORE_RETRY_SCHEDULED:      'geo_score.retry_scheduled',
  GEO_SCORE_CACHE_HIT:            'geo_score.cache_hit',
  GEO_SCORE_CACHE_BYPASSED:       'geo_score.cache_bypassed',
} as const

export const MODULES = {
  DASHBOARD:  'dashboard',
  CAMPAIGNS:  'campaigns',
  LISTINGS:   'listings',
  QUALITY:    'quality',
  DROPSHIP:   'dropship',
  CREATIVE:   'creative',
  RADAR:      'radar',
  CUSTOMERS:  'customers',
  ACTIVE_CRM: 'active_crm',
  ADS:        'ads',
  ENRICHMENT: 'enrichment',
  PRICING:    'pricing',
  SETTINGS:   'settings',
  AI_VISIBILITY: 'ai_visibility',
} as const

export const TRACKED_TASKS = {
  CREATE_CAMPAIGN:     'create_campaign',
  IMPORT_LISTING:      'import_listing',
  ENRICH_CUSTOMER:     'enrich_customer',
  GENERATE_CREATIVE:   'generate_creative',
  ONBOARD_USER:        'onboard_user',
  CONNECT_MARKETPLACE: 'connect_marketplace',
} as const

export type TelemetryEventName = (typeof TELEMETRY_EVENTS)[keyof typeof TELEMETRY_EVENTS]
export type TelemetryModule    = (typeof MODULES)[keyof typeof MODULES]
export type TrackedTask        = (typeof TRACKED_TASKS)[keyof typeof TRACKED_TASKS]

export const EVENT_NAME_SET = new Set<string>(Object.values(TELEMETRY_EVENTS))
export const MODULE_SET     = new Set<string>(Object.values(MODULES))

/**
 * Rota → módulo de telemetria (granularidade fina, diferente do mapa de
 * gating do Sidebar em lib/modules.ts). Ordem: mais específico primeiro.
 * Rota não mapeada → null (não emite page_view/module pra não sujar o dado).
 */
const TELEMETRY_ROUTE_MODULES: ReadonlyArray<readonly [string, TelemetryModule]> = [
  ['/dashboard/ml-campaigns',  MODULES.CAMPAIGNS],
  ['/dashboard/campanhas',     MODULES.CAMPAIGNS],
  ['/dashboard/listings',      MODULES.LISTINGS],
  ['/dashboard/ml-quality',    MODULES.QUALITY],
  ['/dashboard/dropship',      MODULES.DROPSHIP],
  ['/dashboard/creative',      MODULES.CREATIVE],
  ['/dashboard/radar',         MODULES.RADAR],
  ['/dashboard/enriquecimento',MODULES.ENRICHMENT],
  ['/dashboard/crm',           MODULES.CUSTOMERS],
  ['/dashboard/ads',           MODULES.ADS],
  ['/dashboard/pricing-ai',    MODULES.PRICING],
  ['/dashboard/pricing',       MODULES.PRICING],
  ['/dashboard/precos',        MODULES.PRICING],
  ['/dashboard/ai-visibility', MODULES.AI_VISIBILITY],
  ['/dashboard/configuracoes', MODULES.SETTINGS],
]

export function telemetryModuleForPath(pathname: string): TelemetryModule | null {
  for (const [prefix, mod] of TELEMETRY_ROUTE_MODULES) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) return mod
  }
  // Raiz do dashboard (e subrotas não mapeadas acima sob /dashboard direto).
  if (pathname === '/dashboard') return MODULES.DASHBOARD
  return null
}
