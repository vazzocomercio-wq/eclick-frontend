/**
 * Painel de gestão de clientes (e-Click) — leitura e atualização dos
 * módulos liberados por organização. Acesso restrito à equipe e-Click
 * (allowlist em lib/modules). Usa a service-role key (ignora RLS) só
 * depois de confirmar que o chamador é admin da plataforma.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { isPlatformAdmin, MODULE_CATALOG } from '@/lib/modules'

const MODULE_KEYS = new Set(MODULE_CATALOG.map(m => m.key))

/** Devolve o usuário só se ele for admin da plataforma; senão null. */
async function requireAdmin() {
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
  if (!user || !isPlatformAdmin(user.email)) return null
  return user
}

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await adminClient()
    .from('organizations')
    .select('id, name, slug, enabled_modules')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ orgs: data ?? [] })
}

export async function PATCH(req: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const orgId: string = typeof body?.orgId === 'string' ? body.orgId : ''
  const enabledModules: unknown = body?.enabledModules

  if (!orgId) {
    return NextResponse.json({ error: 'orgId obrigatório.' }, { status: 400 })
  }
  if (
    !Array.isArray(enabledModules) ||
    !enabledModules.every(m => typeof m === 'string' && MODULE_KEYS.has(m))
  ) {
    return NextResponse.json({ error: 'Lista de módulos inválida.' }, { status: 400 })
  }

  const { error } = await adminClient()
    .from('organizations')
    .update({ enabled_modules: enabledModules })
    .eq('id', orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
