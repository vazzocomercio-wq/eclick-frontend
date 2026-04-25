import { Clock, Tag, BarChart2, RefreshCw, Plug } from 'lucide-react'
import Link from 'next/link'

export type ChannelConfig = {
  name: string
  abbr: string
  abbrBg: string
  abbrColor: string
  description: string
  features: string[]
}

export default function ChannelListingsPlaceholder({ channel }: { channel: ChannelConfig }) {
  return (
    <div className="p-6 space-y-7 min-h-full" style={{ background: '#09090b' }}>

      {/* Header */}
      <div>
        <p className="text-zinc-500 text-xs">Catálogo · Anúncios</p>
        <div className="flex items-center gap-3 mt-1.5">
          <div className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center text-xs font-black"
            style={{ background: channel.abbrBg, color: channel.abbrColor }}>
            {channel.abbr}
          </div>
          <div>
            <h2 className="text-white text-lg font-semibold">{channel.name}</h2>
            <p className="text-zinc-500 text-xs mt-0.5">{channel.description}</p>
          </div>
          <span className="ml-auto flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(82,82,91,0.2)', color: '#71717a', border: '1px solid #2e2e33' }}>
            <Clock size={10} />
            Em breve
          </span>
        </div>
      </div>

      {/* Feature preview */}
      <div className="rounded-2xl p-5 space-y-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">O que será possível fazer</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: <Tag size={13} />,      label: 'Gerenciar anúncios', desc: 'Edite título, preço, estoque e fotos diretamente do eClick.' },
            { icon: <BarChart2 size={13} />, label: 'Métricas e visitas',  desc: 'Acompanhe impressões, cliques e conversões por anúncio.' },
            { icon: <RefreshCw size={13} />, label: 'Sincronização',       desc: 'Estoque e preços atualizados automaticamente em todos os canais.' },
          ].map(f => (
            <div key={f.label} className="rounded-xl p-3 space-y-1.5" style={{ background: '#18181b', border: '1px solid #27272a' }}>
              <span style={{ color: channel.abbrColor }}>{f.icon}</span>
              <p className="text-xs font-semibold text-zinc-300">{f.label}</p>
              <p className="text-[10px] text-zinc-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
        {channel.features.length > 0 && (
          <ul className="space-y-1.5 pt-1">
            {channel.features.map(f => (
              <li key={f} className="flex items-start gap-2 text-[11px] text-zinc-500">
                <span className="mt-0.5 text-zinc-700">•</span>{f}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* CTA */}
      <div className="flex flex-col items-center gap-3 py-8 rounded-2xl"
        style={{ background: '#111114', border: '1px dashed #2e2e33' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: channel.abbrBg, color: channel.abbrColor }}>
          <Plug size={16} />
        </div>
        <p className="text-sm font-semibold text-zinc-300">
          A integração com {channel.name} está em desenvolvimento
        </p>
        <p className="text-xs text-zinc-500 text-center max-w-sm">
          Quando disponível, será configurada em{' '}
          <Link href="/dashboard/configuracoes/integracoes"
            className="underline" style={{ color: '#00E5FF' }}>
            Configurações → Integrações
          </Link>.
        </p>
        <span className="text-[10px] text-zinc-600">Novas integrações são adicionadas continuamente.</span>
      </div>

    </div>
  )
}
