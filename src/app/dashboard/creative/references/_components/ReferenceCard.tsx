'use client'

/**
 * Card único de referência. Thumb 1:1, hover overlay com nome, checkbox
 * top-left (sempre visível se selected), action menu (···) top-right.
 *
 * Click no body do card abre o drawer de edição. Curated refs: badge cyan +
 * disable de checkbox e action menu (read-only).
 */

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { MoreVertical, Edit3, Power, PowerOff, Trash2, ImageOff, Sparkles } from 'lucide-react'
import type { CreativeReference } from '@/components/creative/types'

export default function ReferenceCard({
  ref: refImg, selected, onToggleSelect, onEdit, onToggleActive, onDelete, busy,
}: {
  ref:             CreativeReference
  selected:        boolean
  onToggleSelect:  () => void
  onEdit:          () => void
  onToggleActive:  () => void
  onDelete:        () => void
  busy?:           boolean
}) {
  const t = useTranslations('creative.references')
  const [menuOpen, setMenuOpen]   = useState(false)
  const [imgError, setImgError]   = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)

  const curated = refImg.is_curated
  const inactive = !refImg.is_active

  return (
    <div
      onClick={onEdit}
      className={[
        'group relative rounded-xl border bg-zinc-900/40 overflow-hidden cursor-pointer transition-all',
        selected
          ? 'border-cyan-400 ring-2 ring-cyan-400/20'
          : 'border-zinc-800 hover:border-cyan-500/40',
        inactive ? 'opacity-60' : '',
      ].join(' ')}
    >
      {/* Thumb 1:1 */}
      <div className="relative aspect-square bg-zinc-950">
        {!imgError && refImg.signed_url ? (
          <>
            {!imgLoaded && (
              <div className="absolute inset-0 bg-zinc-800/50 animate-pulse" />
            )}
            <img
              src={refImg.signed_url}
              alt={refImg.name}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
              className={[
                'absolute inset-0 w-full h-full object-cover transition-transform duration-300',
                inactive ? 'grayscale' : '',
                'group-hover:scale-105',
              ].join(' ')}
              loading="lazy"
            />
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-600">
            <ImageOff size={28} />
          </div>
        )}

        {/* Top-left: checkbox (curated não selecionável) */}
        {!curated && (
          <div
            onClick={e => { e.stopPropagation(); onToggleSelect() }}
            className={[
              'absolute top-2 left-2 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all',
              selected
                ? 'bg-cyan-400 border-cyan-400 opacity-100'
                : 'bg-zinc-950/70 border-zinc-600 opacity-0 group-hover:opacity-100',
            ].join(' ')}
          >
            {selected && (
              <svg className="w-3 h-3 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>
        )}

        {/* Top-right: badges + menu */}
        <div className="absolute top-2 right-2 flex items-center gap-1">
          {curated && (
            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
              <Sparkles size={8} /> {t('curated')}
            </span>
          )}
          {inactive && (
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
              {t('deactivated')}
            </span>
          )}
          {!curated && (
            <div className="relative">
              <button
                type="button"
                onClick={e => { e.stopPropagation(); setMenuOpen(o => !o) }}
                disabled={busy}
                className="p-1 rounded-md bg-zinc-950/70 text-zinc-300 hover:bg-zinc-950 hover:text-white transition-colors disabled:opacity-50 opacity-0 group-hover:opacity-100"
              >
                <MoreVertical size={12} />
              </button>
              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={e => { e.stopPropagation(); setMenuOpen(false) }}
                  />
                  <div
                    onClick={e => e.stopPropagation()}
                    className="absolute right-0 top-full mt-1 w-40 rounded-lg border border-zinc-800 bg-zinc-950 shadow-xl z-20 overflow-hidden"
                  >
                    <MenuItem
                      icon={<Edit3 size={11} />}
                      label={t('edit')}
                      onClick={() => { setMenuOpen(false); onEdit() }}
                    />
                    <MenuItem
                      icon={refImg.is_active ? <PowerOff size={11} /> : <Power size={11} />}
                      label={refImg.is_active ? t('deactivate') : t('activate')}
                      onClick={() => { setMenuOpen(false); onToggleActive() }}
                    />
                    <MenuItem
                      icon={<Trash2 size={11} />}
                      label={t('delete')}
                      danger
                      onClick={() => { setMenuOpen(false); onDelete() }}
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-2">
        <p className="text-xs font-medium text-zinc-100 truncate" title={refImg.name}>
          {refImg.name}
        </p>
        <div className="mt-1 flex flex-wrap gap-1 min-h-[16px]">
          {refImg.tags.slice(0, 3).map(t => (
            <span
              key={t}
              className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 truncate max-w-[80px]"
              title={t}
            >
              {t}
            </span>
          ))}
          {refImg.tags.length > 3 && (
            <span className="text-[9px] px-1 py-0.5 text-zinc-500">+{refImg.tags.length - 3}</span>
          )}
        </div>
      </div>
    </div>
  )
}

function MenuItem({
  icon, label, onClick, danger,
}: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors',
        danger ? 'text-red-300 hover:bg-red-500/10' : 'text-zinc-300 hover:bg-zinc-900',
      ].join(' ')}
    >
      {icon}
      {label}
    </button>
  )
}
