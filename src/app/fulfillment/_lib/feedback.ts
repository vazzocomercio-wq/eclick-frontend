'use client'

// Feedback sonoro + tátil pro operador (que muitas vezes não olha a tela).
// Beep curto via WebAudio + vibração via navigator.vibrate.

let audioCtx: AudioContext | null = null

function ctx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    if (!audioCtx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      audioCtx = new AC()
    }
    return audioCtx
  } catch {
    return null
  }
}

function beep(freq: number, durationMs: number, when = 0) {
  const c = ctx()
  if (!c) return
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'square'
  osc.frequency.value = freq
  gain.gain.value = 0.06
  osc.connect(gain).connect(c.destination)
  const t0 = c.currentTime + when
  osc.start(t0)
  osc.stop(t0 + durationMs / 1000)
}

function vibrate(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try { navigator.vibrate(pattern) } catch { /* noop */ }
  }
}

/** Bipe positivo (item correto). */
export function feedbackOk() {
  beep(880, 90)
  vibrate(40)
}

/** Bipe de erro (código errado / bloqueio). */
export function feedbackError() {
  beep(220, 160)
  beep(220, 160, 0.2)
  vibrate([80, 60, 80])
}

/** Bipe de conclusão (pedido fechado). */
export function feedbackDone() {
  beep(660, 80)
  beep(990, 120, 0.1)
  vibrate([30, 40, 30])
}
