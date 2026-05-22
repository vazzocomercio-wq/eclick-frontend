'use client'

/**
 * LeadFormEditor — editor da seção `leadForm` no Designer v3.
 *
 * 2 partes:
 *  1. Conteúdo do formulário: título, descrição, botão, mensagem de
 *     sucesso + lista de campos (liga/desliga, obrigatório, label) +
 *     adicionar campo custom.
 *  2. Destino no Active CRM: picker de funil (pipeline) → etapa (stage)
 *     → responsável (agente, opcional). Busca via os endpoints
 *     /products/active-config/{pipelines,pipelines/:id/stages,agents}.
 *
 * Sem funil configurado, o formulário ainda renderiza mas o lead fica
 * 'received' na fila do dashboard (não some).
 */

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { Plus, Trash2, GripVertical, AlertCircle, Loader2 } from 'lucide-react'
import type { LeadFormSection, LeadFormField } from '@/lib/storefront/v3/types'
import { Field, Input, Textarea, Toggle } from './primitives'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

interface Pipeline { id: string; name: string; is_default: boolean }
interface Stage    { id: string; pipeline_id: string; name: string; position: number }
interface Agent    { member_id: string; display_name: string | null; role: string }

type Settings = LeadFormSection['settings']

export function LeadFormEditor({ settings, onChange }: {
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
}) {
  const fields = settings.fields ?? []

  const setField = (i: number, patch: Partial<LeadFormField>) =>
    onChange({ fields: fields.map((f, k) => k === i ? { ...f, ...patch } : f) })
  const removeField = (i: number) => onChange({ fields: fields.filter((_, k) => k !== i) })
  const addCustom = () => onChange({
    fields: [...fields, {
      key: `custom_${Date.now().toString(36)}`, label: 'Novo campo',
      type: 'text', required: false, enabled: true,
    }],
  })

  return (
    <>
      {/* Conteúdo */}
      <Field label="Título"><Input value={settings.title ?? ''} onChange={v => onChange({ title: v || undefined })} /></Field>
      <Field label="Descrição"><Textarea value={settings.description ?? ''} onChange={v => onChange({ description: v || undefined })} rows={2} /></Field>
      <Field label="Texto do botão"><Input value={settings.submitLabel ?? ''} onChange={v => onChange({ submitLabel: v })} placeholder="Enviar" /></Field>
      <Field label="Mensagem de sucesso" hint="Aparece depois que o cliente envia.">
        <Textarea value={settings.successMessage ?? ''} onChange={v => onChange({ successMessage: v })} rows={2} />
      </Field>

      {/* Campos */}
      <div style={{ marginTop: 8, marginBottom: 4, fontSize: 12, fontWeight: 600, color: '#a1a1aa' }}>Campos do formulário</div>
      <div className="space-y-2">
        {fields.map((f, i) => (
          <div key={f.key} className="rounded p-2.5" style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
            <div className="flex items-center gap-2 mb-2">
              <GripVertical size={12} style={{ color: '#52525b' }} />
              <input value={f.label} onChange={e => setField(i, { label: e.target.value })}
                placeholder="Rótulo do campo"
                style={{ flex: 1, padding: '6px 8px', minHeight: 32, background: '#18181b', color: '#fafafa', border: '1px solid #27272a', borderRadius: 4, fontSize: 13 }} />
              {f.key.startsWith('custom_') && (
                <button type="button" onClick={() => removeField(i)} title="Remover campo"
                  style={{ padding: 4, minHeight: 28, minWidth: 28, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 4, color: '#ef4444', cursor: 'pointer' }}>
                  <Trash2 size={11} />
                </button>
              )}
            </div>
            <div className="flex items-center justify-between gap-3" style={{ fontSize: 12, color: '#a1a1aa' }}>
              <label className="inline-flex items-center gap-1.5">
                <Toggle value={f.enabled} onChange={v => setField(i, { enabled: v })} /> Mostrar
              </label>
              <label className="inline-flex items-center gap-1.5">
                <Toggle value={f.required} onChange={v => setField(i, { required: v })} /> Obrigatório
              </label>
              {f.key.startsWith('custom_') && (
                <select value={f.type} onChange={e => setField(i, { type: e.target.value as LeadFormField['type'] })}
                  style={{ padding: '4px 6px', minHeight: 28, background: '#18181b', color: '#fafafa', border: '1px solid #27272a', borderRadius: 4, fontSize: 12 }}>
                  <option value="text">Texto</option>
                  <option value="textarea">Texto longo</option>
                  <option value="email">E-mail</option>
                  <option value="tel">Telefone</option>
                </select>
              )}
            </div>
          </div>
        ))}
      </div>
      <button type="button" onClick={addCustom}
        className="w-full inline-flex items-center justify-center gap-2 text-sm font-medium rounded mt-2"
        style={{ padding: '10px 16px', minHeight: 40, background: 'rgba(0,229,255,0.05)', border: '1px dashed rgba(0,229,255,0.3)', color: '#00E5FF', cursor: 'pointer' }}>
        <Plus size={14} /> Adicionar campo
      </button>

      {/* Destino no Active */}
      <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #27272a' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#a1a1aa', marginBottom: 6 }}>
          Destino no Active CRM
        </div>
        <FunnelPicker settings={settings} onChange={onChange} />
      </div>
    </>
  )
}

