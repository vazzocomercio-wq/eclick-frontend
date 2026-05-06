'use client'

import { useState } from 'react'
import { Palette, Globe, Volume2, Image as ImageIcon, Maximize2 } from 'lucide-react'
import {
  MARKETPLACE_OPTIONS,
  VISUAL_STYLES,
  ENVIRONMENT_OPTIONS,
  TONE_OPTIONS,
  IMAGE_COUNT_OPTIONS,
  IMAGE_FORMAT_OPTIONS,
  type Marketplace,
} from './types'

export interface BriefingFormState {
  target_marketplace:  Marketplace
  visual_style:        string
  environment:         string
  custom_environment:  string
  background_color:    string
  use_logo:            boolean
  communication_tone:  string
  image_count:         number
  image_format:        string
}

export const DEFAULT_BRIEFING: BriefingFormState = {
  target_marketplace: 'mercado_livre',
  visual_style:       'clean',
  environment:        'neutro',
  custom_environment: '',
  background_color:   '#FFFFFF',
  use_logo:           false,
  communication_tone: 'vendedor',
  image_count:        10,
  image_format:       '1200x1200',
}

interface Props {
  value:    BriefingFormState
  onChange: (next: BriefingFormState) => void
}

export default function BriefingConfigurator({ value, onChange }: Props) {
  const set = <K extends keyof BriefingFormState>(k: K, v: BriefingFormState[K]) =>
    onChange({ ...value, [k]: v })

  return (
    <div className="space-y-6">
      {/* Marketplace */}
      <Section icon={<Globe size={14} />} title="Marketplace alvo" >
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {MARKETPLACE_OPTIONS.map(o => (
            <ChipButton
              key={o.value}
              active={value.target_marketplace === o.value}
              onClick={() => set('target_marketplace', o.value)}
            >
              <span>{o.emoji}</span>
              <span>{o.label}</span>
            </ChipButton>
          ))}
        </div>
      </Section>

      {/* Estilo visual */}
      <Section icon={<Palette size={14} />} title="Estilo visual">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {VISUAL_STYLES.map(s => (
            <ChipButton
              key={s.value}
              active={value.visual_style === s.value}
              onClick={() => set('visual_style', s.value)}
              title={s.description}
            >
              {s.label}
            </ChipButton>
          ))}
        </div>
      </Section>

      {/* Ambiente */}
      <Section icon={<ImageIcon size={14} />} title="Ambiente">
        <div className="flex flex-wrap gap-1.5">
          {ENVIRONMENT_OPTIONS.map(e => (
            <SmallChip
              key={e.value}
              active={value.environment === e.value}
              onClick={() => set('environment', e.value)}
            >
              {e.label}
            </SmallChip>
          ))}
        </div>
        {value.environment === 'custom' && (
          <input
            type="text"
            value={value.custom_environment}
            onChange={e => set('custom_environment', e.target.value)}
            placeholder="Descreva o ambiente personalizado"
            className="mt-3 w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-cyan-400"
          />
        )}
      </Section>

      {/* Cor de fundo + logo */}
      <Section icon={<Palette size={14} />} title="Identidade visual">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-zinc-500">Cor de fundo</label>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="color"
                value={value.background_color}
                onChange={e => set('background_color', e.target.value)}
                className="h-9 w-12 rounded border border-zinc-800 bg-zinc-950 cursor-pointer"
              />
              <input
                type="text"
                value={value.background_color}
                onChange={e => set('background_color', e.target.value)}
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 font-mono outline-none focus:border-cyan-400"
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] text-zinc-500">Logo da marca</label>
            <button
              type="button"
              onClick={() => set('use_logo', !value.use_logo)}
              className={[
                'mt-1 w-full rounded-lg border px-3 py-2 text-xs transition-colors',
                value.use_logo
                  ? 'border-cyan-400 bg-cyan-400/10 text-cyan-200'
                  : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700',
              ].join(' ')}
            >
              {value.use_logo ? '✓ Incluir logo nas imagens' : 'Sem logo'}
            </button>
          </div>
        </div>
      </Section>

      {/* Tom */}
      <Section icon={<Volume2 size={14} />} title="Tom de comunicação">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {TONE_OPTIONS.map(t => (
            <ChipButton
              key={t.value}
              active={value.communication_tone === t.value}
              onClick={() => set('communication_tone', t.value)}
              title={t.description}
            >
              {t.label}
            </ChipButton>
          ))}
        </div>
      </Section>

      {/* Imagens — qtde + formato */}
      <Section icon={<Maximize2 size={14} />} title="Imagens">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-zinc-500">Quantidade</label>
            <div className="flex gap-1.5 mt-1">
              {IMAGE_COUNT_OPTIONS.map(n => (
                <SmallChip
                  key={n}
                  active={value.image_count === n}
                  onClick={() => set('image_count', n)}
                >
                  {n} imagens
                </SmallChip>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[11px] text-zinc-500">Formato</label>
            <div className="flex gap-1.5 mt-1 flex-wrap">
              {IMAGE_FORMAT_OPTIONS.map(f => (
                <SmallChip
                  key={f}
                  active={value.image_format === f}
                  onClick={() => set('image_format', f)}
                >
                  {f}
                </SmallChip>
              ))}
            </div>
          </div>
        </div>
      </Section>
    </div>
  )
}

function Section({
  icon, title, children,
}: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-zinc-400">
        <span className="text-cyan-400">{icon}</span>
        <h4 className="text-xs font-semibold uppercase tracking-wider">{title}</h4>
      </div>
      <div>{children}</div>
    </div>
  )
}

function ChipButton({
  active, onClick, title, children,
}: {
  active:   boolean
  onClick:  () => void
  title?:   string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={[
        'flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs transition-all',
        active
          ? 'bg-cyan-400 text-black font-semibold shadow-[0_0_12px_rgba(0,229,255,0.3)]'
          : 'bg-zinc-950 text-zinc-300 border border-zinc-800 hover:border-cyan-400/40 hover:bg-zinc-900',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function SmallChip({
  active, onClick, children,
}: {
  active:   boolean
  onClick:  () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'px-2.5 py-1 rounded-full text-[11px] transition-all',
        active
          ? 'bg-cyan-400 text-black font-semibold'
          : 'bg-zinc-950 text-zinc-400 border border-zinc-800 hover:border-cyan-400/40 hover:text-zinc-200',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

// ── Helper pra montar o body que vai pra POST /briefings ──────────────────

export function briefingFormToApiBody(form: BriefingFormState) {
  return {
    target_marketplace:  form.target_marketplace,
    visual_style:        form.visual_style,
    environment:         form.environment === 'custom' ? 'custom' : form.environment,
    custom_environment:  form.environment === 'custom' ? (form.custom_environment || undefined) : undefined,
    background_color:    form.background_color,
    use_logo:            form.use_logo,
    communication_tone:  form.communication_tone,
    image_count:         form.image_count,
    image_format:        form.image_format,
  }
}
