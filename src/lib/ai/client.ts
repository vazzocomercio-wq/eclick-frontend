import { isAIEnabled, getAIPreference } from './config'
import type { AIFeature } from './config'

export interface AIResponse {
  content:     string
  tokens_used: number
  feature:     AIFeature
  provider:    string
  model:       string
}

export async function callAI(
  feature: AIFeature,
  prompt: string,
  systemPrompt?: string,
  provider?: string,
  model?: string,
): Promise<AIResponse | null> {
  if (!isAIEnabled(feature)) {
    console.log(`[AI] Feature "${feature}" desativada`)
    return null
  }

  // Fall back to stored preference if caller doesn't specify
  const pref = getAIPreference()
  const resolvedProvider = provider ?? pref.provider
  const resolvedModel    = model    ?? pref.model

  try {
    const res = await fetch('/api/ia/completar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feature, prompt, systemPrompt, provider: resolvedProvider, model: resolvedModel }),
    })
    if (!res.ok) throw new Error(`AI request failed: ${res.status}`)
    return await res.json()
  } catch (error) {
    console.error(`[AI] Erro na feature "${feature}":`, error)
    return null
  }
}
