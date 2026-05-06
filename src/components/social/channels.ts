import {
  Camera, MessageCircle, Mail, Megaphone, Search, Video, Film, Image as ImageIcon,
  type LucideIcon,
} from 'lucide-react'
import type { SocialChannel } from './types'

/** Onda 3 / S1 — registry visual dos canais sociais. Ícone + cor + label
 *  curto + categoria pra agrupamento na UI. */

export interface ChannelMeta {
  channel:     SocialChannel
  label:       string
  shortLabel:  string
  category:    'organic' | 'ads' | 'direct'
  icon:        LucideIcon
  color:       string  // brand-ish hex pra borda/icon tint
  description: string
}

export const CHANNEL_META: Record<SocialChannel, ChannelMeta> = {
  instagram_post: {
    channel:     'instagram_post',
    label:       'Instagram — Post',
    shortLabel:  'IG Post',
    category:    'organic',
    icon:        Camera,
    color:       '#E1306C',
    description: 'Post de feed quadrado/retrato com caption + hashtags',
  },
  instagram_reels: {
    channel:     'instagram_reels',
    label:       'Instagram — Reels',
    shortLabel:  'Reels',
    category:    'organic',
    icon:        Film,
    color:       '#E1306C',
    description: 'Vídeo vertical 9:16 com roteiro de 15-30s',
  },
  instagram_stories: {
    channel:     'instagram_stories',
    label:       'Instagram — Stories',
    shortLabel:  'Stories',
    category:    'organic',
    icon:        ImageIcon,
    color:       '#FF7A00',
    description: 'Sequência de stories com stickers interativos',
  },
  instagram_carousel: {
    channel:     'instagram_carousel',
    label:       'Instagram — Carrossel',
    shortLabel:  'Carrossel',
    category:    'organic',
    icon:        ImageIcon,
    color:       '#a855f7',
    description: '5-7 slides com storytelling',
  },
  tiktok_video: {
    channel:     'tiktok_video',
    label:       'TikTok — Vídeo',
    shortLabel:  'TikTok',
    category:    'organic',
    icon:        Video,
    color:       '#FF0050',
    description: 'Vídeo TikTok com hook nos primeiros 3s',
  },
  facebook_post: {
    channel:     'facebook_post',
    label:       'Facebook — Post',
    shortLabel:  'FB Post',
    category:    'organic',
    icon:        MessageCircle,
    color:       '#1877F2',
    description: 'Post Facebook com link e imagem',
  },
  facebook_ads: {
    channel:     'facebook_ads',
    label:       'Meta Ads',
    shortLabel:  'Meta Ads',
    category:    'ads',
    icon:        Megaphone,
    color:       '#0866FF',
    description: 'Headlines + primary text + CTA pra Facebook/Instagram Ads',
  },
  google_ads: {
    channel:     'google_ads',
    label:       'Google Ads',
    shortLabel:  'Google Ads',
    category:    'ads',
    icon:        Search,
    color:       '#4285F4',
    description: 'Headlines + descriptions + keywords pra Search/Shopping',
  },
  whatsapp_broadcast: {
    channel:     'whatsapp_broadcast',
    label:       'WhatsApp — Broadcast',
    shortLabel:  'WhatsApp',
    category:    'direct',
    icon:        MessageCircle,
    color:       '#25D366',
    description: 'Mensagem para lista de transmissão',
  },
  email_marketing: {
    channel:     'email_marketing',
    label:       'Email Marketing',
    shortLabel:  'Email',
    category:    'direct',
    icon:        Mail,
    color:       '#6b7280',
    description: 'Subject + preview + body HTML + CTA',
  },
}

export const ALL_CHANNELS: SocialChannel[] = Object.keys(CHANNEL_META) as SocialChannel[]

export const CHANNEL_GROUPS: Array<{ label: string; channels: SocialChannel[] }> = [
  {
    label: 'Orgânico',
    channels: [
      'instagram_post', 'instagram_reels', 'instagram_stories',
      'instagram_carousel', 'tiktok_video', 'facebook_post',
    ],
  },
  {
    label: 'Mídia paga',
    channels: ['facebook_ads', 'google_ads'],
  },
  {
    label: 'Direto',
    channels: ['whatsapp_broadcast', 'email_marketing'],
  },
]

export const STATUS_META: Record<string, { label: string; color: string }> = {
  draft:     { label: 'rascunho',  color: '#71717a' },
  approved:  { label: 'aprovado',  color: '#22c55e' },
  scheduled: { label: 'agendado',  color: '#00E5FF' },
  published: { label: 'publicado', color: '#a855f7' },
  archived:  { label: 'arquivado', color: '#52525b' },
}
