'use client'

import type { TabProps } from '../types'

const inp = 'w-full bg-[#1c1c1f] border border-[#3f3f46] text-white text-sm rounded-lg px-3 py-2.5 outline-none transition-all placeholder-zinc-600 focus:border-[#00E5FF] focus:ring-1 focus:ring-[#00E5FF20]'
const sel = `${inp} cursor-pointer`
const lbl = 'block text-[13px] font-medium text-zinc-300 mb-1.5'
const sec = 'text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-4 pb-2 border-b border-[#1e1e24]'

const ORIGINS = [
  { v: '0', l: '0 – Nacional (padrão)' },
  { v: '1', l: '1 – Estrangeira, importação direta' },
  { v: '2', l: '2 – Estrangeira, mercado interno' },
  { v: '3', l: '3 – Nacional, > 40% conteúdo estrangeiro' },
  { v: '4', l: '4 – Nacional, processos produtivos básicos' },
  { v: '5', l: '5 – Nacional, < 40% conteúdo estrangeiro' },
  { v: '6', l: '6 – Estrangeira c/ similar nacional' },
  { v: '7', l: '7 – Estrangeira s/ similar nacional' },
  { v: '8', l: '8 – Nacional, > 70% conteúdo importado' },
]

const CSOSN_OPTIONS = [
  { v: '102', l: '102 – Tributada pelo Simples sem permissão de crédito' },
  { v: '400', l: '400 – Não tributada pelo Simples Nacional' },
  { v: '500', l: '500 – ICMS cobrado anteriormente por ST' },
  { v: '900', l: '900 – Outros' },
]

const PIS_COFINS = [
  { v: '01', l: '01 – Op. Tributável (alíquota básica)' },
  { v: '02', l: '02 – Op. Tributável (alíquota diferenciada)' },
  { v: '07', l: '07 – Op. Isenta da contribuição' },
  { v: '08', l: '08 – Op. sem incidência da contribuição' },
  { v: '49', l: '49 – Outras operações de saída' },
  { v: '70', l: '70 – Op. de aquisição sem direito a crédito' },
  { v: '99', l: '99 – Outras operações' },
]

export default function Tab7Fiscal({ data, set }: TabProps) {
  return (
    <div className="space-y-8">

      <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-[12px]"
        style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#d4a017' }}>
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Esta aba é opcional. Preencha apenas se emite NF-e e precisa de conformidade fiscal.
      </div>

      {/* Classification */}
      <section>
        <p className={sec}>Classificação fiscal</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>NCM</label>
            <input type="text" className={inp} placeholder="0000.00.00" maxLength={10}
              value={data.ncm} onChange={e => set('ncm', e.target.value)} />
          </div>
          <div>
            <label className={lbl}>CEST</label>
            <input type="text" className={inp} placeholder="00.000.00" maxLength={9}
              value={data.cest} onChange={e => set('cest', e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className={lbl}>Origem</label>
            <select className={sel} value={data.origin} onChange={e => set('origin', e.target.value)}
              style={{ background: '#1c1c1f' }}>
              {ORIGINS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </div>
        </div>
      </section>

      {/* CFOP */}
      <section>
        <p className={sec}>CFOP</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Venda mesmo estado</label>
            <input type="text" className={inp} placeholder="5102" maxLength={4}
              value={data.cfopSameState} onChange={e => set('cfopSameState', e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Venda outros estados</label>
            <input type="text" className={inp} placeholder="6102" maxLength={4}
              value={data.cfopOtherState} onChange={e => set('cfopOtherState', e.target.value)} />
          </div>
        </div>
      </section>

      {/* Taxes */}
      <section>
        <p className={sec}>Tributação</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className={lbl}>CSOSN</label>
            <select className={sel} value={data.csosn} onChange={e => set('csosn', e.target.value)}
              style={{ background: '#1c1c1f' }}>
              <option value="">Selecione</option>
              {CSOSN_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className={lbl}>PIS/COFINS CST</label>
            <select className={sel} value={data.pisCofins} onChange={e => set('pisCofins', e.target.value)}
              style={{ background: '#1c1c1f' }}>
              <option value="">Selecione</option>
              {PIS_COFINS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>% Total de tributos</label>
            <div className="relative">
              <input type="number" className={inp} placeholder="0.00" step="0.01" min={0} max={100}
                value={data.tributesPercent} onChange={e => set('tributesPercent', e.target.value)}
                style={{ paddingRight: '30px' }} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">%</span>
            </div>
          </div>
          <div>
            <label className={lbl}>EX TIPI</label>
            <input type="text" className={inp} placeholder="Ex: 01"
              value={data.exTipi} onChange={e => set('exTipi', e.target.value)} />
          </div>
        </div>
      </section>

      {/* Other fiscal */}
      <section>
        <p className={sec}>Outros dados fiscais</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Nº RECOPI</label>
            <input type="text" className={inp} placeholder="20 dígitos"
              value={data.recopi} onChange={e => set('recopi', e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Nº FCI</label>
            <input type="text" className={inp} placeholder="UUID"
              value={data.fci} onChange={e => set('fci', e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className={lbl}>Informações adicionais do produto</label>
            <textarea className={inp} rows={3} placeholder="Informações adicionais para a NF-e..."
              value={data.additionalInfo} onChange={e => set('additionalInfo', e.target.value)}
              style={{ resize: 'vertical' }} />
          </div>
          <div className="col-span-2">
            <label className={lbl}>Item agrupável</label>
            <div className="flex gap-3">
              {(['Sim', 'Não'] as const).map(opt => {
                const active = (opt === 'Sim') === data.groupable
                return (
                  <button key={opt} type="button" onClick={() => set('groupable', opt === 'Sim')}
                    className="px-5 py-2.5 rounded-lg text-sm font-medium border transition-all"
                    style={{
                      background: active ? 'rgba(0,229,255,0.08)' : '#1c1c1f',
                      borderColor: active ? '#00E5FF' : '#3f3f46',
                      color: active ? '#00E5FF' : '#71717a',
                    }}>
                    {opt}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
