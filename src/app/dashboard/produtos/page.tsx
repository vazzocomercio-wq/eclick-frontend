'use client'

import Link from 'next/link'

export default function ProdutosPage() {
  return (
    <div className="p-6 min-h-full" style={{ background: '#09090b' }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-white text-lg font-semibold">Produtos</h2>
          <p className="text-zinc-500 text-sm mt-0.5">Gerencie seu catálogo de produtos</p>
        </div>
        <Link
          href="/dashboard/produtos/novo"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all active:scale-[0.98]"
          style={{ background: '#00E5FF', color: '#000' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Novo Produto
        </Link>
      </div>

      {/* Empty state */}
      <div
        className="rounded-2xl border flex flex-col items-center justify-center py-20"
        style={{ background: '#111114', borderColor: '#1e1e24' }}
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: 'rgba(0,229,255,0.08)' }}
        >
          <svg className="w-7 h-7" fill="none" stroke="#00E5FF" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </div>
        <p className="text-white font-semibold text-base mb-1">Nenhum produto cadastrado</p>
        <p className="text-zinc-500 text-sm mb-6 text-center max-w-xs">
          Adicione produtos ao seu catálogo para começar a monitorar preços e concorrentes.
        </p>
        <Link
          href="/dashboard/produtos/novo"
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all active:scale-[0.98]"
          style={{ background: '#00E5FF', color: '#000' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Cadastrar primeiro produto
        </Link>
      </div>
    </div>
  )
}
