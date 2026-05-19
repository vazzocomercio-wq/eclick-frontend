'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
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
const TAB_KEYS: { key: Tab; emoji: string }[] = [
  { key: 'whatsapp', emoji: '📱' },
  { key: 'when',     emoji: '🎯' },
  { key: 'schedule', emoji: '⏰' },
  { key: 'history',  emoji: '📜' },
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
  const t = useTranslations('pricing')
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
        onError(t('errEnterWhatsappNumber'))
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
      onSaved(t('settingsSaved'))
    } catch (e) { onError((e as Error).message) }
    setSaving(false)
  }

  async function sendTest() {
    if (!settings?.whatsapp_phone?.trim()) {
      onError(t('errSaveNumberFirst')); return
    }
    setTesting(true)
    try {
      const r = await api<{ ok: boolean; error: string | null }>('/pricing/notifications/test', { method: 'POST' })
      if (r.ok) onSaved(t('testMessageSent'))
      else      onError(r.error ?? t('errSendTest'))
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
            <p className="text-white font-semibold text-lg">{t('notificationsTitle')}</p>
            <p className="text-zinc-500 text-sm mt-0.5">{t('notificationsSubtitle')}</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white text-xl">✕</button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar de abas */}
          <div className="shrink-0 w-52 p-3 space-y-0.5 overflow-y-auto" style={{ borderRight: '1px solid #1e1e24', background: '#08080c' }}>
            {TAB_KEYS.map(tk => (
              <button
                key={tk.key}
                onClick={() => setTab(tk.key)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-left transition"
                style={{
                  background:  tab === tk.key ? 'rgba(0,229,255,0.05)' : 'transparent',
                  color:       tab === tk.key ? '#00E5FF' : '#a1a1aa',
                  borderLeft:  tab === tk.key ? '2px solid #00E5FF' : '2px solid transparent',
                }}
              >
                <span className="text-base">{tk.emoji}</span>
                <span>{t(`tab_${tk.key}`)}</span>
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
          <p className="text-zinc-500 text-xs">{dirty ? t('pendingChanges') : t('noChanges')}</p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border" style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>{t('cancel')}</button>
            <button
              onClick={save}
              disabled={!dirty || saving}
              className="glow-rainbow px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
              style={{ background: '#00E5FF', color: '#08323b' }}
            >
              {saving ? t('saving') : t('saveSettings')}
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
  const t = useTranslations('pricing')
  return (
    <>
      <div className="rounded-2xl p-5" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <p className="text-white font-semibold">{t('enableWhatsapp')}</p>
            <p className="text-zinc-500 text-xs mt-0.5">{t('enableWhatsappDesc')}</p>
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
            <p className="text-zinc-400 text-xs mb-1">{t('whatsappNumber')}</p>
            <input
              value={settings.whatsapp_phone ?? ''}
              onChange={(e) => onPhone(e.target.value.replace(/[^\d+]/g, ''))}
              placeholder="5571999998888"
              className="wa-input font-mono"
            />
            <p className="text-zinc-500 text-[11px] mt-1">{t('whatsappNumberHint')}</p>
          </div>

          <button
            onClick={onTest}
            disabled={testing || !settings.whatsapp_phone?.trim()}
            className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
            style={{ background: '#00E5FF', color: '#08323b' }}
          >
            {testing ? t('sending') : t('sendTestMessage')}
          </button>

          <div className="rounded-xl p-3" style={{ background: '#0a3a35', border: '1px solid #134e48' }}>
            <p className="text-emerald-300/70 text-[11px] mb-1.5">{t('testMessagePreview')}</p>
            <p className="text-white text-sm">
              ✅ <span className="font-bold">e-Click</span> — {t('testMessageLine1')}
            </p>
            <p className="text-white text-sm mt-1.5">
              {t('testMessageLine2')}
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl p-5 mt-4" style={{ background: '#111114', border: '1px dashed #27272a' }}>
          <p className="text-zinc-400 text-sm leading-relaxed">
            {t('whatsappDisabledNote')}
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
  const t = useTranslations('pricing')
  const sevCount  = settings.notify_severities?.length ?? 0
  const typeCount = settings.notify_signal_types?.length ?? 0

  return (
    <div className="space-y-6">
      <section>
        <p className="text-zinc-300 text-sm font-semibold mb-1">{t('severitiesTitle')}</p>
        <p className="text-zinc-500 text-xs mb-3">{t('severitiesHint')}</p>
        <div className="grid gap-2">
          {(['critical','high','medium','low'] as Severity[]).map(sev => {
            const meta = SEVERITY_META[sev]
            const checked = settings.notify_severities?.includes(sev) ?? false
            return (
              <label key={sev} className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer" style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
                <input type="checkbox" checked={checked} onChange={() => onToggleSev(sev)} className="w-4 h-4" style={{ accentColor: meta.color }} />
                <span className="text-sm text-zinc-200">{meta.emoji} {meta.label}</span>
                {sev === 'critical' && <span className="ml-auto text-[10px] text-zinc-500 italic">{t('recommended')}</span>}
              </label>
            )
          })}
        </div>
      </section>

      <section>
        <p className="text-zinc-300 text-sm font-semibold mb-1">{t('signalTypesTitle')}</p>
        <p className="text-zinc-500 text-xs mb-3">{t('signalTypesHint')}</p>
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
          {t.rich('whenSummary', {
            sevCount,
            typeCount,
            em: (chunks) => <span className="font-bold">{chunks}</span>,
          })}
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
  const t = useTranslations('pricing')
  return (
    <div className="space-y-6">
      <section>
        <p className="text-zinc-300 text-sm font-semibold mb-3">{t('quietHoursTitle')}</p>
        <div className="rounded-2xl p-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
          <div className="flex items-center gap-3">
            <span className="text-zinc-400 text-sm">{t('from')}</span>
            <input
              type="time"
              value={settings.quiet_hours_start ?? '22:00'}
              onChange={e => setField('quiet_hours_start', e.target.value as string)}
              className="quiet-input"
            />
            <span className="text-zinc-400 text-sm">{t('to')}</span>
            <input
              type="time"
              value={settings.quiet_hours_end ?? '08:00'}
              onChange={e => setField('quiet_hours_end', e.target.value as string)}
              className="quiet-input"
            />
          </div>
          <p className="text-zinc-500 text-xs mt-2">{t('quietHoursNote')}</p>

          <QuietBar start={settings.quiet_hours_start ?? '22:00'} end={settings.quiet_hours_end ?? '08:00'} />
        </div>

        <label className="flex items-center gap-3 mt-3 cursor-pointer">
          <input type="checkbox" checked={settings.notify_weekends} onChange={e => setField('notify_weekends', e.target.checked)} className="w-4 h-4" style={{ accentColor: '#00E5FF' }} />
          <span className="text-sm text-zinc-300">{t('notifyWeekends')}</span>
          <span className="text-zinc-500 text-xs">{t('notifyWeekendsNote')}</span>
        </label>
      </section>

      <section>
        <p className="text-zinc-300 text-sm font-semibold mb-3">{t('groupingTitle')}</p>
        <div className="rounded-2xl p-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-white text-sm">{t('groupNotifications')}</p>
              <p className="text-zinc-500 text-xs mt-0.5">{t('groupNotificationsDesc')}</p>
            </div>
            <input type="checkbox" checked={settings.group_notifications} onChange={e => setField('group_notifications', e.target.checked)} className="w-5 h-5" style={{ accentColor: '#00E5FF' }} />
          </label>

          {settings.group_notifications && (
            <div className="mt-4">
              <p className="text-zinc-400 text-xs mb-1">{t('groupWindow')}</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={settings.group_window_minutes}
                  onChange={e => setField('group_window_minutes', Math.max(5, Math.min(120, Number(e.target.value) || 15)))}
                  className="quiet-input w-20"
                  min={5} max={120}
                />
                <span className="text-zinc-500 text-sm">{t('minutes')}</span>
              </div>
              <p className="text-zinc-500 text-xs mt-2">{t('groupWindowNote')}</p>
            </div>
          )}
        </div>
      </section>

      <section>
        <p className="text-zinc-300 text-sm font-semibold mb-3">{t('limitsTitle')}</p>
        <div className="rounded-2xl p-4 grid grid-cols-2 gap-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
          <div>
            <p className="text-zinc-400 text-xs mb-1">{t('maxPerHour')}</p>
            <input type="number" min={1} max={50}
              value={settings.max_per_hour}
              onChange={e => setField('max_per_hour', Math.max(1, Math.min(50, Number(e.target.value) || 5)))}
              className="quiet-input"
            />
          </div>
          <div>
            <p className="text-zinc-400 text-xs mb-1">{t('maxPerDay')}</p>
            <input type="number" min={1} max={200}
              value={settings.max_per_day}
              onChange={e => setField('max_per_day', Math.max(1, Math.min(200, Number(e.target.value) || 20)))}
              className="quiet-input"
            />
          </div>
          <p className="text-zinc-500 text-xs col-span-2">{t('limitsNote')}</p>
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
  const t = useTranslations('pricing')
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
            title={`${i}h${inQuiet(i) ? ` (${t('quiet')})` : ''}`}
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
  const t = useTranslations('pricing')
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
          >{t(`logFilter_${f}`)}</button>
        ))}
      </div>

      {filtered.length === 0
        ? <div className="rounded-2xl px-6 py-10 text-center text-zinc-500 text-sm" style={{ background: '#111114', border: '1px dashed #27272a' }}>
            {logs.length === 0 ? t('noNotificationsSent') : t('noneWithFilter')}
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
                    <span className="text-zinc-500 text-xs">{t('signalCount', { count: l.signal_ids?.length ?? 0 })}</span>
                    <span className="flex-1 truncate text-zinc-400 text-xs">{l.message_body.split('\n')[0]}</span>
                    <span className="text-zinc-600">{isOpen ? '▾' : '▸'}</span>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4">
                      <pre className="text-zinc-300 text-xs whitespace-pre-wrap font-mono p-3 rounded" style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>{l.message_body}</pre>
                      {l.error && <p className="text-red-400 text-xs mt-2">{t('errorPrefix', { error: l.error })}</p>}
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
  const t = useTranslations('pricing')
  const meta = status === 'sent' || status === 'delivered'
    ? { color: '#34d399', label: `✓ ${t('logSent')}`,  bg: 'rgba(52,211,153,0.1)' }
    : status === 'failed'
      ? { color: '#f87171', label: `✗ ${t('logFailed')}`,  bg: 'rgba(248,113,113,0.1)' }
      : { color: '#a1a1aa', label: `⏸ ${t('logPending')}`, bg: 'rgba(161,161,170,0.1)' }
  return <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-semibold whitespace-nowrap" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
}
