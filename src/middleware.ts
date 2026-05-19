import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { moduleForPath, CORE_MODULES } from '@/lib/modules'

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

  // Loop guard: se ja foi reescrito pra /loja/<algo>, deixa passar
  // (Next.js executa a rota direto sem segunda passagem do middleware
  //  esperada — mas vale ter o guard pra evitar duplicacao tipo
  //  /loja/vazzo/loja/vazzo).
  if (pathname.startsWith('/loja/')) return null

  // Ignora assets internos do Next (_next, api, etc) pra nao reescrever
  if (pathname.startsWith('/_next/') || pathname.startsWith('/api/')) return null

  const isStorefrontSubdomain = host === 'storefront.eclick.app.br'
  let slug: string | null = null
  let pathOffset = 0  // quantos segmentos do path original consumir como prefixo

  if (isStorefrontSubdomain) {
    const seg = pathname.split('/').filter(Boolean)[0]
    if (seg) {
      slug = seg
      pathOffset = 1  // o slug ja eh o primeiro segmento
    }
  } else {
    // Custom domain — resolve via backend (slug NAO esta no path,
    // entao pathOffset fica 0 e o path inteiro vira sufixo).
    try {
      const res = await fetch(`${BACKEND}/public/store/by-domain?domain=${encodeURIComponent(host)}`, {
        cache: 'no-store',
      })
      if (res.ok) {
        const text = await res.text()
        if (text && text !== 'null') {
          const cfg = JSON.parse(text) as { store_slug?: string } | null
          if (cfg?.store_slug) slug = cfg.store_slug
        }
      }
    } catch { /* fallback no-rewrite */ }
  }

  if (!slug) return null

  const segments = pathname.split('/').filter(Boolean)
  const remainingPath = segments.slice(pathOffset).join('/')
  const targetPath = remainingPath ? `/loja/${slug}/${remainingPath}` : `/loja/${slug}`

  // Usa new URL com base do request.url pra evitar issues de origin/host
  const targetUrl = new URL(targetPath, request.url)
  // Preserva query string original
  request.nextUrl.searchParams.forEach((v, k) => targetUrl.searchParams.set(k, v))
  return NextResponse.rewrite(targetUrl)
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
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/redefinir-senha') ||
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

  // Gating de módulos — bloqueia rota de módulo que a org não tem liberado.
  if (user && pathname.startsWith('/dashboard/')) {
    const mod = moduleForPath(pathname)
    if (mod && !CORE_MODULES.includes(mod)) {
      const { data: m } = await supabase
        .from('organization_members')
        .select('organizations(enabled_modules)')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()
      const orgRel = (m as { organizations?: unknown } | null)?.organizations
      const orgRow = Array.isArray(orgRel) ? orgRel[0] : orgRel
      const enabled =
        (orgRow as { enabled_modules?: string[] | null } | null | undefined)?.enabled_modules ?? null
      if (enabled != null && !enabled.includes(mod)) {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
