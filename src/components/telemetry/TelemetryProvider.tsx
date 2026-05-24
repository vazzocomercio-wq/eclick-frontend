'use client'

/**
 * Liga a telemetria de produto no dashboard. Montado uma vez no
 * dashboard/layout.tsx (que é server component). Faz:
 *  - init do TelemetryClient com um getter de token Supabase
 *  - page_view + module_entered/exited automáticos por rota (usePathname)
 *
 * Eventos de feature específicos (campaign.published, listing.edited, etc)
 * e funis de tarefa são disparados pelas próprias telas via os hooks.
 */
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { telemetry } from '@/lib/telemetry/client'
import { telemetryModuleForPath } from '@/lib/telemetry/events'

export default function TelemetryProvider() {
  useEffect(() => {
    // Telemetria é best-effort: nunca pode derrubar o dashboard.
    try {
      const supabase = createClient()
      telemetry.init(async () => {
        try {
          const { data } = await supabase.auth.getSession()
          return data.session?.access_token ?? null
        } catch {
          return null
        }
      })
    } catch {
      /* noop */
    }
  }, [])

  const pathname = usePathname()
  useEffect(() => {
    if (!pathname) return
    try {
      const mod = telemetryModuleForPath(pathname)
      if (!mod) return
      telemetry.enterModule(mod)
      telemetry.pageView(mod)
    } catch {
      /* noop */
    }
  }, [pathname])

  return null
}
