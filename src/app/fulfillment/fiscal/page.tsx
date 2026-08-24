'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { FilaFiscalPanel } from '../_components/FilaFiscalPanel'

/** Fila fiscal (F2b-6) — tela de trabalho do faturamento do dia. */
export default function FiscalPage() {
  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/fulfillment" className="rounded-xl p-2" style={{ background: '#18181b' }} aria-label="Voltar">
          <ArrowLeft size={18} color="#a1a1aa" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notas fiscais</h1>
          <p className="text-sm" style={{ color: '#71717a' }}>Pedidos aguardando NF-e</p>
        </div>
      </header>
      <FilaFiscalPanel />
    </div>
  )
}
