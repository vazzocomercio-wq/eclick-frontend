/**
 * Convite de membro pra equipe (SaaS). A tela
 * /dashboard/configuracoes/equipe posta aqui. Só proprietário/admin da
 * organização pode convidar. O convidado recebe um e-mail do Supabase e
 * define a própria senha (link volta por /auth/callback?next=/redefinir-senha).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const REDIRECT = 'https://eclick.app.br/auth/callback?next=/redefinir-senha'
const VALID_ROLES = new Set(['admin', 'member', 'viewer'])

function fail(message: string, status: number) {
  return NextResponse.json({ message }, { status })
}

export async function POST(req: NextRequest) {
  // ── 1. Caller autenticado ──────────────────────────────────────────────
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

  // ── 2. Body ────────────────────────────────────────────────────────────
  const body = await req.json().catch(() => null)
  const email = String(body?.email ?? '').trim().toLowerCase()
  const role  = String(body?.role ?? 'member')
  if (!email || !email.includes('@')) return fail('E-mail inválido.', 400)
  if (!VALID_ROLES.has(role)) return fail('Função inválida.', 400)

  // ── 3. Service-role (ignora RLS) ───────────────────────────────────────
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  // ── 4. Org do chamador — só owner/admin convida ────────────────────────
  const { data: caller } = await admin
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()
  if (!caller) return fail('Você não tem uma organização.', 403)
  if (caller.role !== 'owner' && caller.role !== 'admin') {
    return fail('Só o proprietário ou um admin pode convidar membros.', 403)
  }
  const orgId = caller.organization_id as string

  // ── 5. Encontra ou convida o usuário ───────────────────────────────────
  let invitedId: string | null = null
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) return fail('Erro ao verificar usuários.', 500)
    const u = data.users.find(x => (x.email ?? '').toLowerCase() === email)
    if (u) { invitedId = u.id; break }
    if (data.users.length < 200) break
  }
  if (!invitedId) {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: REDIRECT })
    if (error || !data?.user) return fail('Não foi possível enviar o convite.', 500)
    invitedId = data.user.id
  }

  // ── 6. Já é membro? ────────────────────────────────────────────────────
  const { data: existing } = await admin
    .from('organization_members')
    .select('id')
    .eq('organization_id', orgId)
    .eq('user_id', invitedId)
    .maybeSingle()
  if (existing) return fail('Esse usuário já está na equipe.', 409)

  // ── 7. Cria a associação ───────────────────────────────────────────────
  const { error: memberErr } = await admin
    .from('organization_members')
    .insert({ organization_id: orgId, user_id: invitedId, role })
  if (memberErr) return fail(`Erro ao adicionar membro: ${memberErr.message}`, 500)

  return NextResponse.json({ ok: true })
}
