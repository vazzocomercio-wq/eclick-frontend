'use client'

import type { SocialChannel, SocialContentStatus } from './types'
import { CHANNEL_META, STATUS_META } from './channels'

export function ChannelBadge({ channel, size = 'sm' }: { channel: SocialChannel; size?: 'sm' | 'xs' }) {
  const meta = CHANNEL_META[channel]
  const Icon = meta.icon
  const cls  = size === 'xs'
    ? 'text-[10px] px-1.5 py-0.5 gap-1'
    : 'text-[11px] px-2 py-0.5 gap-1.5'
  return (
    <span
      className={`inline-flex items-center rounded-full border whitespace-nowrap ${cls}`}
      style={{
        borderColor: `${meta.color}40`,
        background:  `${meta.color}10`,
        color:       meta.color,
      }}
    >
      <Icon size={size === 'xs' ? 9 : 11} />
      {meta.shortLabel}
    </span>
  )
}

export function StatusBadge({ status, size = 'sm' }: { status: SocialContentStatus; size?: 'sm' | 'xs' }) {
  const meta = STATUS_META[status] ?? { label: status, color: '#71717a' }
  const cls  = size === 'xs'
    ? 'text-[10px] px-1.5 py-0.5'
    : 'text-[11px] px-2 py-0.5'
  return (
    <span
      className={`inline-flex items-center rounded-full border whitespace-nowrap ${cls}`}
      style={{
        borderColor: `${meta.color}40`,
        background:  `${meta.color}10`,
        color:       meta.color,
      }}
    >
      {meta.label}
    </span>
  )
}
