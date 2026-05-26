/**
 * Seed do blog: 7 categorias (pilares) + autor Silvio + 3 posts iniciais.
 * Idempotente (createOrReplace por _id determinístico).
 *
 * Uso:
 *   SANITY_PROJECT_ID=.. SANITY_DATASET=production SANITY_TOKEN=sk... \
 *     node scripts/seed.mjs
 *
 * Os números citados vêm das fontes da spec (SparkToro, KDD 2024, E-GEO 2025,
 * operação Vazzo) — NÃO inventar. Silvio pode editar tudo depois no Studio.
 */
import { createClient } from '@sanity/client'
import zlib from 'node:zlib'

const projectId = process.env.SANITY_PROJECT_ID
const dataset = process.env.SANITY_DATASET || 'production'
const token = process.env.SANITY_TOKEN
if (!projectId || !token) {
  console.error('Faltam SANITY_PROJECT_ID e/ou SANITY_TOKEN.')
  process.exit(1)
}

const client = createClient({ projectId, dataset, token, apiVersion: '2024-10-01', useCdn: false })

let k = 0
const key = () => `k${(k++).toString(36)}${Date.now().toString(36)}`
const span = (text, marks = []) => ({ _type: 'span', _key: key(), text, marks })
const para = (text) => ({ _type: 'block', _key: key(), style: 'normal', markDefs: [], children: [span(text)] })
const h2 = (text) => ({ _type: 'block', _key: key(), style: 'h2', markDefs: [], children: [span(text)] })
const stat = (value, label, source) => ({ _type: 'stat', _key: key(), value, label, source })
const paper = (quote, paperTitle, authors, venue, url) => ({ _type: 'paperQuote', _key: key(), quote, paperTitle, authors, venue, url })
const callout = (variant, title, body) => ({ _type: 'callout', _key: key(), variant, title, body })
const cta = (variant, title, body) => ({ _type: 'ctaInline', _key: key(), variant, title, body })

// ── PNG sólido pra capa (sem dep externa) ───────────────────────────────────
let CRC
function crc32(buf) {
  if (!CRC) { CRC = []; for (let n = 0; n < 256; n++) { let c = n; for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c } }
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function png(w, h, [r, g, b]) {
  const ck = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]) }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2
  const row = Buffer.concat([Buffer.from([0]), Buffer.concat(Array.from({ length: w }, () => Buffer.from([r, g, b])))])
  const raw = Buffer.concat(Array.from({ length: h }, () => row))
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), ck('IHDR', ihdr), ck('IDAT', zlib.deflateSync(raw)), ck('IEND', Buffer.alloc(0))])
}
const hexRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

async function uploadCover(hex, label) {
  const asset = await client.assets.upload('image', png(1200, 630, hexRgb(hex)), { filename: `cover-${label}.png` })
  return { _type: 'image', asset: { _type: 'reference', _ref: asset._id }, alt: `Capa: ${label}` }
}

// ── Categorias (7 pilares) ───────────────────────────────────────────────────
const CATEGORIES = [
  { n: 1, slug: 'mudanca-de-comportamento', title: 'Mudança de comportamento', color: '#EF4444', icon: '🔁', description: 'Como a IA mudou a forma de descobrir e comprar produtos.' },
  { n: 2, slug: 'geo-101', title: 'GEO 101', color: '#00E5FF', icon: '🎓', description: 'Educação fundamental sobre Otimização para Mecanismos Generativos.' },
  { n: 3, slug: 'ciencia-aplicada', title: 'Ciência aplicada', color: '#4ADE80', icon: '🔬', description: 'O que a pesquisa acadêmica prova sobre visibilidade em IA.' },
  { n: 4, slug: 'como-fazer', title: 'Como fazer', color: '#FACC15', icon: '🛠️', description: 'GEO na prática: passo a passo aplicável hoje.' },
  { n: 5, slug: 'demonstracoes', title: 'Demonstrações', color: '#A855F7', icon: '🎬', description: 'Antes e depois, testes ao vivo e provas visuais.' },
  { n: 6, slug: 'cases', title: 'Cases', color: '#FB923C', icon: '📊', description: 'Resultados reais de operação.' },
  { n: 7, slug: 'geo-brasil', title: 'GEO Brasil', color: '#22D3EE', icon: '🇧🇷', description: 'O estado do GEO no mercado brasileiro.' },
]
const catId = (slug) => `category-${slug}`

