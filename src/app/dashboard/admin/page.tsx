/**
 * Painel de gestão de clientes — exclusivo da equipe e-Click.
 * Aqui se libera/bloqueia módulos por organização-cliente. Os clientes
 * NÃO têm acesso a esta tela (gate por allowlist de e-mail).
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { isPlatformAdmin } from '@/lib/modules'
import { AdminClientsPanel } from './_components/AdminClientsPanel'

export default async function AdminPage() {
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
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <AdminClientsPanel />
    </div>
  )
}
