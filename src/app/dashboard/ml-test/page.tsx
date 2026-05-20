'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

type EndpointDef = {
  key: string
  path: string
}

const ENDPOINTS: EndpointDef[] = [
  { key: 'seller-info',   path: '/ml/seller-info' },
  { key: 'my-items',      path: '/ml/my-items' },
  { key: 'recent-orders', path: '/ml/recent-orders?limit=5' },
  { key: 'questions',     path: '/ml/questions' },
  { key: 'claims',        path: '/ml/claims' },
  { key: 'metrics',       path: '/ml/metrics' },
  { key: 'status',        path: '/ml/status' },
]

const PARAM_ENDPOINTS: EndpointDef[] = [
  { key: 'item-detail',   path: '/ml/items/{mlbId}' },
  { key: 'item-visits',   path: '/ml/items/{mlbId}/visits' },
  { key: 'catalog-comps', path: '/ml/catalog-competitors/{catalogId}' },
  { key: 'item-info',     path: '/ml/item-info?url={url}' },
]

type Result = { data?: unknown; error?: string; loading?: boolean }

async function getToken(): Promise<string | null> {
  const { data } = await createClient().auth.getSession()
  return data.session?.access_token ?? null
}

async function callEndpoint(path: string, sessionExpiredMsg: string): Promise<Result> {
  const token = await getToken()
  if (!token) return { error: sessionExpiredMsg }
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
  const t = useTranslations('mlTest')
  if (!result) return <p className="text-zinc-600 text-xs">{t('clickToTest')}</p>
  if (result.loading) return (
    <div className="flex items-center gap-2 text-zinc-500 text-xs">
      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      {t('waiting')}
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
  const t = useTranslations('mlTest')
  const [results, setResults] = useState<Record<string, Result>>({})
  const [params, setParams] = useState<Record<string, string>>({})
  const [testing, setTesting] = useState(false)

  function setResult(key: string, r: Result) {
    setResults(prev => ({ ...prev, [key]: r }))
  }

  async function test(key: string, path: string) {
    setResult(key, { loading: true })
    const r = await callEndpoint(path, t('sessionExpired'))
    setResult(key, r)
  }

  async function testParam(ep: EndpointDef) {
    const param = params[ep.key] ?? ''
    if (!param.trim()) {
      setResult(ep.key, { error: t('enterParam') })
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
    <div className="flex flex-col h-full" style={{ background: 'var(--background)' }}>
      {/* Header */}
      <div className="shrink-0 px-6 pt-6 pb-5" style={{ borderBottom: '1px solid #1e1e24' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white text-lg font-semibold">{t('title')}</h1>
            <p className="text-zinc-500 text-sm mt-0.5">{t('subtitle')}</p>
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
                {t('testingAll')}
              </>
            ) : t('testAll')}
          </button>
        </div>
        <p className="text-zinc-600 text-xs mt-2 font-mono">{BACKEND}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">

        {/* Fixed endpoints */}
        <section>
          <p className="text-zinc-500 text-[11px] uppercase tracking-widest font-semibold mb-3">{t('fixedEndpoints')}</p>
          <div className="space-y-3">
            {ENDPOINTS.map(ep => (
              <div key={ep.key} className="rounded-2xl overflow-hidden" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
                <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid #1e1e24', background: '#0d0d10' }}>
                  <div className="min-w-0">
                    <p className="text-white text-sm font-semibold">{t(`endpoints.${ep.key}.label`)}</p>
                    <p className="text-zinc-500 text-[11px] font-mono mt-0.5">GET {ep.path}</p>
                    <p className="text-zinc-600 text-[10px] mt-0.5">{t(`endpoints.${ep.key}.note`)}</p>
                  </div>
                  <button
                    onClick={() => test(ep.key, ep.path)}
                    disabled={results[ep.key]?.loading}
                    className="shrink-0 ml-4 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40 transition-all"
                    style={{ background: '#00E5FF', color: '#000' }}
                  >
                    {results[ep.key]?.loading ? '…' : t('test')}
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
          <p className="text-zinc-500 text-[11px] uppercase tracking-widest font-semibold mb-3">{t('paramEndpoints')}</p>
          <div className="space-y-3">
            {PARAM_ENDPOINTS.map(ep => (
              <div key={ep.key} className="rounded-2xl overflow-hidden" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
                <div className="px-5 py-3" style={{ borderBottom: '1px solid #1e1e24', background: '#0d0d10' }}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-white text-sm font-semibold">{t(`endpoints.${ep.key}.label`)}</p>
                      <p className="text-zinc-500 text-[11px] font-mono mt-0.5">GET {ep.path}</p>
                    </div>
                    <button
                      onClick={() => testParam(ep)}
                      disabled={results[ep.key]?.loading}
                      className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
                      style={{ background: '#00E5FF', color: '#000' }}
                    >
                      {results[ep.key]?.loading ? '…' : t('test')}
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder={t(`endpoints.${ep.key}.note`)}
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
