/**
 * CustomHtml v3 — bloco HTML/CSS custom (premium).
 *
 * Sanitiza HTML via isomorphic-dompurify antes de injetar. CSS opcional
 * fica escopado por classe (`.custom-html-${id}`) pra nao vazar pro resto
 * da pagina.
 *
 * ⚠️ Mesmo com sanitize, customHtml deve ser oferecido SO pra usuarios
 * premium (controle de plano feito em camada superior — editor restringe
 * adicao deste bloco). NUNCA aceite HTML de qualquer source publico.
 */

import DOMPurify from 'isomorphic-dompurify'
import type { CustomHtmlSection } from '@/lib/storefront/v3/types'
import type { RenderCtx } from '../RenderCtx'

export function CustomHtmlSectionView({ ctx: _ctx, section }: { ctx: RenderCtx; section: CustomHtmlSection }) {
  void _ctx
  const { html, css } = section.settings
  const safeHtml = DOMPurify.sanitize(html ?? '', {
    USE_PROFILES: { html: true },
    FORBID_TAGS:  ['style', 'script', 'iframe', 'object', 'embed'],
    FORBID_ATTR:  ['onerror', 'onload', 'onclick', 'onmouseover'],
  })
  const scopeClass = `custom-html-${section.id}`
  // CSS escopado: prefixa cada selector com `.${scopeClass}`. Heuristica
  // simples (split por `}` e processa cada regra). Nao perfeita, mas evita
  // vazamento global na maioria dos casos.
  const safeCss = css
    ? css
        .split('}')
        .filter(Boolean)
        .map(rule => {
          const [sel, body] = rule.split('{')
          if (!sel || !body) return ''
          const scoped = sel.split(',').map(s => `.${scopeClass} ${s.trim()}`).join(', ')
          return `${scoped} { ${body} }`
        })
        .join('\n')
    : ''
  return (
    <div className={`container mx-auto px-4 ${scopeClass}`}>
      {safeCss && <style dangerouslySetInnerHTML={{ __html: safeCss }} />}
      <div dangerouslySetInnerHTML={{ __html: safeHtml }} />
    </div>
  )
}
