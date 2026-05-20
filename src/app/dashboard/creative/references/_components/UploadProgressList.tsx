'use client'

/**
 * Lista de uploads em andamento. Cada item: nome + status + progress bar.
 * Status: 'pending' | 'uploading' | 'creating' | 'done' | 'error'.
 * "done" some após 2s pra não poluir a UI.
 */

import { useTranslations } from 'next-intl'
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'

export type UploadItem = {
  id:        string          // uuid local p/ identificar a linha
  file_name: string
  status:    'pending' | 'uploading' | 'creating' | 'done' | 'error'
  progress:  number           // 0-100
  error?:    string
}

export default function UploadProgressList({ items }: { items: UploadItem[] }) {
  const t = useTranslations('creative.references')
  if (items.length === 0) return null

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 space-y-2">
      <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">
        {t('uploadInProgress', { count: items.length })}
      </div>
      <div className="space-y-1.5">
        {items.map(it => (
          <div key={it.id} className="flex items-center gap-3 text-xs">
            <div className="flex-shrink-0 w-4">
              {it.status === 'done' && <CheckCircle2 size={14} className="text-emerald-400" />}
              {it.status === 'error' && <AlertTriangle size={14} className="text-red-400" />}
              {(it.status === 'uploading' || it.status === 'creating' || it.status === 'pending') && (
                <Loader2 size={14} className="animate-spin text-cyan-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-zinc-200 truncate">{it.file_name}</span>
                <span className="text-[10px] text-zinc-500 shrink-0">
                  {it.status === 'pending'   && t('uploadWaiting')}
                  {it.status === 'uploading' && `${it.progress}%`}
                  {it.status === 'creating'  && t('uploadCreating')}
                  {it.status === 'done'      && t('uploadDone')}
                  {it.status === 'error'     && t('uploadErrorShort')}
                </span>
              </div>
              <div className="mt-1 h-1 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className={[
                    'h-full transition-all duration-200',
                    it.status === 'error' ? 'bg-red-500'
                    : it.status === 'done' ? 'bg-emerald-500'
                    : 'bg-cyan-400',
                  ].join(' ')}
                  style={{
                    width: it.status === 'done' ? '100%'
                         : it.status === 'creating' ? '95%'
                         : `${it.progress}%`,
                  }}
                />
              </div>
              {it.status === 'error' && it.error && (
                <p className="text-[10px] text-red-300 mt-0.5">{it.error}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
