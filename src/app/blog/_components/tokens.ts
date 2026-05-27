/**
 * Design tokens do blog — espelham a landing /auditoria-gratis pra manter
 * identidade coesa (estética Profound + marca e-Click). Dark sempre.
 */
export const C = {
  CYAN: '#00E5FF',
  GREEN: '#4ADE80',
  BG: '#09090b',
  CARD: '#121214',
  INPUT: '#0a0a0e',
  BORDER: 'rgba(255,255,255,0.08)',
  BORDER_STRONG: 'rgba(255,255,255,0.12)',
  TXT: '#fafafa',
  MUT: '#a1a1aa',
  DIM: '#71717a',
  RED: '#f87171',
} as const

export const SITE_URL = 'https://eclick.app.br'

export const BACKEND =
  process.env.NEXT_PUBLIC_BACKEND_URL ??
  'https://eclick-backend-production-2a87.up.railway.app'

/** Cor de um pilar/categoria (fallback ciano). */
export function pillarColor(color?: string): string {
  return color && /^#[0-9a-f]{3,8}$/i.test(color) ? color : C.CYAN
}

/** Formata data ISO pra pt-BR (ex: 26 de mai. de 2026). */
export function fmtDate(iso?: string): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return ''
  }
}

/** CSS global do blog (injetado 1x no layout). Prefixo bl- pra não colidir. */
export const BLOG_CSS = `
/* Fonte de display (Clash Display ~ Agrandir) nos títulos e banner */
#top h1, #top h2, #top h3 { font-family: var(--font-display), system-ui, -apple-system, sans-serif; }
.bl-display { font-family: var(--font-display), system-ui, -apple-system, sans-serif; }
.bl-spin { animation: bl-spin 0.8s linear infinite; }
@keyframes bl-spin { to { transform: rotate(360deg); } }
.bl-reveal { opacity: 0; transform: translateY(14px); animation: bl-reveal 0.6s ease-out forwards; }
@keyframes bl-reveal { to { opacity: 1; transform: none; } }
.bl-card { transition: transform .2s ease, border-color .2s ease; }
.bl-card:hover { transform: translateY(-2px); border-color: rgba(0,229,255,0.4) !important; }
.bl-grid-3 { display: grid; grid-template-columns: 1fr; gap: 18px; }
@media (min-width: 720px) { .bl-grid-3 { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 1040px) { .bl-grid-3 { grid-template-columns: repeat(3, 1fr); } }
.bl-pillars { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
@media (min-width: 720px) { .bl-pillars { grid-template-columns: repeat(4, 1fr); } }
@media (min-width: 1040px) { .bl-pillars { grid-template-columns: repeat(7, 1fr); } }
.bl-post-layout { display: grid; grid-template-columns: 1fr; gap: 32px; }
@media (min-width: 1040px) { .bl-post-layout { grid-template-columns: 220px minmax(0, 1fr) 260px; gap: 40px; } }
.bl-sticky { position: sticky; top: 24px; }
.bl-link { color: ${C.MUT}; text-decoration: none; transition: color .2s ease; }
.bl-link:hover { color: ${C.CYAN}; }
.bl-faq summary { cursor: pointer; list-style: none; }
.bl-faq summary::-webkit-details-marker { display: none; }
.bl-faq[open] .bl-faq-plus { transform: rotate(45deg); }
.bl-faq-plus { transition: transform .2s ease; display: inline-block; }
.bl-prose p { margin: 0 0 18px; line-height: 1.75; color: #d4d4d8; font-size: 17px; }
.bl-prose h2 { font-size: clamp(1.5rem, 3vw, 2rem); font-weight: 600; letter-spacing: -0.02em; margin: 40px 0 16px; scroll-margin-top: 90px; color: ${C.TXT}; }
.bl-prose h3 { font-size: clamp(1.2rem, 2vw, 1.45rem); font-weight: 600; margin: 28px 0 12px; scroll-margin-top: 90px; color: ${C.TXT}; }
.bl-prose ul, .bl-prose ol { margin: 0 0 18px; padding-left: 22px; color: #d4d4d8; line-height: 1.75; }
.bl-prose li { margin: 6px 0; }
.bl-prose a { color: ${C.CYAN}; text-decoration: underline; text-underline-offset: 2px; }
.bl-prose blockquote { border-left: 3px solid ${C.CYAN}; padding: 4px 0 4px 20px; margin: 24px 0; font-style: italic; color: #e4e4e7; }
.bl-prose img { border-radius: 12px; max-width: 100%; height: auto; }
@media (prefers-reduced-motion: reduce) {
  .bl-reveal { animation: none; opacity: 1; transform: none; }
  .bl-spin { animation: none; }
  .bl-card:hover { transform: none; }
}
`
