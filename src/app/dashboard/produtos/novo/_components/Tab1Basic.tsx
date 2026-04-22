'use client'

import { useRef } from 'react'
import type { TabProps } from '../types'

const inp = 'w-full bg-[#1c1c1f] border border-[#3f3f46] text-white text-sm rounded-lg px-3 py-2.5 outline-none transition-all placeholder-zinc-600 focus:border-[#00E5FF] focus:ring-1 focus:ring-[#00E5FF20]'
const lbl = 'block text-[13px] font-medium text-zinc-300 mb-1.5'
const sec = 'text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-4 pb-2 border-b border-[#1e1e24]'

const CATEGORIES = [
  'Eletrônicos', 'Celulares e Smartphones', 'Informática', 'Televisores',
  'Áudio', 'Câmeras e Fotografia', 'Games', 'Eletrodomésticos',
  'Casa e Jardim', 'Ferramentas', 'Esporte e Lazer', 'Moda',
  'Beleza e Saúde', 'Bebês', 'Brinquedos', 'Alimentos',
  'Automotivo', 'Indústria e Comércio', 'Outros',
]

export default function Tab1Basic({ data, set }: TabProps) {
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFiles(files: FileList | null) {
    if (!files) return
    const arr = Array.from(files).slice(0, 10 - data.photos.length)
    const urls = arr.map(f => URL.createObjectURL(f))
    set('photos', [...data.photos, ...arr])
    set('photoUrls', [...data.photoUrls, ...urls])
  }

  function removePhoto(i: number) {
    set('photos', data.photos.filter((_, idx) => idx !== i))
    set('photoUrls', data.photoUrls.filter((_, idx) => idx !== i))
  }

  return (
    <div className="space-y-8">

      {/* Photos */}
      <section>
        <p className={sec}>Fotos do produto</p>
        <div className="flex flex-wrap gap-3">
          {data.photoUrls.map((url, i) => (
            <div key={url} className="relative group">
              <img
                src={url}
                alt=""
                className="w-20 h-20 rounded-xl object-cover border-2"
                style={{ borderColor: i === 0 ? '#00E5FF' : '#3f3f46' }}
              />
              {i === 0 && (
                <span className="absolute -top-1.5 -right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: '#00E5FF', color: '#000' }}>CAPA</span>
              )}
              <button
                type="button"
                onClick={() => removePhoto(i)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: 'rgba(0,0,0,0.7)' }}
              >
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}

          {data.photos.length < 10 && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-20 h-20 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-colors"
              style={{ borderColor: '#3f3f46' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#00E5FF')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#3f3f46')}
            >
              <svg className="w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-[10px] text-zinc-600">Adicionar</span>
            </button>
          )}
        </div>
        <p className="text-[11px] text-zinc-600 mt-2">
          {data.photos.length}/10 fotos · A primeira imagem será a capa do anúncio
        </p>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
          onChange={e => handleFiles(e.target.files)} />
      </section>

      {/* Identity */}
      <section>
        <p className={sec}>Identificação</p>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className={lbl}>Nome do produto <span className="text-red-400">*</span></label>
            <input type="text" className={inp} maxLength={120} placeholder="Ex: Ventilador de Mesa Mondial 40cm 6 Pás"
              value={data.name} onChange={e => set('name', e.target.value)} />
            <p className="text-[11px] text-zinc-600 mt-1 text-right">{data.name.length}/120</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>SKU interno</label>
              <input type="text" className={inp} placeholder="Ex: VENT-40CM-001"
                value={data.sku} onChange={e => set('sku', e.target.value)} />
            </div>
            <div>
              <label className={lbl}>GTIN / EAN</label>
              <input type="text" className={inp} placeholder="Ex: 7891234567890" maxLength={14}
                value={data.gtin} onChange={e => set('gtin', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Marca <span className="text-red-400">*</span></label>
              <input type="text" className={inp} placeholder="Ex: Mondial"
                value={data.brand} onChange={e => set('brand', e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Modelo</label>
              <input type="text" className={inp} placeholder="Ex: NV-18-6P"
                value={data.model} onChange={e => set('model', e.target.value)} />
            </div>
          </div>
        </div>
      </section>

      {/* Condition */}
      <section>
        <p className={sec}>Condição</p>
        <div className="flex gap-3">
          {(['new', 'used', 'refurbished'] as const).map(c => {
            const labels = { new: 'Novo', used: 'Usado', refurbished: 'Recondicionado' }
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

      {/* Category */}
      <section>
        <p className={sec}>Categoria</p>
        <div>
          <label className={lbl}>Categoria principal</label>
          <select className={inp} value={data.category} onChange={e => set('category', e.target.value)}
            style={{ background: '#1c1c1f' }}>
            <option value="">Selecione uma categoria</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </section>
    </div>
  )
}
