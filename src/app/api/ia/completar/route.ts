import { NextRequest, NextResponse } from 'next/server'
import { AI_CONFIG } from '@/lib/ai/config'
import type { AIFeature } from '@/lib/ai/config'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

// Estimated cost per 1K tokens (USD)
const PRICES: Record<string, Record<string, { input: number; output: number }>> = {
  anthropic: {
    'claude-haiku-4-5-20251001': { input: 0.00025, output: 0.00125 },
    'claude-sonnet-4-6':         { input: 0.003,   output: 0.015   },
    'claude-opus-4-6':           { input: 0.015,   output: 0.075   },
  },
  openai: {
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'gpt-4o':      { input: 0.005,   output: 0.015  },
    'o1':          { input: 0.015,   output: 0.060  },
  },
}

function calcCost(provider: string, model: string, input: number, output: number): number {
  const price = PRICES[provider]?.[model]
  if (!price) return 0
  return (input / 1000) * price.input + (output / 1000) * price.output
}

// Fire-and-forget usage logging — never blocks the response
function logUsage(token: string, payload: {
  provider: string; model: string; feature: string
  tokens_input: number; tokens_output: number; tokens_total: number; cost_usd: number
}) {
  fetch(`${BACKEND}/ai-usage`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => { /* silent */ })
}

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

  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')

  console.log(`[ia] provider=${selectedProvider} model=${selectedModel} feature=${feature}`)

  try {
    if (selectedProvider === 'anthropic') {
      const apiKey = (token ? await getApiKeyFromDB('anthropic', token) : null)
        ?? process.env.ANTHROPIC_API_KEY
      if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada' }, { status: 500 })

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: selectedModel, max_tokens: 1500, system, messages: [{ role: 'user', content: prompt }] }),
      })

      if (!res.ok) {
        const err = await res.json()
        return NextResponse.json(
          { error: (err as { error?: { message?: string } }).error?.message ?? `Anthropic error: ${res.status}` },
          { status: res.status },
        )
      }

      const data = await res.json() as {
        content?: Array<{ text: string }>
        usage?: { input_tokens: number; output_tokens: number }
      }
      const inp = data.usage?.input_tokens  ?? 0
      const out = data.usage?.output_tokens ?? 0

      if (token) logUsage(token, {
        provider: 'anthropic', model: selectedModel, feature,
        tokens_input: inp, tokens_output: out, tokens_total: inp + out,
        cost_usd: calcCost('anthropic', selectedModel, inp, out),
      })

      return NextResponse.json({ content: data.content?.[0]?.text ?? '', provider: 'anthropic', model: selectedModel, tokens_used: out, feature })
    }

    if (selectedProvider === 'openai') {
      const apiKey = (token ? await getApiKeyFromDB('openai', token) : null)
        ?? process.env.OPENAI_API_KEY
      if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY não configurada' }, { status: 500 })

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: selectedModel, max_tokens: 1500,
          messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        return NextResponse.json(
          { error: (err as { error?: { message?: string } }).error?.message ?? `OpenAI error: ${res.status}` },
          { status: res.status },
        )
      }

      const data = await res.json() as {
        choices?: Array<{ message: { content: string } }>
        usage?: { prompt_tokens: number; completion_tokens: number }
      }
      const inp = data.usage?.prompt_tokens     ?? 0
      const out = data.usage?.completion_tokens ?? 0

      if (token) logUsage(token, {
        provider: 'openai', model: selectedModel, feature,
        tokens_input: inp, tokens_output: out, tokens_total: inp + out,
        cost_usd: calcCost('openai', selectedModel, inp, out),
      })

      return NextResponse.json({ content: data.choices?.[0]?.message?.content ?? '', provider: 'openai', model: selectedModel, tokens_used: out, feature })
    }

    return NextResponse.json({ error: `Provider não suportado: ${selectedProvider}` }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno'
    console.error('[ia] erro:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
