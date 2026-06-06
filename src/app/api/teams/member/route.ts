/**
 * Atualiza dados de um membro da equipe (SaaS) — hoje, o WhatsApp do operador
 * (usado pelo alerta de tarefa URGENTE da Operação de Cadastro). Só
 * proprietário/admin da org pode editar. Service-role (ignora RLS), com checagem
 * de papel e de que o alvo pertence à mesma org.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

function fail(message: string, status: number) {
  return NextResponse.json({ message }, { status })
}

/** Normaliza WhatsApp: mantém '+' inicial e só dígitos. Vazio/curto → null (limpa). */
function normalizeWhatsapp(raw: string): string | null {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return null
  const hasPlus = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')
  if (digits.length < 8) return null
  return hasPlus ? `+${digits}` : digits
}

export async function PATCH(req: NextRequest) {
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
  const targetUserId = String(body?.user_id ?? '').trim()
  if (!targetUserId) return fail('user_id obrigatório.', 400)
  // whatsapp_phone pode vir vazio (limpa o número)
  const whatsapp = normalizeWhatsapp(String(body?.whatsapp_phone ?? ''))

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  // Org do chamador — só owner/admin edita
  const { data: caller } = await admin
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()
  if (!caller) return fail('Você não tem uma organização.', 403)
  if (caller.role !== 'owner' && caller.role !== 'admin') {
    return fail('Só o proprietário ou um admin pode editar membros.', 403)
  }
  const orgId = caller.organization_id as string

  const { error } = await admin
    .from('organization_members')
    .update({ whatsapp_phone: whatsapp })
    .eq('organization_id', orgId)
    .eq('user_id', targetUserId)
  if (error) return fail(`Erro ao salvar: ${error.message}`, 500)

  return NextResponse.json({ ok: true, whatsapp_phone: whatsapp })
}
