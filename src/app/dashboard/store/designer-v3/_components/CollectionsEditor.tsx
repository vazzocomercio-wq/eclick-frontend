'use client'

/**
 * CollectionsEditor — editor estruturado pros cards de categoria do
 * `collectionGrid` (Designer v3). Substitui o Textarea-JSON pelo
 * formato visual: label + collectionId + imagem por card.
 *
 * Cada card oferece 3 fontes pra imagem (via ImageUploadField):
 *   - Upload manual (arquivo do computador)
 *   - URL direta (colar link)
 *   - Gerar com IA (modal de banner de produtos)
 *
 * Adicionalmente — específico de categoria — tem um botão "Gerar
 * imagem desta categoria" que dispara o endpoint leve
 *   POST /store/config/design/scene-image { prompt: <label> }
 * pra criar uma cena ambiente baseada SÓ no nome da categoria
 * (ex.: "Sala de Jantar" → mesa posta, luz natural, etc.) sem
 * exigir produtos cadastrados. Ideal pro cliente que ainda não
 * tem fotos da categoria.
 *
 * Geração é "uma a uma" (cada categoria gera sua própria imagem)
 * pra evitar gasto desnecessário com IA e dar controle ao lojista.
 */

import { useState } from 'react'
import { Plus, Trash2, GripVertical, Sparkles, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { ImageUploadField } from '@/components/storefront/ImageUploadField'
import { Field, Input, inputStyle } from './primitives'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

interface Collection {
  collectionId: string
  label?:       string
  imageUrl?:    string
}

interface Props {
  value:    Collection[]
  onChange: (next: Collection[]) => void
}

export function CollectionsEditor({ value, onChange }: Props) {
  const add = () => onChange([...value, { collectionId: '', label: '', imageUrl: '' }])
  const remove = (i: number) => onChange(value.filter((_, k) => k !== i))
  const update = (i: number, patch: Partial<Collection>) =>
    onChange(value.map((c, k) => k === i ? { ...c, ...patch } : c))
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= value.length) return
    const next = [...value]
    ;[next[i], next[j]] = [next[j]!, next[i]!]
    onChange(next)
  }

  return (
    <div className="space-y-3">
      {value.length === 0 && (
        <div className="text-center py-6 rounded" style={{ background: '#0a0a0e', border: '1px dashed #27272a' }}>
          <p className="text-xs" style={{ color: '#71717a' }}>
            Nenhuma categoria — clique em &ldquo;Adicionar categoria&rdquo;
          </p>
        </div>
      )}

      {value.map((c, i) => (
        <CollectionCard
          key={i}
          index={i}
          total={value.length}
          collection={c}
          onChange={patch => update(i, patch)}
          onRemove={() => remove(i)}
          onMoveUp={() => move(i, -1)}
          onMoveDown={() => move(i, 1)}
        />
      ))}

      <button type="button" onClick={add}
        className="w-full inline-flex items-center justify-center gap-2 text-sm font-medium rounded transition-colors"
        style={{
          padding: '12px 16px', minHeight: 44,
          background: 'rgba(0,229,255,0.05)',
          border: '1px dashed rgba(0,229,255,0.3)',
          color: '#00E5FF',
          cursor: 'pointer',
        }}>
        <Plus size={14} /> Adicionar categoria
      </button>
    </div>
  )
}

