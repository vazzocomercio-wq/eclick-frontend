'use client'

/**
 * Chips clicáveis de variáveis interpoláveis.
 *
 * Click em um chip → invoca `onInsert('{nome_var}')` no callback do parent,
 * que insere no textarea no cursor atual (lógica de cursor fica no parent
 * que tem ref do textarea).
 *
 * Hover → tooltip com exemplo de valor real (de VARIABLE_EXAMPLES).
 *
 * Inicialização: carrega lista de vars via CreativeApi.listTemplateVariables.
 * Se falhar, cai pra lista hardcoded (defensivo — vars são estáveis).
 */

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { CreativeApi } from '@/components/creative/api'
import { VARIABLE_EXAMPLES } from './constants'

const FALLBACK_VARS = Object.keys(VARIABLE_EXAMPLES)

export default function VariablesChips({
  onInsert,
  disabled,
}: {
  onInsert: (varToken: string) => void
  disabled?: boolean
}) {
  const t = useTranslations('creative.templates')
  const [vars, setVars] = useState<readonly string[]>(FALLBACK_VARS)

  useEffect(() => {
    let cancelled = false
    void CreativeApi.listTemplateVariables()
      .then(r => { if (!cancelled) setVars(r.variables ?? FALLBACK_VARS) })
      .catch(() => { /* mantém fallback */ })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="flex flex-wrap gap-1.5">
      {vars.map(v => (
        <button
          key={v}
          type="button"
          disabled={disabled}
          onClick={() => onInsert(`{${v}}`)}
          title={VARIABLE_EXAMPLES[v] ? t('varExampleTooltip', { example: VARIABLE_EXAMPLES[v] }) : v}
          className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-zinc-800 text-cyan-300 hover:bg-cyan-400/15 hover:text-cyan-200 transition-colors border border-zinc-700 hover:border-cyan-400/40 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {`{${v}}`}
        </button>
      ))}
    </div>
  )
}
