/**
 * CustomHtml v3 — bloco HTML/CSS custom (premium).
 *
 * ⚠️ DOMPurify TEMPORARIAMENTE DESATIVADO pra investigar incompatibilidade
 * com runtime serverless do Netlify (causou 500 em /loja/[slug] após
 * commit 6e75052). Renderiza placeholder enquanto investigamos.
 *
 * Pra reativar:
 *  1. `import DOMPurify from 'isomorphic-dompurify'`
 *  2. Trocar o return abaixo pelo render com sanitize
 *  3. Validar em prod (Netlify Lambda) antes de marcar feito
 */

import type { CustomHtmlSection } from '@/lib/storefront/v3/types'
import type { RenderCtx } from '../RenderCtx'

export function CustomHtmlSectionView({ ctx: _ctx, section }: { ctx: RenderCtx; section: CustomHtmlSection }) {
  void _ctx
  void section
  return (
    <div className="container mx-auto px-4">
      <div style={{
        padding: 16, fontSize: 13,
        background: 'var(--c-surface)', color: 'var(--c-text-muted)',
        border: '1px dashed var(--c-border)', borderRadius: 'var(--r)',
      }}>
        Bloco HTML customizado — sanitização temporariamente desativada (em manutenção).
      </div>
    </div>
  )
}
