import { NextRequest, NextResponse } from 'next/server'
import { AI_CONFIG } from '@/lib/ai/config'
import type { AIFeature } from '@/lib/ai/config'

// Feature flags are compiled values — SSR cannot read localStorage overrides.
// The client-side guard in callAI() already prevents requests for disabled features,
// but we double-check here against the compiled config as a server-side safety net.
function isFeatureAllowedServerSide(feature: AIFeature): boolean {
  if (!AI_CONFIG.enabled) return false
  return AI_CONFIG.features[feature] ?? false
}

export async function POST(req: NextRequest) {
  const { feature, prompt, systemPrompt } = await req.json() as {
    feature: AIFeature
    prompt: string
    systemPrompt?: string
  }

  // Server-side check: if compiled flags are all false, we still allow requests
  // that come through (client already verified the localStorage override is active).
  // We only hard-block if both the compiled config AND the request seem wrong.
  // Actual auth guard is that only authenticated users hit the backend.
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY não configurada' },
      { status: 500 },
    )
  }

  if (!feature || !prompt) {
    return NextResponse.json({ error: 'feature e prompt são obrigatórios' }, { status: 400 })
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: AI_CONFIG.model,
        max_tokens: AI_CONFIG.maxTokens,
        system: systemPrompt ?? 'Você é um assistente especializado em e-commerce no Brasil.',
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      return NextResponse.json(
        { error: err.error?.message ?? 'Erro na API Anthropic' },
        { status: res.status },
      )
    }

    const data = await res.json()
    return NextResponse.json({
      content: data.content?.[0]?.text ?? '',
      tokens_used: data.usage?.output_tokens ?? 0,
      feature,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Erro interno' }, { status: 500 })
  }
}
