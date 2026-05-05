'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { api } from './api'
import {
  ChurnRisk, ChurnRiskCustomer, CHURN_LABELS, CHURN_COLORS,
  fmtCurrency, fmtNumber,
} from './types'
import CustomerDetailDrawer from '@/components/customer-hub/CustomerDetailDrawer'

const ICON: Record<ChurnRisk, string> = { low: '🟢', medium: '🟡', high: '🟠', critical: '🔴' }

export function ChurnRiskTab({ onToast }: { onToast: (m: string, type?: 'success' | 'error') => void }) {
  const router = useRouter()
  const [counts, setCounts] = useState<Record<ChurnRisk, number> | null>(null)
  const [list, setList]     = useState<ChurnRiskCustomer[]>([])
  const [loading, setLoad]  = useState(true)
  const [selected, setSelected] = useState<ChurnRiskCustomer | null>(null)

  const load = useCallback(async () => {
    setLoad(true)
    try {
      const [c, l] = await Promise.all([
        api<Record<ChurnRisk, number>>('/customer-hub/churn-risk'),
        api<ChurnRiskCustomer[]>('/customer-hub/churn-risk/customers?limit=200'),
      ])
      setCounts(c); setList(l)
    } catch (e) { onToast((e as Error).message, 'error') }
    setLoad(false)
  }, [onToast])

  useEffect(() => { load() }, [load])

  function reativacao() {
    // Pré-seleciona template "Pós-venda 7 dias" + segmento "em_risco"
    router.push('/dashboard/messaging?template_name=' + encodeURIComponent('Pós-venda 7 dias') + '&segment=em_risco')
  }

  function exportCsv() {
    if (list.length === 0) return
    const escape = (s: string) => /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    const lines = [
      ['Cliente', 'Telefone', 'Última compra', 'Dias sem compra', 'LTV', 'Ticket médio', 'Churn risk'].join(','),
      ...list.map(c => [
        escape(c.display_name ?? ''),
        c.phone ?? '',
        c.last_purchase_at ? new Date(c.last_purchase_at).toLocaleDateString('pt-BR') : '',
        c.rfm_recency_days ?? '',
        (c.ltv_score ?? 0).toFixed(2),
        (c.avg_ticket ?? 0).toFixed(2),
        c.churn_risk,
      ].join(',')),
    ]
    const csv = '﻿' + lines.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const stamp = new Date().toISOString().slice(0, 10)
    a.href = url
    a.download = `churn-risk-${stamp}.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (loading) return <div className="h-64 rounded-2xl animate-pulse" style={{ background: '#111114' }} />
  if (!counts) return <div className="text-zinc-500 text-sm">Sem dados.</div>

  return (
    <>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <p className="text-zinc-400 text-sm">Bucketing por dias desde última compra. Cron diário recalcula. Use a campanha de reativação pra re-engajar high/critical.</p>
        <div className="flex items-center gap-2">
          {list.length > 0 && (
            <button
              onClick={exportCsv}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border"
              style={{ borderColor: '#3f3f46', color: '#e4e4e7' }}>
              Exportar CSV
            </button>
          )}
          <button
            onClick={reativacao}
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: '#f87171', color: '#1a0a0a' }}
          >Criar campanha de reativação</button>
        </div>
      </div>

      {/* 4 cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5">
        {(['low', 'medium', 'high', 'critical'] as ChurnRisk[]).map(k => {
          const color = CHURN_COLORS[k]
          return (
            <div key={k} className="rounded-2xl p-5" style={{ background: '#111114', border: `1px solid ${color}40` }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">{ICON[k]}</span>
                <span className="text-3xl font-bold" style={{ color }}>{fmtNumber(counts[k])}</span>
              </div>
              <p className="text-white text-sm font-semibold">{CHURN_LABELS[k].split(' ')[0]}</p>
              <p className="text-zinc-500 text-xs mt-0.5">{CHURN_LABELS[k].replace(/^\S+\s*/, '')}</p>
            </div>
          )
        })}
      </div>

      {/* Tabela high/critical */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #1e1e24' }}>
          <p className="text-zinc-300 text-sm font-semibold">Clientes em alto/crítico risco — top 200 por LTV</p>
          <p className="text-zinc-500 text-xs">{fmtNumber(list.length)} cliente{list.length === 1 ? '' : 's'}</p>
        </div>
        {list.length === 0
          ? <div className="px-6 py-10 text-center text-zinc-500 text-sm">Nenhum cliente em high/critical 🎉</div>
          : <table className="w-full text-sm">
              <thead style={{ background: '#0a0a0e' }}>
                <tr className="text-zinc-500 text-[11px] uppercase tracking-wider">
                  <th className="text-left  px-4 py-2.5">Cliente</th>
                  <th className="text-left  px-4 py-2.5">Última compra</th>
                  <th className="text-right px-4 py-2.5">Dias sem compra</th>
                  <th className="text-right px-4 py-2.5">LTV</th>
                  <th className="text-right px-4 py-2.5">Ticket médio</th>
                  <th className="text-center px-4 py-2.5">Risco</th>
                  <th className="text-right px-4 py-2.5">Ação</th>
                </tr>
              </thead>
              <tbody>
                {list.map(c => {
                  const color = CHURN_COLORS[c.churn_risk]
                  return (
                    <tr key={c.id} className="border-t cursor-pointer hover:bg-[#161618] transition-colors"
                      style={{ borderColor: '#1e1e24' }}
                      onClick={() => setSelected(c)}>
                      <td className="px-4 py-2.5 text-white truncate max-w-xs">{c.display_name ?? c.phone ?? c.id.slice(0, 8)}</td>
                      <td className="px-4 py-2.5 text-zinc-400">{c.last_purchase_at ? new Date(c.last_purchase_at).toLocaleDateString('pt-BR') : '—'}</td>
                      <td className="px-4 py-2.5 text-right text-zinc-300">{c.rfm_recency_days != null ? `${c.rfm_recency_days}d` : '—'}</td>
                      <td className="px-4 py-2.5 text-right text-zinc-300">{fmtCurrency(c.ltv_score)}</td>
                      <td className="px-4 py-2.5 text-right text-zinc-300">{fmtCurrency(c.avg_ticket)}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="text-[11px] uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: `${color}1a`, color }}>
                          {c.churn_risk}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                        <button onClick={reativacao} className="text-xs text-cyan-400 hover:text-cyan-300">Reativar →</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>}
      </div>

      {selected && (
        <CustomerDetailDrawer
          customerId={selected.id}
          seed={{
            id:               selected.id,
            display_name:     selected.display_name,
            phone:            selected.phone,
            last_purchase_at: selected.last_purchase_at,
            rfm_recency_days: selected.rfm_recency_days,
            ltv_score:        selected.ltv_score,
            avg_ticket:       selected.avg_ticket,
            churn_risk:       selected.churn_risk,
          }}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  )
}
