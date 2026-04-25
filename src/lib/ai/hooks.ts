'use client'

import { useState, useCallback } from 'react'
import { callAI } from './client'
import { PROMPTS } from './prompts'
import { isAIEnabled } from './config'

// ── useSugestaoResposta ────────────────────────────────────────────────────

export function useSugestaoResposta() {
  const [loading, setLoading] = useState(false)
  const [sugestao, setSugestao] = useState<string | null>(null)

  const gerar = useCallback(async (
    pergunta: string,
    produto: { nome?: string; preco?: string | number; estoque?: number },
    opts?: { provider?: string; model?: string },
  ) => {
    if (!isAIEnabled('sugestao_resposta')) return
    setLoading(true)
    const result = await callAI('sugestao_resposta', PROMPTS.sugestao_resposta(pergunta, produto), undefined, opts?.provider, opts?.model)
    setSugestao(result?.content ?? null)
    setLoading(false)
  }, [])

  return { sugestao, loading, gerar, limpar: () => setSugestao(null) }
}

// ── useOtimizarTitulo ──────────────────────────────────────────────────────

export function useOtimizarTitulo() {
  const [loading, setLoading] = useState(false)
  const [titulo, setTitulo] = useState<string | null>(null)

  const otimizar = useCallback(async (tituloAtual: string, categoria: string) => {
    if (!isAIEnabled('titulo_anuncio')) return
    setLoading(true)
    const result = await callAI('titulo_anuncio', PROMPTS.otimizar_titulo(tituloAtual, categoria))
    setTitulo(result?.content ?? null)
    setLoading(false)
  }, [])

  return { titulo, loading, otimizar }
}

// ── useGerarDescricao ──────────────────────────────────────────────────────

export function useGerarDescricao() {
  const [loading, setLoading] = useState(false)
  const [descricao, setDescricao] = useState<string | null>(null)

  const gerar = useCallback(async (produto: { nome?: string; sku?: string; preco?: string | number }) => {
    if (!isAIEnabled('descricao_produto')) return
    setLoading(true)
    const result = await callAI('descricao_produto', PROMPTS.gerar_descricao(produto))
    setDescricao(result?.content ?? null)
    setLoading(false)
  }, [])

  return { descricao, loading, gerar }
}

// ── useSugerirPreco ────────────────────────────────────────────────────────

export function useSugerirPreco() {
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<{
    preco_sugerido: number
    justificativa: string
    margem_estimada: number
  } | null>(null)

  const sugerir = useCallback(async (
    produto: { nome?: string; preco?: number; custo?: number },
    concorrentes: unknown[],
  ) => {
    if (!isAIEnabled('precificacao')) return
    setLoading(true)
    const result = await callAI('precificacao', PROMPTS.sugerir_preco(produto, concorrentes))
    try {
      setResultado(JSON.parse(result?.content ?? '{}'))
    } catch { setResultado(null) }
    setLoading(false)
  }, [])

  return { resultado, loading, sugerir }
}

// ── useClassificarTicket ───────────────────────────────────────────────────

export function useClassificarTicket() {
  const [loading, setLoading] = useState(false)
  const [classificacao, setClassificacao] = useState<{
    urgencia: 'alta' | 'media' | 'baixa'
    motivo: string
    categoria: 'reclamacao' | 'duvida' | 'elogio' | 'cancelamento' | 'troca'
  } | null>(null)

  const classificar = useCallback(async (texto: string) => {
    if (!isAIEnabled('classificacao_ticket')) return
    setLoading(true)
    const result = await callAI('classificacao_ticket', PROMPTS.classificar_ticket(texto))
    try {
      setClassificacao(JSON.parse(result?.content ?? '{}'))
    } catch { setClassificacao(null) }
    setLoading(false)
  }, [])

  return { classificacao, loading, classificar }
}

// ── useInsightsFinanceiros ─────────────────────────────────────────────────

export function useInsightsFinanceiros() {
  const [loading, setLoading] = useState(false)
  const [insights, setInsights] = useState<string | null>(null)

  const gerar = useCallback(async (dados: {
    periodo?: string
    faturamento?: number | string
    margem?: number
    topProdutos?: unknown[]
  }) => {
    if (!isAIEnabled('resumo_financeiro')) return
    setLoading(true)
    const result = await callAI('resumo_financeiro', PROMPTS.insights_financeiros(dados))
    setInsights(result?.content ?? null)
    setLoading(false)
  }, [])

  return { insights, loading, gerar }
}

// ── usePrevisaoDemanda ─────────────────────────────────────────────────────

export function usePrevisaoDemanda() {
  const [loading, setLoading] = useState(false)
  const [previsao, setPrevisao] = useState<{
    quantidade_repor: number
    prazo_dias: number
    justificativa: string
  } | null>(null)

  const prever = useCallback(async (
    produto: { nome?: string; estoque?: number },
    historico: unknown[],
  ) => {
    if (!isAIEnabled('previsao_demanda')) return
    setLoading(true)
    const result = await callAI('previsao_demanda', PROMPTS.previsao_demanda(produto, historico))
    try {
      setPrevisao(JSON.parse(result?.content ?? '{}'))
    } catch { setPrevisao(null) }
    setLoading(false)
  }, [])

  return { previsao, loading, prever }
}
