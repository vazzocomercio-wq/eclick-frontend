import React from 'react'

interface ComingSoonPageProps {
  icon: React.ReactNode
  title: string
  description: string
}

export default function ComingSoonPage({ icon, title, description }: ComingSoonPageProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5 px-8 text-center">
      <div style={{ color: '#00E5FF', opacity: 0.9 }}>{icon}</div>
      <div>
        <h1 className="text-2xl font-bold mb-2" style={{ color: '#e4e4e7' }}>{title}</h1>
        <p className="text-sm max-w-md" style={{ color: '#71717a' }}>{description}</p>
      </div>
      <div className="flex flex-col items-center gap-2">
        <span className="text-xs font-semibold px-3 py-1.5 rounded-full"
          style={{ background: 'rgba(0,229,255,0.08)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.2)' }}>
          Em desenvolvimento
        </span>
        <span className="text-xs" style={{ color: '#3f3f46' }}>Previsão: em breve</span>
      </div>
    </div>
  )
}
