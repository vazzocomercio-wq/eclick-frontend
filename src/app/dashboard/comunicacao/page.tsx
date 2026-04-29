'use client'

import { useState } from 'react'
import PedidosEmCursoTab    from './_components/PedidosEmCursoTab'
import ModelosJornadasTab   from './_components/ModelosJornadasTab'
import TemplatesTab         from './_components/TemplatesTab'
import ConfiguracoesTab     from './_components/ConfiguracoesTab'

type TabKey = 'pedidos' | 'jornadas' | 'templates' | 'configuracoes'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'pedidos',       label: 'Pedidos em curso' },
  { key: 'jornadas',      label: 'Modelos de jornada' },
  { key: 'templates',     label: 'Templates' },
  { key: 'configuracoes', label: 'Configurações' },
]

type Toast = { id: number; msg: string; type: 'success' | 'error' }

/** Shell de /dashboard/comunicacao. Padrão visual = /dashboard/messaging
 * (tabs cyan, header com border-bottom, container max-w-5xl). Conteúdo
 * de cada aba virá nas Fases 3.3 (Templates) e 3.4 (demais). */
export default function ComunicacaoPage() {
  const [tab, setTab]       = useState<TabKey>('pedidos')
  const [toasts, setToasts] = useState<Toast[]>([])

  // Infra de toast — TemplatesTab consome via prop; demais abas (3.4) idem.
  function pushToast(msg: string, type: Toast['type'] = 'success') {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, msg, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }

  return (
    <div className="flex flex-col h-full" style={{ background: '#09090b' }}>
      {/* Header */}
      <div className="shrink-0 px-6 pt-6 pb-2" style={{ borderBottom: '1px solid #1e1e24' }}>
        <h1 className="text-white text-lg font-semibold">Comunicação</h1>
        <p className="text-zinc-500 text-sm mt-0.5">
          Comunicação automatizada pós-venda. WhatsApp ativo.
        </p>

        {/* Tabs */}
        <div className="flex gap-1 mt-4 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap"
              style={{
                borderColor: tab === t.key ? '#00E5FF' : 'transparent',
                color:       tab === t.key ? '#00E5FF' : '#a1a1aa',
              }}
            >{t.label}</button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-6 space-y-4">
          {tab === 'pedidos'       && <PedidosEmCursoTab />}
          {tab === 'jornadas'      && <ModelosJornadasTab />}
          {tab === 'templates'     && <TemplatesTab onToast={pushToast} />}
          {tab === 'configuracoes' && <ConfiguracoesTab onToast={pushToast} />}
        </div>
      </div>

      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id}
            className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium shadow-2xl pointer-events-auto"
            style={{
              background: t.type === 'success' ? '#111114' : '#1a0a0a',
              border: `1px solid ${t.type === 'success' ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`,
              color: t.type === 'success' ? '#34d399' : '#f87171',
            }}>
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  )
}
