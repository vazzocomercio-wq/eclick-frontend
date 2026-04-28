'use client'

import { AbsoluteBlocks } from './types'

const BLOCKS_INFO: Array<{
  key:    keyof AbsoluteBlocks
  icon:   string
  label:  string
  desc:   string
}> = [
  { key: 'never_below_cost',                icon: '🔒', label: 'Nunca vende abaixo do custo',           desc: 'Garantia matemática: sale_price ≥ cost_price + impostos. Sem exceção.' },
  { key: 'max_change_per_run_pct',          icon: '🔒', label: 'Máximo de 10% de variação por execução', desc: 'Por rodada da IA, nenhum produto sobe ou desce mais que esse percentual em um único movimento.' },
  { key: 'require_cost_data',               icon: '🔒', label: 'Não age sem custo cadastrado',           desc: 'Produtos sem cost_price ficam bloqueados — IA pode sugerir mas nunca aplica.' },
  { key: 'max_changes_per_day_per_product', icon: '🔒', label: 'Máximo 2 mudanças por dia por produto',  desc: 'Evita "ping-pong" de preço — após 2 mudanças no dia, produto fica estável.' },
]

/** Aba 4 — Bloqueios Absolutos. Read-only por design (proteção do
 * negócio). Display informativo apenas. */
export function BlocksTab({ blocks }: { blocks: AbsoluteBlocks }) {
  return (
    <>
      <div className="rounded-2xl px-5 py-4 mb-5" style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.3)' }}>
        <p className="text-amber-400 text-sm font-semibold mb-1">⚠ Bloqueios permanentes</p>
        <p className="text-zinc-400 text-xs">Estes bloqueios são permanentes e não podem ser desativados para proteger seu negócio. São aplicados antes de qualquer regra de preset/curva/gatilho.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {BLOCKS_INFO.map(b => {
          const v = blocks[b.key]
          const display = typeof v === 'boolean' ? (v ? 'Ativo' : 'Inativo') : `${v}${b.key === 'max_change_per_run_pct' ? '%' : ''}`
          return (
            <div key={b.key} className="rounded-2xl p-5" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
              <div className="flex items-start gap-3">
                <span className="text-2xl">{b.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                    <p className="text-white text-sm font-semibold">{b.label}</p>
                    <span className="text-[11px] uppercase tracking-wider px-2 py-0.5 rounded-full font-mono" style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399' }}>
                      {display}
                    </span>
                  </div>
                  <p className="text-zinc-500 text-xs leading-relaxed">{b.desc}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
