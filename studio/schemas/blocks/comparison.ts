import { defineType, defineField, defineArrayMember } from 'sanity'

/** Tabela comparativa (ex: GEO vs SEO). Linhas com 2 colunas + título de cada lado. */
export default defineType({
  name: 'comparison',
  title: 'Tabela Comparativa',
  type: 'object',
  fields: [
    defineField({ name: 'title', title: 'Título da tabela', type: 'string' }),
    defineField({ name: 'leftLabel', title: 'Coluna esquerda (ex: SEO)', type: 'string', validation: (Rule) => Rule.required() }),
    defineField({ name: 'rightLabel', title: 'Coluna direita (ex: GEO)', type: 'string', validation: (Rule) => Rule.required() }),
    defineField({
      name: 'rows',
      title: 'Linhas',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'comparisonRow',
          fields: [
            { name: 'aspect', type: 'string', title: 'Aspecto' },
            { name: 'left', type: 'text', rows: 2, title: 'Lado esquerdo' },
            { name: 'right', type: 'text', rows: 2, title: 'Lado direito' },
          ],
          preview: { select: { title: 'aspect', subtitle: 'left' } },
        }),
      ],
      validation: (Rule) => Rule.min(1),
    }),
  ],
  preview: {
    select: { title: 'title', left: 'leftLabel', right: 'rightLabel' },
    prepare({ title, left, right }) {
      return { title: title || `${left} vs ${right}`, subtitle: 'Tabela comparativa' }
    },
  },
})
