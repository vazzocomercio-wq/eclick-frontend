import { defineType, defineField } from 'sanity'

/** Estatística destacada (número grande + label + fonte). GEO booster. */
export default defineType({
  name: 'stat',
  title: 'Estatística Destacada',
  type: 'object',
  fields: [
    defineField({ name: 'value', title: 'Valor (ex: 99%, +40%, 649)', type: 'string', validation: (Rule) => Rule.required() }),
    defineField({ name: 'label', title: 'Descrição', type: 'string', validation: (Rule) => Rule.required() }),
    defineField({ name: 'source', title: 'Fonte', type: 'string' }),
  ],
  preview: {
    select: { value: 'value', label: 'label' },
    prepare({ value, label }) {
      return { title: `${value} — ${label}`, subtitle: 'Estatística' }
    },
  },
})
