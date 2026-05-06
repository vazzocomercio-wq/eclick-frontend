'use client'

import { useMemo } from 'react'
import {
  Camera, MessageCircle, Megaphone, Search, Heart,
  Bookmark, Send,
} from 'lucide-react'
import type {
  SocialChannel, IgPostContent, IgCarouselContent, IgReelsContent,
  IgStoriesContent, AdsContent, WhatsappBroadcastContent, EmailContent,
} from './types'
import { CHANNEL_META } from './channels'

interface Props {
  channel:  SocialChannel
  content:  Record<string, unknown>
}

/** Onda 3 / S1 — Preview visual do conteúdo gerado por canal.
 *
 *  Não é WYSIWYG perfeito (impossível replicar UIs reais), só indica o tom
 *  e a forma do conteúdo gerado pra o usuário ter contexto antes de aprovar.
 */
export default function SocialContentPreview({ channel, content }: Props) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 overflow-hidden">
      {/* Channel banner */}
      <div className="px-4 py-2 border-b border-zinc-800 flex items-center gap-2 bg-zinc-900/50">
        <span
          className="w-1.5 h-4 rounded-sm"
          style={{ background: CHANNEL_META[channel].color }}
        />
        <p className="text-xs font-medium text-zinc-300">{CHANNEL_META[channel].label}</p>
      </div>

      <div className="p-4">
        {channel === 'instagram_post'    && <IgPostBlock     content={content} />}
        {channel === 'facebook_post'     && <IgPostBlock     content={content} fb />}
        {channel === 'instagram_carousel' && <IgCarouselBlock content={content} />}
        {channel === 'instagram_reels'   && <ReelsBlock      content={content} />}
        {channel === 'tiktok_video'      && <ReelsBlock      content={content} tiktok />}
        {channel === 'instagram_stories' && <StoriesBlock    content={content} />}
        {channel === 'facebook_ads'      && <AdsBlock        content={content} platform="meta" />}
        {channel === 'google_ads'        && <AdsBlock        content={content} platform="google" />}
        {channel === 'whatsapp_broadcast' && <WhatsappBlock  content={content} />}
        {channel === 'email_marketing'   && <EmailBlock      content={content} />}
      </div>
    </div>
  )
}

// ── IG Post / FB Post ─────────────────────────────────────────────────────

function IgPostBlock({ content, fb }: { content: Record<string, unknown>; fb?: boolean }) {
  const c = content as unknown as IgPostContent
  const Icon = fb ? MessageCircle : Camera
  const accent = fb ? '#1877F2' : '#E1306C'
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center">
          <Icon size={14} style={{ color: accent }} />
        </div>
        <div>
          <p className="text-xs text-zinc-200 font-medium">sua_marca</p>
          <p className="text-[10px] text-zinc-500">Promovido</p>
        </div>
      </div>

      {/* Image placeholder */}
      <div className="aspect-square rounded-md bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center border border-zinc-800">
        <p className="text-[11px] text-zinc-600 px-4 text-center italic">
          {c.image_suggestion || 'imagem do produto aqui'}
        </p>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-3 text-zinc-500">
        <Heart   size={14} />
        <MessageCircle size={14} />
        <Send    size={14} />
        <Bookmark size={14} className="ml-auto" />
      </div>

      {/* Caption */}
      <div className="text-[12px] text-zinc-300 whitespace-pre-wrap leading-relaxed">
        <span className="font-medium text-zinc-200">sua_marca</span>{' '}
        {c.caption}
      </div>

      {/* Hashtags */}
      {c.hashtags && c.hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {c.hashtags.map(h => (
            <span key={h} className="text-[10px] text-cyan-400">{h.startsWith('#') ? h : `#${h}`}</span>
          ))}
        </div>
      )}

      {c.cta && (
        <div className="pt-2 border-t border-zinc-800">
          <p className="text-[11px] text-zinc-400">
            <span className="text-cyan-400">CTA:</span> {c.cta}
          </p>
        </div>
      )}
    </div>
  )
}

// ── IG Carousel ───────────────────────────────────────────────────────────

