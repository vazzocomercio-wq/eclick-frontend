import { defineType, defineField, defineArrayMember } from 'sanity'

/**
 * Post do blog — single source of truth do conteúdo.
 *
 * Grupos: Conteúdo, SEO/GEO, Metadados, Distribuição.
 * Campos GEO-críticos: tldr, faq, aiPrompts, citationSources, updatedAt.
 */
export default defineType({
  name: 'post',
  title: 'Post',
  type: 'document',
  groups: [
    { name: 'content', title: 'Conteúdo', default: true },
    { name: 'seo', title: 'SEO / GEO' },
    { name: 'meta', title: 'Metadados' },
    { name: 'distribution', title: 'Distribuição' },
  ],
  fields: [
    // ===== GRUPO: CONTENT =====
    defineField({
      name: 'title',
      title: 'Título',
      type: 'string',
      group: 'content',
      validation: (Rule) =>
        Rule.required().min(20).max(80).warning('Ideal entre 40-65 caracteres'),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      group: 'content',
      options: { source: 'title', maxLength: 80 },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'excerpt',
      title: 'Resumo (2-3 frases)',
      type: 'text',
      rows: 3,
      group: 'content',
      validation: (Rule) => Rule.required().min(80).max(280),
    }),
    defineField({
      name: 'tldr',
      title: 'TL;DR (3-5 bullets — aparece no topo do post)',
      type: 'array',
      of: [defineArrayMember({ type: 'string' })],
      group: 'content',
      validation: (Rule) => Rule.required().min(3).max(5),
    }),
    defineField({
      name: 'body',
      title: 'Conteúdo',
      type: 'array',
      group: 'content',
      of: [
        defineArrayMember({ type: 'block' }),
        defineArrayMember({ type: 'image', options: { hotspot: true }, fields: [
          { name: 'alt', type: 'string', title: 'Texto alternativo' },
          { name: 'caption', type: 'string', title: 'Legenda (opcional)' },
        ] }),
        defineArrayMember({ type: 'code', options: { withFilename: true } }),
        defineArrayMember({ type: 'callout' }),
        defineArrayMember({ type: 'paperQuote' }),
        defineArrayMember({ type: 'comparison' }),
        defineArrayMember({ type: 'stat' }),
        defineArrayMember({ type: 'ctaInline' }),
      ],
    }),
    defineField({
      name: 'faq',
      title: 'FAQ (3-7 perguntas — GEO booster)',
      type: 'array',
      group: 'content',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'faqItem',
          fields: [
            { name: 'question', type: 'string', title: 'Pergunta' },
            { name: 'answer', type: 'text', title: 'Resposta' },
          ],
          preview: {
            select: { title: 'question' },
          },
        }),
      ],
      validation: (Rule) => Rule.min(3).max(7).warning('Posts com FAQ ranqueiam melhor em IA'),
    }),

    // ===== GRUPO: SEO/GEO =====
    defineField({
      name: 'seoTitle',
      title: 'Título SEO (60-65 chars)',
      type: 'string',
      group: 'seo',
      validation: (Rule) => Rule.max(70),
    }),
    defineField({
      name: 'metaDescription',
      title: 'Meta description (140-160 chars)',
      type: 'text',
      rows: 2,
      group: 'seo',
      validation: (Rule) => Rule.min(120).max(165),
    }),
    defineField({
      name: 'focusKeyword',
      title: 'Palavra-chave foco',
      type: 'string',
      group: 'seo',
    }),
    defineField({
      name: 'aiPrompts',
      title: 'Perguntas que esse post responde (para LLMs)',
      type: 'array',
      group: 'seo',
      of: [defineArrayMember({ type: 'string' })],
      description:
        'Perguntas reais que usuários fazem ao ChatGPT/Perplexity que esse post responde. Usado em schema.org + estratégia GEO.',
      validation: (Rule) => Rule.min(3).max(10),
    }),
    defineField({
      name: 'citationSources',
      title: 'Fontes citadas no post',
      type: 'array',
      group: 'seo',
      description: 'Toda fonte externa citada. Crítico para GEO (paper KDD 2024 provou +40%).',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'citationSource',
          fields: [
            { name: 'title', type: 'string', title: 'Título da fonte' },
            { name: 'url', type: 'url', title: 'URL' },
            { name: 'authorOrOrg', type: 'string', title: 'Autor/Organização' },
            { name: 'year', type: 'number', title: 'Ano' },
          ],
          preview: {
            select: { title: 'title', subtitle: 'authorOrOrg' },
          },
        }),
      ],
    }),

    // ===== GRUPO: META =====
    defineField({
      name: 'category',
      title: 'Categoria (Pilar Editorial)',
      type: 'reference',
      group: 'meta',
      to: [{ type: 'category' }],
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'tags',
      title: 'Tags',
      type: 'array',
      group: 'meta',
      of: [defineArrayMember({ type: 'reference', to: [{ type: 'tag' }] })],
    }),
    defineField({
      name: 'author',
      title: 'Autor',
      type: 'reference',
      group: 'meta',
      to: [{ type: 'author' }],
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'coverImage',
      title: 'Imagem de capa',
      type: 'image',
      group: 'meta',
      options: { hotspot: true },
      fields: [
        {
          name: 'alt',
          type: 'string',
          title: 'Texto alternativo',
          validation: (Rule) => Rule.required(),
        },
        { name: 'caption', type: 'string', title: 'Legenda (opcional)' },
      ],
    }),
    defineField({
      name: 'publishedAt',
      title: 'Publicado em',
      type: 'datetime',
      group: 'meta',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'updatedAt',
      title: 'Atualizado em',
      type: 'datetime',
      group: 'meta',
      description: 'IMPORTANTE para GEO: LLMs priorizam conteúdo recente.',
    }),
    defineField({
      name: 'readingTimeMinutes',
      title: 'Tempo de leitura (min)',
      type: 'number',
      group: 'meta',
    }),
    defineField({
      name: 'status',
      title: 'Status editorial',
      type: 'string',
      group: 'meta',
      options: {
        list: [
          { title: '📝 Rascunho', value: 'draft' },
          { title: '👀 Em revisão', value: 'review' },
          { title: '✅ Aprovado', value: 'approved' },
          { title: '🚀 Publicado', value: 'published' },
          { title: '🗄️ Arquivado', value: 'archived' },
        ],
        layout: 'radio',
      },
      initialValue: 'draft',
      validation: (Rule) => Rule.required(),
    }),

    // ===== GRUPO: DISTRIBUTION =====
    defineField({
      name: 'newsletterSendOnPublish',
      title: 'Enviar via newsletter ao publicar?',
      type: 'boolean',
      group: 'distribution',
      initialValue: true,
    }),
    defineField({
      name: 'socialDistribution',
      title: 'Plataformas para distribuição automática',
      type: 'array',
      group: 'distribution',
      of: [defineArrayMember({ type: 'string' })],
      options: {
        list: [
          { title: 'LinkedIn (perfil Silvio)', value: 'linkedin-personal' },
          { title: 'LinkedIn (página e-Click)', value: 'linkedin-company' },
          { title: 'Twitter/X', value: 'twitter' },
        ],
      },
    }),
    defineField({
      name: 'series',
      title: 'Série (se aplicável)',
      type: 'reference',
      group: 'distribution',
      to: [{ type: 'series' }],
    }),
    defineField({
      name: 'relatedPosts',
      title: 'Posts relacionados (manual)',
      type: 'array',
      group: 'distribution',
      of: [defineArrayMember({ type: 'reference', to: [{ type: 'post' }] })],
      validation: (Rule) => Rule.max(3),
    }),
  ],
  preview: {
    select: {
      title: 'title',
      status: 'status',
      category: 'category.title',
      author: 'author.name',
      media: 'coverImage',
    },
    prepare({ title, status, category, author, media }) {
      const statusEmoji: Record<string, string> = {
        draft: '📝',
        review: '👀',
        approved: '✅',
        published: '🚀',
        archived: '🗄️',
      }
      return {
        title: `${statusEmoji[status] || ''} ${title}`,
        subtitle: `${category || 'Sem categoria'} · ${author || 'Sem autor'}`,
        media,
      }
    },
  },
  orderings: [
    {
      title: 'Mais recente publicado',
      name: 'publishedDesc',
      by: [{ field: 'publishedAt', direction: 'desc' }],
    },
    {
      title: 'Em produção',
      name: 'productionStatus',
      by: [
        { field: 'status', direction: 'asc' },
        { field: 'updatedAt', direction: 'desc' },
      ],
    },
  ],
})
