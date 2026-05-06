/**
 * Sentry client-side init. Importado automaticamente pelo Next.js
 * quando @sentry/nextjs está instalado.
 *
 * Sem NEXT_PUBLIC_SENTRY_DSN setado, no-op.
 */

import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment:      process.env.NEXT_PUBLIC_SENTRY_ENV ?? process.env.NODE_ENV ?? 'production',
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? '0'),
    // Replay opcional — comentado pra não inflar bundle por default
    // integrations: [Sentry.replayIntegration()],
    // replaysSessionSampleRate: 0.01,
    // replaysOnErrorSampleRate: 1.0,
  })
}
