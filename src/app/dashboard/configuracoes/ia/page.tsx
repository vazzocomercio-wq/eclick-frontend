'use client'

import { useState, useEffect, useCallback } from 'react'
import { AI_CONFIG, setAIEnabled, setAIFeature, getAIState } from '@/lib/ai/config'
import type { AIFeature } from '@/lib/ai/config'

const FEATURE_META: Record<AIFeature, { label: string; desc: string; page: string }> = {
  sugestao_resposta:    { label: 'Sugestão de Resposta',    desc: 'Gera respostas para perguntas de compradores', page: 'Atendimento → Perguntas' },
  precificacao:         { label: 'Precificação Inteligente', desc: 'Sugere preço competitivo com base nos concorrentes', page: 'Anúncios' },
  titulo_anuncio:       { label: 'Otimização de Título',    desc: 'Reescreve títulos de anúncios para melhor SEO', page: 'Catálogo' },
  descricao_produto:    { label: 'Descrição de Produto',    desc: 'Gera descrições persuasivas para produtos', page: 'Catálogo' },
  analise_concorrencia: { label: 'Análise de Concorrência', desc: 'Insights automáticos sobre posicionamento', page: 'Dashboard' },
  previsao_demanda:     { label: 'Previsão de Demanda',     desc: 'Prevê necessidade de reposição de estoque', page: 'Estoque' },
  classificacao_ticket: { label: 'Classificação de Ticket', desc: 'Classifica urgência e categoria das mensagens', page: 'Atendimento' },
  resumo_financeiro:    { label: 'Insights Financeiros',    desc: 'Análise automática de dados financeiros', page: 'Financeiro' },
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0"
      style={{ background: on ? '#00E5FF' : '#27272a' }}
    >
      <span
        className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform"
        style={{ transform: on ? 'translateX(18px)' : 'translateX(2px)' }}
      />
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

export default function IAConfigPage() {
  const [globalOn, setGlobalOn]     = useState(false)
  const [features, setFeatures]     = useState<Record<AIFeature, boolean>>({} as Record<AIFeature, boolean>)
  const [hasKey, setHasKey]         = useState<boolean | null>(null)
  const [testing, setTesting]       = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)

  // Load state from localStorage on mount
  useEffect(() => {
    const state = getAIState()
    setGlobalOn(state.enabled)
    setFeatures(state.features)
    // Check for API key via a HEAD-like call
    fetch('/api/ia/completar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feature: 'sugestao_resposta', prompt: '__check__' }),
    }).then(r => {
      setHasKey(r.status !== 500)
    }).catch(() => setHasKey(false))
  }, [])

  const handleGlobal = (v: boolean) => {
    setGlobalOn(v)
    setAIEnabled(v)
    setTestResult(null)
  }

  const handleFeature = (feature: AIFeature, v: boolean) => {
    setFeatures(prev => ({ ...prev, [feature]: v }))
    setAIFeature(feature, v)
  }

  const handleTest = useCallback(async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/ia/completar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feature: 'sugestao_resposta',
          prompt: 'Responda apenas com "ok" em letras minúsculas.',
        }),
      })
      const data = await res.json()
      if (res.ok && data.content) {
        setTestResult({ ok: true, msg: `Conexão ok · ${data.tokens_used} tokens usados` })
      } else {
        setTestResult({ ok: false, msg: data.error ?? 'Resposta inesperada da API' })
      }
    } catch (e: any) {
      setTestResult({ ok: false, msg: e.message ?? 'Erro de rede' })
    } finally {
      setTesting(false)
    }
  }, [])

  const activeCount = Object.values(features).filter(Boolean).length
  const totalFeatures = Object.keys(FEATURE_META).length

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 text-white">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-lg bg-[#0a1520] border border-[#00E5FF22] flex items-center justify-center text-[#00E5FF]">
          <SparklesIcon />
        </div>
        <div>
          <h1 className="text-base font-semibold">Inteligência Artificial</h1>
          <p className="text-xs text-gray-500 mt-0.5">Configure as features de IA do e-Click</p>
        </div>
      </div>

      {/* API Key status */}
      <div className="bg-[#111114] border border-[#1a1a1f] rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white">Chave da API Anthropic</p>
            <p className="text-xs text-gray-500 mt-0.5 font-mono">ANTHROPIC_API_KEY</p>
          </div>
          <div className="flex items-center gap-2">
            {hasKey === null ? (
              <span className="text-xs text-gray-500">Verificando...</span>
            ) : hasKey ? (
              <span className="flex items-center gap-1.5 text-xs text-green-400">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                Configurada
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-red-400">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                Não configurada
              </span>
            )}
          </div>
        </div>
        {!hasKey && hasKey !== null && (
          <p className="mt-3 text-xs text-gray-500 bg-[#09090b] rounded-lg p-2 border border-[#1a1a1f] font-mono">
            Adicione <span className="text-[#00E5FF]">ANTHROPIC_API_KEY=sk-ant-...</span> nas variáveis de ambiente da Vercel.
          </p>
        )}
      </div>

      {/* Global toggle */}
      <div className="bg-[#111114] border border-[#1a1a1f] rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-white">IA Global</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {globalOn
                ? `${activeCount} de ${totalFeatures} features ativas`
                : 'Todas as features de IA estão desativadas'}
            </p>
          </div>
          <Toggle on={globalOn} onChange={handleGlobal} />
        </div>

        {/* Test connection */}
        <div className="mt-3 pt-3 border-t border-[#1a1a1f] flex items-center gap-3">
          <button
            onClick={handleTest}
            disabled={testing || !hasKey}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#09090b] border border-[#1a1a1f] text-xs text-gray-400 hover:text-white hover:border-[#00E5FF33] transition-colors disabled:opacity-40"
          >
            {testing ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Testando...
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Testar conexão
              </>
            )}
          </button>
          {testResult && (
            <span className={`text-xs ${testResult.ok ? 'text-green-400' : 'text-red-400'}`}>
              {testResult.ok ? '✓' : '✗'} {testResult.msg}
            </span>
          )}
        </div>
      </div>

      {/* Feature list */}
      <div className="bg-[#111114] border border-[#1a1a1f] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#1a1a1f]">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Features</p>
        </div>
        {(Object.entries(FEATURE_META) as [AIFeature, typeof FEATURE_META[AIFeature]][]).map(
          ([key, meta], idx, arr) => (
            <div
              key={key}
              className={`flex items-start gap-4 px-4 py-3.5 ${idx < arr.length - 1 ? 'border-b border-[#1a1a1f]' : ''} ${!globalOn ? 'opacity-50' : ''}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-white">{meta.label}</p>
                  {features[key] && globalOn && (
                    <span className="text-[10px] text-[#00E5FF] border border-[#00E5FF33] px-1.5 py-0.5 rounded-full">
                      Ativa
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{meta.desc}</p>
                <p className="text-[11px] text-gray-600 mt-0.5">Página: {meta.page}</p>
              </div>
              <Toggle
                on={features[key] ?? false}
                onChange={v => handleFeature(key, v)}
              />
            </div>
          ),
        )}
      </div>

      {/* Note */}
      <p className="text-xs text-gray-600 mt-4 text-center">
        As configurações são salvas localmente neste navegador.
        Os flags compilados no código permanecem <code className="text-gray-500">false</code> — as ativações via este painel usam localStorage como override.
      </p>
    </div>
  )
}
