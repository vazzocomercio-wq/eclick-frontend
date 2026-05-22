'use client'

/**
 * Editor da seção `roomVisualizer` no Designer v3. Só o conteúdo do bloco
 * promocional (título + descrição); créditos, funil e cupom ficam em
 * Loja > Ambientador IA.
 */

import type { RoomVisualizerSection } from '@/lib/storefront/v3/types'
import { Field, Input, Textarea } from './primitives'

type Settings = RoomVisualizerSection['settings']

export function RoomVisualizerEditor({ settings, onChange }: {
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
}) {
  return (
    <>
      <Field label="Título">
        <Input value={settings.title ?? ''} onChange={v => onChange({ title: v || undefined })} placeholder="Veja no seu ambiente" />
      </Field>
      <Field label="Descrição">
        <Textarea value={settings.description ?? ''} onChange={v => onChange({ description: v || undefined })} rows={3} />
      </Field>
      <p style={{ fontSize: 11, color: '#71717a', marginTop: 4, lineHeight: 1.5 }}>
        Créditos, funil do Active e cupom são configurados em <strong style={{ color: '#a1a1aa' }}>Loja &gt; Ambientador IA</strong>.
        Em página de produto, o botão abre pro produto que o cliente está vendo.
      </p>
    </>
  )
}
