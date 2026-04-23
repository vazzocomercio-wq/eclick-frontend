export const PROMPTS = {
  sugestao_resposta: (pergunta: string, produto: { nome?: string; preco?: string | number; estoque?: number }) => `
Você é um assistente de atendimento ao cliente do Mercado Livre.
Produto: ${produto.nome ?? 'Não informado'} - ${produto.preco ?? 'Não informado'}
Estoque: ${produto.estoque ?? 'Não informado'} unidades
Pergunta do comprador: "${pergunta}"
Gere uma resposta profissional, cordial e objetiva.
Máximo 3 parágrafos. Tom profissional mas amigável. Em português.
  `.trim(),

  otimizar_titulo: (titulo: string, categoria: string) => `
Você é especialista em SEO para Mercado Livre.
Título atual: "${titulo}"
Categoria: ${categoria}
Otimize o título para melhorar a visibilidade na busca do ML.
Mantenha até 60 caracteres. Inclua palavras-chave relevantes.
Retorne APENAS o novo título, sem explicações.
  `.trim(),

  gerar_descricao: (produto: { nome?: string; sku?: string; preco?: string | number }) => `
Crie uma descrição persuasiva para o produto:
Nome: ${produto.nome ?? 'Não informado'}
SKU: ${produto.sku ?? 'Não informado'}
Preço: ${produto.preco ?? 'Não informado'}
Escreva 3-4 parágrafos destacando benefícios, especificações e diferenciais.
Tom profissional e persuasivo. Em português.
  `.trim(),

  sugerir_preco: (
    produto: { nome?: string; preco?: number; custo?: number },
    concorrentes: unknown[],
  ) => `
Analise os dados e sugira um preço competitivo:
Produto: ${produto.nome ?? 'Não informado'}
Preço atual: ${produto.preco ?? 'Não informado'}
Preço de custo: ${produto.custo ?? 'Não informado'}
Concorrentes: ${JSON.stringify(concorrentes.slice(0, 5))}
Sugira um preço que maximize vendas mantendo margem saudável.
Retorne JSON: { "preco_sugerido": number, "justificativa": string, "margem_estimada": number }
  `.trim(),

  classificar_ticket: (texto: string) => `
Classifique a urgência desta mensagem de atendimento:
"${texto}"
Retorne JSON: { "urgencia": "alta" | "media" | "baixa", "motivo": string, "categoria": "reclamacao" | "duvida" | "elogio" | "cancelamento" | "troca" }
  `.trim(),

  insights_financeiros: (dados: {
    periodo?: string
    faturamento?: number | string
    margem?: number
    topProdutos?: unknown[]
  }) => `
Analise os dados financeiros e gere insights acionáveis:
Período: ${dados.periodo ?? 'Não informado'}
Faturamento: ${dados.faturamento ?? 'Não informado'}
Margem: ${dados.margem ?? 'Não informado'}%
Top produtos: ${JSON.stringify(dados.topProdutos ?? [])}
Gere 3 insights práticos e uma recomendação principal.
  `.trim(),

  previsao_demanda: (
    produto: { nome?: string; estoque?: number },
    historico: unknown[],
  ) => `
Com base no histórico de vendas, preveja a demanda:
Produto: ${produto.nome ?? 'Não informado'}
Estoque atual: ${produto.estoque ?? 'Não informado'}
Histórico: ${JSON.stringify(historico)}
Sugira quantidade para repor e prazo ideal de reposição.
Retorne JSON: { "quantidade_repor": number, "prazo_dias": number, "justificativa": string }
  `.trim(),
}
