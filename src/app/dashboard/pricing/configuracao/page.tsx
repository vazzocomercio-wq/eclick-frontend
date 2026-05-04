'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { api } from './_components/api'
import {
  PricingConfig, PresetName, MODE_META, PRESET_LABELS,
} from './_components/types'
import { GlobalsTab }              from './_components/GlobalsTab'
import { AbcStrategiesTab }        from './_components/AbcStrategiesTab'
import { TriggersTab }             from './_components/TriggersTab'
import { BlocksTab }               from './_components/BlocksTab'
import { ConfidenceTab }           from './_components/ConfidenceTab'
import { SeasonalTab }             from './_components/SeasonalTab'
import { UntouchableSellersTab }   from './_components/UntouchableSellersTab'
import { AuditTab }                from './_components/AuditTab'
import { useConfirm } from '@/components/ui/dialog-provider'

type TabKey = 'globais' | 'abc' | 'triggers' | 'blocks' | 'confidence' | 'seasonal' | 'untouchable' | 'audit'

const TABS: { key: TabKey; label: string; emoji: string }[] = [
  { key: 'globais',     label: 'Globais',      emoji: '📊' },
  { key: 'abc',         label: 'Curva ABC',    emoji: '📈' },
  { key: 'triggers',    label: 'Gatilhos',     emoji: '⚡' },
  { key: 'blocks',      label: 'Bloqueios',    emoji: '🔒' },
  { key: 'confidence',  label: 'Confiança',    emoji: '🎯' },
  { key: 'seasonal',    label: 'Sazonalidade', emoji: '🗓' },
  { key: 'untouchable', label: 'Vendedores',   emoji: '🚫' },
  { key: 'audit',       label: 'Auditoria',    emoji: '📜' },
]

type Toast = { id: number; msg: string; type: 'success' | 'error' }

