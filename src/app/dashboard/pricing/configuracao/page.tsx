'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
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

const TAB_KEYS: { key: TabKey; emoji: string }[] = [
  { key: 'globais',     emoji: '📊' },
  { key: 'abc',         emoji: '📈' },
  { key: 'triggers',    emoji: '⚡' },
  { key: 'blocks',      emoji: '🔒' },
  { key: 'confidence',  emoji: '🎯' },
  { key: 'seasonal',    emoji: '🗓' },
  { key: 'untouchable', emoji: '🚫' },
  { key: 'audit',       emoji: '📜' },
]

type Toast = { id: number; msg: string; type: 'success' | 'error' }

export default function PricingConfigPage() {
  const t = useTranslations('pricing')
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
        pushToast(t('saveFieldError', { path, error: (e as Error).message }), 'error')
      }
    }
    if (lastConfig) {
      setConfig(lastConfig); setOriginal(lastConfig); setDirty(new Set())
      pushToast(errors === 0 ? t('configSaved') : t('savedPartial', { errors }), errors === 0 ? 'success' : 'error')
    }
    setSaving(false)
  }

  async function applyPreset(preset: PresetName) {
    if (preset === 'custom') return
    if (dirtyPaths.size > 0) {
      const ok = await confirm({
        title:        t('applyPresetTitle'),
        message:      t('applyPresetMessage', { count: dirtyPaths.size, preset: PRESET_LABELS[preset] }),
        confirmLabel: t('continue'),
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
      pushToast(t('presetApplied', { preset: PRESET_LABELS[preset] }), 'success')
    } catch (e) { pushToast((e as Error).message, 'error') }
    setSaving(false)
  }

  async function resetToDefaults() {
    const ok = await confirm({
      title:        t('resetTitle'),
      message:      t('resetMessage'),
      confirmLabel: t('reset'),
      variant:      'warning',
    })
    if (!ok) return
    setSaving(true)
    try {
      const c = await api<PricingConfig>('/pricing/config/reset', { method: 'POST' })
      setConfig(c); setOriginal(c); setDirty(new Set())
      pushToast(t('defaultsRestored'), 'success')
    } catch (e) { pushToast((e as Error).message, 'error') }
    setSaving(false)
  }

  async function discardChanges() {
    if (!original) return
    if (dirtyPaths.size > 0) {
      const ok = await confirm({
        title:        t('discardTitle'),
        message:      t('discardMessage', { count: dirtyPaths.size }),
        confirmLabel: t('discard'),
        variant:      'warning',
      })
      if (!ok) return
    }
    setConfig(original); setDirty(new Set())
  }

  const dirtyCount = dirtyPaths.size

  if (loading) return <div className="p-6"><div className="h-64 rounded-2xl animate-pulse" style={{ background: '#111114' }} /></div>
  if (!config) return <div className="p-6 text-zinc-500 text-sm">{t('configLoadFailed')}</div>

  const modeMeta   = MODE_META[config.mode]
  const presetName = (config.preset_name ?? 'custom') as PresetName

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--background)' }}>
      {/* Header */}
      <div className="shrink-0 px-6 pt-6 pb-4" style={{ borderBottom: '1px solid #1e1e24' }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-white text-lg font-semibold">{t('configTitle')}</h1>
            <p className="text-zinc-500 text-sm mt-0.5">{t('configSubtitle')}</p>
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
              style={{ background: '#0a0a0e', border: '1px solid #27272a', color: 'var(--text)' }}
            >
              {(['conservador', 'equilibrado', 'agressivo', 'custom'] as PresetName[]).map(p => (
                <option key={p} value={p} disabled={p === 'custom'}>
                  {PRESET_LABELS[p]}{p === 'custom' && presetName === 'custom' ? ` ${t('currentSuffix')}` : ''}
                </option>
              ))}
            </select>
            <button
              onClick={save}
              disabled={dirtyCount === 0 || saving}
              className="glow-rainbow px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
              style={{ background: '#00E5FF', color: '#08323b' }}
            >
              {saving ? t('saving') : `${t('saveChangesBtn')}${dirtyCount > 0 ? ` (${dirtyCount})` : ''}`}
            </button>
            {dirtyCount > 0 && !saving && (
              <button onClick={discardChanges} className="text-xs text-zinc-400 hover:text-white">{t('discard')}</button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar de abas */}
        <div className="shrink-0 w-56 overflow-y-auto" style={{ borderRight: '1px solid #1e1e24', background: '#0a0a0e' }}>
          <div className="p-3 space-y-0.5">
            {TAB_KEYS.map(tk => (
              <button
                key={tk.key}
                onClick={() => setTab(tk.key)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition text-left"
                style={{
                  background:  tab === tk.key ? 'rgba(0,229,255,0.05)' : 'transparent',
                  color:       tab === tk.key ? '#00E5FF' : '#a1a1aa',
                  borderLeft:  tab === tk.key ? '2px solid #00E5FF' : '2px solid transparent',
                }}
              >
                <span className="text-base">{tk.emoji}</span>
                <span>{t(`cfgTab_${tk.key}`)}</span>
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
              ↻ {t('restoreDefaults')}
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
