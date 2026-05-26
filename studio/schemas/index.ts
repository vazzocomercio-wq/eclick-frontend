import post from './documents/post'
import author from './documents/author'
import category from './documents/category'
import tag from './documents/tag'
import series from './documents/series'

import callout from './blocks/callout'
import paperQuote from './blocks/paperQuote'
import stat from './blocks/stat'
import comparison from './blocks/comparison'
import ctaInline from './blocks/ctaInline'

/** Todos os tipos registrados no Studio. Documentos + blocks do corpo do post. */
export const schemaTypes = [
  // Documentos
  post,
  author,
  category,
  tag,
  series,
  // Blocks do Portable Text (corpo do post)
  callout,
  paperQuote,
  stat,
  comparison,
  ctaInline,
]
