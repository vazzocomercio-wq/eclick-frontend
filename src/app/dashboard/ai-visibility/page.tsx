import { Sparkles } from 'lucide-react'

export default function AiVisibilityPage() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-6">
      <div
        className="flex items-center justify-center rounded-2xl mb-6"
        style={{
          width: 72,
          height: 72,
          background: 'rgba(0,229,255,0.10)',
          border: '1px solid rgba(0,229,255,0.25)',
          boxShadow: '0 0 32px -12px rgba(0,229,255,0.4)',
        }}
      >
        <Sparkles size={34} style={{ color: '#00E5FF' }} />
      </div>

      <h1 className="text-2xl font-bold" style={{ color: '#fafafa' }}>
        AI Visibility OS
      </h1>

      <span
        className="mt-3 text-xs font-semibold px-3 py-1 rounded-full"
        style={{ background: 'rgba(0,229,255,0.10)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.25)' }}
      >
        Em construção
      </span>

      <p className="mt-5 max-w-md text-sm leading-relaxed" style={{ color: '#a1a1aa' }}>
        Visibilidade dos seus produtos nos motores de IA — ChatGPT, Perplexity,
        Gemini e Google AI Overviews. Medimos, pontuamos e otimizamos para que
        a IA recomende a sua marca.
      </p>
    </div>
  )
}
