"use client"

/**
 * Sons de notificação leves gerados via WebAudio (sem baixar assets).
 * O estado de mudo fica em localStorage e vale para o app inteiro.
 */

const MUTE_KEY = "dash_sound_muted"

export function isSoundMuted(): boolean {
  if (typeof window === "undefined") return false
  return window.localStorage.getItem(MUTE_KEY) === "1"
}

export function setSoundMuted(muted: boolean) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0")
  window.dispatchEvent(new CustomEvent("dash-sound-mute", { detail: muted }))
}

let ctx: AudioContext | null = null
function audioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = ctx ?? new AC()
    return ctx
  } catch {
    return null
  }
}

/**
 * Destrava o AudioContext num gesto do usuário. Sem isso, os navegadores
 * mantêm o contexto "suspended" e os sons disparados por eventos (realtime,
 * lembretes) ficam mudos. Deve ser chamado num pointerdown/keydown.
 */
export function primeSound() {
  const ac = audioCtx()
  if (!ac) return
  if (ac.state === "suspended") ac.resume().catch(() => {})
}

/** Toca uma sequência de tons curtos. Silencioso quando mudo. */
function playTones(tones: { freq: number; start: number; dur: number }[], gainPeak = 0.08) {
  if (isSoundMuted()) return
  const ac = audioCtx()
  if (!ac) return
  if (ac.state === "suspended") ac.resume().catch(() => {})
  const now = ac.currentTime
  for (const t of tones) {
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = "sine"
    osc.frequency.value = t.freq
    gain.gain.setValueAtTime(0, now + t.start)
    gain.gain.linearRampToValueAtTime(gainPeak, now + t.start + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + t.start + t.dur)
    osc.connect(gain).connect(ac.destination)
    osc.start(now + t.start)
    osc.stop(now + t.start + t.dur + 0.02)
  }
}

/** Som de notificação geral (sino): dois tons ascendentes. */
export function playNotificationSound() {
  playTones([
    { freq: 660, start: 0, dur: 0.14 },
    { freq: 880, start: 0.1, dur: 0.18 },
  ])
}

/** Som de mensagem de chat: um toque curto e suave. */
export function playMessageSound() {
  playTones([{ freq: 720, start: 0, dur: 0.12 }], 0.06)
}
