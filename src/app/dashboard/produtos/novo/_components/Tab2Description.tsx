'use client'

import type { TabProps } from '../types'

const inp = 'w-full bg-[#1c1c1f] border border-[#3f3f46] text-white text-sm rounded-lg px-3 py-2.5 outline-none transition-all placeholder-zinc-600 focus:border-[#00E5FF] focus:ring-1 focus:ring-[#00E5FF20]'
const lbl = 'block text-[13px] font-medium text-zinc-300 mb-1.5'
const sec = 'text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-4 pb-2 border-b border-[#1e1e24]'

export default function Tab2Description({ data, set }: TabProps) {
  const mlLen = data.mlTitle.length
  const mlOver = mlLen > 60

  return (
    <div className="space-y-8">

      {/* ML Title */}
      <section>
        <p className={sec}>Título do anúncio</p>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className={lbl} style={{ marginBottom: 0 }}>
              Título Mercado Livre <span className="text-red-400">*</span>
            </label>
            <span className={`text-[11px] font-semibold ${mlOver ? 'text-red-400' : 'text-zinc-500'}`}>
              {mlLen}/60
            </span>
          </div>
          <input
            type="text"
            className={inp}
            maxLength={80}
            placeholder="Ex: Ventilador de Mesa Mondial 40cm 6 Pás Preto 110V"
            value={data.mlTitle}
            onChange={e => set('mlTitle', e.target.value)}
            style={mlOver ? { borderColor: '#f87171' } : {}}
          />
          {mlOver && (
            <p className="text-[11px] text-red-400 mt-1">
              O título do ML deve ter no máximo 60 caracteres.
            </p>
          )}
          <p className="text-[11px] text-zinc-600 mt-1">
            Inclua: produto + marca + modelo + características principais. Não use caps lock, pontuação ou termos promocionais.
          </p>
        </div>
      </section>

      {/* Description */}
      <section>
        <p className={sec}>Descrição</p>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className={lbl} style={{ marginBottom: 0 }}>
              Descrição do produto
            </label>
            <span className="text-[11px] text-zinc-600">
              {data.description.length.toLocaleString('pt-BR')}/50.000
            </span>
          </div>
          <textarea
            className={inp}
            rows={12}
            maxLength={50000}
            placeholder="Descreva o produto com todos os detalhes: especificações técnicas, modo de uso, conteúdo da embalagem, compatibilidade, etc.

Esta descrição é compartilhada entre Mercado Livre e Shopee."
            value={data.description}
            onChange={e => set('description', e.target.value)}
            style={{ resize: 'vertical', minHeight: '240px' }}
          />
          <p className="text-[11px] text-zinc-600 mt-1">
            Compartilhada entre ML e Shopee. Use texto simples, sem HTML.
          </p>
        </div>
      </section>
    </div>
  )
}
