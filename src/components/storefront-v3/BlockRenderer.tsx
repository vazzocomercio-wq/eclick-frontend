/**
 * Renderiza UM block v3 — switch por type.
 *
 * Server Component. Cada section que aceita blocks itera com este renderer
 * (ou implementa render proprio de blocks, conforme conveniencia).
 */

import type { Block } from '@/lib/storefront/v3/types'
import type { RenderCtx } from './RenderCtx'
import {
  Heading, Subheading, Paragraph, Image as ImageBlk, Video as VideoBlk,
  Button, Badge, Countdown, Divider, Spacer, Icon,
  ProductCardMini, CollectionLink, SocialIcon, Slide,
} from './blocks'

export function BlockRenderer({ ctx, block }: { ctx: RenderCtx; block: Block }) {
  switch (block.type) {
    case 'heading':         return <Heading ctx={ctx} block={block} />
    case 'subheading':      return <Subheading ctx={ctx} block={block} />
    case 'paragraph':       return <Paragraph ctx={ctx} block={block} />
    case 'image':           return <ImageBlk ctx={ctx} block={block} />
    case 'video':           return <VideoBlk ctx={ctx} block={block} />
    case 'button':          return <Button ctx={ctx} block={block} />
    case 'badge':           return <Badge ctx={ctx} block={block} />
    case 'countdown':       return <Countdown ctx={ctx} block={block} />
    case 'divider':         return <Divider ctx={ctx} block={block} />
    case 'spacer':          return <Spacer ctx={ctx} block={block} />
    case 'icon':            return <Icon ctx={ctx} block={block} />
    case 'productCardMini': return <ProductCardMini ctx={ctx} block={block} />
    case 'collectionLink':  return <CollectionLink ctx={ctx} block={block} />
    case 'socialIcon':      return <SocialIcon ctx={ctx} block={block} />
    case 'slide':           return <Slide ctx={ctx} block={block} />
  }
}
