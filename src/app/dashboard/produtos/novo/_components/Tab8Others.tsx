'use client'

import { useRef } from 'react'
import type { TabProps } from '../types'

const inp = 'w-full bg-[#1c1c1f] border border-[#3f3f46] text-white text-sm rounded-lg px-3 py-2.5 outline-none transition-all placeholder-zinc-600 focus:border-[#00E5FF] focus:ring-1 focus:ring-[#00E5FF20]'
const lbl = 'block text-[13px] font-medium text-zinc-300 mb-1.5'
const sec = 'text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-4 pb-2 border-b border-[#1e1e24]'

const PLATFORM_OPTIONS = [
  { id: 'mercadolivre', label: 'Mercado Livre', abbr: 'ML', bg: '#FFE600', fg: '#111' },
  { id: 'shopee',       label: 'Shopee',         abbr: 'SH', bg: '#EE4D2D', fg: '#fff' },
  { id: 'amazon',       label: 'Amazon',          abbr: 'AZ', bg: '#FF9900', fg: '#111' },
  { id: 'magalu',       label: 'Magazine Luiza',  abbr: 'MG', bg: '#0086FF', fg: '#fff' },
]

export default function Tab8Others({ data, set }: TabProps) {
  const anatelRef = useRef<HTMLInputElement>(null)

  function togglePlatform(id: string) {
    set('platforms', data.platforms.includes(id)
      ? data.platforms.filter(p => p !== id)
      : [...data.platforms, id]
    )
  }

  return (
    <div className="space-y-8">

      {/* Publishing */}
      <section>
        <p className={sec}>Publicação</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>SKU principal</label>
            <input type="text" className={inp} placeholder="Ex: SKU-PRINCIPAL-001"
              value={data.mainSku} onChange={e => set('mainSku', e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Agendamento</label>
            <input type="datetime-local" className={inp}
              value={data.publishAt} onChange={e => set('publishAt', e.target.value)}
              style={{ colorScheme: 'dark' }} />
            <p className="text-[11px] text-zinc-600 mt-1">Deixe vazio para publicar imediatamente.</p>
          </div>
        </div>
      </section>

      {/* Platforms */}
      <section>
        <p className={sec}>Plataformas de destino</p>
        <div className="grid grid-cols-2 gap-3">
          {PLATFORM_OPTIONS.map(p => {
            const active = data.platforms.includes(p.id)
            return (
              <button key={p.id} type="button" onClick={() => togglePlatform(p.id)}
                className="flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all"
                style={{
                  background: active ? `${p.bg}12` : '#1c1c1f',
                  borderColor: active ? p.bg : '#3f3f46',
                }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-[12px] font-black shrink-0"
                  style={{ background: p.bg, color: p.fg }}>
                  {p.abbr}
                </div>
                <span className="font-medium text-sm flex-1"
                  style={{ color: active ? '#fff' : '#71717a' }}>
                  {p.label}
                </span>
                <div className="w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ background: active ? '#00E5FF' : 'transparent', border: active ? 'none' : '2px solid #3f3f46' }}>
                  {active && (
                    <svg className="w-2.5 h-2.5" fill="none" stroke="#000" viewBox="0 0 24 24" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </button>
            )
          })}
        </div>
        {data.platforms.length === 0 && (
          <p className="text-[12px] text-red-400 mt-2">Selecione ao menos uma plataforma.</p>
        )}
      </section>

      {/* Condition for Shopee */}
      {data.platforms.includes('shopee') && (
        <section>
          <p className={sec}>Condição — Shopee</p>
          <div className="flex gap-3">
            {(['new', 'used'] as const).map(c => {
              const labels = { new: 'Novo', used: 'Usado' }
              const active = data.condition === c
              return (
                <button key={c} type="button" onClick={() => set('condition', c)}
                  className="flex-1 py-2.5 rounded-lg text-sm font-medium border transition-all"
                  style={{
                    background: active ? 'rgba(0,229,255,0.08)' : '#1c1c1f',
                    borderColor: active ? '#00E5FF' : '#3f3f46',
                    color: active ? '#00E5FF' : '#71717a',
                  }}>
                  {labels[c]}
                </button>
              )
            })}
          </div>
        </section>
      )}

      {/* ANATEL */}
      <section>
        <p className={sec}>Homologação ANATEL (opcional)</p>
        <div className="space-y-3">
          <div>
            <label className={lbl}>Número de homologação</label>
            <input type="text" className={inp} placeholder="Ex: 12345-22-12345"
              value={data.anatelHomologation} onChange={e => set('anatelHomologation', e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Certificado (PDF ou imagem)</label>
            <button type="button" onClick={() => anatelRef.current?.click()}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-dashed transition-all text-sm"
              style={{ borderColor: '#3f3f46', color: '#71717a', background: 'transparent' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#00E5FF')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#3f3f46')}>
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              {data.anatelFile
                ? <span style={{ color: '#00E5FF' }}>{data.anatelFile.name}</span>
                : <span>Clique para selecionar arquivo</span>
              }
            </button>
            <input ref={anatelRef} type="file" accept=".pdf,image/*" className="hidden"
              onChange={e => set('anatelFile', e.target.files?.[0] ?? null)} />
          </div>
        </div>
      </section>
    </div>
  )
}
