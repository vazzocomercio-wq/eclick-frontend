'use client'

import { useState, useEffect, useCallback } from 'react'
import { setAIEnabled, setAIFeature, getAIState, AI_PROVIDERS, getAIPreference, setAIPreference } from '@/lib/ai/config'
import type { AIFeature } from '@/lib/ai/config'
import { CheckCircle2, XCircle, Loader2, Zap } from 'lucide-react'

const FEATURE_META: Record<AIFeature, { label: string; desc: string; page: string }> = {
  sugestao_resposta:    { label: 'Sugestão de Resposta',    desc: 'Gera respostas para perguntas de compradores', page: 'Atendimento → Perguntas' },
  precificacao:         { label: 'Precificação Inteligente', desc: 'Sugere preço competitivo com base nos concorrentes', page: 'Anúncios' },
  titulo_anuncio:       { label: 'Otimização de Título',    desc: 'Reescreve títulos de anúncios para melhor SEO', page: 'Catálogo' },
  descricao_produto:    { label: 'Descrição de Produto',    desc: 'Gera descrições persuasivas para produtos', page: 'Catálogo' },
  analise_concorrencia: { label: 'Análise de Concorrência', desc: 'Insights automáticos sobre posicionamento', page: 'Concorrentes' },
  previsao_demanda:     { label: 'Previsão de Demanda',     desc: 'Prevê necessidade de reposição de estoque', page: 'Estoque' },
  classificacao_ticket: { label: 'Classificação de Ticket', desc: 'Classifica urgência e categoria das mensagens', page: 'Atendimento' },
  resumo_financeiro:    { label: 'Insights Financeiros',    desc: 'Análise automática de dados financeiros', page: 'Financeiro' },
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)}
      className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0"
      style={{ background: on ? '#00E5FF' : '#27272a' }}>
      <span className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform"
        style={{ transform: on ? 'translateX(18px)' : 'translateX(2px)' }} />
    </button>
  )
}

function SparklesIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.88 5.12L19 10l-5.12 1.88L12 17l-1.88-5.12L5 10l5.12-1.88L12 3z" />
      <path d="M5 3l.94 2.56L8.5 6.5l-2.56.94L5 10l-.94-2.56L1.5 6.5l2.56-.94L5 3z" strokeWidth={1.5} />
      <path d="M19 14l.94 2.56L22.5 17.5l-2.56.94L19 21l-.94-2.56L15.5 17.5l2.56-.94L19 14z" strokeWidth={1.5} />
    </svg>
  )
}

// ── Provider card ─────────────────────────────────────────────────────────────

