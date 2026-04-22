'use client'

import { useId } from 'react'
import type { TabProps, Variation } from '../types'

const inp = 'w-full bg-[#1c1c1f] border border-[#3f3f46] text-white text-sm rounded-lg px-3 py-2 outline-none transition-all placeholder-zinc-600 focus:border-[#00E5FF] focus:ring-1 focus:ring-[#00E5FF20]'
const sec = 'text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-4 pb-2 border-b border-[#1e1e24]'

const VARIATION_TYPES = ['Cor', 'Voltagem', 'Tamanho', 'Modelo', 'Capacidade', 'Material', 'Estilo']

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className="relative w-11 h-6 rounded-full transition-all shrink-0"
      style={{ background: checked ? '#00E5FF' : '#3f3f46' }}>
      <span className="absolute top-0.5 transition-all w-5 h-5 rounded-full"
        style={{ background: '#fff', left: checked ? '22px' : '2px' }} />
    </button>
  )
}

export default function Tab4Variations({ data, set }: TabProps) {
  const uid = useId()

  function addVariation() {
    const v: Variation = {
      id: `${uid}-${Date.now()}`,
      type: 'Cor', value: '', price: data.price, stock: '', sku: '',
    }
    set('variations', [...data.variations, v])
  }

  function updateVariation(id: string, field: keyof Variation, value: string) {
    set('variations', data.variations.map(v => v.id === id ? { ...v, [field]: value } : v))
  }

  function removeVariation(id: string) {
    set('variations', data.variations.filter(v => v.id !== id))
  }

  return (
    <div className="space-y-8">
      {/* Toggle */}
      <section>
        <p className={sec}>Variações do produto</p>
        <div className="flex items-center justify-between p-4 rounded-xl border"
          style={{ background: '#1c1c1f', borderColor: '#3f3f46' }}>
          <div>
            <p className="text-white text-sm font-medium">Produto com variações</p>
            <p className="text-zinc-500 text-[12px] mt-0.5">
              Ative se o produto tem cores, tamanhos, voltagens ou modelos diferentes
            </p>
          </div>
          <Toggle checked={data.hasVariations} onChange={v => {
            set('hasVariations', v)
            if (!v) set('variations', [])
          }} />
        </div>
      </section>

      {/* Variation table */}
      {data.hasVariations && (
        <section>
          <p className={sec}>Tabela de variações</p>

          {data.variations.length === 0 ? (
            <p className="text-zinc-500 text-sm text-center py-6">
              Nenhuma variação adicionada. Clique em "Adicionar variação" abaixo.
            </p>
          ) : (
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#1e1e24' }}>
              {/* Table header */}
              <div className="grid gap-2 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-zinc-500"
                style={{ gridTemplateColumns: '140px 1fr 110px 90px 130px 36px', background: '#0c0c0f', borderBottom: '1px solid #1e1e24' }}>
                <span>Tipo</span>
                <span>Valor</span>
                <span>Preço (R$)</span>
                <span>Estoque</span>
                <span>SKU variação</span>
                <span />
              </div>
              {/* Rows */}
              {data.variations.map((v, i) => (
                <div key={v.id}
                  className="grid gap-2 px-4 py-2.5 items-center"
                  style={{
                    gridTemplateColumns: '140px 1fr 110px 90px 130px 36px',
                    background: i % 2 === 0 ? '#111114' : '#0f0f12',
                    borderBottom: '1px solid #1e1e24',
                  }}>
                  <select className={inp} value={v.type} onChange={e => updateVariation(v.id, 'type', e.target.value)}
                    style={{ background: '#1c1c1f' }}>
                    {VARIATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input type="text" className={inp} placeholder="Ex: Vermelho" value={v.value}
                    onChange={e => updateVariation(v.id, 'value', e.target.value)} />
                  <input type="text" className={inp} placeholder="0,00" value={v.price}
                    onChange={e => updateVariation(v.id, 'price', e.target.value)} />
                  <input type="number" className={inp} placeholder="0" min={0} value={v.stock}
                    onChange={e => updateVariation(v.id, 'stock', e.target.value)} />
                  <input type="text" className={inp} placeholder="SKU-VAR-001" value={v.sku}
                    onChange={e => updateVariation(v.id, 'sku', e.target.value)} />
                  <button type="button" onClick={() => removeVariation(v.id)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0"
                    style={{ color: '#71717a' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#71717a')}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          <button type="button" onClick={addVariation}
            className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all"
            style={{ borderColor: '#00E5FF', color: '#00E5FF', background: 'rgba(0,229,255,0.05)' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Adicionar variação
          </button>

          {data.hasVariations && data.variations.length > 0 && (
            <div className="mt-4 px-4 py-3 rounded-lg text-[12px]"
              style={{ background: 'rgba(0,229,255,0.05)', border: '1px solid rgba(0,229,255,0.12)', color: '#71717a' }}>
              <span style={{ color: '#00E5FF' }}>Dica:</span> O preço e estoque da aba Vendas serão usados como padrão quando não preenchidos aqui.
            </div>
          )}
        </section>
      )}
    </div>
  )
}
