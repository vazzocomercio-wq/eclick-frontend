/**
 * Reenvio de convite pra membro que nunca definiu a senha (ou perdeu o
 * e-mail). O convite original (inviteUserByEmail) só dispara na criação do
 * usuário — este endpoint manda um e-mail de (re)definição de senha pro
 * membro existente, que cumpre o mesmo papel: link → /redefinir-senha.
 * Só proprietário/admin da organização pode reenviar.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const REDIRECT = 'https://eclick.app.br/auth/callback?next=/redefinir-senha'

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

  const body = await req.json().catch(() => null)
  const email = String(body?.email ?? '').trim().toLowerCase()
  if (!email || !email.includes('@')) return fail('E-mail inválido.', 400)

  // ── 2. Service-role: caller é owner/admin? ─────────────────────────────
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  const { data: caller } = await admin
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()
  if (!caller) return fail('Você não tem uma organização.', 403)
  if (caller.role !== 'owner' && caller.role !== 'admin') {
    return fail('Só o proprietário ou um admin pode reenviar convites.', 403)
  }

  // ── 3. Alvo precisa ser membro da MESMA org ────────────────────────────
  let targetId: string | null = null
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) return fail('Erro ao verificar usuários.', 500)
    const u = data.users.find(x => (x.email ?? '').toLowerCase() === email)
    if (u) { targetId = u.id; break }
    if (data.users.length < 200) break
  }
  if (!targetId) return fail('Usuário não encontrado.', 404)

  const { data: membership } = await admin
    .from('organization_members')
    .select('id')
    .eq('organization_id', caller.organization_id)
    .eq('user_id', targetId)
    .maybeSingle()
  if (!membership) return fail('Esse usuário não é membro da sua equipe.', 404)

  // ── 4. Envia o e-mail (recovery = define/redefine a senha) ─────────────
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  const { error: sendErr } = await anon.auth.resetPasswordForEmail(email, { redirectTo: REDIRECT })
  if (sendErr) {
    // rate limit do GoTrue é o caso comum (1 envio/minuto por e-mail)
    return fail(`Não foi possível enviar agora: ${sendErr.message}`, 429)
  }

  return NextResponse.json({ ok: true })
}
