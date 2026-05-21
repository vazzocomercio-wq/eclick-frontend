'use client'

/**
 * TemplateGalleryModal — galeria de templates v3 pra aplicar com 1 clique.
 *
 * Lista os templates do MAP, mostra preview minimal (paleta + nicho).
 * Submit chama POST /store/config/design-v3/apply-template.
 */

import { useState } from 'react'
import { X, Loader2, Check } from 'lucide-react'
import { STOREFRONT_TEMPLATES_V3, type StorefrontTemplateV3 } from '@/lib/storefront/v3/templates'

interface Props {
  onClose: () => void
  onApply: (templateKey: string) => Promise<void>
}

export function TemplateGalleryModal({ onClose, onApply }: Props) {
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [confirmKey, setConfirmKey] = useState<string | null>(null)

  const apply = async (key: string) => {
    setBusyKey(key)
    await onApply(key)
    // parent fecha o modal
  }

  return (
    <div
      onClick={() => !busyKey && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 70,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#0d0d10', border: '1px solid #27272a', borderRadius: 12,
          width: '100%', maxWidth: 720, maxHeight: '90vh',
          display: 'flex', flexDirection: 'column',
        }}>
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: '#27272a' }}>
          <h2 className="text-sm font-medium" style={{ color: '#fafafa' }}>Aplicar template</h2>
          <button onClick={onClose} disabled={!!busyKey} aria-label="Fechar"
            style={{ background: 'transparent', border: 'none', color: '#a1a1aa', cursor: busyKey ? 'wait' : 'pointer', minHeight: 44, minWidth: 44 }}>
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {STOREFRONT_TEMPLATES_V3.map(t => (
            <TemplateCard
              key={t.id}
              template={t}
              busy={busyKey === t.id}
              confirming={confirmKey === t.id}
              onPick={() => setConfirmKey(t.id)}
              onConfirm={() => apply(t.id)}
              onCancel={() => setConfirmKey(null)}
            />
          ))}
        </div>

        <div className="text-xs p-3 border-t" style={{ borderColor: '#27272a', color: '#a1a1aa' }}>
          ⚠️ Aplicar um template <strong style={{ color: '#fcd34d' }}>sobrescreve</strong> o design atual.
          A loja pode ser personalizada depois nos modos Fácil ou Avançado.
        </div>
      </div>
    </div>
  )
}

function TemplateCard({ template, busy, confirming, onPick, onConfirm, onCancel }: {
  template: StorefrontTemplateV3
  busy:       boolean
  confirming: boolean
  onPick:     () => void
  onConfirm:  () => void
  onCancel:   () => void
}) {
  const c = template.design.theme.colors
  return (
    <div style={{ border: '1px solid #27272a', borderRadius: 8, background: '#0a0a0e', overflow: 'hidden' }}>
      {/* Preview minimal — barras de cor + texto */}
      <div style={{ padding: 16, background: c.background, color: c.text, minHeight: 120 }}>
        <div style={{ fontFamily: template.design.theme.fontPair === 'editorial' ? 'serif' : 'sans-serif', fontSize: 16, fontWeight: 600 }}>
          {template.label}
        </div>
        <div style={{ fontSize: 11, color: c.textMuted, marginTop: 4 }}>
          {template.niche}
        </div>
        <div className="flex gap-1 mt-3">
          <div style={{ width: 24, height: 16, background: c.primary, borderRadius: 4 }} title="Primária" />
          <div style={{ width: 24, height: 16, background: c.text, borderRadius: 4, border: `1px solid ${c.border}` }} title="Texto" />
          <div style={{ width: 24, height: 16, background: c.surface, borderRadius: 4, border: `1px solid ${c.border}` }} title="Surface" />
        </div>
      </div>
      <div className="p-3">
        <div style={{ fontSize: 12, color: '#a1a1aa', minHeight: 36 }}>{template.description}</div>
        <div className="mt-3 flex gap-2">
          {!confirming ? (
            <button onClick={onPick} disabled={busy}
              style={{
                flex: 1, padding: '8px 12px', minHeight: 40,
                background: '#1e1e24', color: '#fafafa',
                border: 'none', borderRadius: 6,
                cursor: busy ? 'wait' : 'pointer', fontSize: 13,
              }}>
              Aplicar este
            </button>
          ) : (
            <>
              <button onClick={onCancel} disabled={busy}
                style={{
                  padding: '8px 12px', minHeight: 40,
                  background: 'transparent', color: '#a1a1aa',
                  border: '1px solid #27272a', borderRadius: 6,
                  cursor: busy ? 'wait' : 'pointer', fontSize: 13,
                }}>
                Cancelar
              </button>
              <button onClick={onConfirm} disabled={busy}
                className="flex-1 flex items-center justify-center gap-1"
                style={{
                  padding: '8px 12px', minHeight: 40,
                  background: '#00E5FF', color: '#0a0a0e',
                  border: 'none', borderRadius: 6,
                  cursor: busy ? 'wait' : 'pointer', fontSize: 13, fontWeight: 500,
                }}>
                {busy
                  ? <><Loader2 size={12} className="animate-spin" /> Aplicando…</>
                  : <><Check size={12} /> Confirmar</>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
