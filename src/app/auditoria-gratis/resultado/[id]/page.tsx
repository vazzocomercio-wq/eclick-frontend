import type { Metadata } from 'next'
import { ResultClient } from '../../_components/ResultClient'

export const metadata: Metadata = { title: 'Sua Nota GEO | e-Click', robots: { index: false } }

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ResultClient id={id} />
}
