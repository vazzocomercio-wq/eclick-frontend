'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ListChecks, Archive } from 'lucide-react'
import { FilaFiscalPanel } from '../_components/FilaFiscalPanel'
import { NotasEmitidasPanel } from '../_components/NotasEmitidasPanel'

/**
 * Faturamento — duas perguntas diferentes, duas abas:
 *   Fila   = "o que preciso faturar agora?" (janela de despacho)
 *   Notas  = "o que já foi faturado?" (histórico, filtros, XML e PDF)
 */
type Aba = 'fila' | 'notas'

export default function FiscalPage() {
  const [aba, setAba] = useState<Aba>('fila')
  const abas: Array<{ k: Aba; label: string; icone: React.ReactNode }> = [
    { k: 'fila', label: 'Fila', icone: <ListChecks size={14} /> },
    { k: 'notas', label: 'Notas emitidas', icone: <Archive size={14} /> },
  ]

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/fulfillment" className="rounded-xl p-2" style={{ background: '#18181b' }} aria-label="Voltar">
          <ArrowLeft size={18} color="#a1a1aa" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Faturamento</h1>
          <p className="text-sm" style={{ color: '#71717a' }}>Notas fiscais dos pedidos</p>
        </div>
      </header>

      <div className="flex gap-1 rounded-xl p-1" style={{ background: '#121214', border: '1px solid #27272a' }}>
        {abas.map((a) => {
          const ativa = aba === a.k
          return (
            <button key={a.k} onClick={() => setAba(a.k)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors duration-150"
              style={ativa
                ? { background: '#00E5FF', color: '#04222a' }
                : { background: 'transparent', color: '#a1a1aa' }}>
              {a.icone} {a.label}
            </button>
          )
        })}
      </div>

      {aba === 'fila' ? <FilaFiscalPanel /> : <NotasEmitidasPanel />}
    </div>
  )
}
