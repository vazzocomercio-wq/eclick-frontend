import { defineType, defineField } from 'sanity'

/**
 * Categoria = pilar editorial. 7 pilares iniciais (ver README).
 * `color` / `icon` alimentam a navegação por pilar na home do blog.
 */
export default defineType({
  name: 'category',
  title: 'Categoria',
  type: 'document',
  fields: [
    defineField({ name: 'title', title: 'Título', type: 'string', validation: (Rule) => Rule.required() }),
    defineField({ name: 'slug', title: 'Slug', type: 'slug', options: { source: 'title' }, validation: (Rule) => Rule.required() }),
    defineField({ name: 'description', title: 'Descrição', type: 'text', rows: 2 }),
    defineField({
      name: 'pillarNumber',
      title: 'Número do pilar (1-7)',
      type: 'number',
      validation: (Rule) => Rule.min(1).max(7),
    }),
    defineField({ name: 'icon', title: 'Ícone (emoji ou nome Lucide)', type: 'string' }),
    defineField({ name: 'color', title: 'Cor de destaque (hex)', type: 'string', description: 'Ex: #00E5FF' }),
  ],
  orderings: [
    { title: 'Por pilar', name: 'pillarAsc', by: [{ field: 'pillarNumber', direction: 'asc' }] },
  ],
  preview: {
    select: { title: 'title', subtitle: 'pillarNumber' },
    prepare({ title, subtitle }) {
      return { title, subtitle: subtitle ? `Pilar ${subtitle}` : 'Sem pilar' }
    },
  },
})
