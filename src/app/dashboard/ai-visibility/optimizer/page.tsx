import { Suspense } from 'react'
import GeoOptimizerClient from './_components/GeoOptimizerClient'

export default function GeoOptimizerPage() {
  return (
    <Suspense fallback={null}>
      <GeoOptimizerClient />
    </Suspense>
  )
}
