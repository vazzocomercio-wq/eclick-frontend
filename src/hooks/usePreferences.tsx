'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const STORAGE_KEY = 'eclick.prefs.v1'

export const PREF_DEFAULTS: Record<string, string> = {
  mask_cpf:    'true',
  mask_phone:  'true',
  mask_email:  'true',
  mask_export: 'false',
}

export type Preferences = Record<string, string>

function loadCached(): Preferences {
  if (typeof window === 'undefined') return { ...PREF_DEFAULTS }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...PREF_DEFAULTS, ...(JSON.parse(raw) as Preferences) }
  } catch {}
  return { ...PREF_DEFAULTS }
}

function persistCached(p: Preferences) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)) } catch {}
}

// In-memory broadcast so multiple components stay in sync without a context.
const listeners = new Set<(p: Preferences) => void>()
let inMem: Preferences = loadCached()
function notify() { for (const fn of listeners) fn({ ...inMem }) }

/** React hook — devolve as prefs com defaults aplicados + setter.
 * Cache em localStorage pra resposta instantânea no primeiro render;
 * background fetch atualiza com a verdade do servidor. */
export function usePreferences() {
  const [prefs, setPrefs] = useState<Preferences>(() => ({ ...inMem }))

  useEffect(() => {
    const fn = (next: Preferences) => setPrefs(next)
    listeners.add(fn)
    return () => { listeners.delete(fn) }
  }, [])

  // background refresh — only fire once per page session
  useEffect(() => {
    let canceled = false
    ;(async () => {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) return
        const res = await fetch(`${BACKEND}/user-preferences`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (!res.ok) return
        const body = await res.json() as Preferences
        if (canceled || !body) return
        const merged = { ...PREF_DEFAULTS, ...body }
        inMem = merged
        persistCached(merged)
        notify()
      } catch { /* offline / network — keep cache */ }
    })()
    return () => { canceled = true }
  }, [])

  const setPref = useCallback(async (key: string, value: string) => {
    inMem = { ...inMem, [key]: value }
    persistCached(inMem)
    notify()
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      await fetch(`${BACKEND}/user-preferences`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key, value }),
      })
    } catch { /* offline — local cache wins, will sync next time */ }
  }, [])

  // Convenience getters with bool coercion
  const bool = (k: string) => prefs[k] === 'true'
  return {
    prefs,
    setPref,
    maskCpf:    bool('mask_cpf'),
    maskPhone:  bool('mask_phone'),
    maskEmail:  bool('mask_email'),
    maskExport: bool('mask_export'),
  }
}
