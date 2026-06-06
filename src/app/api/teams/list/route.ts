/**
 * Lista os membros da equipe (SaaS) da org do chamador, enriquecidos com
 * nome/e-mail (do auth.users via service-role) + WhatsApp. A tela
 * /dashboard/configuracoes/equipe usa isto pra exibir e editar o WhatsApp de
 * cada operador. Qualquer membro da org pode listar.
 */

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

function fail(message: string, status: number) {
  return NextResponse.json({ message }, { status })
}

export async function GET() {
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
  if (!user) return fail('Não autenticado.', 401)

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  // Org do chamador
  const { data: caller } = await admin
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()
  if (!caller) return fail('Você não tem uma organização.', 403)
  const orgId = caller.organization_id as string

  const { data: rows, error } = await admin
    .from('organization_members')
    .select('user_id, role, created_at, whatsapp_phone')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: true })
  if (error) return fail(`Erro ao listar membros: ${error.message}`, 500)

  const members = await Promise.all(
    (rows ?? []).map(async (m) => {
      let email: string | null = null
      let name: string | null = null
      try {
        const { data } = await admin.auth.admin.getUserById(m.user_id as string)
        const u = data?.user
        if (u) {
          email = u.email ?? null
          const meta = (u.user_metadata ?? {}) as Record<string, unknown>
          name = (meta.full_name as string | undefined) ?? (meta.name as string | undefined) ?? null
        }
      } catch {
        /* user inacessível — devolve só o id */
      }
      return {
        user_id:        m.user_id as string,
        role:           (m.role as string | null) ?? 'member',
        created_at:     (m.created_at as string | null) ?? null,
        whatsapp_phone: (m.whatsapp_phone as string | null) ?? null,
        email,
        name,
      }
    }),
  )

  return NextResponse.json({ members })
}
