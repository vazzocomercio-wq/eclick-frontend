import { defineType, defineField } from 'sanity'

/**
 * Config global do blog (singleton). Hoje só a fonte de display padrão —
 * escolhida normalmente pelo Estúdio do Active, que escreve este doc
 * (_id fixo "siteSettings"). O site público lê daqui.
 */
export default defineType({
  name: 'siteSettings',
  title: 'Configurações do Blog',
  type: 'document',
  fields: [
    defineField({
      name: 'blogDisplayFont',
      title: 'Fonte de título (padrão do blog)',
      type: 'string',
      description: 'Slug da família de fonte aplicada aos títulos. Ex: clash, space-grotesk, sora, outfit, manrope, inter-tight, chivo, archivo, syne, exo2, unbounded, lexend.',
      options: {
        list: [
          { title: 'Clash Display', value: 'clash' },
          { title: 'Space Grotesk', value: 'space-grotesk' },
          { title: 'Sora', value: 'sora' },
          { title: 'Outfit', value: 'outfit' },
          { title: 'Manrope', value: 'manrope' },
          { title: 'Inter Tight', value: 'inter-tight' },
          { title: 'Chivo', value: 'chivo' },
          { title: 'Archivo', value: 'archivo' },
          { title: 'Syne', value: 'syne' },
          { title: 'Exo 2', value: 'exo2' },
          { title: 'Unbounded', value: 'unbounded' },
          { title: 'Lexend', value: 'lexend' },
        ],
      },
      initialValue: 'clash',
    }),
  ],
  preview: {
    prepare() {
      return { title: 'Configurações do Blog' }
    },
  },
})
