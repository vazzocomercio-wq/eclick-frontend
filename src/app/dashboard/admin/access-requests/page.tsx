/**
 * F17-A · Painel de pedidos de acesso (platform admin).
 *
 * Lista os access_requests e permite aprovar/rejeitar. Aprovação cria
 * auth.user + organization + member + subscription (backend).
 *
 * Gated por isPlatformAdmin — mesma allowlist do /dashboard/admin.
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { isPlatformAdmin } from '@/lib/modules'
import { AccessRequestsPanel } from './_components/AccessRequestsPanel'

export default async function AccessRequestsPage() {
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
      <AccessRequestsPanel />
    </div>
  )
}
