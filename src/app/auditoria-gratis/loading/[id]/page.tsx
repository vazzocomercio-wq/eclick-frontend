import type { Metadata } from 'next'
import { LoadingClient } from '../../_components/LoadingClient'

export const metadata: Metadata = { title: 'Analisando… | Auditoria GEO', robots: { index: false } }

export default async function LoadingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <LoadingClient id={id} />
}