export default function PricingConfigPage() {
  const [config, setConfig]       = useState<PricingConfig | null>(null)
  const [original, setOriginal]   = useState<PricingConfig | null>(null)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [tab, setTab]             = useState<TabKey>('globais')
  const [toasts, setToasts]       = useState<Toast[]>([])
  const [dirtyPaths, setDirty]    = useState<Set<string>>(new Set())
  const confirm = useConfirm()

  function pushToast(msg: string, type: Toast['type'] = 'success') {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, msg, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const c = await api<PricingConfig>('/pricing/config')
      setConfig(c); setOriginal(c); setDirty(new Set())
    } catch (e) { pushToast((e as Error).message, 'error') }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // setField: muda local e marca path como dirty
  const setField = useCallback((path: string, value: unknown) => {
    setConfig(prev => {
      if (!prev) return prev
      const clone = JSON.parse(JSON.stringify(prev)) as PricingConfig
      setDeepPath(clone, path, value)
      return clone
    })
    setDirty(prev => {
      const next = new Set(prev)
      next.add(path)
      return next
    })
  }, [])

  const isDirty = useCallback((path: string) => dirtyPaths.has(path), [dirtyPaths])

  // Salvar: PATCH em sequência pra cada path dirty
  async function save() {
    if (!config || dirtyPaths.size === 0) return
    setSaving(true)
    let lastConfig: PricingConfig | null = null
    let errors = 0
    for (const path of dirtyPaths) {
      try {
        const value = getDeepPath(config, path)
        lastConfig = await api<PricingConfig>('/pricing/config', {
          method: 'PATCH',
          body: JSON.stringify({ path, value }),
        })
      } catch (e) {
        errors++
        pushToast(`Falha em ${path}: ${(e as Error).message}`, 'error')
      }
    }
    if (lastConfig) {
      setConfig(lastConfig); setOriginal(lastConfig); setDirty(new Set())
      pushToast(errors === 0 ? 'Configuração salva' : `Salvou parcial (${errors} erro${errors === 1 ? '' : 's'})`, errors === 0 ? 'success' : 'error')
    }
    setSaving(false)
  }

  async function applyPreset(preset: PresetName) {
    if (preset === 'custom') return
    if (dirtyPaths.size > 0) {
      const ok = await confirm({
        title:        'Aplicar preset',
        message:      `Você tem ${dirtyPaths.size} alteração(ões) pendentes. Aplicar preset "${PRESET_LABELS[preset]}" descarta-as. Continuar?`,
        confirmLabel: 'Continuar',
        variant:      'warning',
      })
      if (!ok) return
    }
    setSaving(true)
    try {
      const c = await api<PricingConfig>('/pricing/config/preset', {
        method: 'POST',
        body: JSON.stringify({ preset }),
      })
      setConfig(c); setOriginal(c); setDirty(new Set())
      pushToast(`Preset "${PRESET_LABELS[preset]}" aplicado`, 'success')
    } catch (e) { pushToast((e as Error).message, 'error') }
    setSaving(false)
  }

  async function resetToDefaults() {
    const ok = await confirm({
      title:        'Restaurar padrões',
      message:      'Restaurar padrões? Esta ação descarta todas as customizações.',
      confirmLabel: 'Restaurar',
      variant:      'warning',
    })
    if (!ok) return
    setSaving(true)
    try {
      const c = await api<PricingConfig>('/pricing/config/reset', { method: 'POST' })
      setConfig(c); setOriginal(c); setDirty(new Set())
      pushToast('Padrões restaurados', 'success')
    } catch (e) { pushToast((e as Error).message, 'error') }
    setSaving(false)
  }

  async function discardChanges() {
    if (!original) return
    if (dirtyPaths.size > 0) {
      const ok = await confirm({
        title:        'Descartar mudanças',
        message:      `Descartar ${dirtyPaths.size} alteração(ões) pendentes?`,
        confirmLabel: 'Descartar',
        variant:      'warning',
      })
      if (!ok) return
    }
    setConfig(original); setDirty(new Set())
  }

  const dirtyCount = dirtyPaths.size

  if (loading) return <div className="p-6"><div className="h-64 rounded-2xl animate-pulse" style={{ background: '#111114' }} /></div>
  if (!config) return <div className="p-6 text-zinc-500 text-sm">Não foi possível carregar a configuração.</div>

  const modeMeta   = MODE_META[config.mode]
  const presetName = (config.preset_name ?? 'custom') as PresetName

  return (
    <div className="flex flex-col h-full" style={{ background: '#09090b' }}>
      {/* Header */}
      <div className="shrink-0 px-6 pt-6 pb-4" style={{ borderBottom: '1px solid #1e1e24' }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-white text-lg font-semibold">Inteligência de Preços — Configuração</h1>
            <p className="text-zinc-500 text-sm mt-0.5">8 abas com parâmetros editáveis. Cada mudança é auditada.</p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
              style={{ background: modeMeta.bg, color: modeMeta.color }}>
              {modeMeta.emoji} {modeMeta.label}
            </span>
            <select
              value={presetName}
              onChange={(e) => applyPreset(e.target.value as PresetName)}
              disabled={saving}
              className="px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#fafafa' }}
            >
              {(['conservador', 'equilibrado', 'agressivo', 'custom'] as PresetName[]).map(p => (
                <option key={p} value={p} disabled={p === 'custom'}>
                  {PRESET_LABELS[p]}{p === 'custom' && presetName === 'custom' ? ' (atual)' : ''}
                </option>
              ))}
            </select>
            <button
              onClick={save}
              disabled={dirtyCount === 0 || saving}
              className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
              style={{ background: '#00E5FF', color: '#08323b' }}
            >
              {saving ? 'Salvando…' : `Salvar alterações${dirtyCount > 0 ? ` (${dirtyCount})` : ''}`}
            </button>
            {dirtyCount > 0 && !saving && (
              <button onClick={discardChanges} className="text-xs text-zinc-400 hover:text-white">Descartar</button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar de abas */}
        <div className="shrink-0 w-56 overflow-y-auto" style={{ borderRight: '1px solid #1e1e24', background: '#0a0a0e' }}>
          <div className="p-3 space-y-0.5">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition text-left"
                style={{
                  background:  tab === t.key ? 'rgba(0,229,255,0.05)' : 'transparent',
                  color:       tab === t.key ? '#00E5FF' : '#a1a1aa',
                  borderLeft:  tab === t.key ? '2px solid #00E5FF' : '2px solid transparent',
                }}
              >
                <span className="text-base">{t.emoji}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          {/* Restaurar padrões no rodapé */}
          <div className="p-3 mt-2" style={{ borderTop: '1px solid #1e1e24' }}>
            <button
              onClick={resetToDefaults}
              disabled={saving}
              className="w-full px-3 py-2 rounded-lg text-xs font-medium text-left disabled:opacity-50"
              style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b' }}
            >
              ↻ Restaurar padrões
            </button>
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto p-6">
            {tab === 'globais'     && <GlobalsTab              params={config.global_params}     isDirty={isDirty} setField={setField} />}
            {tab === 'abc'         && <AbcStrategiesTab        strategies={config.abc_strategies} isDirty={isDirty} setField={setField} />}
            {tab === 'triggers'    && <TriggersTab             triggers={config.triggers}        isDirty={isDirty} setField={setField} />}
            {tab === 'blocks'      && <BlocksTab               blocks={config.absolute_blocks} />}
            {tab === 'confidence'  && <ConfidenceTab           rules={config.confidence_rules}   isDirty={isDirty} setField={setField} />}
            {tab === 'seasonal'    && <SeasonalTab             onToast={pushToast} />}
            {tab === 'untouchable' && <UntouchableSellersTab   onToast={pushToast} />}
            {tab === 'audit'       && <AuditTab                onToast={pushToast} />}
          </div>
        </div>
      </div>

      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id}
            className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium shadow-2xl pointer-events-auto"
            style={{
              background: t.type === 'success' ? '#111114' : '#1a0a0a',
              border: `1px solid ${t.type === 'success' ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`,
              color:  t.type === 'success' ? '#34d399' : '#f87171',
            }}>
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Path-walking helpers (espelham backend pricing-config.service)

function parsePath(path: string): Array<string | number> {
  const out: Array<string | number> = []
  for (const part of path.split('.')) {
    const m = part.match(/^([^[\]]+)(?:\[(\d+)\])*$/)
    if (!m) { out.push(part); continue }
    out.push(m[1])
    for (const ai of part.matchAll(/\[(\d+)\]/g)) out.push(Number(ai[1]))
  }
  return out
}

function setDeepPath(target: unknown, path: string, value: unknown): void {
  const segments = parsePath(path)
  let cur: unknown = target
  for (let i = 0; i < segments.length - 1; i++) {
    cur = (cur as Record<string | number, unknown>)[segments[i] as string | number]
  }
  ;(cur as Record<string | number, unknown>)[segments[segments.length - 1] as string | number] = value
}

function getDeepPath(target: unknown, path: string): unknown {
  const segments = parsePath(path)
  let cur: unknown = target
  for (const seg of segments) {
    if (cur === null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string | number, unknown>)[seg as string | number]
  }
  return cur
}
