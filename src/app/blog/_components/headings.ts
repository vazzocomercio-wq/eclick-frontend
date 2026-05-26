import type { PortableTextBlock } from '@portabletext/types'

interface BlockChild {
  text?: string
}

/** Texto plano de um bloco Portable Text. */
export function blockText(block: PortableTextBlock): string {
  const children = (block as { children?: BlockChild[] }).children ?? []
  return children.map((c) => c.text ?? '').join('')
}

/** Slug estável de um heading (usado por PostBody e TableOfContents — devem casar). */
export function headingId(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80)
}

export interface Heading {
  id: string
  text: string
  level: 2 | 3
}

/** Extrai H2/H3 do corpo pra montar o índice (TOC). */
export function extractHeadings(body: PortableTextBlock[] = []): Heading[] {
  const out: Heading[] = []
  for (const block of body) {
    if (block._type !== 'block') continue
    const style = (block as { style?: string }).style
    if (style !== 'h2' && style !== 'h3') continue
    const text = blockText(block)
    if (!text) continue
    out.push({ id: headingId(text), text, level: style === 'h2' ? 2 : 3 })
  }
  return out
}
