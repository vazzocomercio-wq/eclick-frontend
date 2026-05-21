'use client'

/**
 * Primitivas de formulario reusadas pelo ModoFacil e pelos sub-editores
 * (SectionInspector, BlockEditor).
 *
 * Todos seguem mobile-first: touch >=44px, campos full-width.
 */

import { ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'

export const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px', minHeight: 44,
  background: '#0a0a0e', color: '#fafafa',
  border: '1px solid #27272a', borderRadius: 6,
  fontSize: 14,
}

export function Acc({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(!!defaultOpen)
  return (
    <div style={{ borderBottom: '1px solid #27272a' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between py-3 text-left text-sm font-medium"
        style={{ color: '#fafafa', minHeight: 44, background: 'transparent', border: 'none', cursor: 'pointer' }}>
        {title}
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && <div className="pb-4 space-y-3">{children}</div>}
    </div>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs mb-1.5" style={{ color: '#a1a1aa' }}>{label}</label>
      {children}
      {hint && <div className="text-[11px] mt-1" style={{ color: '#52525b' }}>{hint}</div>}
    </div>
  )
}

export function Input({ value, onChange, placeholder, type }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return <input type={type ?? 'text'} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
}

export function Textarea({ value, onChange, rows, placeholder }: {
  value: string; onChange: (v: string) => void; rows?: number; placeholder?: string
}) {
  return (
    <textarea
      value={value} onChange={e => onChange(e.target.value)}
      rows={rows ?? 4} placeholder={placeholder}
      style={{ ...inputStyle, minHeight: rows ? rows * 24 : 96, resize: 'vertical', fontFamily: 'inherit' }}
    />
  )
}

export function NumberInput({ value, onChange, min, max, step }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number
}) {
  return (
    <input
      type="number" value={value}
      onChange={e => {
        const n = parseFloat(e.target.value)
        if (Number.isFinite(n)) onChange(n)
      }}
      min={min} max={max} step={step ?? 1}
      style={inputStyle}
    />
  )
}

export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <div className="flex gap-2">
        <input type="color" value={value} onChange={e => onChange(e.target.value)}
          style={{ width: 44, height: 44, padding: 0, border: '1px solid #27272a', borderRadius: 6, background: '#0a0a0e', cursor: 'pointer' }} />
        <input type="text" value={value} onChange={e => onChange(e.target.value)}
          style={inputStyle} placeholder="#000000" />
      </div>
    </Field>
  )
}

export function Select<T extends string>({ value, options, onChange }: {
  value: T; options: ReadonlyArray<readonly [T, string]>; onChange: (v: T) => void
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value as T)} style={inputStyle}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  )
}

export function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      role="switch" aria-checked={value}
      style={{
        position: 'relative', width: 44, height: 24,
        background: value ? '#00E5FF' : '#27272a',
        border: 'none', borderRadius: 12, cursor: 'pointer',
        minHeight: 44, padding: 0,
        display: 'inline-flex', alignItems: 'center',
      }}>
      <span style={{
        position: 'absolute',
        left: value ? 22 : 2, top: 2,
        width: 20, height: 20,
        background: '#fafafa', borderRadius: '50%',
        transition: 'left 150ms',
      }} />
    </button>
  )
}
