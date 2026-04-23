import { AI_CONFIG, isAIEnabled } from './config'
import type { AIFeature } from './config'

export interface AIResponse {
  content: string
  tokens_used: number
  feature: AIFeature
}

export async function callAI(
  feature: AIFeature,
  prompt: string,
  systemPrompt?: string,
): Promise<AIResponse | null> {
  if (!isAIEnabled(feature)) {
    console.log(`[AI] Feature "${feature}" desativada`)
    return null
  }

  try {
    const res = await fetch('/api/ia/completar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feature, prompt, systemPrompt }),
    })
    if (!res.ok) throw new Error(`AI request failed: ${res.status}`)
    return await res.json()
  } catch (error) {
    console.error(`[AI] Erro na feature "${feature}":`, error)
    return null
  }
}
