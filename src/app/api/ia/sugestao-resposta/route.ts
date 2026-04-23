import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { question, item_title, item_price, item_stock } = await req.json()

  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    // Graceful fallback when key is not configured
    const parts = [`Olá! Obrigado pela sua pergunta.`]
    if (item_title) parts.push(`O produto "${item_title}"`)
    if (item_stock != null && item_stock > 0) parts.push(`está disponível com ${item_stock} unidade(s) em estoque.`)
    else parts.push(`está disponível para compra.`)
    parts.push(`Ficamos à disposição para mais informações!`)
    return NextResponse.json({ suggestion: parts.join(' ') })
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [
          {
            role: 'user',
            content: `Você é um assistente de atendimento ao cliente para um vendedor do Mercado Livre. Gere uma resposta profissional, clara e amigável em português brasileiro para a seguinte pergunta de um comprador.

Produto: ${item_title ?? 'Não informado'}
Preço: ${item_price != null ? `R$ ${Number(item_price).toFixed(2)}` : 'Não informado'}
Estoque disponível: ${item_stock != null ? `${item_stock} unidades` : 'Não informado'}

Pergunta do comprador: "${question}"

Responda de forma natural e direta. Máximo 3 frases. Não use saudações formais excessivas.`,
          },
        ],
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      return NextResponse.json({ error: err.error?.message ?? 'Erro na API da IA' }, { status: 502 })
    }

    const data = await res.json()
    const suggestion = data.content?.[0]?.text ?? ''
    return NextResponse.json({ suggestion })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Erro interno' }, { status: 500 })
  }
}
