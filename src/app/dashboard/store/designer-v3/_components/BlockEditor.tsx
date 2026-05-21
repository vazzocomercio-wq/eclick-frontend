'use client'

/**
 * BlockEditor — switch por block.type que renderiza form de edicao do
 * settings do bloco. Usado pelo BlockListEditor (que vive dentro do
 * SectionInspector).
 *
 * Cada caso e curto e inline (sem arquivos separados por block type —
 * blocos sao simples). Reusa primitives.tsx.
 */

import type { Block } from '@/lib/storefront/v3/types'
import { Field, Input, Textarea, NumberInput, Select, Toggle } from './primitives'
import { ImageUploadField } from '@/components/storefront/ImageUploadField'

type Align = 'left' | 'center' | 'right'

interface Props {
  block:    Block
  onChange: (next: Block) => void
}

export function BlockEditor({ block, onChange }: Props) {
  // Helper tipado pra atualizar settings sem perder discriminator.
  const setSettings = (patch: Partial<Block['settings']>) =>
    onChange({ ...block, settings: { ...block.settings, ...patch } } as Block)

  switch (block.type) {
    case 'heading':
      return (
        <>
          <Field label="Texto"><Input value={block.settings.text} onChange={v => setSettings({ text: v })} /></Field>
          <Field label="Nível">
            <Select value={String(block.settings.level)}
              options={[['1','H1 — Título principal'], ['2','H2'], ['3','H3'], ['4','H4']]}
              onChange={v => setSettings({ level: parseInt(v) as 1 | 2 | 3 | 4 })} />
          </Field>
          <Field label="Alinhamento">
            <Select value={block.settings.align}
              options={[['left','Esquerda'],['center','Centro'],['right','Direita']] as ReadonlyArray<readonly [Align, string]>}
              onChange={v => setSettings({ align: v })} />
          </Field>
        </>
      )
    case 'subheading':
    case 'paragraph':
      return (
        <>
          <Field label="Texto"><Textarea value={block.settings.text} onChange={v => setSettings({ text: v })} /></Field>
          <Field label="Alinhamento">
            <Select value={block.settings.align}
              options={[['left','Esquerda'],['center','Centro'],['right','Direita']] as ReadonlyArray<readonly [Align, string]>}
              onChange={v => setSettings({ align: v })} />
          </Field>
        </>
      )
    case 'image':
      return (
        <>
          <Field label="Imagem">
            <ImageUploadField value={block.settings.url} onChange={v => setSettings({ url: v })}
              previewMaxWidth={200} downscaleMaxWidth={1600} />
          </Field>
          <Field label="Texto alternativo (alt)"><Input value={block.settings.alt} onChange={v => setSettings({ alt: v })} /></Field>
          <Field label="Link (opcional)"><Input value={block.settings.link ?? ''} onChange={v => setSettings({ link: v || undefined })} placeholder="/produtos" /></Field>
          <Field label="Proporção">
            <Select value={block.settings.aspectRatio}
              options={[['1:1','Quadrado'],['4:5','Retrato 4:5'],['16:9','Wide 16:9'],['3:2','Foto 3:2'],['free','Livre']]}
              onChange={v => setSettings({ aspectRatio: v as 'free' | '1:1' | '4:5' | '16:9' | '3:2' })} />
          </Field>
          <Field label="Ajuste">
            <Select value={block.settings.objectFit}
              options={[['cover','Cobrir (corta)'],['contain','Caber (sem cortar)']]}
              onChange={v => setSettings({ objectFit: v as 'cover' | 'contain' })} />
          </Field>
        </>
      )
    case 'video':
      return (
        <>
          <Field label="URL do vídeo (mp4, YouTube, Vimeo)"><Input value={block.settings.url} onChange={v => setSettings({ url: v })} /></Field>
          <Field label="Reproduzir automaticamente"><Toggle value={block.settings.autoplay} onChange={v => setSettings({ autoplay: v })} /></Field>
          <Field label="Em loop"><Toggle value={block.settings.loop} onChange={v => setSettings({ loop: v })} /></Field>
          <Field label="Sem áudio (muted)"><Toggle value={block.settings.muted} onChange={v => setSettings({ muted: v })} /></Field>
          <Field label="Mostrar controles"><Toggle value={block.settings.controls} onChange={v => setSettings({ controls: v })} /></Field>
        </>
      )
    case 'button':
      return (
        <>
          <Field label="Texto do botão"><Input value={block.settings.label} onChange={v => setSettings({ label: v })} /></Field>
          <Field label="Link"><Input value={block.settings.href} onChange={v => setSettings({ href: v })} placeholder="/produtos" /></Field>
          <Field label="Estilo">
            <Select value={block.settings.style}
              options={[['primary','Primário (cor de destaque)'],['secondary','Secundário (outline)'],['ghost','Discreto']]}
              onChange={v => setSettings({ style: v as 'primary' | 'secondary' | 'ghost' })} />
          </Field>
          <Field label="Tamanho">
            <Select value={block.settings.size}
              options={[['sm','Pequeno'],['md','Médio'],['lg','Grande']]}
              onChange={v => setSettings({ size: v as 'sm' | 'md' | 'lg' })} />
          </Field>
          <Field label="Abrir em nova aba"><Toggle value={block.settings.newTab} onChange={v => setSettings({ newTab: v })} /></Field>
        </>
      )
    case 'badge':
      return (
        <>
          <Field label="Texto"><Input value={block.settings.text} onChange={v => setSettings({ text: v })} /></Field>
          <Field label="Cor">
            <Select value={block.settings.color}
              options={[['primary','Primária'],['success','Sucesso (verde)'],['error','Erro (vermelho)'],['warning','Aviso (amarelo)']]}
              onChange={v => setSettings({ color: v as 'primary' | 'success' | 'error' | 'warning' })} />
          </Field>
        </>
      )
    case 'countdown':
      return (
        <>
          <Field label="Data/hora final (ISO)" hint="Ex.: 2026-12-31T23:59:59">
            <Input value={block.settings.endsAt} onChange={v => setSettings({ endsAt: v })} placeholder="2026-12-31T23:59:59" />
          </Field>
          <Field label="Rótulo (opcional)">
            <Input value={block.settings.label ?? ''} onChange={v => setSettings({ label: v || undefined })} placeholder="Termina em:" />
          </Field>
        </>
      )
    case 'divider':
      return (
        <>
          <Field label="Estilo">
            <Select value={block.settings.style}
              options={[['solid','Sólida'],['dashed','Tracejada'],['dotted','Pontilhada']]}
              onChange={v => setSettings({ style: v as 'solid' | 'dashed' | 'dotted' })} />
          </Field>
          <Field label="Cor (hex — opcional)">
            <Input value={block.settings.color ?? ''} onChange={v => setSettings({ color: v || undefined })} placeholder="#cccccc" />
          </Field>
        </>
      )
    case 'spacer':
      return (
        <Field label="Altura (px)">
          <NumberInput value={block.settings.height} onChange={v => setSettings({ height: v })} min={0} max={400} />
        </Field>
      )
    case 'icon':
      return (
        <>
          <Field label="Nome do ícone (lucide)" hint="Ex.: Star, Heart, ShoppingCart">
            <Input value={block.settings.name} onChange={v => setSettings({ name: v })} />
          </Field>
          <Field label="Tamanho (px)">
            <NumberInput value={block.settings.size} onChange={v => setSettings({ size: v })} min={12} max={96} />
          </Field>
          <Field label="Cor (hex — opcional)">
            <Input value={block.settings.color ?? ''} onChange={v => setSettings({ color: v || undefined })} placeholder="#00E5FF" />
          </Field>
        </>
      )
    case 'productCardMini':
      return (
        <>
          <Field label="ID do produto"><Input value={block.settings.productId} onChange={v => setSettings({ productId: v })} /></Field>
          <Field label="Mostrar preço"><Toggle value={block.settings.showPrice} onChange={v => setSettings({ showPrice: v })} /></Field>
          <Field label="Mostrar CTA"><Toggle value={block.settings.showCta} onChange={v => setSettings({ showCta: v })} /></Field>
        </>
      )
    case 'collectionLink':
      return (
        <>
          <Field label="ID da coleção"><Input value={block.settings.collectionId} onChange={v => setSettings({ collectionId: v })} /></Field>
          <Field label="Rótulo"><Input value={block.settings.label} onChange={v => setSettings({ label: v })} /></Field>
          <Field label="URL da imagem (opcional)">
            <Input value={block.settings.imageUrl ?? ''} onChange={v => setSettings({ imageUrl: v || undefined })} />
          </Field>
        </>
      )
    case 'socialIcon':
      return (
        <>
          <Field label="Rede">
            <Select value={block.settings.network}
              options={[
                ['instagram','Instagram'],['facebook','Facebook'],['tiktok','TikTok'],
                ['youtube','YouTube'],['twitter','X / Twitter'],['whatsapp','WhatsApp'],['pinterest','Pinterest'],
              ]}
              onChange={v => setSettings({ network: v as 'instagram' | 'facebook' | 'tiktok' | 'youtube' | 'twitter' | 'whatsapp' | 'pinterest' })} />
          </Field>
          <Field label="Link"><Input value={block.settings.href} onChange={v => setSettings({ href: v })} placeholder="https://..." /></Field>
        </>
      )
    case 'slide':
      return (
        <>
          <Field label="Imagem do slide">
            <ImageUploadField value={block.settings.imageUrl} onChange={v => setSettings({ imageUrl: v })}
              previewMaxWidth={240} downscaleMaxWidth={1920} />
          </Field>
          <Field label="Título"><Input value={block.settings.headline ?? ''} onChange={v => setSettings({ headline: v || undefined })} /></Field>
          <Field label="Subtítulo"><Input value={block.settings.subheadline ?? ''} onChange={v => setSettings({ subheadline: v || undefined })} /></Field>
          <Field label="Texto do botão (opcional)"><Input value={block.settings.ctaLabel ?? ''} onChange={v => setSettings({ ctaLabel: v || undefined })} /></Field>
          <Field label="Link do botão"><Input value={block.settings.ctaHref ?? ''} onChange={v => setSettings({ ctaHref: v || undefined })} /></Field>
          <Field label="Cor do texto (hex — opcional)">
            <Input value={block.settings.textColor ?? ''} onChange={v => setSettings({ textColor: v || undefined })} placeholder="#ffffff" />
          </Field>
          <Field label="Alinhamento">
            <Select value={block.settings.textAlign ?? 'left'}
              options={[['left','Esquerda'],['center','Centro'],['right','Direita']] as ReadonlyArray<readonly [Align, string]>}
              onChange={v => setSettings({ textAlign: v })} />
          </Field>
        </>
      )
  }
}
