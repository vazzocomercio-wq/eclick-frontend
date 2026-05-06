/**
 * Next.js instrumentation hook — chamado uma vez quando o server inicia.
 * Setup do Sentry guarded por NEXT_PUBLIC_SENTRY_DSN.
 *
 * Sem DSN, no-op total (sem perf hit, sem erro).
 *
 * Setup:
 *   1. Criar projeto Next.js no Sentry → copiar DSN
 *   2. Netlify env: NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
 *   3. Opcional: NEXT_PUBLIC_SENTRY_ENV=production
 *   4. Opcional: SENTRY_AUTH_TOKEN (pra source maps no build)
 */

export async function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
  if (!dsn) return

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const Sentry = await import('@sentry/nextjs')
    Sentry.init({
      dsn,
      environment:      process.env.NEXT_PUBLIC_SENTRY_ENV ?? process.env.NODE_ENV ?? 'production',
      tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? '0'),
    })
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    const Sentry = await import('@sentry/nextjs')
    Sentry.init({
      dsn,
      environment:      process.env.NEXT_PUBLIC_SENTRY_ENV ?? 'production',
      tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? '0'),
    })
  }
}
