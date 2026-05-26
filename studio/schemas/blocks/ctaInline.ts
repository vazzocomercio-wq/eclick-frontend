import { defineType, defineField } from 'sanity'

/** CTA inline no meio do post (auditoria, demo, lead magnet). Link rastreado. */
export default defineType({
  name: 'ctaInline',
  title: 'CTA Inline',
  type: 'object',
  fields: [
    defineField({
      name: 'variant',
      title: 'Objetivo',
      type: 'string',
      options: {
        list: [
          { title: 'Auditoria GEO grátis', value: 'audit' },
          { title: 'Conhecer a plataforma', value: 'demo' },
          { title: 'Newsletter', value: 'newsletter' },
          { title: 'Custom', value: 'custom' },
        ],
        layout: 'radio',
      },
      initialValue: 'audit',
    }),
    defineField({ name: 'title', title: 'Título', type: 'string', validation: (Rule) => Rule.required() }),
    defineField({ name: 'body', title: 'Texto de apoio', type: 'text', rows: 2 }),
    defineField({ name: 'buttonLabel', title: 'Texto do botão', type: 'string' }),
    defineField({ name: 'href', title: 'Link (vazio = usa o padrão do objetivo)', type: 'string' }),
  ],
  preview: {
    select: { title: 'title', variant: 'variant' },
    prepare({ title, variant }) {
      return { title: title || 'CTA', subtitle: `CTA inline · ${variant || 'audit'}` }
    },
  },
})