function IgCarouselBlock({ content }: { content: Record<string, unknown> }) {
  const c = content as unknown as IgCarouselContent
  const slides = c.slides ?? []
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-zinc-500">{slides.length} slides</p>
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
        {slides.map((s, i) => (
          <div key={i} className="shrink-0 w-40 rounded-md border border-zinc-800 bg-zinc-900/50 p-2 space-y-2">
            <div className="aspect-square rounded bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center text-[10px] text-zinc-600 italic px-2 text-center">
              {s.image_suggestion || `slide ${i + 1}`}
            </div>
            <p className="text-[10px] text-zinc-400 leading-relaxed line-clamp-3">{s.caption}</p>
            <p className="text-[9px] text-zinc-600">slide {i + 1}/{slides.length}</p>
          </div>
        ))}
      </div>
      {c.main_caption && (
        <div className="pt-2 border-t border-zinc-800 text-[12px] text-zinc-300 whitespace-pre-wrap">
          {c.main_caption}
        </div>
      )}
      {c.hashtags && c.hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {c.hashtags.map(h => (
            <span key={h} className="text-[10px] text-cyan-400">{h.startsWith('#') ? h : `#${h}`}</span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Reels / TikTok ────────────────────────────────────────────────────────

function ReelsBlock({ content, tiktok }: { content: Record<string, unknown>; tiktok?: boolean }) {
  const c = content as unknown as IgReelsContent
  const scenes = c.scenes ?? []
  const total = useMemo(() => {
    // estimar duração total parsing tempos como "0-3s"
    let max = 0
    for (const s of scenes) {
      const m = /-(\d+)s/.exec(s.time)
      if (m) max = Math.max(max, parseInt(m[1], 10))
    }
    return max
  }, [scenes])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-zinc-500">{tiktok ? 'TikTok' : 'Reels'} · {total || '~15-30'}s</span>
        {c.audio_suggestion && (
          <span className="text-cyan-400 truncate max-w-[60%]">♪ {c.audio_suggestion}</span>
        )}
      </div>

      {/* Timeline */}
      <div className="space-y-1.5">
        {scenes.map((s, i) => (
          <div key={i} className="rounded border border-zinc-800 bg-zinc-900/40 px-2 py-1.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono text-cyan-300">{s.time}</span>
              <span className="text-[10px] text-zinc-500">{s.action}</span>
            </div>
            <p className="text-[11px] text-zinc-300 italic">"{s.text_overlay}"</p>
          </div>
        ))}
      </div>

      {c.script && (
        <div className="pt-2 border-t border-zinc-800">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Roteiro</p>
          <p className="text-[12px] text-zinc-300 whitespace-pre-wrap leading-relaxed">{c.script}</p>
        </div>
      )}

      {c.caption && (
        <p className="text-[11px] text-zinc-400 whitespace-pre-wrap">{c.caption}</p>
      )}

      {c.hashtags && c.hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {c.hashtags.map(h => (
            <span key={h} className="text-[10px] text-cyan-400">{h.startsWith('#') ? h : `#${h}`}</span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Stories ───────────────────────────────────────────────────────────────

function StoriesBlock({ content }: { content: Record<string, unknown> }) {
  const c = content as unknown as IgStoriesContent
  const stories = c.stories ?? []
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-zinc-500">{stories.length} stories sequenciais</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {stories.map((s, i) => (
          <div key={i} className="aspect-[9/16] rounded-md border border-zinc-800 bg-gradient-to-br from-zinc-800 to-zinc-900 p-2 flex flex-col">
            <span className="text-[9px] uppercase font-mono text-cyan-400 mb-1">{s.type}</span>
            <p className="text-[11px] text-zinc-300 flex-1">{s.text}</p>
            {s.sticker && (
              <p className="text-[10px] text-zinc-500 italic">↺ {s.sticker}</p>
            )}
            <p className="text-[9px] text-zinc-600 mt-2">story {i + 1}/{stories.length}</p>
          </div>
        ))}
      </div>
      {c.cta && (
        <p className="text-[11px] text-cyan-400">CTA: {c.cta}</p>
      )}
    </div>
  )
}

// ── Ads (Meta / Google) ──────────────────────────────────────────────────

function AdsBlock({ content, platform }: { content: Record<string, unknown>; platform: 'meta' | 'google' }) {
  const c = content as unknown as AdsContent
  const headlines = c.headlines ?? []
  const descs     = c.descriptions ?? []
  const Icon      = platform === 'meta' ? Megaphone : Search
  const accent    = platform === 'meta' ? '#0866FF' : '#4285F4'

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon size={14} style={{ color: accent }} />
        <p className="text-[11px] text-zinc-400 uppercase tracking-wider">{platform === 'meta' ? 'Meta Ads' : 'Google Ads'}</p>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Headlines ({headlines.length})</p>
        <div className="space-y-1">
          {headlines.map((h, i) => (
            <div key={i} className="rounded border border-zinc-800 bg-zinc-900/40 px-2 py-1 text-[12px] text-zinc-200 flex justify-between gap-2">
              <span className="truncate">{h}</span>
              <span className="text-[9px] text-zinc-600 shrink-0">{h.length}c</span>
            </div>
          ))}
        </div>
      </div>

      {c.primary_text && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Primary text</p>
          <p className="text-[12px] text-zinc-300 whitespace-pre-wrap leading-relaxed">{c.primary_text}</p>
          <p className="text-[9px] text-zinc-600 mt-1">{c.primary_text.length} chars</p>
        </div>
      )}

      {descs.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Descriptions ({descs.length})</p>
          <div className="space-y-1">
            {descs.map((d, i) => (
              <p key={i} className="text-[11px] text-zinc-400 px-2 py-1 rounded bg-zinc-900/40 border border-zinc-800">{d}</p>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-800">
        {c.cta_type && (
          <div>
            <p className="text-[10px] text-zinc-500">CTA</p>
            <p className="text-[11px] text-cyan-300 font-mono">{c.cta_type}</p>
          </div>
        )}
        {c.budget_suggestion_daily_brl != null && (
          <div>
            <p className="text-[10px] text-zinc-500">Budget/dia</p>
            <p className="text-[11px] text-zinc-200">R$ {Number(c.budget_suggestion_daily_brl).toFixed(2)}</p>
          </div>
        )}
      </div>

      {c.target_audience_suggestion && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Público</p>
          <p className="text-[11px] text-zinc-400 italic">{c.target_audience_suggestion}</p>
        </div>
      )}

      {c.keywords && c.keywords.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Keywords</p>
          <div className="flex flex-wrap gap-1">
            {c.keywords.map(k => (
              <span key={k} className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-400/10 text-cyan-300 border border-cyan-400/20">{k}</span>
            ))}
          </div>
        </div>
      )}

      {c.negative_keywords && c.negative_keywords.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Negativas</p>
          <div className="flex flex-wrap gap-1">
            {c.negative_keywords.map(k => (
              <span key={k} className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-400/10 text-red-300 border border-red-400/20">{k}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── WhatsApp Broadcast ───────────────────────────────────────────────────

function WhatsappBlock({ content }: { content: Record<string, unknown> }) {
  const c = content as unknown as WhatsappBroadcastContent
  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-emerald-400/10 border border-emerald-400/30 p-3 max-w-[80%]">
        <p className="text-[12px] text-zinc-200 whitespace-pre-wrap leading-relaxed">{c.message}</p>
        <p className="text-[9px] text-zinc-500 mt-2 text-right">{c.message?.length ?? 0} chars</p>
      </div>
      <div className="grid grid-cols-3 gap-2 text-[10px]">
        <div>
          <p className="text-zinc-500">Imagem</p>
          <p className="text-zinc-300">{c.include_image ? 'sim' : 'não'}</p>
        </div>
        <div>
          <p className="text-zinc-500">Link</p>
          <p className="text-zinc-300">{c.include_link ? 'sim' : 'não'}</p>
        </div>
        <div>
          <p className="text-zinc-500">Segmento</p>
          <p className="text-zinc-300">{c.target_segment || '-'}</p>
        </div>
      </div>
    </div>
  )
}

// ── Email ────────────────────────────────────────────────────────────────

function EmailBlock({ content }: { content: Record<string, unknown> }) {
  const c = content as unknown as EmailContent
  return (
    <div className="space-y-3">
      <div className="rounded border border-zinc-800 overflow-hidden">
        <div className="px-3 py-2 bg-zinc-900/60 border-b border-zinc-800">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">Subject</p>
          <p className="text-[12px] text-zinc-200 font-medium">{c.subject}</p>
          <p className="text-[10px] text-zinc-500 italic">{c.preview_text}</p>
        </div>
        {c.body_html && (
          <div
            className="px-3 py-2 text-[11px] text-zinc-300 leading-relaxed prose-sm prose-invert max-h-60 overflow-y-auto"
            dangerouslySetInnerHTML={{ __html: c.body_html }}
          />
        )}
      </div>
      {c.cta_text && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-500">CTA:</span>
          <span className="px-2 py-1 rounded bg-cyan-400 text-black text-[11px] font-medium">{c.cta_text}</span>
          {c.cta_url && <span className="text-[10px] text-zinc-500 truncate flex-1">→ {c.cta_url}</span>}
        </div>
      )}
    </div>
  )
}
