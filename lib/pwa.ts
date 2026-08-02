"use client"

// Utilitários de PWA no cliente: registro do service worker, permissão de
// notificação e agendamento local de lembretes de tarefas.

import { playNotificationSound } from "@/lib/sound"

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

import { savePushSubscription } from "@/app/actions/push"

const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  "BLnF17klfFXsfCmayro8yc8HI7xbtZ_iQwi565pIC8WN1-p9-kJ200UrqFR4YUUx83rirg4E2-AeEsQsAUnBFJs"

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export async function subscribeUserToPush(): Promise<boolean> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return false
  }
  try {
    const reg = await navigator.serviceWorker.ready
    if (!reg.pushManager) return false

    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      const convertedKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey,
      })
    }
    if (sub) {
      await savePushSubscription(sub.toJSON() as any)
      return true
    }
  } catch (err) {
    console.warn("Push subscription error:", err)
  }
  return false
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return "denied"
  if (Notification.permission === "granted") {
    void subscribeUserToPush()
    return "granted"
  }
  try {
    const perm = await Notification.requestPermission()
    if (perm === "granted") {
      void subscribeUserToPush()
    }
    return perm
  } catch {
    return "denied"
  }
}

/** Dispara uma notificação imediatamente (via SW se disponível, senão nativa). */
export async function showNotification(title: string, body: string, url = "/organizacao/tarefas") {
  if (!notificationsSupported() || Notification.permission !== "granted") return
  // Som imediato no app (a notificação do SO nem sempre toca com a aba aberta).
  playNotificationSound()
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
