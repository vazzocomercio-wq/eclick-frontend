'use client'

/**
 * Seletor de idioma — dropdown no Header. Grava o idioma num cookie via
 * server action e atualiza a árvore de server components.
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { setLocale } from '@/i18n/locale-actions'
import { locales, localeFlags, localeNames, type Locale } from '@/i18n/locales'

export default function LanguageSwitcher() {
  const current = useLocale() as Locale
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function choose(loc: Locale) {
    setOpen(false)
    if (loc === current) return
    startTransition(async () => {
      await setLocale(loc)
      router.refresh()
    })
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        disabled={pending}
        aria-label="Idioma / Language"
        className="flex items-center gap-1 h-7 px-2 rounded-md text-zinc-500 text-[12px] transition-colors hover:text-zinc-300 hover:bg-white/5 disabled:opacity-50"
      >
        <span className="text-[13px] leading-none">{localeFlags[current]}</span>
        <span className="hidden sm:inline uppercase">{current}</span>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-9 w-44 rounded-xl z-20 overflow-hidden p-1 shadow-2xl"
            style={{
              background: '#161618',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
            }}
          >
            {locales.map(loc => (
              <button
                key={loc}
                type="button"
                onClick={() => choose(loc)}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] transition-colors text-left hover:bg-white/5"
                style={{ color: loc === current ? '#00E5FF' : '#a1a1aa' }}
              >
                <span className="text-[14px] leading-none">{localeFlags[loc]}</span>
                <span className="flex-1">{localeNames[loc]}</span>
                {loc === current && (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