function ProviderCard({
  provId, prov, configured, onTest,
}: {
  provId: string
  prov: { name: string; models: readonly { id: string; name: string; description: string }[] }
  configured: boolean | null
  onTest: (provId: string) => void
}) {
  const [testing, setTesting] = useState(false)
  const [result,  setResult]  = useState<{ ok: boolean; msg: string } | null>(null)

  const [selModel, setSelModel] = useState(() => {
    const pref = getAIPreference()
    return pref.provider === provId ? pref.model : prov.models[0].id
  })

  function applyModel(model: string) {
    setSelModel(model)
    const pref = getAIPreference()
    if (pref.provider === provId) {
      setAIPreference(provId, model)
    }
  }

  function setAsDefault() {
    setAIPreference(provId, selModel)
  }

  async function handleTest() {
    setTesting(true)
    setResult(null)
    try {
      const res = await fetch('/api/ia/completar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feature:  'sugestao_resposta',
          prompt:   'Responda apenas com "ok" em letras minúsculas.',
          provider: provId,
          model:    selModel,
        }),
      })
      const data = await res.json()
      if (res.ok && data.content) {
        setResult({ ok: true, msg: `OK · ${data.tokens_used} tokens · modelo ${data.model}` })
      } else {
        setResult({ ok: false, msg: data.error ?? 'Resposta inesperada' })
      }
    } catch (e) {
      setResult({ ok: false, msg: e instanceof Error ? e.message : 'Erro de rede' })
    } finally {
      setTesting(false)
      onTest(provId)
    }
  }

  const envVar = provId === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY'
  const pref   = getAIPreference()
  const isDefault = pref.provider === provId

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#1e1e24' }}>
        <div>
          <p className="text-sm font-semibold text-white">{prov.name}</p>
          <p className="text-[10px] font-mono text-zinc-600 mt-0.5">{envVar}</p>
        </div>
        <div className="flex items-center gap-2">
          {isDefault && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(0,229,255,0.1)', color: '#00E5FF' }}>
              Padrão
            </span>
          )}
          {configured === null ? (
            <span className="text-[11px] text-zinc-600">Verificando…</span>
          ) : configured ? (
            <span className="flex items-center gap-1 text-[11px] text-green-400">
              <CheckCircle2 size={12} /> Configurada
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] text-red-400">
              <XCircle size={12} /> Não configurada
            </span>
          )}
        </div>
      </div>

      {!configured && configured !== null && (
        <div className="px-4 py-2 border-b" style={{ borderColor: '#1e1e24', background: 'rgba(248,113,113,0.04)' }}>
          <p className="text-[10px] font-mono text-zinc-500">
            Adicione <span className="text-cyan-400">{envVar}=sk-...</span> nas variáveis de ambiente da Vercel / .env.local
          </p>
        </div>
      )}

      {/* Model selector */}
      <div className="px-4 py-3 space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Modelo</p>
        <div className="grid grid-cols-1 gap-1.5">
          {prov.models.map(m => (
            <button key={m.id} onClick={() => applyModel(m.id)}
              className="flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors"
              style={{
                background:  selModel === m.id ? 'rgba(0,229,255,0.06)' : 'rgba(255,255,255,0.02)',
                border:      `1px solid ${selModel === m.id ? 'rgba(0,229,255,0.25)' : '#1e1e24'}`,
              }}>
              <div>
                <p className="text-xs font-medium text-white">{m.name}</p>
                <p className="text-[10px] text-zinc-500">{m.description}</p>
              </div>
              {selModel === m.id && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#00E5FF' }} />}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 px-4 pb-3">
        <button onClick={handleTest} disabled={testing || !configured}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-40"
          style={{ background: '#1a1a1f', color: '#a1a1aa', border: '1px solid #2e2e33' }}>
          {testing ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
          {testing ? 'Testando…' : 'Testar conexão'}
        </button>
        {!isDefault && (
          <button onClick={setAsDefault}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors"
            style={{ background: 'rgba(0,229,255,0.08)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.2)' }}>
            Definir como padrão
          </button>
        )}
        {result && (
          <span className={`text-[11px] ${result.ok ? 'text-green-400' : 'text-red-400'}`}>
            {result.ok ? '✓' : '✗'} {result.msg}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function IAConfigPage() {
  const [globalOn,    setGlobalOn]    = useState(false)
  const [features,    setFeatures]    = useState<Record<AIFeature, boolean>>({} as Record<AIFeature, boolean>)
  const [keyStatus,   setKeyStatus]   = useState<{ anthropic: boolean | null; openai: boolean | null }>({ anthropic: null, openai: null })
  const [testing,     setTesting]     = useState(false)
  const [testResult,  setTestResult]  = useState<{ ok: boolean; msg: string } | null>(null)

  useEffect(() => {
    const state = getAIState()
    setGlobalOn(state.enabled)
    setFeatures(state.features)
    fetch('/api/ia/status')
      .then(r => r.json())
      .then(d => setKeyStatus({ anthropic: d.anthropic ?? false, openai: d.openai ?? false }))
      .catch(() => setKeyStatus({ anthropic: false, openai: false }))
  }, [])

  const handleGlobal  = (v: boolean) => { setGlobalOn(v); setAIEnabled(v); setTestResult(null) }
  const handleFeature = (feature: AIFeature, v: boolean) => {
    setFeatures(prev => ({ ...prev, [feature]: v }))
    setAIFeature(feature, v)
  }

  const handleTest = useCallback(async () => {
    setTesting(true)
    setTestResult(null)
    const pref = getAIPreference()
    try {
      const res = await fetch('/api/ia/completar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature: 'sugestao_resposta', prompt: 'Responda apenas com "ok".', provider: pref.provider, model: pref.model }),
      })
      const data = await res.json()
      setTestResult(res.ok && data.content
        ? { ok: true,  msg: `Conexão ok · ${data.tokens_used} tokens · ${pref.provider}/${pref.model}` }
        : { ok: false, msg: data.error ?? 'Resposta inesperada da API' })
    } catch (e) {
      setTestResult({ ok: false, msg: e instanceof Error ? e.message : 'Erro de rede' })
    } finally { setTesting(false) }
  }, [])

  const activeCount   = Object.values(features).filter(Boolean).length
  const totalFeatures = Object.keys(FEATURE_META).length

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 text-white">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-[#00E5FF]"
          style={{ background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.15)' }}>
          <SparklesIcon />
        </div>
        <div>
          <h1 className="text-base font-semibold">Inteligência Artificial</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Configure provedores e features de IA do eClick</p>
        </div>
      </div>

      {/* Providers */}
      <div className="space-y-3 mb-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 px-1">Provedores</p>
        {Object.entries(AI_PROVIDERS).map(([provId, prov]) => (
          <ProviderCard
            key={provId}
            provId={provId}
            prov={prov}
            configured={keyStatus[provId as keyof typeof keyStatus]}
            onTest={() => {}}
          />
        ))}
      </div>

      {/* Global toggle */}
      <div className="rounded-xl p-4 mb-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-white">IA Global</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {globalOn
                ? `${activeCount} de ${totalFeatures} features ativas`
                : 'Todas as features de IA estão desativadas'}
            </p>
          </div>
          <Toggle on={globalOn} onChange={handleGlobal} />
        </div>
        <div className="mt-3 pt-3 border-t flex items-center gap-3" style={{ borderColor: '#1e1e24' }}>
          <button onClick={handleTest} disabled={testing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-40"
            style={{ background: '#09090b', border: '1px solid #1e1e24', color: '#a1a1aa' }}>
            {testing
              ? <><Loader2 size={12} className="animate-spin" /> Testando…</>
              : <>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Testar provedor padrão
                </>
            }
          </button>
          {testResult && (
            <span className={`text-xs ${testResult.ok ? 'text-green-400' : 'text-red-400'}`}>
              {testResult.ok ? '✓' : '✗'} {testResult.msg}
            </span>
          )}
        </div>
      </div>

      {/* Feature list */}
      <div className="rounded-xl overflow-hidden mb-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: '#1e1e24' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Features</p>
        </div>
        {(Object.entries(FEATURE_META) as [AIFeature, typeof FEATURE_META[AIFeature]][]).map(([key, meta], idx, arr) => (
          <div key={key}
            className="flex items-start gap-4 px-4 py-3.5"
            style={{
              borderBottom: idx < arr.length - 1 ? '1px solid #1e1e24' : undefined,
              opacity: globalOn ? 1 : 0.5,
            }}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-white">{meta.label}</p>
                {features[key] && globalOn && (
                  <span className="text-[10px] text-[#00E5FF] border border-[#00E5FF33] px-1.5 py-0.5 rounded-full">Ativa</span>
                )}
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">{meta.desc}</p>
              <p className="text-[11px] text-zinc-600 mt-0.5">Página: {meta.page}</p>
            </div>
            <Toggle on={features[key] ?? false} onChange={v => handleFeature(key, v)} />
          </div>
        ))}
      </div>

      <p className="text-xs text-zinc-700 text-center">
        Configurações salvas localmente neste navegador via localStorage. As variáveis de ambiente de API key precisam ser configuradas no servidor.
      </p>
    </div>
  )
}
