import { defineType, defineField } from 'sanity'

/** Box destacado no corpo do post (info, alerta, dica, ciência, case). */
export default defineType({
  name: 'callout',
  title: 'Callout Box',
  type: 'object',
  fields: [
    defineField({
      name: 'variant',
      title: 'Tipo',
      type: 'string',
      options: {
        list: [
          { title: 'ℹ️ Info', value: 'info' },
          { title: '⚠️ Alerta', value: 'warning' },
          { title: '💡 Dica', value: 'tip' },
          { title: '🔬 Ciência', value: 'science' },
          { title: '📊 Case', value: 'case' },
        ],
        layout: 'radio',
      },
      initialValue: 'info',
    }),
    defineField({ name: 'title', title: 'Título', type: 'string' }),
    defineField({ name: 'body', title: 'Texto', type: 'text', rows: 4 }),
  ],
  preview: {
    select: { title: 'title', variant: 'variant', body: 'body' },
    prepare({ title, variant, body }) {
      return { title: title || body || 'Callout', subtitle: `Callout · ${variant || 'info'}` }
    },
  },
})
