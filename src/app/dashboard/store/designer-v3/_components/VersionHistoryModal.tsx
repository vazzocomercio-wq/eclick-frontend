'use client'

/**
 * VersionHistoryModal — historico de versions do design v3 (Fase E).
 *
 * Lista snapshots por data + source + label. Botao "Restaurar" copia a
 * version selecionada de volta pro design atual.
 */

import { useEffect, useState, useCallback } from 'react'
import { X, History, Loader2, RotateCcw, Sparkles, LayoutTemplate, Save, Check } from 'lucide-react'
import { useConfirm } from '@/components/ui/dialog-provider'

interface Version {
  id:         string
  label:      string | null
  source:     'manual_save' | 'ai_generated' | 'template_applied' | 'publish'
  created_at: string
}

const SOURCE_LABELS: Record<Version['source'], { label: string; icon: React.ReactNode; color: string }> = {
  manual_save:      { label: 'Save manual',     icon: <Save size={12} />,           color: '#a1a1aa' },
  ai_generated:     { label: 'Gerado por IA',   icon: <Sparkles size={12} />,       color: '#00E5FF' },
  template_applied: { label: 'Template aplicado', icon: <LayoutTemplate size={12} />, color: '#a78bfa' },
  publish:          { label: 'Publicado',       icon: <Check size={12} />,          color: '#22c55e' },
}

interface Props {
  onClose:   () => void
  onRevert:  (versionId: string) => Promise<void>
  fetchUrl:  string
  authToken: () => Promise<string | undefined>
}

export function VersionHistoryModal({ onClose, onRevert, fetchUrl, authToken }: Props) {
  const [versions, setVersions] = useState<Version[] | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error,   setError]     = useState<string | null>(null)
  const [busyId,  setBusyId]    = useState<string | null>(null)
  const confirm = useConfirm()

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const token = await authToken()
      const res = await fetch(fetchUrl, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const { versions: list } = await res.json()
      setVersions(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar histórico.')
    } finally {
      setLoading(false)
    }
  }, [fetchUrl, authToken])

  useEffect(() => { void load() }, [load])

  const revert = async (id: string) => {
    const ok = await confirm({
      title:        'Restaurar versão',
      message:      'O design atual será sobrescrito por esta versão. Você pode reverter de novo a qualquer momento pelo próprio histórico.',
      confirmLabel: 'Restaurar',
      variant:      'warning',
    })
    if (!ok) return
    setBusyId(id)
    await onRevert(id)
    // parent fecha o modal
  }

  return (
    <div onClick={() => !busyId && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: '#0d0d10', border: '1px solid #27272a', borderRadius: 12, width: '100%', maxWidth: 560, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: '#27272a' }}>
          <div className="flex items-center gap-2">
            <History size={16} style={{ color: '#a1a1aa' }} />
            <h2 className="text-sm font-medium" style={{ color: '#fafafa' }}>Histórico de versões</h2>
          </div>
          <button onClick={onClose} disabled={!!busyId} aria-label="Fechar"
            style={{ background: 'transparent', border: 'none', color: '#a1a1aa', cursor: busyId ? 'wait' : 'pointer', minHeight: 44, minWidth: 44 }}>
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto p-3">
          {loading && (
            <div className="flex items-center gap-2 p-6 text-sm justify-center" style={{ color: '#a1a1aa' }}>
              <Loader2 size={14} className="animate-spin" /> Carregando…
            </div>
          )}

          {error && (
            <div className="p-3 text-sm" style={{ color: '#f87171' }}>{error}</div>
          )}

          {versions && versions.length === 0 && (
            <div className="p-6 text-center text-sm" style={{ color: '#a1a1aa' }}>
              Nenhuma versão salva ainda. As versões aparecem quando você aplica template, gera por IA ou clica em Publicar.
            </div>
          )}

          {versions && versions.length > 0 && (
            <div className="space-y-2">
              {versions.map(v => {
                const meta = SOURCE_LABELS[v.source]
                const isBusy = busyId === v.id
                const date = new Date(v.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                return (
                  <div key={v.id}
                    style={{ background: '#0a0a0e', border: '1px solid #27272a', borderRadius: 8, padding: 12 }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span style={{ color: meta.color, display: 'inline-flex', alignItems: 'center' }}>{meta.icon}</span>
                          <span style={{ fontSize: 12, fontWeight: 500, color: meta.color }}>{meta.label}</span>
                        </div>
                        {v.label && (
                          <div style={{ fontSize: 13, color: '#fafafa', marginTop: 4 }}>{v.label}</div>
                        )}
                        <div style={{ fontSize: 11, color: '#52525b', marginTop: 4 }}>{date}</div>
                      </div>
                      <button onClick={() => revert(v.id)} disabled={isBusy}
                        className="flex items-center gap-1 px-3 py-2 text-xs font-medium rounded"
                        style={{
                          background: 'transparent', color: '#00E5FF',
                          border: '1px solid #27272a', cursor: isBusy ? 'wait' : 'pointer',
                          minHeight: 36,
                        }}>
                        {isBusy
                          ? <Loader2 size={12} className="animate-spin" />
                          : <><RotateCcw size={12} /> Restaurar</>}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="text-xs p-3 border-t" style={{ borderColor: '#27272a', color: '#a1a1aa' }}>
          ℹ️ Versões são criadas automaticamente quando você gera por IA, aplica template ou publica. Restaurar substitui o design atual (mas salva snapshot antes pra poder voltar).
        </div>
      </div>
    </div>
  )
}