const TAGS = [
  { slug: 'chatgpt', title: 'ChatGPT' },
  { slug: 'perplexity', title: 'Perplexity' },
  { slug: 'seo', title: 'SEO' },
  { slug: 'papers', title: 'Pesquisa acadêmica' },
  { slug: 'mercado-livre', title: 'Mercado Livre' },
]
const tagId = (slug) => `tag-${slug}`

const AUTHOR_ID = 'author-silvio-junior'

async function run() {
  console.log('→ categorias…')
  for (const c of CATEGORIES) {
    await client.createOrReplace({
      _id: catId(c.slug), _type: 'category', title: c.title,
      slug: { _type: 'slug', current: c.slug }, description: c.description,
      pillarNumber: c.n, icon: c.icon, color: c.color,
    })
  }

  console.log('→ tags…')
  for (const t of TAGS) {
    await client.createOrReplace({
      _id: tagId(t.slug), _type: 'tag', title: t.title,
      slug: { _type: 'slug', current: t.slug },
    })
  }

  console.log('→ autor Silvio…')
  await client.createOrReplace({
    _id: AUTHOR_ID, _type: 'author', name: 'Silvio Junior',
    slug: { _type: 'slug', current: 'silvio-junior' },
    role: 'CEO e fundador da e-Click',
    bio: 'CEO e fundador da e-Click Inteligência Comercial (2010). Profissional de vendas desde 1998. Pesquisador aplicado em GEO (Generative Engine Optimization).',
    credentials: ['27+ anos em vendas', 'CEO e-Click', 'Operador Vazzo (catálogo 649+ anúncios)'],
    expertise: ['GEO', 'E-commerce', 'Mercado Livre', 'Inteligência Comercial', 'Marketplaces'],
    socialLinks: { linkedin: 'https://www.linkedin.com/company/eclick', website: 'https://eclick.app.br' },
  })

  // ── Posts ──────────────────────────────────────────────────────────────────
  const now = new Date().toISOString()

  console.log('→ capas…')
  const cover1 = await uploadCover('#EF4444', 'manifesto')
  const cover2 = await uploadCover('#00E5FF', 'geo-vs-seo')
  const cover3 = await uploadCover('#4ADE80', 'ciencia')

  const posts = [
    {
      _id: 'post-vitrine-da-ia-mudou',
      title: 'A vitrine das compras está migrando para dentro da resposta da IA',
      slug: 'vitrine-da-ia-mudou',
      category: catId('mudanca-de-comportamento'),
      cover: cover1,
      tags: ['chatgpt', 'mercado-livre'],
      readingTimeMinutes: 7,
      excerpt: 'Quando o cliente pergunta ao ChatGPT, ele não recebe uma lista de links — recebe uma resposta. Se a sua marca não está nessa resposta, você ficou invisível. Isso tem nome, tem ciência e quase ninguém no Brasil aplica.',
      metaDescription: 'A vitrine de compras está migrando para dentro da resposta da IA. Entenda o que é GEO, por que a janela de oportunidade é agora e como não ficar invisível.',
      tldr: [
        '60% das buscas hoje já terminam sem clique (SparkToro).',
        'Quando alguém pergunta ao ChatGPT, ele NÃO devolve uma lista de links — devolve UMA resposta.',
        'Se sua marca não está nessa resposta, você é invisível para esse cliente.',
        'Isso tem nome (GEO), tem ciência (KDD 2024, E-GEO 2025) e quase ninguém no Brasil aplica.',
        'A janela de oportunidade é agora.',
      ],
      aiPrompts: ['O que é GEO em marketing digital?', 'Por que minha loja não aparece no ChatGPT?', 'Como a IA escolhe quais produtos recomendar?'],
      faq: [
        { question: 'O que é GEO?', answer: 'GEO (Generative Engine Optimization, ou Otimização para Mecanismos Generativos) é a prática de estruturar seu conteúdo para que mecanismos de IA como ChatGPT, Gemini e Perplexity citem e recomendem seus produtos nas respostas que dão aos usuários.' },
        { question: 'GEO substitui o SEO?', answer: 'Não substitui — complementa. SEO te coloca em uma lista de links; GEO te coloca dentro da resposta gerada pela IA. Os dois convivem, mas o peso está migrando para o segundo.' },
        { question: 'Por que isso é urgente agora?', answer: 'Porque a maioria dos vendedores brasileiros ainda escreve para o algoritmo de busca do marketplace, não para a IA. Quem se estruturar primeiro ocupa o espaço enquanto a concorrência ainda nem percebeu a mudança.' },
      ],
      citationSources: [
        { title: 'Zero-click searches study', url: 'https://sparktoro.com/', authorOrOrg: 'SparkToro', year: 2024 },
        { title: 'GEO: Generative Engine Optimization', url: 'https://arxiv.org/abs/2311.09735', authorOrOrg: 'Princeton et al. (KDD)', year: 2024 },
      ],
      body: [
        para('Durante 20 anos, vender online significou aparecer numa lista. Você otimizava título, descrição e palavra-chave para subir alguns degraus no resultado de busca — e brigava por cliques. Esse jogo está mudando de lugar.'),
        para('Hoje, uma fatia enorme das pessoas não pesquisa mais "melhor abajur de cabeceira" e clica em dez links. Elas perguntam ao ChatGPT, ao Gemini ou ao Perplexity — e recebem uma resposta pronta, com recomendações específicas. A vitrine saiu da página de resultados e entrou dentro da resposta da IA.'),
        stat('60%', 'das buscas terminam sem nenhum clique', 'SparkToro, 2024'),
        h2('O problema: você foi escrito para o algoritmo errado'),
        para('O anúncio típico do Mercado Livre foi escrito para o motor de busca do próprio marketplace — recheado de palavra-chave, pensado para ranquear numa lista. Quando o comprador pergunta à IA "qual o melhor X para Y?", quem não tem dados concretos, contexto de uso e estrutura clara simplesmente não é citado.'),
        callout('warning', 'O risco silencioso', 'Você pode estar vendendo bem hoje e, ao mesmo tempo, ficando invisível para uma parcela crescente de compradores que já decide pela IA. A queda não aparece de uma vez — ela corrói aos poucos.'),
        h2('A boa notícia: dá para medir e dá para corrigir'),
        para('Isso não é achismo. Existe um campo de pesquisa dedicado a entender o que faz a IA citar uma fonte — e os resultados são replicáveis. Citar fontes, adicionar estatísticas e escrever com clareza aumentam mensuravelmente a chance de ser recomendado.'),
        paper('Citar fontes, adicionar estatísticas e melhorar a fluência aumentam a visibilidade em mecanismos generativos em até 40%.', 'GEO: Generative Engine Optimization', 'Aggarwal et al.', 'KDD 2024', 'https://arxiv.org/abs/2311.09735'),
        para('A janela de oportunidade é agora: enquanto a maioria dos vendedores brasileiros ainda nem ouviu falar de GEO, quem se estruturar primeiro ocupa o espaço na resposta da IA — o lugar onde a próxima geração de compras vai acontecer.'),
        cta('audit', 'Quer saber se a IA enxerga o seu anúncio?', 'Rode a auditoria gratuita: em 60 segundos você recebe a nota de visibilidade do seu anúncio nos motores de IA e os 3 problemas mais críticos.'),
      ],
    },
    {
      _id: 'post-geo-vs-seo',
      title: 'GEO vs SEO: o que mudou no jogo da visibilidade online',
      slug: 'geo-vs-seo',
      category: catId('geo-101'),
      cover: cover2,
      tags: ['seo', 'chatgpt'],
      readingTimeMinutes: 6,
      excerpt: 'SEO te coloca em uma lista. GEO te coloca dentro da resposta. E tem uma reviravolta: a técnica clássica de encher de palavra-chave, que ajudava no SEO, PIORA seu desempenho na IA.',
      metaDescription: 'GEO vs SEO: a diferença que muda tudo. SEO te coloca numa lista; GEO te coloca dentro da resposta da IA. Veja o que funciona — e o que piora.',
      tldr: [
        'SEO te coloca em uma LISTA. GEO te coloca DENTRO da resposta.',
        'Encher de palavra-chave (técnica clássica de SEO) PIORA o desempenho em IA.',
        'Citar fontes + adicionar estatísticas + clareza = +40% de visibilidade em IA.',
        'Sites de rank baixo se beneficiam MAIS (+115% para o 5º colocado).',
      ],
      aiPrompts: ['Qual a diferença entre GEO e SEO?', 'Keyword stuffing funciona na IA?', 'Como otimizar conteúdo para o ChatGPT?'],
      faq: [
        { question: 'GEO e SEO são a mesma coisa?', answer: 'Não. SEO otimiza para aparecer em uma lista de links de um buscador tradicional. GEO otimiza para ser citado dentro da resposta gerada por uma IA. As técnicas se sobrepõem em parte, mas têm diferenças importantes — algumas até opostas.' },
        { question: 'Keyword stuffing ajuda no GEO?', answer: 'Pelo contrário. A pesquisa do KDD 2024 mostrou que encher o texto de palavra-chave PIORA a visibilidade em mecanismos generativos. A IA valoriza clareza, fontes e dados — não repetição.' },
        { question: 'Quem ganha mais com GEO?', answer: 'Curiosamente, quem está em posições mais baixas. O estudo mostrou ganho de até +115% de visibilidade para o 5º colocado — ou seja, GEO nivela o jogo para quem não está no topo.' },
      ],
      citationSources: [
        { title: 'GEO: Generative Engine Optimization', url: 'https://arxiv.org/abs/2311.09735', authorOrOrg: 'Princeton et al. (KDD)', year: 2024 },
      ],
      body: [
        para('A pergunta certa não é "GEO ou SEO?". É entender que eles resolvem coisas diferentes — e que o que você aprendeu a fazer no SEO pode estar te prejudicando na IA.'),
        h2('A diferença em uma frase'),
        para('SEO te coloca em uma lista de links e torce para o clique. GEO te coloca dentro da resposta que a IA já entrega pronta — sem lista, sem clique intermediário. Em vez de competir por posição numa página, você compete por ser citado numa frase.'),
        {
          _type: 'comparison', _key: key(), title: 'SEO vs GEO na prática',
          leftLabel: 'SEO clássico', rightLabel: 'GEO',
          rows: [
            { _key: key(), aspect: 'Objetivo', left: 'Ranquear numa lista de links', right: 'Ser citado dentro da resposta' },
            { _key: key(), aspect: 'Palavra-chave', left: 'Repetir ajuda', right: 'Repetir atrapalha' },
            { _key: key(), aspect: 'Fontes e dados', left: 'Opcional', right: 'Decisivo (+40%)' },
            { _key: key(), aspect: 'Quem ganha', left: 'Quem já está no topo', right: 'Nivela para os de baixo (+115% p/ 5º)' },
          ],
        },
        h2('A reviravolta contraintuitiva'),
        para('Por anos, a cartilha do SEO mandou repetir a palavra-chave. Na IA, isso joga contra: a pesquisa mostra que keyword stuffing reduz a visibilidade. O motor generativo premia clareza, contexto e factualidade — não densidade de termo.'),
        stat('+40%', 'de visibilidade ao citar fontes e adicionar estatísticas', 'KDD 2024'),
        para('E há um efeito democratizante: os maiores ganhos vão para quem está em posições mais baixas. Para o 5º colocado, o estudo mediu até +115% de visibilidade — GEO é uma chance real para quem não domina o topo do ranking tradicional.'),
        cta('audit', 'O seu anúncio está otimizado para a lista ou para a resposta?', 'Descubra em 60 segundos com a auditoria gratuita.'),
      ],
    },
    {
      _id: 'post-ciencia-do-geo-papers',
      title: 'O que Princeton, Columbia e MIT provaram sobre fazer a IA recomendar seu produto',
      slug: 'ciencia-do-geo-papers',
      category: catId('ciencia-aplicada'),
      cover: cover3,
      tags: ['papers', 'perplexity'],
      readingTimeMinutes: 8,
      excerpt: 'Dois papers acadêmicos testaram, em escala, o que faz a IA citar uma fonte. As três estratégias vencedoras se repetem — e uma técnica famosa do SEO, surpreendentemente, piora tudo.',
      metaDescription: 'A ciência do GEO: o que os papers do KDD 2024 (Princeton) e E-GEO 2025 (Columbia + MIT) provaram sobre fazer a IA recomendar seu produto.',
      tldr: [
        'O paper KDD 2024 testou 9 estratégias em 10.000 consultas reais.',
        'Cite Sources, Statistics e Quotation foram as 3 vencedoras (+30-40%).',
        'Keyword Stuffing PIORA — resultado contraintuitivo.',
        'O E-GEO 2025 confirmou em e-commerce: existe uma receita universal.',
        '7 elementos formam a estratégia universalmente eficaz.',
      ],
      aiPrompts: ['Quais estratégias de GEO funcionam segundo a ciência?', 'O que o paper do KDD 2024 sobre GEO descobriu?', 'Como aumentar a visibilidade do meu produto na IA?'],
      faq: [
        { question: 'Quais foram as estratégias vencedoras?', answer: 'Citar fontes (Cite Sources), adicionar estatísticas (Statistics) e usar citações diretas (Quotation) — as três aumentaram a visibilidade entre 30% e 40% no estudo do KDD 2024.' },
        { question: 'O que NÃO funciona?', answer: 'Keyword Stuffing (encher de palavra-chave). Foi a única estratégia testada que piorou a visibilidade — um resultado contraintuitivo para quem vem do SEO tradicional.' },
        { question: 'Isso vale para e-commerce?', answer: 'Sim. O paper E-GEO 2025 (Columbia + MIT) replicou os achados especificamente em cenários de e-commerce e identificou uma "receita universal" com 7 elementos que tornam um produto mais recomendável pela IA.' },
      ],
      citationSources: [
        { title: 'GEO: Generative Engine Optimization', url: 'https://arxiv.org/abs/2311.09735', authorOrOrg: 'Aggarwal et al., Princeton', year: 2024 },
        { title: 'A Testbed for GEO in E-Commerce (E-GEO)', url: 'https://arxiv.org/', authorOrOrg: 'Columbia + MIT', year: 2025 },
      ],
      body: [
        para('GEO não é palpite de marketeiro — é um campo com método, amostra e resultado replicável. Dois trabalhos acadêmicos ancoram a prática, e vale entender o que cada um provou.'),
        h2('KDD 2024: 9 estratégias, 10.000 consultas'),
        para('O paper que cunhou o termo Generative Engine Optimization testou nove estratégias diferentes de conteúdo contra dez mil consultas reais, medindo quanto cada uma mudava a visibilidade da fonte na resposta gerada pela IA.'),
        paper('Métodos como citar fontes, adicionar estatísticas e incluir citações são os mais eficazes para aumentar a visibilidade em mecanismos generativos.', 'GEO: Generative Engine Optimization', 'Aggarwal et al.', 'KDD 2024', 'https://arxiv.org/abs/2311.09735'),
        para('As três vencedoras foram consistentes: Cite Sources, Statistics e Quotation, com ganhos na faixa de 30% a 40%. E a grande surpresa veio pelo lado negativo — Keyword Stuffing, a velha tática de SEO, foi a única que PIOROU o desempenho.'),
        stat('9', 'estratégias testadas em 10.000 consultas reais', 'KDD 2024'),
        h2('E-GEO 2025: a receita universal do e-commerce'),
        para('O segundo trabalho, de Columbia e MIT, levou o método para o terreno do e-commerce e confirmou: existe uma combinação de elementos que torna um produto mais recomendável pela IA — independente da categoria.'),
        callout('science', 'Os 7 elementos da estratégia universal', 'Intenção de uso clara, diferenciais concretos, dados e medidas, avaliações reais, factualidade, estrutura legível por máquina e citação de fontes. Juntos, formam a base do que a IA precisa para confiar e recomendar.'),
        para('A leitura prática é direta: não existe truque mágico, existe higiene de conteúdo orientada por evidência. Quem aplica esses elementos no anúncio aumenta sistematicamente a chance de ser a resposta — e não apenas mais um link.'),
        cta('audit', 'Quer ver quantos desses elementos o seu anúncio já tem?', 'A auditoria gratuita avalia seu anúncio em 8 dimensões baseadas exatamente nesses papers.'),
      ],
    },
  ]

  for (const p of posts) {
    console.log(`→ post ${p.slug}…`)
    await client.createOrReplace({
      _id: p._id,
      _type: 'post',
      title: p.title,
      slug: { _type: 'slug', current: p.slug },
      excerpt: p.excerpt,
      tldr: p.tldr,
      body: p.body,
      faq: p.faq.map((f) => ({ _type: 'faqItem', _key: key(), ...f })),
      metaDescription: p.metaDescription,
      aiPrompts: p.aiPrompts,
      citationSources: p.citationSources.map((s) => ({ _type: 'citationSource', _key: key(), ...s })),
      category: { _type: 'reference', _ref: p.category },
      tags: (p.tags || []).map((s) => ({ _type: 'reference', _key: key(), _ref: tagId(s) })),
      author: { _type: 'reference', _ref: AUTHOR_ID },
      coverImage: p.cover,
      publishedAt: now,
      updatedAt: now,
      readingTimeMinutes: p.readingTimeMinutes,
      status: 'published',
      newsletterSendOnPublish: false,
    })
  }

  console.log('\n✅ Seed concluído: 7 categorias + Silvio + 3 posts publicados.')
}

run().catch((e) => { console.error('Seed falhou:', e.message); process.exit(1) })
