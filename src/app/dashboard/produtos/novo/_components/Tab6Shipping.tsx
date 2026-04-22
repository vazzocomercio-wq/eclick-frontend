'use client'

import type { TabProps } from '../types'

const inp = 'w-full bg-[#1c1c1f] border border-[#3f3f46] text-white text-sm rounded-lg px-3 py-2.5 outline-none transition-all placeholder-zinc-600 focus:border-[#00E5FF] focus:ring-1 focus:ring-[#00E5FF20]'
const lbl = 'block text-[13px] font-medium text-zinc-300 mb-1.5'
const sec = 'text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-4 pb-2 border-b border-[#1e1e24]'

function Toggle({
  checked, onChange, label, sub, badge,
}: {
  checked: boolean; onChange: (v: boolean) => void
  label: string; sub?: string; badge?: string
}) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl border transition-all"
      style={{ background: '#1c1c1f', borderColor: checked ? 'rgba(0,229,255,0.3)' : '#3f3f46' }}>
      <div>
        <div className="flex items-center gap-2">
          <p className="text-white text-sm font-medium">{label}</p>
          {badge && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(0,229,255,0.1)', color: '#00E5FF' }}>{badge}</span>
          )}
        </div>
        {sub && <p className="text-zinc-500 text-[12px] mt-0.5">{sub}</p>}
      </div>
      <button type="button" onClick={() => onChange(!checked)}
        className="relative w-11 h-6 rounded-full transition-all shrink-0"
        style={{ background: checked ? '#00E5FF' : '#3f3f46' }}>
        <span className="absolute top-0.5 transition-all w-5 h-5 rounded-full"
          style={{ background: '#fff', left: checked ? '22px' : '2px' }} />
      </button>
    </div>
  )
}

export default function Tab6Shipping({ data, set }: TabProps) {
  return (
    <div className="space-y-8">

      {/* Weight & dimensions */}
      <section>
        <p className={sec}>Peso e dimensões</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 md:col-span-1">
            <label className={lbl}>Peso <span className="text-red-400">*</span></label>
            <div className="relative">
              <input type="number" className={inp} placeholder="0.500" step="0.001" min={0}
                value={data.weightKg} onChange={e => set('weightKg', e.target.value)}
                style={{ paddingRight: '44px' }} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs font-medium">kg</span>
            </div>
          </div>
          <div />
          <div>
            <label className={lbl}>Largura <span className="text-red-400">*</span></label>
            <div className="relative">
              <input type="number" className={inp} placeholder="0" min={0}
                value={data.widthCm} onChange={e => set('widthCm', e.target.value)}
                style={{ paddingRight: '44px' }} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs font-medium">cm</span>
            </div>
          </div>
          <div>
            <label className={lbl}>Comprimento <span className="text-red-400">*</span></label>
            <div className="relative">
              <input type="number" className={inp} placeholder="0" min={0}
                value={data.lengthCm} onChange={e => set('lengthCm', e.target.value)}
                style={{ paddingRight: '44px' }} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs font-medium">cm</span>
            </div>
          </div>
          <div>
            <label className={lbl}>Altura <span className="text-red-400">*</span></label>
            <div className="relative">
              <input type="number" className={inp} placeholder="0" min={0}
                value={data.heightCm} onChange={e => set('heightCm', e.target.value)}
                style={{ paddingRight: '44px' }} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs font-medium">cm</span>
            </div>
          </div>
        </div>

        {/* Volume display */}
        {data.widthCm && data.lengthCm && data.heightCm && (
          <div className="mt-3 px-4 py-2.5 rounded-lg text-[12px]"
            style={{ background: 'rgba(0,229,255,0.04)', border: '1px solid rgba(0,229,255,0.1)', color: '#71717a' }}>
            Volume: <span style={{ color: '#00E5FF' }}>
              {(parseFloat(data.widthCm) * parseFloat(data.lengthCm) * parseFloat(data.heightCm) / 1000).toFixed(2)} L
            </span>
            {' '}·{' '}
            {data.widthCm}cm × {data.lengthCm}cm × {data.heightCm}cm
          </div>
        )}
      </section>

      {/* Mercado Livre */}
      <section>
        <p className={sec}>Opções Mercado Livre</p>
        <div className="space-y-3">
          <Toggle checked={data.mlFreeShipping} onChange={v => set('mlFreeShipping', v)}
            label="Frete grátis (ML)" badge="ML"
            sub="Você absorve o custo de envio. Aumenta visibilidade no ranking." />
          <Toggle checked={data.mlFlex} onChange={v => set('mlFlex', v)}
            label="Envios Flex" badge="ML"
            sub="Entrega no mesmo dia para compradores próximos. Requer habilitação no ML." />
        </div>
      </section>

      {/* Shopee */}
      <section>
        <p className={sec}>Canais Shopee</p>
        <div className="space-y-3">
          <Toggle checked={data.shopeeXpress} onChange={v => set('shopeeXpress', v)}
            label="Shopee Xpress" badge="até 30kg"
            sub="Transportadora oficial da Shopee. Recomendado para a maioria dos produtos." />
          <Toggle checked={data.shopeeQuickDelivery} onChange={v => set('shopeeQuickDelivery', v)}
            label="Entrega Rápida" badge="até 10kg"
            sub="Entrega expressa para compradores da mesma cidade." />
          <Toggle checked={data.shopeePickup} onChange={v => set('shopeePickup', v)}
            label="Retirada pelo Comprador" badge="até 30kg"
            sub="O comprador retira pessoalmente no seu endereço." />
        </div>
      </section>
    </div>
  )
}
