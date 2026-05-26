import { defineType, defineField } from 'sanity'

export default defineType({
  name: 'series',
  title: 'Série',
  type: 'document',
  fields: [
    defineField({ name: 'title', title: 'Título', type: 'string', validation: (Rule) => Rule.required() }),
    defineField({ name: 'slug', title: 'Slug', type: 'slug', options: { source: 'title' }, validation: (Rule) => Rule.required() }),
    defineField({ name: 'description', title: 'Descrição', type: 'text', rows: 3 }),
  ],
  preview: { select: { title: 'title' } },
})
