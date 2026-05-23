import type { Metadata, Viewport } from 'next'
import { FulfillmentShell } from './_components/FulfillmentShell'

export const metadata: Metadata = {
  title: 'e-Click Separação',
  manifest: '/fulfillment-manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'e-Click CD' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#09090b',
}

export default function FulfillmentLayout({ children }: { children: React.ReactNode }) {
  return <FulfillmentShell>{children}</FulfillmentShell>
}
