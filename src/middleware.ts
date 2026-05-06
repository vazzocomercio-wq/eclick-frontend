import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

// Hostnames "internos" do app — qualquer outro vira candidato a custom domain
const APP_HOSTNAMES = new Set([
  'app.eclick.app.br',
  'eclick.app.br',
  'localhost',
  'localhost:3000',
])

/** Detecta storefront por Host header. Quando o Host é diferente dos
 *  hostnames internos, busca store_config por custom_domain ou por
 *  subdomain padrao (storefront.eclick.app.br) e reescreve pra /loja/<slug>.
 *  Retorna null quando deve seguir o flow normal (auth/dashboard). */
async function resolveStorefrontRewrite(request: NextRequest): Promise<NextResponse | null> {
  const host = (request.headers.get('host') ?? '').toLowerCase()
  if (!host) return null
  if (APP_HOSTNAMES.has(host)) return null

  const { pathname } = request.nextUrl

  // Storefront subdomain padrao (storefront.eclick.app.br) usa ?slug= ou
  // path /<slug>/... — implementacao simples: pega primeiro segmento como
  // slug. Pra custom domain do cliente, busca por dominio.
  const isStorefrontSubdomain = host === 'storefront.eclick.app.br'
  let slug: string | null = null

  if (isStorefrontSubdomain) {
    const seg = pathname.split('/').filter(Boolean)[0]
    if (seg) slug = seg
  } else {
    // Custom domain — resolve via backend
    try {
      const res = await fetch(`${BACKEND}/public/store/by-domain?domain=${encodeURIComponent(host)}`, {
        cache: 'no-store',
      })
      if (res.ok) {
        const cfg = await res.json().catch(() => null) as { store_slug?: string } | null
        if (cfg?.store_slug) slug = cfg.store_slug
      }
    } catch { /* fallback no-rewrite */ }
  }

  if (!slug) return null

  // Reescreve pra /loja/<slug>/<resto-do-path> sem mudar a URL visivel
  const url = request.nextUrl.clone()
  const restOfPath = isStorefrontSubdomain
    ? '/' + pathname.split('/').filter(Boolean).slice(1).join('/')
    : pathname
  url.pathname = `/loja/${slug}${restOfPath === '/' ? '' : restOfPath}`
  return NextResponse.rewrite(url)
}

export async function middleware(request: NextRequest) {
  // 1) Storefront por hostname tem prioridade — retorna direto sem auth
  const sfRewrite = await resolveStorefrontRewrite(request)
  if (sfRewrite) return sfRewrite

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // /loja/* eh storefront publico — sem auth
  const isPublicRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/loja') ||
    pathname.startsWith('/lb') ||
    pathname.startsWith('/p/')

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && (pathname === '/' || pathname.startsWith('/login') || pathname.startsWith('/register'))) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
