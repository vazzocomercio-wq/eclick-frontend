'use client'

/**
 * GenerateAIModal — modal pra IA gerar o design da loja a partir de
 * um prompt do lojista.
 *
 * Submit chama POST /store/config/design-v3/generate. O parent (page.tsx)
 * cuida da request + atualizacao do design + postMessage no iframe.
 */

import { useState } from 'react'
import { X, Sparkles, Loader2 } from 'lucide-react'

const SUGESTOES = [
  'Loja sofisticada de lustres clássicos, paleta creme e dourado',
  'Bolsas artesanais de couro, visual minimalista preto e branco',
  'Promoção relâmpago de eletrônicos com 70% off, cores vibrantes',
  'Loja de roupas femininas casual, jovem e descontraída',
  'Decoração escandinava, cores neutras e fontes elegantes',
]

interface Props {
  onClose:    () => void
  onGenerate: (prompt: string) => Promise<void>
}

export function GenerateAIModal({ onClose, onGenerate }: Props) {
  const [prompt, setPrompt]     = useState('')
  const [busy, setBusy]         = useState(false)

  const submit = async () => {
    if (prompt.trim().length < 3) return
    setBusy(true)
    await onGenerate(prompt.trim())
    // parent fecha o modal
  }

  return (
    <div
      onClick={() => !busy && onClose()}
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
          width: '100%', maxWidth: 560,
          display: 'flex', flexDirection: 'column',
        }}>
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: '#27272a' }}>
          <div className="flex items-center gap-2">
            <Sparkles size={16} style={{ color: '#00E5FF' }} />
            <h2 className="text-sm font-medium" style={{ color: '#fafafa' }}>Gerar design da loja com IA</h2>
          </div>
          <button onClick={onClose} disabled={busy} aria-label="Fechar"
            style={{ background: 'transparent', border: 'none', color: '#a1a1aa', cursor: busy ? 'wait' : 'pointer', minHeight: 44, minWidth: 44 }}>
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-xs mb-2" style={{ color: '#a1a1aa' }}>
              Descreva como você quer a sua loja
            </label>
            <textarea
              value={prompt} onChange={e => setPrompt(e.target.value)}
              placeholder="Ex.: Loja de produtos naturais, paleta verde claro com toques de marrom, fonte editorial, sensação aconchegante de fazenda."
              rows={5}
              autoFocus
              style={{
                width: '100%', padding: '12px 14px',
                background: '#0a0a0e', color: '#fafafa',
                border: '1px solid #27272a', borderRadius: 8,
                fontSize: 14, resize: 'vertical', minHeight: 120,
                fontFamily: 'inherit',
              }}
            />
            <div className="text-[11px] mt-1" style={{ color: '#52525b' }}>
              {prompt.trim().length < 3 ? 'Pelo menos algumas palavras.' : `${prompt.trim().length} caracteres.`}
            </div>
          </div>

          <div>
            <div className="text-xs mb-2" style={{ color: '#a1a1aa' }}>Sugestões pra começar</div>
            <div className="flex flex-wrap gap-2">
              {SUGESTOES.map(s => (
                <button key={s} onClick={() => setPrompt(s)} disabled={busy}
                  className="text-left text-xs px-3 py-2 rounded"
                  style={{
                    background: '#0a0a0e', color: '#a1a1aa',
                    border: '1px solid #27272a', cursor: busy ? 'wait' : 'pointer',
                    minHeight: 36,
                  }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="text-xs rounded p-3" style={{ background: 'rgba(0,229,255,0.05)', color: '#a5f3fc', border: '1px solid rgba(0,229,255,0.2)' }}>
            ⚡ A IA cria a paleta, tipografia e organiza as seções da home a
            partir do que você descrever. Você pode ajustar depois nos modos
            Fácil ou Avançado. O design ATUAL será sobrescrito.
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t" style={{ borderColor: '#27272a' }}>
          <button onClick={onClose} disabled={busy}
            style={{
              padding: '10px 16px', minHeight: 44,
              background: 'transparent', color: '#a1a1aa',
              border: '1px solid #27272a', borderRadius: 6,
              cursor: busy ? 'wait' : 'pointer', fontSize: 13,
            }}>
            Cancelar
          </button>
          <button onClick={submit} disabled={busy || prompt.trim().length < 3}
            className="flex items-center gap-2"
            style={{
              padding: '10px 20px', minHeight: 44,
              background: prompt.trim().length < 3 ? '#1e1e24' : 'linear-gradient(135deg, #00E5FF, #6366f1)',
              color: prompt.trim().length < 3 ? '#52525b' : '#0a0a0e',
              border: 'none', borderRadius: 6,
              cursor: busy || prompt.trim().length < 3 ? 'not-allowed' : 'pointer',
              fontSize: 13, fontWeight: 500,
            }}>
            {busy
              ? <><Loader2 size={14} className="animate-spin" /> Gerando…</>
              : <><Sparkles size={14} /> Gerar</>}
          </button>
        </div>
      </div>
    </div>
  )
}