function CollectionCard({ index, total, collection, onChange, onRemove, onMoveUp, onMoveDown }: {
  index:       number
  total:       number
  collection:  Collection
  onChange:    (patch: Partial<Collection>) => void
  onRemove:    () => void
  onMoveUp:    () => void
  onMoveDown:  () => void
}) {
  const [aiBusy, setAiBusy] = useState(false)
  const [aiErr, setAiErr]   = useState<string | null>(null)

  const labelSeed = (collection.label ?? '').trim()

  const generateFromLabel = async () => {
    if (!labelSeed) {
      setAiErr('Coloque o nome da categoria antes de gerar.')
      return
    }
    setAiBusy(true); setAiErr(null)
    try {
      const supabase = createClient()
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token
      const res = await fetch(`${BACKEND}/store/config/design/scene-image`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ prompt: labelSeed, format: 'square' }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => null)
        throw new Error(e?.message ?? `HTTP ${res.status}`)
      }
      const data = await res.json()
      onChange({ imageUrl: data.url })
    } catch (e) {
      setAiErr(e instanceof Error ? e.message : 'Falha na geração.')
    } finally {
      setAiBusy(false)
    }
  }

  return (
    <div className="rounded p-3 space-y-2.5"
      style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
      {/* Cabeçalho do card: índice + reordenar + remover */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <GripVertical size={12} style={{ color: '#52525b' }} />
          <span className="text-[11px] font-medium" style={{ color: '#a1a1aa' }}>
            Categoria {index + 1} de {total}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={onMoveUp} disabled={index === 0}
            title="Subir"
            style={{
              padding: '4px 8px', minHeight: 28, minWidth: 28,
              background: 'transparent', border: '1px solid #27272a',
              borderRadius: 4, cursor: index === 0 ? 'not-allowed' : 'pointer',
              color: index === 0 ? '#3f3f46' : '#a1a1aa', fontSize: 11,
            }}>
            ↑
          </button>
          <button type="button" onClick={onMoveDown} disabled={index === total - 1}
            title="Descer"
            style={{
              padding: '4px 8px', minHeight: 28, minWidth: 28,
              background: 'transparent', border: '1px solid #27272a',
              borderRadius: 4, cursor: index === total - 1 ? 'not-allowed' : 'pointer',
              color: index === total - 1 ? '#3f3f46' : '#a1a1aa', fontSize: 11,
            }}>
            ↓
          </button>
          <button type="button" onClick={onRemove}
            title="Remover categoria"
            style={{
              padding: '4px 8px', minHeight: 28, minWidth: 28,
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 4, cursor: 'pointer',
              color: '#ef4444',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      <Field label="Nome (aparece no card)">
        <Input value={collection.label ?? ''} placeholder="Ex.: Sala de Jantar"
          onChange={v => onChange({ label: v })} />
      </Field>

      <Field label="ID da coleção" hint="Slug da categoria/coleção que o card filtra ao clicar.">
        <Input value={collection.collectionId} placeholder="ex.: sala-de-jantar"
          onChange={v => onChange({ collectionId: v })} />
      </Field>

      <Field label="Imagem do card"
        hint='Use upload, cole uma URL, ou clique em "Gerar imagem desta categoria" abaixo.'>
        <ImageUploadField
          value={collection.imageUrl ?? ''}
          onChange={url => onChange({ imageUrl: url })}
          previewMaxWidth={280}
          aiBannerEnabled={false}
        />
      </Field>

      {/* Geração 1-a-1 baseada no label */}
      <div className="space-y-1">
        <button type="button" onClick={generateFromLabel} disabled={aiBusy || !labelSeed}
          className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-medium rounded transition-colors"
          style={{
            ...inputStyle,
            minHeight: 40,
            background: aiBusy ? 'rgba(0,229,255,0.1)' : 'rgba(168,85,247,0.05)',
            border: `1px solid ${aiBusy ? 'rgba(0,229,255,0.4)' : 'rgba(168,85,247,0.3)'}`,
            color: aiBusy ? '#00E5FF' : '#c084fc',
            cursor: aiBusy || !labelSeed ? 'not-allowed' : 'pointer',
            opacity: !labelSeed && !aiBusy ? 0.5 : 1,
          }}>
          {aiBusy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {aiBusy
            ? 'Gerando…'
            : labelSeed
              ? `Gerar imagem da categoria "${labelSeed.slice(0, 30)}${labelSeed.length > 30 ? '…' : ''}"`
              : 'Preencha o nome pra gerar com IA'}
        </button>
        {aiErr && (
          <p className="text-[11px]" style={{ color: '#f87171' }}>⚠ {aiErr}</p>
        )}
        <p className="text-[10px]" style={{ color: '#52525b' }}>
          A IA usa o nome da categoria como inspiração — gera uma cena ambiente
          (estilo da loja é levado em conta). Cada categoria gera por demanda,
          sem desperdiçar imagens.
        </p>
      </div>
    </div>
  )
}
