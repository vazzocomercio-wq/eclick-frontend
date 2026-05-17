import { Radar } from 'lucide-react'

// Placeholder do módulo e-Click Radar IA — entregue no R1 como parte da
// decomissão do antigo Monitor de Concorrentes. O conteúdo real (Watchlist /
// Grade + Detalhe do produto) é construído no R4.
export default function RadarPlaceholderPage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <div
        className="flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{ background: 'rgba(0,229,255,0.10)', border: '1px solid rgba(0,229,255,0.25)' }}
      >
        <Radar size={30} style={{ color: '#00E5FF' }} />
      </div>
      <h1 className="mt-5 text-xl font-semibold" style={{ color: '#fafafa' }}>
        e-Click Radar IA
      </h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed" style={{ color: '#a1a1aa' }}>
        Inteligência de mercado, concorrência e oportunidades para marketplaces.
        Módulo em construção — em breve.
      </p>
    </div>
  )
}
