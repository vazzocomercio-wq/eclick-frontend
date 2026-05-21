'use client'

/**
 * Designer da Loja v3 — Store Builder.
 *
 * Rota nova, isolada do Designer v2 (que continua em
 * /dashboard/store/designer). Quando v3 maturar, redireciona o legado pra
 * ca e remove a rota antiga.
 *
 * Estrutura:
 *  - Header com nome da loja + botoes (voltar pro v2, salvar, publicar)
 *  - Sidebar esquerda: tabs "Fácil" | "Avançado" + galeria de templates
 *  - Centro: preview ao vivo em iframe (toggle mobile/tablet/desktop)
 *  - Direita: sub-editor da secao/bloco selecionado (aparece em "Avançado")
 *
 * C.2 entrega so o WRAPPER + preview funcional. Modo Facil/Avancado vem
 * em C.3+C.4. Aplicar template vem em C.8.
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { ArrowLeft, Loader2, Smartphone, Tablet, Monitor, AlertCircle, Save, Sparkles } from 'lucide-react'
import type { StorefrontDesignV3 } from '@/lib/storefront/v3/types'
import { DEFAULT_DESIGN_V3 } from '@/lib/storefront/v3/templates'
import { ModoFacil } from './_components/ModoFacil'
import { ModoAvancado } from './_components/ModoAvancado'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

type Device = 'mobile' | 'tablet' | 'desktop'
type Tab    = 'facil' | 'avancado'

const DEVICE_WIDTH: Record<Device, number> = { mobile: 375, tablet: 768, desktop: 1280 }

export default function DesignerV3Page() {
  const [design,    setDesign]    = useState<StorefrontDesignV3 | null>(null)
  const [storeSlug, setStoreSlug] = useState<string | null>(null)
  const [storeName, setStoreName] = useState<string>('Minha loja')
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [device,    setDevice]    = useState<Device>('mobile')
  const [tab,       setTab]       = useState<Tab>('facil')
  const iframeRef                 = useRef<HTMLIFrameElement | null>(null)
  const previewReady              = useRef(false)
  const latestDesign              = useRef<StorefrontDesignV3 | null>(null)

  // ─ Carrega design + dados da loja ──────────────────────────────
  useEffect(() => {
    const supabase = createClient()
    void (async () => {
      try {
        const { data: session } = await supabase.auth.getSession()
        const token = session.session?.access_token
        if (!token) { setError('Sem sessão.'); setLoading(false); return }

        const [designRes, configRes] = await Promise.all([
          fetch(`${BACKEND}/store/config/design-v3`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${BACKEND}/store/config`,           { headers: { Authorization: `Bearer ${token}` } }),
        ])
        if (designRes.ok) {
          const { design: d } = await designRes.json()
          setDesign(d ?? DEFAULT_DESIGN_V3)
        } else {
          setDesign(DEFAULT_DESIGN_V3)
        }
        if (configRes.ok) {
          const cfg = await configRes.json()
          setStoreSlug(cfg.store_slug ?? null)
          setStoreName(cfg.store_name ?? 'Minha loja')
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Falha ao carregar design.')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  // ─ Live update: postMessage pro iframe (sem debounce). Chamado a cada
  //   keystroke pelos Modos Facil/Avancado via prop `onLiveChange`.
  const sendToPreview = useCallback((next: StorefrontDesignV3) => {
    latestDesign.current = next
    if (previewReady.current && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: 'design:update', design: next }, '*')
    }
  }, [])

  const handleLiveChange = useCallback((next: StorefrontDesignV3) => {
    setDesign(next)
    sendToPreview(next)
  }, [sendToPreview])

  // ─ Quando o preview iframe avisa que esta pronto, envia o design atual.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const data = e.data as { type?: string } | null
      if (data?.type === 'preview:ready') {
        previewReady.current = true
        const d = latestDesign.current ?? design
        if (d && iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage({ type: 'design:update', design: d }, '*')
        }
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [design])

  // ─ Save (chamado por Modo Fácil/Avançado via prop, debounced no filho) ──
  const save = useCallback(async (next: StorefrontDesignV3) => {
    setSaving(true); setError(null)
    try {
      const supabase = createClient()
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token
      const res = await fetch(`${BACKEND}/store/config/design-v3`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ design: next }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const { design: saved } = await res.json()
      setDesign(saved)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao salvar.')
    } finally {
      setSaving(false)
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: '#09090b', color: '#a1a1aa' }}>
        <Loader2 className="animate-spin mr-2" size={20} /> Carregando Designer…
      </div>
    )
  }

  if (!design) {
    return (
      <div className="p-6" style={{ background: '#09090b', minHeight: '100vh', color: '#fafafa' }}>
        <div style={{
          background: 'rgba(239,68,68,0.10)', color: '#f87171',
          border: '1px solid rgba(239,68,68,0.3)', padding: 16, borderRadius: 8,
        }}>
          <AlertCircle size={16} className="inline mr-2" />
          {error ?? 'Não foi possível carregar o design.'}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col" style={{ background: '#09090b', color: '#fafafa', minHeight: '100vh' }}>
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-4 md:px-6 py-3 border-b" style={{ borderColor: '#27272a', background: '#0a0a0e' }}>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/store/designer"
            className="flex items-center gap-1 text-sm hover:opacity-80"
            style={{ color: '#a1a1aa', minHeight: 44 }}>
            <ArrowLeft size={16} /> Voltar ao Designer clássico
          </Link>
          <span style={{ color: '#3f3f46' }}>·</span>
          <h1 className="text-sm font-medium" style={{ color: '#fafafa' }}>
            Store Builder — {storeName}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {storeSlug && (
            <a href={`/loja/${storeSlug}`} target="_blank" rel="noopener noreferrer"
              className="text-sm hover:opacity-80" style={{ color: '#00E5FF' }}>
              Abrir vitrine
            </a>
          )}
          <button
            onClick={() => save(design)}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg"
            style={{
              background: '#00E5FF', color: '#0a0a0e',
              minHeight: 44, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.6 : 1,
            }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Salvar
          </button>
        </div>
      </header>

      {error && (
        <div className="px-6 py-2 text-sm" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171' }}>
          {error}
        </div>
      )}

      {/* ── Workspace ── */}
      <div className="flex flex-1" style={{ height: 'calc(100vh - 60px)' }}>
        {/* Sidebar — tabs + conteúdo */}
        <aside className="flex flex-col border-r" style={{ width: 380, borderColor: '#27272a', background: '#0d0d10' }}>
          <div className="flex border-b" style={{ borderColor: '#27272a' }}>
            <TabButton active={tab === 'facil'}    onClick={() => setTab('facil')}>
              Fácil
            </TabButton>
            <TabButton active={tab === 'avancado'} onClick={() => setTab('avancado')}>
              Avançado
            </TabButton>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {tab === 'facil'
              ? <ModoFacil design={design} onSave={save} onLiveChange={handleLiveChange} />
              : <ModoAvancado design={design} onSave={save} onLiveChange={handleLiveChange} />}
            <div className="mt-6 pt-6 border-t" style={{ borderColor: '#27272a' }}>
              <button
                disabled
                className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm rounded-lg"
                style={{
                  background: '#1e1e24', color: '#52525b',
                  minHeight: 44, cursor: 'not-allowed',
                }}>
                <Sparkles size={14} /> Gerar com IA (C.7)
              </button>
            </div>
          </div>
        </aside>

        {/* Preview ao vivo */}
        <main className="flex-1 flex flex-col items-center" style={{ background: '#111114' }}>
          <div className="flex items-center gap-2 py-3 border-b w-full justify-center" style={{ borderColor: '#27272a' }}>
            <DeviceButton current={device} target="mobile"  onClick={setDevice}><Smartphone size={14} /> 375</DeviceButton>
            <DeviceButton current={device} target="tablet"  onClick={setDevice}><Tablet     size={14} /> 768</DeviceButton>
            <DeviceButton current={device} target="desktop" onClick={setDevice}><Monitor    size={14} /> 1280</DeviceButton>
          </div>
          <div className="flex-1 overflow-auto py-6 px-4 w-full flex justify-center">
            <iframe
              key={device}
              ref={iframeRef}
              src={storeSlug ? `/loja/${storeSlug}/preview` : 'about:blank'}
              onLoad={() => {
                // Quando o iframe (re)carrega — ex.: troca de device — reseta
                // o flag pra esperar o `preview:ready` de novo.
                previewReady.current = false
              }}
              style={{
                width: DEVICE_WIDTH[device], maxWidth: '100%',
                height: '100%', minHeight: 600,
                background: '#fff',
                border: '1px solid #27272a', borderRadius: 8,
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              }}
              title="Preview da loja"
            />
          </div>
        </main>
      </div>
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 py-3 text-sm font-medium transition-colors"
      style={{
        background: active ? '#1a1a1e' : 'transparent',
        color:      active ? '#fafafa' : '#a1a1aa',
        borderBottom: active ? '2px solid #00E5FF' : '2px solid transparent',
        minHeight: 44, cursor: 'pointer',
      }}>
      {children}
    </button>
  )
}

function DeviceButton({ current, target, onClick, children }: {
  current: Device; target: Device; onClick: (d: Device) => void; children: React.ReactNode
}) {
  const active = current === target
  return (
    <button
      onClick={() => onClick(target)}
      className="flex items-center gap-1 px-3 py-2 text-xs font-medium rounded"
      style={{
        background: active ? '#00E5FF' : 'transparent',
        color:      active ? '#0a0a0e' : '#a1a1aa',
        border: active ? 'none' : '1px solid #27272a',
        minHeight: 44, cursor: 'pointer',
      }}>
      {children}
    </button>
  )
}

function ComingSoon({ label, hint }: { label: string; hint: string }) {
  return (
    <div style={{ padding: 24, textAlign: 'center', color: '#a1a1aa' }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#fafafa', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 12 }}>{hint}</div>
    </div>
  )
}
