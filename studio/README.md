# e-Click Blog Studio (Sanity)

CMS headless do blog GEO (`eclick.app.br/blog`). O conteúdo dos posts vive
**aqui** (single source of truth). O Active CRM gerencia briefing/pipeline/métricas,
mas nunca duplica `body`/`excerpt`.

## Setup

```bash
cd studio
cp .env.example .env      # preencher SANITY_STUDIO_PROJECT_ID
npm install
npm run dev               # http://localhost:3333
```

Variáveis (`.env`):

- `SANITY_STUDIO_PROJECT_ID` — Project ID do dashboard Sanity
- `SANITY_STUDIO_DATASET` — `production`

## Deploy do Studio

```bash
npm run deploy            # publica em https://eclick-blog.sanity.studio
```

Para `studio.eclick.app.br`: apontar CNAME no DNS → `eclick-blog.sanity.studio`.

## Schemas

- `documents/post.ts` — post (grupos: Conteúdo, SEO/GEO, Metadados, Distribuição)
- `documents/author.ts` — autor (E-E-A-T: bio, credenciais, social)
- `documents/category.ts` — os 7 pilares editoriais
- `documents/tag.ts`, `documents/series.ts`
- `blocks/*` — blocks customizados do corpo: callout, paperQuote, stat, comparison, ctaInline

## Categorias iniciais (popular no Studio)

| # | Pilar | Cor |
|---|---|---|
| 1 | Mudança de comportamento | `#EF4444` |
| 2 | GEO 101 | `#00E5FF` |
| 3 | Ciência aplicada | `#4ADE80` |
| 4 | Como fazer | `#FACC15` |
| 5 | Demonstrações | `#A855F7` |
| 6 | Cases | `#FB923C` |
| 7 | GEO Brasil | `#22D3EE` |

Autor inicial: **Silvio Junior** — CEO e fundador da e-Click (2010), vendas desde 1998.
