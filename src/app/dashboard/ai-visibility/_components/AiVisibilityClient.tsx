'use client'

import Link from 'next/link'
import { Sparkles, Gauge, Wand2, Radar } from 'lucide-react'

type ModuleCard = {
  icon:  React.ReactNode
  title: string
  desc:  string
  href?: string   // quando presente, o card é clicável (módulo pronto)
}

const CARDS: ModuleCard[] = [
  {
    icon:  <Gauge size={22} />,
    title: 'GEO Score',
    desc:  'Pontue de 0 a 100 como o ChatGPT, Perplexity e Gemini enxergam cada produto seu.',
    href:  '/dashboard/ai-visibility/score',
  },
  {
    icon:  <Wand2 size={22} />,
    title: 'GEO Optimizer',
    desc:  'A IA reescreve título e descrição, publica no anúncio e mede o impacto em vendas.',
    href:  '/dashboard/ai-visibility/optimizer',
  },
  {
    icon:  <Radar size={22} />,
    title: 'Citation Radar',
    desc:  'Monitore se seus produtos aparecem nas respostas das IAs para as buscas que importam.',
  },
]

function CardInner({ c }: { c: ModuleCard }) {
  const ready = !!c.href
  return (
    <>
      <div className="flex items-center justify-between">
        <span className="flex items-center justify-center rounded-lg"
          style={{ width: 40, height: 40, background: ready ? 'rgba(0,229,255,0.10)' : 'rgba(255,255,255,0.04)', color: ready ? '#00E5FF' : '#a1a1aa' }}>
          {c.icon}
        </span>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={ready
            ? { background: 'rgba(0,229,255,0.12)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.35)' }
            : { background: '#27272a', color: '#71717a', border: '1px solid #3f3f46' }}>
          {ready ? 'Disponível' : 'Em construção'}
        </span>
      </div>
      <div>
        <h3 className="text-base font-semibold" style={{ color: '#fafafa' }}>{c.title}</h3>
        <p className="mt-1 text-[13px] leading-relaxed" style={{ color: ready ? '#a1a1aa' : '#71717a' }}>{c.desc}</p>
      </div>
    </>
  )
}

export default function AiVisibilityClient() {
  return (
    <div className="px-6 py-8 max-w-5xl mx-auto" style={{ color: '#fafafa' }}>
      {/* Hero */}
      <div className="flex items-start gap-4">
        <div className="flex items-center justify-center rounded-2xl shrink-0"
          style={{ width: 56, height: 56, background: 'rgba(0,229,255,0.10)', border: '1px solid rgba(0,229,255,0.25)', boxShadow: '0 0 32px -12px rgba(0,229,255,0.4)' }}>
          <Sparkles size={28} style={{ color: '#00E5FF' }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Visibility OS</h1>
          <p className="mt-1.5 text-sm leading-relaxed max-w-2xl" style={{ color: '#a1a1aa' }}>
            Otimize seus listings para serem encontrados pelo ChatGPT, Perplexity,
            Gemini e outras IAs generativas.
          </p>
        </div>
      </div>

      {/* Cards de módulos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
        {CARDS.map((c) =>
          c.href ? (
            <Link key={c.title} href={c.href}
              className="rounded-xl p-5 flex flex-col gap-3 transition-colors"
              style={{ background: '#111114', border: '1px solid rgba(0,229,255,0.25)' }}>
              <CardInner c={c} />
            </Link>
          ) : (
            <div key={c.title} className="rounded-xl p-5 flex flex-col gap-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
              <CardInner c={c} />
            </div>
          ),
        )}
      </div>
    </div>
  )
}
