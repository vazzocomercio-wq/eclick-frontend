'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

type EndpointDef = {
  key: string
  label: string
  path: string
  note?: string
}

const ENDPOINTS: EndpointDef[] = [
  { key: 'seller-info',   label: 'Dados do Vendedor',        path: '/ml/seller-info',         note: 'nickname, reputação, métricas' },
  { key: 'my-items',      label: 'Meus Anúncios Ativos',     path: '/ml/my-items',            note: 'lista de MLB IDs ativos' },
  { key: 'recent-orders', label: 'Pedidos Recentes',         path: '/ml/recent-orders?limit=5', note: 'últimos 5 pedidos' },
  { key: 'questions',     label: 'Perguntas sem Resposta',   path: '/ml/questions',           note: 'perguntas pendentes' },
  { key: 'claims',        label: 'Reclamações Abertas',      path: '/ml/claims',              note: 'reclamações como reclamante' },
  { key: 'metrics',       label: 'Métricas 30 dias',         path: '/ml/metrics',             note: 'visitas e pedidos' },
  { key: 'status',        label: 'Status da Conexão',        path: '/ml/status',              note: 'token, nickname, expires_at' },
]

const PARAM_ENDPOINTS: EndpointDef[] = [
  { key: 'item-detail',   label: 'Detalhe do Anúncio',       path: '/ml/items/{mlbId}',       note: 'ex: MLB4499322187' },
  { key: 'item-visits',   label: 'Visitas do Anúncio (7d)',  path: '/ml/items/{mlbId}/visits', note: 'ex: MLB4499322187' },
  { key: 'catalog-comps', label: 'Concorrentes do Catálogo', path: '/ml/catalog-competitors/{catalogId}', note: 'ex: MLBU123456789' },
  { key: 'item-info',     label: 'Info Concorrente (URL)',   path: '/ml/item-info?url={url}', note: 'cole uma URL do ML' },
]

type Result = { data?: unknown; error?: string; loading?: boolean }

async function getToken(): Promise<string | null> {
  const { data } = await createClient().auth.getSession()
  return data.session?.access_token ?? null
}

async function callEndpoint(path: string): Promise<Result> {
  const token = await getToken()
  if (!token) return { error: 'Sessão expirada — faça login novamente.' }
  try {
    const res = await fetch(`${BACKEND}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await res.json().catch(() => null)
    if (!res.ok) return { error: `HTTP ${res.status}: ${JSON.stringify(body)}` }
    return { data: body }
  } catch (e) {
    return { error: String(e) }
  }
}

function ResultBox({ result }: { result?: Result }) {
  if (!result) return <p className="text-zinc-600 text-xs">Clique em Testar.</p>
  if (result.loading) return (
    <div className="flex items-center gap-2 text-zinc-500 text-xs">
      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      Aguardando…
    </div>
  )
  if (result.error) return (
    <p className="text-red-400 text-xs font-mono break-all whitespace-pre-wrap">{result.error}</p>
  )
  return (
    <pre className="text-xs font-mono text-emerald-300 overflow-x-auto whitespace-pre-wrap break-words max-h-56 leading-relaxed">
      {JSON.stringify(result.data, null, 2)}
    </pre>
  )
}

export default function MlTestPage() {
  const [results, setResults] = useState<Record<string, Result>>({})
  const [params, setParams] = useState<Record<string, string>>({})
  const [testing, setTesting] = useState(false)

  function setResult(key: string, r: Result) {
    setResults(prev => ({ ...prev, [key]: r }))
  }

  async function test(key: string, path: string) {
    setResult(key, { loading: true })
    const r = await callEndpoint(path)
    setResult(key, r)
  }

  async function testParam(ep: EndpointDef) {
    const param = params[ep.key] ?? ''
    if (!param.trim()) {
      setResult(ep.key, { error: 'Informe o parâmetro antes de testar.' })
      return
    }
    const path = ep.path
      .replace('{mlbId}', encodeURIComponent(param.trim()))
      .replace('{catalogId}', encodeURIComponent(param.trim()))
      .replace('{url}', encodeURIComponent(param.trim()))
    await test(ep.key, path)
  }

  async function testAll() {
    setTesting(true)
    await Promise.all(ENDPOINTS.map(ep => test(ep.key, ep.path)))
    setTesting(false)
  }

  return (
    <div className="flex flex-col h-full" style={{ background: '#09090b' }}>
      {/* Header */}
      <div className="shrink-0 px-6 pt-6 pb-5" style={{ borderBottom: '1px solid #1e1e24' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white text-lg font-semibold">ML API Debug</h1>
            <p className="text-zinc-500 text-sm mt-0.5">Teste todos os endpoints do Mercado Livre</p>
          </div>
          <button
            onClick={testAll}
            disabled={testing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
            style={{ background: '#00E5FF', color: '#000' }}
          >
            {testing ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Testando…
              </>
            ) : 'Testar todos'}
          </button>
        </div>
        <p className="text-zinc-600 text-xs mt-2 font-mono">{BACKEND}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">

        {/* Fixed endpoints */}
        <section>
          <p className="text-zinc-500 text-[11px] uppercase tracking-widest font-semibold mb-3">Endpoints fixos</p>
          <div className="space-y-3">
            {ENDPOINTS.map(ep => (
              <div key={ep.key} className="rounded-2xl overflow-hidden" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
                <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid #1e1e24', background: '#0d0d10' }}>
                  <div className="min-w-0">
                    <p className="text-white text-sm font-semibold">{ep.label}</p>
                    <p className="text-zinc-500 text-[11px] font-mono mt-0.5">GET {ep.path}</p>
                    {ep.note && <p className="text-zinc-600 text-[10px] mt-0.5">{ep.note}</p>}
                  </div>
                  <button
                    onClick={() => test(ep.key, ep.path)}
                    disabled={results[ep.key]?.loading}
                    className="shrink-0 ml-4 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40 transition-all"
                    style={{ background: '#00E5FF', color: '#000' }}
                  >
                    {results[ep.key]?.loading ? '…' : 'Testar'}
                  </button>
                </div>
                <div className="px-5 py-4">
                  <ResultBox result={results[ep.key]} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Parameterised endpoints */}
        <section>
          <p className="text-zinc-500 text-[11px] uppercase tracking-widest font-semibold mb-3">Endpoints com parâmetro</p>
          <div className="space-y-3">
            {PARAM_ENDPOINTS.map(ep => (
              <div key={ep.key} className="rounded-2xl overflow-hidden" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
                <div className="px-5 py-3" style={{ borderBottom: '1px solid #1e1e24', background: '#0d0d10' }}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-white text-sm font-semibold">{ep.label}</p>
                      <p className="text-zinc-500 text-[11px] font-mono mt-0.5">GET {ep.path}</p>
                    </div>
                    <button
                      onClick={() => testParam(ep)}
                      disabled={results[ep.key]?.loading}
                      className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
                      style={{ background: '#00E5FF', color: '#000' }}
                    >
                      {results[ep.key]?.loading ? '…' : 'Testar'}
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder={ep.note}
                    value={params[ep.key] ?? ''}
                    onChange={e => setParams(prev => ({ ...prev, [ep.key]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') testParam(ep) }}
                    className="mt-2 w-full px-3 py-2 rounded-lg text-sm text-white placeholder-zinc-600 border border-[#3f3f46] outline-none focus:border-[#00E5FF] font-mono"
                    style={{ background: '#1c1c1f' }}
                  />
                </div>
                <div className="px-5 py-4">
                  <ResultBox result={results[ep.key]} />
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  )
}