function FunnelPicker({ settings, onChange }: { settings: Settings; onChange: (patch: Partial<Settings>) => void }) {
  const [pipelines, setPipelines] = useState<Pipeline[] | null>(null)
  const [stages, setStages] = useState<Stage[] | null>(null)
  const [agents, setAgents] = useState<Agent[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const token = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token
  }, [])

  const fetchJson = useCallback(async <T,>(path: string): Promise<T | null> => {
    try {
      const t = await token()
      const res = await fetch(`${BACKEND}${path}`, { headers: { Authorization: `Bearer ${t}` } })
      if (!res.ok) return null
      return await res.json() as T
    } catch { return null }
  }, [token])

  // Carrega pipelines + agentes ao montar
  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true); setError(null)
      const [pl, ag] = await Promise.all([
        fetchJson<Pipeline[]>('/products/active-config/pipelines'),
        fetchJson<Agent[]>('/products/active-config/agents'),
      ])
      if (cancelled) return
      if (!pl) { setError('Não foi possível carregar os funis do Active. Verifique se sua loja está conectada ao Active CRM.'); setLoading(false); return }
      setPipelines(pl)
      setAgents(ag ?? [])
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [fetchJson])

  // Carrega stages quando muda o pipeline
  useEffect(() => {
    if (!settings.pipelineId) { setStages(null); return }
    let cancelled = false
    void (async () => {
      const st = await fetchJson<Stage[]>(`/products/active-config/pipelines/${settings.pipelineId}/stages`)
      if (!cancelled) setStages(st ?? [])
    })()
    return () => { cancelled = true }
  }, [settings.pipelineId, fetchJson])

  if (loading) {
    return <div className="text-xs flex items-center gap-2" style={{ color: '#71717a' }}><Loader2 size={12} className="animate-spin" /> Carregando funis…</div>
  }
  if (error) {
    return (
      <div className="text-xs flex items-start gap-2 p-2 rounded" style={{ color: '#f59e0b', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.3)' }}>
        <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
      </div>
    )
  }

  return (
    <>
      <Field label="Funil">
        <select value={settings.pipelineId ?? ''}
          onChange={e => {
            const pl = pipelines?.find(p => p.id === e.target.value)
            onChange({ pipelineId: e.target.value || undefined, pipelineName: pl?.name, stageId: undefined, stageName: undefined })
          }}
          style={selectStyle()}>
          <option value="">Selecione um funil…</option>
          {(pipelines ?? []).map(p => <option key={p.id} value={p.id}>{p.name}{p.is_default ? ' (padrão)' : ''}</option>)}
        </select>
      </Field>
      {settings.pipelineId && (
        <Field label="Etapa de entrada">
          <select value={settings.stageId ?? ''}
            onChange={e => {
              const st = stages?.find(s => s.id === e.target.value)
              onChange({ stageId: e.target.value || undefined, stageName: st?.name })
            }}
            style={selectStyle()}>
            <option value="">Selecione a etapa…</option>
            {(stages ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
      )}
      <Field label="Responsável (opcional)" hint="Vazio = dono da loja recebe os leads.">
        <select value={settings.assignedTo ?? ''}
          onChange={e => onChange({ assignedTo: e.target.value || undefined })}
          style={selectStyle()}>
          <option value="">Automático (dono da org)</option>
          {(agents ?? []).map(a => <option key={a.member_id} value={a.member_id}>{a.display_name ?? a.member_id.slice(0, 8)}</option>)}
        </select>
      </Field>
      {(!settings.pipelineId || !settings.stageId) && (
        <p className="text-[11px]" style={{ color: '#71717a' }}>
          Sem funil/etapa, os leads ficam na fila em <strong style={{ color: '#a1a1aa' }}>Loja &gt; Leads</strong> até você configurar.
        </p>
      )}
    </>
  )
}

function selectStyle(): React.CSSProperties {
  return {
    width: '100%', padding: '10px 12px', minHeight: 44,
    background: '#0a0a0e', color: '#fafafa',
    border: '1px solid #27272a', borderRadius: 6, fontSize: 14,
  }
}
