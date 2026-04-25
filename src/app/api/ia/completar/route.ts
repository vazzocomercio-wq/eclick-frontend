import { NextRequest, NextResponse } from 'next/server'
import { AI_CONFIG } from '@/lib/ai/config'
import type { AIFeature } from '@/lib/ai/config'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

// Fetch the decrypted API key from the backend (server-side only — key never reaches the browser)
async function getApiKeyFromDB(provider: string, token: string): Promise<string | null> {
  try {
    const res = await fetch(`${BACKEND}/credentials/key?provider=${provider}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    const data = await res.json() as { key: string | null }
    return data.key ?? null
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const { feature, prompt, systemPrompt, provider, model } = await req.json() as {
    feature: AIFeature
    prompt: string
    systemPrompt?: string
    provider?: string
    model?: string
  }

  if (!feature || !prompt) {
    return NextResponse.json({ error: 'feature e prompt são obrigatórios' }, { status: 400 })
  }

  const selectedProvider = provider ?? 'anthropic'
  const selectedModel    = model    ?? AI_CONFIG.model
  const system = systemPrompt ?? 'Você é um assistente especializado em e-commerce no Brasil.'

  // Extract token from Authorization header (passed from client)
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')

  console.log(`[ia] provider=${selectedProvider} model=${selectedModel} feature=${feature}`)

  try {
    if (selectedProvider === 'anthropic') {
      // DB key takes priority; env var is fallback
      const apiKey = (token ? await getApiKeyFromDB('anthropic', token) : null)
        ?? process.env.ANTHROPIC_API_KEY

      if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada' }, { status: 500 })

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: selectedModel,
          max_tokens: 1500,
          system,
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        return NextResponse.json(
          { error: (err as { error?: { message?: string } }).error?.message ?? `Anthropic error: ${res.status}` },
          { status: res.status },
        )
      }

      const data = await res.json() as { content?: Array<{ text: string }>; usage?: { output_tokens: number } }
      return NextResponse.json({
        content:     data.content?.[0]?.text ?? '',
        provider:    'anthropic',
        model:       selectedModel,
        tokens_used: data.usage?.output_tokens ?? 0,
        feature,
      })
    }

    if (selectedProvider === 'openai') {
      const apiKey = (token ? await getApiKeyFromDB('openai', token) : null)
        ?? process.env.OPENAI_API_KEY

      if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY não configurada' }, { status: 500 })

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: selectedModel,
          max_tokens: 1500,
          messages: [
            { role: 'system', content: system },
            { role: 'user',   content: prompt },
          ],
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        return NextResponse.json(
          { error: (err as { error?: { message?: string } }).error?.message ?? `OpenAI error: ${res.status}` },
          { status: res.status },
        )
      }

      const data = await res.json() as { choices?: Array<{ message: { content: string } }>; usage?: { completion_tokens: number } }
      return NextResponse.json({
        content:     data.choices?.[0]?.message?.content ?? '',
        provider:    'openai',
        model:       selectedModel,
        tokens_used: data.usage?.completion_tokens ?? 0,
        feature,
      })
    }

    return NextResponse.json({ error: `Provider não suportado: ${selectedProvider}` }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno'
    console.error('[ia] erro:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
