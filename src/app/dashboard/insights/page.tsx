/**
 * e-Click Insights — dashboard de telemetria de produto (founder).
 * Exclusivo da equipe e-Click (gate por allowlist de e-mail), cross-org.
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { isPlatformAdmin } from '@/lib/modules'
import { InsightsClient } from './_components/InsightsClient'

export default async function InsightsPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        ),
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!isPlatformAdmin(user.email)) redirect('/dashboard')

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <InsightsClient />
    </div>
  )
}
