/**
 * /llms.txt — guia pra motores de IA (formato llms.txt). Faz a própria e-Click
 * (a ferramenta de GEO) ser citável/legível pela IA. Servido em eclick.app.br/llms.txt.
 */

export const dynamic = 'force-static'

const TEXT = `# e-Click — Inteligência Comercial

> Plataforma brasileira de inteligência comercial para vendedores de marketplace (Mercado Livre, Shopee, Amazon) e lojas próprias. Inclui um módulo de GEO (Generative Engine Optimization): medir e melhorar o quanto os produtos aparecem e são citados pelos motores de IA (ChatGPT, Gemini, Perplexity).

## Auditoria GEO Grátis
- [Auditoria GEO gratuita](https://eclick.app.br/auditoria-gratis): cole a URL de um anúncio ou loja e receba, em ~60 segundos, a Nota GEO (0 a 100) e os 3 problemas mais críticos de visibilidade em IA. Sem cadastro, sem cartão.

## O que é GEO
GEO (Generative Engine Optimization) é a prática de otimizar conteúdo de produto para ser entendido, recomendado e citado por motores de IA generativa — diferente do SEO tradicional, que mira buscadores por palavra-chave. Baseia-se em pesquisa acadêmica: "GEO: Generative Engine Optimization" (KDD 2024, Princeton) e um testbed de GEO para e-commerce (E-GEO 2025, Columbia + MIT). Levers que comprovadamente aumentam a visibilidade em IA: citar fontes e estatísticas, profundidade e clareza da descrição, dados estruturados, avaliações, FAQ e factualidade. Encher de palavra-chave PIORA a visibilidade.

## Como a e-Click ajuda
- Mede a Nota GEO de cada anúncio em 8 dimensões.
- Reescreve título e descrição com IA aplicando os levers de GEO.
- Simula o ranking do produto nas respostas da IA antes de publicar.
- Mede o impacto em vendas após otimizar.

## Contato
- Site: https://eclick.app.br
- Slogan: Transformamos vendas em processos, processos em resultados.
`

export function GET() {
  return new Response(TEXT, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
