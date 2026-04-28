'use client'

import { useState } from 'react'
import { OverviewTab }   from './_components/OverviewTab'
import { AbcTab }        from './_components/AbcTab'
import { RfmTab }        from './_components/RfmTab'
import { SegmentsTab }   from './_components/SegmentsTab'
import { ChurnRiskTab }  from './_components/ChurnRiskTab'

type TabKey = 'overview' | 'abc' | 'rfm' | 'segments' | 'churn'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Visão Geral' },
  { key: 'abc',      label: 'Curva ABC' },
  { key: 'rfm',      label: 'RFM' },
  { key: 'segments', label: 'Segmentos' },
  { key: 'churn',    label: 'Churn Risk' },
]

type Toast = { id: number; msg: string; type: 'success' | 'error' }

export default function CustomerHubPage() {
  const [tab, setTab]       = useState<TabKey>('overview')
  const [toasts, setToasts] = useState<Toast[]>([])

  function pushToast(msg: string, type: Toast['type'] = 'success') {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, msg, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }

  return (
    <div className="flex flex-col h-full" style={{ background: '#09090b' }}>
      <div className="shrink-0 px-6 pt-6 pb-2" style={{ borderBottom: '1px solid #1e1e24' }}>
        <h1 className="text-white text-lg font-semibold">Customer Hub</h1>
        <p className="text-zinc-500 text-sm mt-0.5">RFM · Curva ABC · Segmentação · Churn risk. Cron diário @03:17 BRT recalcula tudo automaticamente.</p>

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

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-6">
          {tab === 'overview' && <OverviewTab  onToast={pushToast} />}
          {tab === 'abc'      && <AbcTab       onToast={pushToast} />}
          {tab === 'rfm'      && <RfmTab       onToast={pushToast} />}
          {tab === 'segments' && <SegmentsTab  onToast={pushToast} />}
          {tab === 'churn'    && <ChurnRiskTab onToast={pushToast} />}
        </div>
      </div>

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
