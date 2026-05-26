import type { Metadata } from 'next'
import { UnsubClient } from '../_components/UnsubClient'

export const metadata: Metadata = { title: 'Descadastrar | Auditoria GEO', robots: { index: false } }

export default async function DescadastroPage({ searchParams }: { searchParams: Promise<{ aid?: string }> }) {
  const { aid } = await searchParams
  return <UnsubClient aid={aid ?? ''} />
}
