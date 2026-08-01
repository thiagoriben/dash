"use client"

import { useEffect, useState } from "react"
import { Download, BellRing, Check, Share } from "lucide-react"
import {
  isStandalone,
  notificationsSupported,
  requestNotificationPermission,
} from "@/lib/pwa"

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

/** Cartão no menu mobile: instalar o app (PWA) e ativar notificações. */
export function InstallCard() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [isIos, setIsIos] = useState(false)
  const [showIosHelp, setShowIosHelp] = useState(false)
  const [perm, setPerm] = useState<NotificationPermission>("default")

  useEffect(() => {
    setInstalled(isStandalone())
    if (notificationsSupported()) setPerm(Notification.permission)
    const ua = window.navigator.userAgent.toLowerCase()
    setIsIos(/iphone|ipad|ipod/.test(ua))

    function onPrompt(e: Event) {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    function onInstalled() {
      setInstalled(true)
      setDeferred(null)
    }
    window.addEventListener("beforeinstallprompt", onPrompt)
    window.addEventListener("appinstalled", onInstalled)
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  async function install() {
    if (isIos) {
      setShowIosHelp((v) => !v)
      return
    }
    if (!deferred) return
    await deferred.prompt()
    const choice = await deferred.userChoice
    if (choice.outcome === "accepted") setInstalled(true)
    setDeferred(null)
  }

  async function enableNotifications() {
    const p = await requestNotificationPermission()
    setPerm(p)
  }

  const canInstall = !installed && (deferred !== null || isIos)

  // Nada a mostrar: já instalado e notificações já concedidas.
  if (installed && perm === "granted") return null

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-primary/30 bg-primary/[0.06] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">Aplicativo</p>

      {canInstall && (
        <button
          type="button"
          onClick={install}
          className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-medium text-[color:var(--brand-fg)]"
        >
          {isIos ? <Share size={16} /> : <Download size={16} />}
          Instalar aplicativo
        </button>
      )}

      {showIosHelp && (
        <p className="rounded-lg bg-black/20 p-2 text-xs text-muted">
          No iPhone: toque em <Share size={12} className="inline" /> Compartilhar e depois em
          {" "}
          <strong>&quot;Adicionar à Tela de Início&quot;</strong>.
        </p>
      )}

      {notificationsSupported() && perm !== "granted" ? (
        <button
          type="button"
          onClick={enableNotifications}
          className="flex items-center gap-2 rounded-lg border border-[color:var(--color-border)] px-3 py-2.5 text-sm font-medium text-foreground hover:bg-white/5"
        >
          <BellRing size={16} className="text-primary" />
          {perm === "denied" ? "Notificações bloqueadas" : "Ativar notificações"}
        </button>
      ) : perm === "granted" ? (
        <p className="flex items-center gap-1.5 text-xs text-positive">
          <Check size={13} /> Notificações ativas
        </p>
      ) : null}
    </div>
  )
}
