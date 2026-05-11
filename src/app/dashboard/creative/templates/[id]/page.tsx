'use client'

import { useParams } from 'next/navigation'
import TemplateEditor from '../_components/TemplateEditor'

export default function EditTemplatePage() {
  const params = useParams<{ id: string }>()
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 px-4 sm:px-8 py-6">
      <div className="max-w-6xl mx-auto">
        <TemplateEditor mode="edit" templateId={params.id} />
      </div>
    </div>
  )
}
