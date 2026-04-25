// ── Multi-provider registry ───────────────────────────────────────────────────

export const AI_PROVIDERS = {
  anthropic: {
    name: 'Claude (Anthropic)',
    models: [
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku',  description: 'Rápido e econômico' },
      { id: 'claude-sonnet-4-6',         name: 'Claude Sonnet', description: 'Equilibrado' },
      { id: 'claude-opus-4-6',           name: 'Claude Opus',   description: 'Mais inteligente' },
    ],
  },
  openai: {
    name: 'ChatGPT (OpenAI)',
    models: [
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Rápido e econômico' },
      { id: 'gpt-4o',      name: 'GPT-4o',      description: 'Equilibrado' },
      { id: 'o1',          name: 'GPT o1',       description: 'Raciocínio avançado' },
    ],
  },
} as const

export type AIProvider = keyof typeof AI_PROVIDERS

export const getAIPreference = (): { provider: string; model: string } => {
  if (typeof window === 'undefined') return { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' }
  return {
    provider: localStorage.getItem('ai_provider') ?? 'anthropic',
    model:    localStorage.getItem('ai_model')    ?? 'claude-haiku-4-5-20251001',
  }
}

export const setAIPreference = (provider: string, model: string) => {
  if (typeof window === 'undefined') return
  localStorage.setItem('ai_provider', provider)
  localStorage.setItem('ai_model', model)
}

// ── Legacy single-model config (kept for back-compat) ─────────────────────────

export const AI_CONFIG = {
  // Master switch — all features respect this
  enabled: false,
  features: {
    sugestao_resposta:    false, // Atendimento: sugerir resposta para perguntas
    precificacao:         false, // Anúncios: sugerir preço ideal
    titulo_anuncio:       false, // Catálogo: otimizar título do anúncio
    descricao_produto:    false, // Catálogo: gerar descrição do produto
    analise_concorrencia: true,  // Dashboard: análise de concorrentes
    previsao_demanda:     false, // Estoque: prever necessidade de reposição
    classificacao_ticket: false, // Atendimento: classificar urgência
    resumo_financeiro:    false, // Financeiro: insights automáticos
  },
  model: 'claude-haiku-4-5-20251001',
  maxTokens: 1000,
} as const

export type AIFeature = keyof typeof AI_CONFIG.features

const LS_GLOBAL  = 'ai_enabled'
const lsFeature  = (f: AIFeature) => `ai_feature_${f}`

/**
 * Checks whether a feature is active.
 * Compiled flags are the baseline; localStorage overrides take precedence
 * so the admin page can toggle features without a redeploy.
 * Always returns false on the server (SSR-safe).
 */
export function isAIEnabled(feature?: AIFeature): boolean {
  if (typeof window === 'undefined') return false

  const globalOverride = localStorage.getItem(LS_GLOBAL)
  const globalOn = globalOverride !== null ? globalOverride === 'true' : AI_CONFIG.enabled
  if (!globalOn) return false
  if (!feature) return globalOn

  const featureOverride = localStorage.getItem(lsFeature(feature))
  return featureOverride !== null
    ? featureOverride === 'true'
    : AI_CONFIG.features[feature]
}

/** Used by the admin page to persist toggles. */
export function setAIEnabled(enabled: boolean) {
  if (typeof window === 'undefined') return
  localStorage.setItem(LS_GLOBAL, String(enabled))
}

export function setAIFeature(feature: AIFeature, enabled: boolean) {
  if (typeof window === 'undefined') return
  localStorage.setItem(lsFeature(feature), String(enabled))
}

/** Read current effective state (compiled + localStorage). */
export function getAIState(): { enabled: boolean; features: Record<AIFeature, boolean> } {
  const features = {} as Record<AIFeature, boolean>
  for (const key of Object.keys(AI_CONFIG.features) as AIFeature[]) {
    features[key] = isAIEnabled(key)
  }
  return { enabled: isAIEnabled(), features }
}
