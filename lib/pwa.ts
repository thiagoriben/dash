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

/** Dispara uma notificação imediatamente (via SW se disponível, senão nativa). */
export async function showNotification(title: string, body: string, url = "/organizacao/tarefas") {
  if (!notificationsSupported() || Notification.permission !== "granted") return
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

// Timers ativos em memória (a aba precisa estar aberta para dispararem).
const timers = new Map<string, ReturnType<typeof setTimeout>>()

/** (Re)agenda os lembretes fornecidos, cancelando os antigos. */
export function scheduleReminders(reminders: ScheduledReminder[]) {
  if (typeof window === "undefined") return
  for (const t of timers.values()) clearTimeout(t)
  timers.clear()
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
