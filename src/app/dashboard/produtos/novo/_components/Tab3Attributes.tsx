'use client'

import type { TabProps } from '../types'

const inp = 'w-full bg-[#1c1c1f] border border-[#3f3f46] text-white text-sm rounded-lg px-3 py-2.5 outline-none transition-all placeholder-zinc-600 focus:border-[#00E5FF] focus:ring-1 focus:ring-[#00E5FF20]'
const sel = `${inp} cursor-pointer`
const lbl = 'block text-[13px] font-medium text-zinc-300 mb-1.5'
const sec = 'text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-4 pb-2 border-b border-[#1e1e24]'

const VOLTAGES = ['110V', '220V', 'Bivolt', '12V', '24V', 'Não se aplica']
const WARRANTY_TYPES = [
  { v: 'seller', l: 'Garantia do Vendedor' },
  { v: 'factory', l: 'Garantia de Fábrica' },
  { v: 'none', l: 'Sem Garantia' },
]
const ORIGINS = [
  '0 - Nacional, exceto as indicadas nos códigos 3, 4, 5 e 8',
  '1 - Estrangeira, importação direta',
  '2 - Estrangeira, adquirida no mercado interno',
  '3 - Nacional com mais de 40% de conteúdo estrangeiro',
  '4 - Nacional produzida com processos produtivos básicos',
  '5 - Nacional com menos de 40% de conteúdo estrangeiro',
  '6 - Estrangeira com similar nacional (sem conteúdo estrangeiro)',
  '7 - Estrangeira sem similar nacional',
  '8 - Nacional, mercadoria ou bem com conteúdo de importação superior a 70%',
]

export default function Tab3Attributes({ data, set }: TabProps) {
  return (
    <div className="space-y-8">

      {/* Main attributes */}
      <section>
        <p className={sec}>Atributos principais</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Cor</label>
            <input type="text" className={inp} placeholder="Ex: Preto"
              value={data.color} onChange={e => set('color', e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Cor da luz</label>
            <input type="text" className={inp} placeholder="Ex: Branco quente"
              value={data.lightColor} onChange={e => set('lightColor', e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Voltagem</label>
            <select className={sel} value={data.voltage} onChange={e => set('voltage', e.target.value)}
              style={{ background: '#1c1c1f' }}>
              <option value="">Selecione</option>
              {VOLTAGES.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Material principal</label>
            <input type="text" className={inp} placeholder="Ex: Plástico ABS"
              value={data.material} onChange={e => set('material', e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Potência</label>
            <div className="flex gap-2">
              <input type="number" className={inp} placeholder="0"
                value={data.power} onChange={e => set('power', e.target.value)} style={{ flex: 1 }} />
              <select className={sel} value={data.powerUnit} onChange={e => set('powerUnit', e.target.value)}
                style={{ background: '#1c1c1f', width: '80px', flex: 'none' }}>
                {['W', 'kW', 'HP', 'BTU', 'VA'].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={lbl}>País de origem</label>
            <input type="text" className={inp} placeholder="Ex: Brasil"
              value={data.originCountry} onChange={e => set('originCountry', e.target.value)} />
          </div>
        </div>
      </section>

      {/* Secondary attributes */}
      <section>
        <p className={sec}>Atributos secundários</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Tipo de iluminação</label>
            <input type="text" className={inp} placeholder="Ex: LED"
              value={data.lightingType} onChange={e => set('lightingType', e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Tipo de lâmpada</label>
            <input type="text" className={inp} placeholder="Ex: LED integrado"
              value={data.lampType} onChange={e => set('lampType', e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Tipo de conexão</label>
            <input type="text" className={inp} placeholder="Ex: Wi-Fi, Bluetooth"
              value={data.connectionType} onChange={e => set('connectionType', e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Local de instalação</label>
            <input type="text" className={inp} placeholder="Ex: Teto, Parede"
              value={data.installLocation} onChange={e => set('installLocation', e.target.value)} />
          </div>
        </div>
      </section>

      {/* Warranty */}
      <section>
        <p className={sec}>Garantia</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Tipo de garantia</label>
            <select className={sel} value={data.warrantyType}
              onChange={e => set('warrantyType', e.target.value as typeof data.warrantyType)}
              style={{ background: '#1c1c1f' }}>
              {WARRANTY_TYPES.map(w => <option key={w.v} value={w.v}>{w.l}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Prazo (dias)</label>
            <input type="number" className={inp} placeholder="90" min={0}
              value={data.warrantyDays} onChange={e => set('warrantyDays', e.target.value)}
              disabled={data.warrantyType === 'none'} />
          </div>
        </div>
      </section>
    </div>
  )
}
