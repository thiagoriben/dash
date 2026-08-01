"use client"

// Utilitários de PWA no cliente: registro do service worker, permissão de
// notificação e agendamento local de lembretes de tarefas.

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" })
  } catch {
    return null
  }
}

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return "denied"
  if (Notification.permission === "granted") return "granted"
  try {
    return await Notification.requestPermission()
  } catch {
    return "denied"
  }
}

// AudioContext reaproveitado (criado sob demanda no primeiro uso).
let audioCtx: AudioContext | null = null

/** Toca um "ding" curto via WebAudio (não precisa de arquivo de áudio). */
export function playChime() {
  if (typeof window === "undefined") return
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    audioCtx = audioCtx ?? new Ctx()
    const ctx = audioCtx
    // Alguns navegadores suspendem o contexto até um gesto do usuário.
    if (ctx.state === "suspended") void ctx.resume()

    const now = ctx.currentTime
    const master = ctx.createGain()
    master.gain.setValueAtTime(0.0001, now)
    master.gain.exponentialRampToValueAtTime(0.25, now + 0.01)
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.6)
    master.connect(ctx.destination)

    // Duas notas (intervalo agradável) formando um "ding-dong".
    ;[
      { f: 880, t: 0 },
      { f: 1318.5, t: 0.14 },
    ].forEach(({ f, t }) => {
      const osc = ctx.createOscillator()
      osc.type = "sine"
      osc.frequency.setValueAtTime(f, now + t)
      osc.connect(master)
      osc.start(now + t)
      osc.stop(now + t + 0.5)
    })
  } catch {
    /* silencioso: áudio é só um extra */
  }
}

/** Pré-aquece o AudioContext num gesto do usuário (evita bloqueio de autoplay). */
export function primeAudio() {
  if (typeof window === "undefined") return
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    audioCtx = audioCtx ?? new Ctx()
    if (audioCtx.state === "suspended") void audioCtx.resume()
  } catch {
    /* ignore */
  }
}

/** Dispara uma notificação imediatamente (via SW se disponível, senão nativa). */
export async function showNotification(title: string, body: string, url = "/organizacao/tarefas") {
  if (!notificationsSupported() || Notification.permission !== "granted") return
  // Som imediato no app (a notificação do SO nem sempre toca com a aba aberta).
  playChime()
  const reg = await navigator.serviceWorker?.getRegistration?.()
  if (reg?.active) {
    reg.active.postMessage({ type: "notify", title, body, url, tag: title })
  } else {
    // eslint-disable-next-line no-new
    new Notification(title, { body, icon: "/icons/icon-192.png" })
  }
}

export type ScheduledReminder = {
  id: string
  title: string
  /** Timestamp (ms) em que a notificação deve disparar. */
  at: number
  body: string
}

// Timers ativos em memória, por namespace (a aba precisa estar aberta para dispararem).
// O namespace evita que quadros diferentes (pessoal, cada projeto) apaguem os
// lembretes uns dos outros ao remontar.
const timersByNs = new Map<string, Map<string, ReturnType<typeof setTimeout>>>()

/** (Re)agenda os lembretes de um namespace, cancelando só os daquele namespace. */
export function scheduleReminders(reminders: ScheduledReminder[], namespace = "default") {
  if (typeof window === "undefined") return
  const timers = timersByNs.get(namespace) ?? new Map<string, ReturnType<typeof setTimeout>>()
  for (const t of timers.values()) clearTimeout(t)
  timers.clear()
  timersByNs.set(namespace, timers)
  const now = Date.now()
  for (const r of reminders) {
    const delay = r.at - now
    // Ignora passados e agendamentos além de ~24 dias (limite do setTimeout).
    if (delay <= 0 || delay > 2_073_600_000) continue
    const timer = setTimeout(() => {
      void showNotification(r.title, r.body)
      timers.delete(r.id)
    }, delay)
    timers.set(r.id, timer)
  }
}
