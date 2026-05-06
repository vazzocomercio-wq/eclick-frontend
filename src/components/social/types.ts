/** Onda 3 / S1 — tipos do Social Content Generator (frontend). */

export type SocialChannel =
  | 'instagram_post'
  | 'instagram_reels'
  | 'instagram_stories'
  | 'instagram_carousel'
  | 'tiktok_video'
  | 'facebook_post'
  | 'facebook_ads'
  | 'google_ads'
  | 'whatsapp_broadcast'
  | 'email_marketing'

export type SocialContentStatus =
  | 'draft'
  | 'approved'
  | 'scheduled'
  | 'published'
  | 'archived'

export interface SocialContent {
  id:                  string
  organization_id:     string
  product_id:          string
  user_id:             string
  channel:             SocialChannel
  content:             Record<string, unknown>
  creative_image_ids:  string[]
  creative_video_id:   string | null
  status:              SocialContentStatus
  scheduled_at:        string | null
  published_at:        string | null
  published_url:       string | null
  version:             number
  parent_id:           string | null
  generation_metadata: Record<string, unknown>
  created_at:          string
  updated_at:          string
}

// ── Shapes específicos por canal (parse on-demand) ────────────────────────

export interface IgPostContent {
  caption:           string
  hashtags:          string[]
  image_suggestion?: string
  alt_text?:         string
  cta?:              string
}

export interface IgCarouselContent {
  slides:        Array<{ caption: string; image_suggestion?: string }>
  main_caption:  string
  hashtags:      string[]
}

export interface IgReelsContent {
  script:            string
  scenes:            Array<{ time: string; action: string; text_overlay: string }>
  audio_suggestion?: string
  hashtags:          string[]
  caption:           string
}

export interface IgStoriesContent {
  stories: Array<{ type: string; text: string; sticker?: string }>
  cta?:    string
}

export interface AdsContent {
  headlines:                   string[]
  descriptions:                string[]
  primary_text:                string
  cta_type:                    string
  target_audience_suggestion?: string
  budget_suggestion_daily_brl?: number
  keywords?:                   string[]
  negative_keywords?:          string[]
}

export interface WhatsappBroadcastContent {
  message:        string
  include_image:  boolean
  include_link:   boolean
  target_segment: string
}

export interface EmailContent {
  subject:      string
  preview_text: string
  body_html:    string
  cta_text:     string
  cta_url:      string
}
