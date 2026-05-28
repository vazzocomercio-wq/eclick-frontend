/**
 * F17-B6 · Tela admin de RBAC — exclusivo da equipe e-Click.
 * Gerencia roles (templates + custom) e atribuições user↔role por org.
 *
 * Os usuários CLIENTES NÃO chegam aqui (gate por isPlatformAdmin).
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { isPlatformAdmin } from '@/lib/modules'
import { RolesPanel } from './_components/RolesPanel'

export default async function AdminRolesPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options),
        ),
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!isPlatformAdmin(user.email)) redirect('/dashboard')

  // Resolve org_id default do user logado pra passar pro client component
  const { data: member } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()
  const orgId = member?.organization_id ?? ''

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <RolesPanel initialOrgId={orgId} />
    </div>
  )
}
