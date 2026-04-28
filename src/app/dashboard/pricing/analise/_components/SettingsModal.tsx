'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { api } from './api'
import { Severity, SignalType, SEVERITY_META, SIGNAL_TYPE_META } from './types'

interface NotificationSettings {
  id:                   string
  organization_id:      string
  whatsapp_enabled:     boolean
  whatsapp_phone:       string | null
  notify_severities:    Severity[]
  notify_signal_types:  SignalType[]
  quiet_hours_start:    string | null
  quiet_hours_end:      string | null
  notify_weekends:      boolean
  group_notifications:  boolean
  group_window_minutes: number
  max_per_hour:         number
  max_per_day:          number
}

interface NotifLog {
  id:           string
  channel:      string
  phone:        string | null
  signal_ids:   string[]
  message_body: string
  status:       'pending' | 'sent' | 'delivered' | 'failed'
  sent_at:      string | null
  error:        string | null
  created_at:   string
}

type Tab = 'whatsapp' | 'when' | 'schedule' | 'history'
const TABS: { key: Tab; emoji: string; label: string }[] = [
  { key: 'whatsapp', emoji: '📱', label: 'WhatsApp' },
  { key: 'when',     emoji: '🎯', label: 'Quando notificar' },
  { key: 'schedule', emoji: '⏰', label: 'Horário e frequência' },
  { key: 'history',  emoji: '📜', label: 'Histórico' },
]

/** Modal full-screen com 4 abas. Abre via botão "Configurar" do header
 * do radar. Salva PATCH em batch (uma chamada com todos os campos
 * modificados). */
