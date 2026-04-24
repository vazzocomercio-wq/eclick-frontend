'use client'

import { useState, useEffect, useRef } from 'react'

interface MlCat { id: string; name: string }
interface Level  { options: MlCat[]; selected: string }

const ML_API = 'https://api.mercadolibre.com'
const IS_ML_ID = /^MLB\d+$/

const sel = 'w-full bg-[#1c1c1f] border border-[#3f3f46] text-white text-sm rounded-lg px-3 py-2.5 outline-none transition-all focus:border-[#00E5FF] focus:ring-1 focus:ring-[#00E5FF20]'
const lbl = 'block text-[13px] font-medium text-zinc-300 mb-1.5'

export default function CategoryPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (id: string) => void
}) {
  const [levels, setLevels]   = useState<Level[]>([])
  const [path, setPath]       = useState<MlCat[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const reconstructed         = useRef(false)

  // Load top-level categories once on mount
  useEffect(() => {
    setLoading(true)
    fetch(`${ML_API}/sites/MLB/categories`)
      .then(r => r.json())
      .then((cats: MlCat[]) => setLevels([{ options: cats, selected: '' }]))
      .catch(() => setError('Não foi possível carregar as categorias. Verifique a conexão.'))
      .finally(() => setLoading(false))
  }, [])

  // When top-level loads and an existing value is set, reconstruct the cascade
  useEffect(() => {
    if (reconstructed.current) return
    if (!value || !IS_ML_ID.test(value)) return
    if (levels.length !== 1 || levels[0].options.length === 0) return
    reconstructed.current = true
    void reconstructPath(value)
  }, [levels]) // eslint-disable-line react-hooks/exhaustive-deps

  async function reconstructPath(catId: string) {
    setLoading(true)
    try {
      // One call gets both path_from_root and leaf's children
      const leafRes  = await fetch(`${ML_API}/categories/${catId}`)
      const leafData = await leafRes.json()
      const pathFromRoot: MlCat[] = leafData.path_from_root ?? []
      const leafChildren: MlCat[] = leafData.children_categories ?? []
      if (pathFromRoot.length === 0) return

      const topOptions = levels[0].options
      const newLevels: Level[] = [{ options: topOptions, selected: pathFromRoot[0].id }]
      const newPath:   MlCat[] = [pathFromRoot[0]]

      // Fetch siblings for each intermediate level
      for (let i = 1; i < pathFromRoot.length; i++) {
        const parentRes  = await fetch(`${ML_API}/categories/${pathFromRoot[i - 1].id}`)
        const parentData = await parentRes.json()
        const children: MlCat[] = parentData.children_categories ?? []
        if (children.length > 0) {
          newLevels.push({ options: children, selected: pathFromRoot[i].id })
          newPath.push(pathFromRoot[i])
        }
      }

      // If the leaf itself has children, append an empty select
      if (leafChildren.length > 0) {
        newLevels.push({ options: leafChildren, selected: '' })
      }

      setLevels(newLevels)
      setPath(newPath)
    } catch {
      // Silently fail — top-level select still works
    } finally {
      setLoading(false)
    }
  }

  async function handleSelect(levelIdx: number, catId: string) {
    // Deselection — propagate parent's value up
    if (!catId) {
      const parentId   = levelIdx > 0 ? levels[levelIdx - 1].selected : ''
      const newLevels  = levels
        .slice(0, levelIdx + 1)
        .map((l, i) => i === levelIdx ? { ...l, selected: '' } : l)
      setLevels(newLevels)
      setPath(path.slice(0, levelIdx))
      onChange(parentId)
      return
    }

    const selectedCat = levels[levelIdx].options.find(o => o.id === catId) ?? { id: catId, name: catId }
    const newPath     = [...path.slice(0, levelIdx), selectedCat]
    setPath(newPath)
    onChange(catId)

    setLoading(true)
    try {
      const res  = await fetch(`${ML_API}/categories/${catId}`)
      const data = await res.json()
      const children: MlCat[] = data.children_categories ?? []

      const updated = levels
        .slice(0, levelIdx + 1)
        .map((l, i) => i === levelIdx ? { ...l, selected: catId } : l)

      if (children.length > 0) updated.push({ options: children, selected: '' })
      setLevels(updated)
    } catch {
      setLevels(prev =>
        prev.slice(0, levelIdx + 1).map((l, i) =>
          i === levelIdx ? { ...l, selected: catId } : l,
        ),
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">

      {/* Breadcrumb path */}
      {path.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-1 text-[12px] px-3 py-2 rounded-lg"
          style={{ background: 'rgba(0,229,255,0.05)', border: '1px solid rgba(0,229,255,0.12)' }}
        >
          {path.map((item, i) => (
            <span key={item.id} className="flex items-center gap-1">
              {i > 0 && <span className="text-zinc-600">›</span>}
              <span
                className={i === path.length - 1 ? 'font-medium' : 'text-zinc-400'}
                style={i === path.length - 1 ? { color: '#00E5FF' } : {}}
              >
                {item.name}
              </span>
            </span>
          ))}
          {loading && <span className="text-zinc-500 ml-1 animate-pulse text-[11px]">carregando...</span>}
        </div>
      )}

      {/* Error */}
      {error && <p className="text-[12px] text-red-400">{error}</p>}

      {/* Initial loading */}
      {loading && levels.length === 0 && (
        <div className="flex items-center gap-2 text-[12px] text-zinc-500 py-1">
          <svg className="w-3.5 h-3.5 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Carregando categorias do Mercado Livre…
        </div>
      )}

      {/* Cascading selects */}
      {levels.map((level, i) => (
        <div key={i}>
          <label className={lbl}>
            {i === 0 ? 'Categoria' : 'Subcategoria'}
            {loading && i === levels.length - 1 && level.selected && (
              <span className="text-zinc-600 text-[11px] ml-2">buscando subcategorias…</span>
            )}
          </label>
          <select
            className={sel}
            value={level.selected}
            onChange={e => { void handleSelect(i, e.target.value) }}
            style={{ background: '#1c1c1f' }}
          >
            <option value="">Selecione…</option>
            {level.options.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
      ))}

      {/* Show ID for reference when a leaf is selected */}
      {value && IS_ML_ID.test(value) && (
        <p className="text-[11px] text-zinc-600">ID ML: {value}</p>
      )}
    </div>
  )
}
