import { defineType, defineField } from 'sanity'

/** Citação de paper acadêmico (reforça autoridade — GEO booster). */
export default defineType({
  name: 'paperQuote',
  title: 'Citação de Paper Acadêmico',
  type: 'object',
  fields: [
    defineField({ name: 'quote', title: 'Citação', type: 'text', rows: 3, validation: (Rule) => Rule.required() }),
    defineField({ name: 'paperTitle', title: 'Título do paper', type: 'string' }),
    defineField({ name: 'authors', title: 'Autores', type: 'string' }),
    defineField({ name: 'venue', title: 'Veículo (ex: KDD 2024)', type: 'string' }),
    defineField({ name: 'url', title: 'URL', type: 'url' }),
  ],
  preview: {
    select: { title: 'paperTitle', subtitle: 'venue', quote: 'quote' },
    prepare({ title, subtitle, quote }) {
      return { title: title || quote || 'Citação', subtitle: subtitle ? `Paper · ${subtitle}` : 'Paper' }
    },
  },
})