export function SettingsModal({
  onClose, onSaved, onError,
}: {
  onClose: () => void
  onSaved: (msg: string) => void
  onError: (m: string) => void
}) {
  const [tab, setTab]               = useState<Tab>('whatsapp')
  const [original, setOriginal]     = useState<NotificationSettings | null>(null)
  const [settings, setSettings]     = useState<NotificationSettings | null>(null)
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [testing, setTesting]       = useState(false)

  // Histórico só carrega quando aba aberta
  const [logs, setLogs]             = useState<NotifLog[]>([])
  const [logsLoaded, setLogsLoaded] = useState(false)
  const [expanded, setExpanded]     = useState<string | null>(null)
  const [logFilter, setLogFilter]   = useState<'all' | 'sent' | 'failed' | 'skipped'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const s = await api<NotificationSettings>('/pricing/notifications/settings')
      setOriginal(s); setSettings(s)
    } catch (e) { onError((e as Error).message) }
    setLoading(false)
  }, [onError])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (tab === 'history' && !logsLoaded) {
      api<NotifLog[]>('/pricing/notifications/log?limit=50')
        .then(d => { setLogs(d); setLogsLoaded(true) })
        .catch(e => onError((e as Error).message))
    }
  }, [tab, logsLoaded, onError])

  function setField<K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) {
    setSettings(prev => prev ? { ...prev, [key]: value } : prev)
  }

  function toggleSeverity(sev: Severity) {
    if (!settings) return
    const cur = settings.notify_severities ?? []
    setField('notify_severities', cur.includes(sev) ? cur.filter(s => s !== sev) : [...cur, sev])
  }

  function toggleType(t: SignalType) {
    if (!settings) return
    const cur = settings.notify_signal_types ?? []
    setField('notify_signal_types', cur.includes(t) ? cur.filter(x => x !== t) : [...cur, t])
  }

  const dirty = useMemo(() => {
    if (!original || !settings) return false
    return JSON.stringify(original) !== JSON.stringify(settings)
  }, [original, settings])

  async function save() {
    if (!settings || !dirty) return
    setSaving(true)
    try {
      // Validação básica
      if (settings.whatsapp_enabled && !settings.whatsapp_phone?.trim()) {
        onError('Informe o número do WhatsApp pra ativar notificações')
        setSaving(false); return
      }
      const updated = await api<NotificationSettings>('/pricing/notifications/settings', {
        method: 'PATCH',
        body:   JSON.stringify({
          whatsapp_enabled:     settings.whatsapp_enabled,
          whatsapp_phone:       settings.whatsapp_phone,
          notify_severities:    settings.notify_severities,
          notify_signal_types:  settings.notify_signal_types,
          quiet_hours_start:    settings.quiet_hours_start,
          quiet_hours_end:      settings.quiet_hours_end,
          notify_weekends:      settings.notify_weekends,
          group_notifications:  settings.group_notifications,
          group_window_minutes: settings.group_window_minutes,
          max_per_hour:         settings.max_per_hour,
          max_per_day:          settings.max_per_day,
        }),
      })
      setOriginal(updated); setSettings(updated)
      onSaved('Configurações salvas')
    } catch (e) { onError((e as Error).message) }
    setSaving(false)
  }

  async function sendTest() {
    if (!settings?.whatsapp_phone?.trim()) {
      onError('Salve o número antes de testar'); return
    }
    setTesting(true)
    try {
      const r = await api<{ ok: boolean; error: string | null }>('/pricing/notifications/test', { method: 'POST' })
      if (r.ok) onSaved('Mensagem enviada — verifique seu WhatsApp')
      else      onError(r.error ?? 'Falha ao enviar teste')
    } catch (e) { onError((e as Error).message) }
    setTesting(false)
  }

  if (typeof window === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div
        className="w-full max-w-4xl rounded-2xl flex flex-col"
        style={{ background: '#0a0a0e', border: '1px solid #1e1e24', maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 flex items-start justify-between px-6 py-4" style={{ borderBottom: '1px solid #1e1e24' }}>
          <div>
            <p className="text-white font-semibold text-lg">Notificações de Preço</p>
            <p className="text-zinc-500 text-sm mt-0.5">Receba alertas críticos onde estiver</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white text-xl">✕</button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar de abas */}
          <div className="shrink-0 w-52 p-3 space-y-0.5 overflow-y-auto" style={{ borderRight: '1px solid #1e1e24', background: '#08080c' }}>
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-left transition"
                style={{
                  background:  tab === t.key ? 'rgba(0,229,255,0.05)' : 'transparent',
                  color:       tab === t.key ? '#00E5FF' : '#a1a1aa',
                  borderLeft:  tab === t.key ? '2px solid #00E5FF' : '2px solid transparent',
                }}
              >
                <span className="text-base">{t.emoji}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading || !settings
              ? <div className="h-48 rounded-xl animate-pulse" style={{ background: '#111114' }} />
              : (
                <>
                  {tab === 'whatsapp' && (
                    <WhatsAppTab
                      settings={settings}
                      onToggle={(v) => setField('whatsapp_enabled', v)}
                      onPhone={(v)  => setField('whatsapp_phone', v)}
                      onTest={sendTest}
                      testing={testing}
                    />
                  )}
                  {tab === 'when' && (
                    <WhenTab
                      settings={settings}
                      onToggleSev={toggleSeverity}
                      onToggleType={toggleType}
                    />
                  )}
                  {tab === 'schedule' && (
                    <ScheduleTab
                      settings={settings}
                      setField={setField}
                    />
                  )}
                  {tab === 'history' && (
                    <HistoryTab
                      logs={logs}
                      filter={logFilter}
                      setFilter={setLogFilter}
                      expanded={expanded}
                      setExpanded={setExpanded}
                    />
                  )}
                </>
              )}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4" style={{ borderTop: '1px solid #1e1e24' }}>
          <p className="text-zinc-500 text-xs">{dirty ? 'Alterações pendentes' : 'Sem alterações'}</p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border" style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>Cancelar</button>
            <button
              onClick={save}
              disabled={!dirty || saving}
              className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
              style={{ background: '#00E5FF', color: '#08323b' }}
            >
              {saving ? 'Salvando…' : 'Salvar configurações'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab components

function WhatsAppTab({
  settings, onToggle, onPhone, onTest, testing,
}: {
  settings: NotificationSettings
  onToggle: (v: boolean) => void
  onPhone:  (v: string) => void
  onTest:   () => void
  testing:  boolean
}) {
  return (
    <>
      <div className="rounded-2xl p-5" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <p className="text-white font-semibold">Ativar notificações WhatsApp</p>
            <p className="text-zinc-500 text-xs mt-0.5">Receba alertas críticos diretamente no celular</p>
          </div>
          <input
            type="checkbox"
            checked={settings.whatsapp_enabled}
            onChange={(e) => onToggle(e.target.checked)}
            className="w-5 h-5"
            style={{ accentColor: '#00E5FF' }}
          />
        </label>
      </div>

      {settings.whatsapp_enabled ? (
        <div className="rounded-2xl p-5 mt-4 space-y-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
          <div>
            <p className="text-zinc-400 text-xs mb-1">Número WhatsApp</p>
            <input
              value={settings.whatsapp_phone ?? ''}
              onChange={(e) => onPhone(e.target.value.replace(/[^\d+]/g, ''))}
              placeholder="5571999998888"
              className="wa-input font-mono"
            />
            <p className="text-zinc-500 text-[11px] mt-1">Inclua DDI 55 + DDD + número (apenas dígitos).</p>
          </div>

          <button
            onClick={onTest}
            disabled={testing || !settings.whatsapp_phone?.trim()}
            className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
            style={{ background: '#00E5FF', color: '#08323b' }}
          >
            {testing ? 'Enviando…' : 'Enviar mensagem de teste'}
          </button>

          <div className="rounded-xl p-3" style={{ background: '#0a3a35', border: '1px solid #134e48' }}>
            <p className="text-emerald-300/70 text-[11px] mb-1.5">Preview da mensagem de teste:</p>
            <p className="text-white text-sm">
              ✅ <span className="font-bold">e-Click</span> — notificações WhatsApp ativadas com sucesso!
            </p>
            <p className="text-white text-sm mt-1.5">
              Este é um teste. Você receberá alertas de preço pelos critérios configurados.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl p-5 mt-4" style={{ background: '#111114', border: '1px dashed #27272a' }}>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Ao ativar, você receberá alertas via WhatsApp quando produtos críticos precisarem de atenção de preço. Você pode personalizar quais sinais deseja receber e em qual horário nas próximas abas.
          </p>
        </div>
      )}

      <style jsx>{`
        .wa-input {
          width: 100%; padding: 0.6rem 0.8rem; background: #0a0a0e;
          border: 1px solid #27272a; border-radius: 0.5rem; color: #fafafa;
          font-size: 0.95rem; outline: none;
        }
        .wa-input:focus { border-color: #00E5FF; }
      `}</style>
    </>
  )
}

function WhenTab({
  settings, onToggleSev, onToggleType,
}: {
  settings: NotificationSettings
  onToggleSev:  (sev: Severity) => void
  onToggleType: (t: SignalType) => void
}) {
  const sevCount  = settings.notify_severities?.length ?? 0
  const typeCount = settings.notify_signal_types?.length ?? 0

  return (
    <div className="space-y-6">
      <section>
        <p className="text-zinc-300 text-sm font-semibold mb-1">Severidades</p>
        <p className="text-zinc-500 text-xs mb-3">Escolha o nível mínimo para receber alertas.</p>
        <div className="grid gap-2">
          {(['critical','high','medium','low'] as Severity[]).map(sev => {
            const meta = SEVERITY_META[sev]
            const checked = settings.notify_severities?.includes(sev) ?? false
            return (
              <label key={sev} className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer" style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
                <input type="checkbox" checked={checked} onChange={() => onToggleSev(sev)} className="w-4 h-4" style={{ accentColor: meta.color }} />
                <span className="text-sm text-zinc-200">{meta.emoji} {meta.label}</span>
                {sev === 'critical' && <span className="ml-auto text-[10px] text-zinc-500 italic">recomendado</span>}
              </label>
            )
          })}
        </div>
      </section>

      <section>
        <p className="text-zinc-300 text-sm font-semibold mb-1">Tipos de sinal</p>
        <p className="text-zinc-500 text-xs mb-3">Selecione os tipos que importam para você.</p>
        <div className="grid gap-2">
          {(['decrease_price','increase_price','do_not_touch','review_needed','low_confidence'] as SignalType[]).map(t => {
            const meta = SIGNAL_TYPE_META[t]
            const checked = settings.notify_signal_types?.includes(t) ?? false
            return (
              <label key={t} className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer" style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
                <input type="checkbox" checked={checked} onChange={() => onToggleType(t)} className="w-4 h-4" style={{ accentColor: meta.color }} />
                <span className="text-sm text-zinc-200">{meta.icon} {meta.label}</span>
              </label>
            )
          })}
        </div>
      </section>

      <div className="rounded-lg p-3" style={{ background: '#0a3a35', border: '1px solid #134e48' }}>
        <p className="text-emerald-300 text-xs">
          Você receberá alertas de <span className="font-bold">{sevCount}</span> tipo{sevCount === 1 ? '' : 's'} de severidade em <span className="font-bold">{typeCount}</span> tipo{typeCount === 1 ? '' : 's'} de sinal.
        </p>
      </div>
    </div>
  )
}

function ScheduleTab({
  settings, setField,
}: {
  settings: NotificationSettings
  setField: <K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) => void
}) {
  return (
    <div className="space-y-6">
      <section>
        <p className="text-zinc-300 text-sm font-semibold mb-3">Horário silencioso</p>
        <div className="rounded-2xl p-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
          <div className="flex items-center gap-3">
            <span className="text-zinc-400 text-sm">Das</span>
            <input
              type="time"
              value={settings.quiet_hours_start ?? '22:00'}
              onChange={e => setField('quiet_hours_start', e.target.value as string)}
              className="quiet-input"
            />
            <span className="text-zinc-400 text-sm">às</span>
            <input
              type="time"
              value={settings.quiet_hours_end ?? '08:00'}
              onChange={e => setField('quiet_hours_end', e.target.value as string)}
              className="quiet-input"
            />
          </div>
          <p className="text-zinc-500 text-xs mt-2">Não envia notificações neste período.</p>

          <QuietBar start={settings.quiet_hours_start ?? '22:00'} end={settings.quiet_hours_end ?? '08:00'} />
        </div>

        <label className="flex items-center gap-3 mt-3 cursor-pointer">
          <input type="checkbox" checked={settings.notify_weekends} onChange={e => setField('notify_weekends', e.target.checked)} className="w-4 h-4" style={{ accentColor: '#00E5FF' }} />
          <span className="text-sm text-zinc-300">Notificar nos finais de semana</span>
          <span className="text-zinc-500 text-xs">(sábados e domingos)</span>
        </label>
      </section>

      <section>
        <p className="text-zinc-300 text-sm font-semibold mb-3">Agrupamento</p>
        <div className="rounded-2xl p-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-white text-sm">Agrupar notificações</p>
              <p className="text-zinc-500 text-xs mt-0.5">Junta múltiplos alertas em uma mensagem</p>
            </div>
            <input type="checkbox" checked={settings.group_notifications} onChange={e => setField('group_notifications', e.target.checked)} className="w-5 h-5" style={{ accentColor: '#00E5FF' }} />
          </label>

          {settings.group_notifications && (
            <div className="mt-4">
              <p className="text-zinc-400 text-xs mb-1">Janela de agrupamento</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={settings.group_window_minutes}
                  onChange={e => setField('group_window_minutes', Math.max(5, Math.min(120, Number(e.target.value) || 15)))}
                  className="quiet-input w-20"
                  min={5} max={120}
                />
                <span className="text-zinc-500 text-sm">minutos</span>
              </div>
              <p className="text-zinc-500 text-xs mt-2">Aguarda este tempo antes de enviar — junta sinais que aparecem na janela.</p>
            </div>
          )}
        </div>
      </section>

      <section>
        <p className="text-zinc-300 text-sm font-semibold mb-3">Limites</p>
        <div className="rounded-2xl p-4 grid grid-cols-2 gap-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
          <div>
            <p className="text-zinc-400 text-xs mb-1">Máximo por hora</p>
            <input type="number" min={1} max={50}
              value={settings.max_per_hour}
              onChange={e => setField('max_per_hour', Math.max(1, Math.min(50, Number(e.target.value) || 5)))}
              className="quiet-input"
            />
          </div>
          <div>
            <p className="text-zinc-400 text-xs mb-1">Máximo por dia</p>
            <input type="number" min={1} max={200}
              value={settings.max_per_day}
              onChange={e => setField('max_per_day', Math.max(1, Math.min(200, Number(e.target.value) || 20)))}
              className="quiet-input"
            />
          </div>
          <p className="text-zinc-500 text-xs col-span-2">Evita spam de alertas. Atinjuir o limite pula novos envios.</p>
        </div>
      </section>

      <style jsx>{`
        .quiet-input {
          padding: 0.5rem 0.75rem; background: #0a0a0e;
          border: 1px solid #27272a; border-radius: 0.5rem; color: #fafafa;
          font-size: 0.875rem; outline: none;
        }
        .quiet-input:focus { border-color: #00E5FF; }
      `}</style>
    </div>
  )
}

function QuietBar({ start, end }: { start: string; end: string }) {
  const sH = Number(start.split(':')[0] ?? 22) + Number(start.split(':')[1] ?? 0) / 60
  const eH = Number(end.split(':')[0]   ?? 8)  + Number(end.split(':')[1]   ?? 0) / 60
  // Build 24 segments: each cell colored if in quiet range
  const inQuiet = (h: number) => start === end
    ? false
    : sH > eH
      ? (h >= sH || h < eH)
      : (h >= sH && h < eH)
  return (
    <div className="mt-3">
      <div className="flex h-3 rounded overflow-hidden" style={{ background: '#0a0a0e' }}>
        {Array.from({ length: 24 }).map((_, i) => (
          <div
            key={i}
            className="flex-1"
            title={`${i}h${inQuiet(i) ? ' (silencioso)' : ''}`}
            style={{
              background: inQuiet(i) ? 'repeating-linear-gradient(45deg, #3f3f46, #3f3f46 2px, #27272a 2px, #27272a 4px)' : '#34d399',
              opacity:    inQuiet(i) ? 0.6 : 0.3,
              borderRight: i < 23 ? '1px solid #0a0a0e' : 'none',
            }}
          />
        ))}
      </div>
      <div className="flex justify-between mt-1 text-[9px] text-zinc-600 font-mono">
        <span>00h</span><span>06h</span><span>12h</span><span>18h</span><span>24h</span>
      </div>
    </div>
  )
}

function HistoryTab({
  logs, filter, setFilter, expanded, setExpanded,
}: {
  logs:        NotifLog[]
  filter:      'all' | 'sent' | 'failed' | 'skipped'
  setFilter:   (f: 'all' | 'sent' | 'failed' | 'skipped') => void
  expanded:    string | null
  setExpanded: (id: string | null) => void
}) {
  const filtered = filter === 'all' ? logs : logs.filter(l => l.status === filter)

  return (
    <>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {(['all','sent','failed'] as const).map(f => (
          <button key={f}
            onClick={() => setFilter(f)}
            className="px-3 py-1.5 rounded-full text-xs font-medium border"
            style={{
              borderColor: filter === f ? '#00E5FF' : '#27272a',
              color:       filter === f ? '#00E5FF' : '#a1a1aa',
              background:  filter === f ? 'rgba(0,229,255,0.05)' : 'transparent',
            }}
          >{f === 'all' ? 'Todos' : f === 'sent' ? 'Enviados' : 'Falhas'}</button>
        ))}
      </div>

      {filtered.length === 0
        ? <div className="rounded-2xl px-6 py-10 text-center text-zinc-500 text-sm" style={{ background: '#111114', border: '1px dashed #27272a' }}>
            {logs.length === 0 ? 'Nenhuma notificação enviada ainda.' : 'Nenhuma com este filtro.'}
          </div>
        : <div className="rounded-2xl overflow-hidden" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
            {filtered.map((l, i) => {
              const isOpen = expanded === l.id
              return (
                <div key={l.id} className={i > 0 ? 'border-t' : ''} style={{ borderColor: '#1e1e24' }}>
                  <button
                    onClick={() => setExpanded(isOpen ? null : l.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-900 transition text-left"
                  >
                    <span className="text-zinc-500 text-xs whitespace-nowrap font-mono">
                      {new Date(l.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                    <StatusBadge status={l.status} />
                    <span className="text-zinc-500 text-xs">{l.signal_ids?.length ?? 0} sinal(is)</span>
                    <span className="flex-1 truncate text-zinc-400 text-xs">{l.message_body.split('\n')[0]}</span>
                    <span className="text-zinc-600">{isOpen ? '▾' : '▸'}</span>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4">
                      <pre className="text-zinc-300 text-xs whitespace-pre-wrap font-mono p-3 rounded" style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>{l.message_body}</pre>
                      {l.error && <p className="text-red-400 text-xs mt-2">Erro: {l.error}</p>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>}
    </>
  )
}

function StatusBadge({ status }: { status: NotifLog['status'] }) {
  const meta = status === 'sent' || status === 'delivered'
    ? { color: '#34d399', label: '✓ Enviado',  bg: 'rgba(52,211,153,0.1)' }
    : status === 'failed'
      ? { color: '#f87171', label: '✗ Falhou',  bg: 'rgba(248,113,113,0.1)' }
      : { color: '#a1a1aa', label: '⏸ Pendente', bg: 'rgba(161,161,170,0.1)' }
  return <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-semibold whitespace-nowrap" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
}
