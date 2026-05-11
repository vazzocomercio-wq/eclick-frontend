import TemplateEditor from '../_components/TemplateEditor'

export default function NewTemplatePage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 px-4 sm:px-8 py-6">
      <div className="max-w-6xl mx-auto">
        <TemplateEditor mode="create" />
      </div>
    </div>
  )
}
