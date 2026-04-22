import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

export async function POST(req: NextRequest) {
  // ── 1. Verify the caller is authenticated ──────────────────────────────
  const cookieStore = await cookies()
  const supabaseUser = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        ),
      },
    }
  )

  const { data: { user } } = await supabaseUser.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 2. Parse + validate body ───────────────────────────────────────────
  const body = await req.json().catch(() => null)
  const name: string = body?.name?.trim() ?? ''
  const slug: string = body?.slug?.trim() ?? ''
  const platforms: string[] = Array.isArray(body?.platforms) ? body.platforms : []

  if (name.length < 2) {
    return NextResponse.json({ error: 'Nome inválido.' }, { status: 400 })
  }
  if (!slug) {
    return NextResponse.json({ error: 'Slug inválido.' }, { status: 400 })
  }
  if (platforms.length === 0) {
    return NextResponse.json({ error: 'Selecione ao menos uma plataforma.' }, { status: 400 })
  }

  // ── 3. Service-role client bypasses RLS ────────────────────────────────
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // ── 4. Guard: user must not already have an org ────────────────────────
  const { data: existing } = await admin
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Você já possui uma organização.' }, { status: 409 })
  }

  // ── 5. Insert organization (retry once on slug conflict) ───────────────
  const candidates = [slug, `${slug}-${Math.random().toString(36).slice(2, 5)}`]
  let orgId: string | null = null

  for (const candidate of candidates) {
    const { data, error: orgErr } = await admin
      .from('organizations')
      .insert({ name, slug: candidate })
      .select('id')
      .single()

    if (!orgErr && data) { orgId = data.id; break }
    if (orgErr?.code !== '23505') {
      console.error('[api/onboarding] org insert:', orgErr)
      return NextResponse.json(
        { error: `Erro ao criar organização. [${orgErr?.code}: ${orgErr?.message}]` },
        { status: 500 }
      )
    }
  }

  if (!orgId) {
    return NextResponse.json(
      { error: 'Slug já em uso. Tente um nome diferente.' },
      { status: 409 }
    )
  }

  // ── 6. Insert owner membership ─────────────────────────────────────────
  const { error: memberErr } = await admin
    .from('organization_members')
    .insert({ organization_id: orgId, user_id: user.id, role: 'owner' })

  if (memberErr) {
    console.error('[api/onboarding] member insert:', memberErr)
    // Roll back the org so we don't leave orphans
    await admin.from('organizations').delete().eq('id', orgId)
    return NextResponse.json(
      { error: `Erro ao configurar conta. [${memberErr.code}: ${memberErr.message}]` },
      { status: 500 }
    )
  }

  // ── 7. Insert marketplace connection stubs ─────────────────────────────
  if (platforms.length > 0) {
    const { error: mktErr } = await admin
      .from('marketplaces_connections')
      .insert(platforms.map(platform => ({ organization_id: orgId!, platform })))

    if (mktErr) {
      console.error('[api/onboarding] marketplaces insert:', mktErr)
      // Non-fatal — org and member already exist, user can add platforms later
    }
  }

  return NextResponse.json({ orgId })
}
