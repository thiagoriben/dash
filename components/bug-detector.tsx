"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { reportAutoBug } from "@/app/actions/social"

/**
 * Detector de bugs automático (silencioso para o usuário comum).
 * Escuta erros globais não tratados e promessas rejeitadas, monta um relato
 * técnico detalhado e envia para o servidor, que grava e notifica os admins.
 * O usuário NÃO vê nada — só os admins recebem a notificação e o detalhe.
 */
export function BugDetector() {
  const pathname = usePathname()
  const pathRef = useRef(pathname)
  pathRef.current = pathname
  // Evita reenviar a mesma mensagem em sequência (loops de render).
  const lastSent = useRef<{ msg: string; at: number } | null>(null)

  useEffect(() => {
    function send(message: string, opts: { stack?: string | null; source: string }) {
      const msg = (message || "").trim()
      if (!msg) return
      // Ignora ruído conhecido e irrelevante.
      if (/ResizeObserver loop|Script error\.?$/i.test(msg)) return
      const now = Date.now()
      if (lastSent.current && lastSent.current.msg === msg && now - lastSent.current.at < 15000) return
      lastSent.current = { msg, at: now }
      void reportAutoBug({
        message: msg,
        stack: opts.stack ?? null,
        page: pathRef.current,
        url: typeof location !== "undefined" ? location.href : null,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        source: opts.source,
      })
    }

    function onError(e: ErrorEvent) {
      send(e.message || String(e.error), { stack: e.error?.stack ?? null, source: "window.onerror" })
    }
    function onRejection(e: PromiseRejectionEvent) {
      const reason: any = e.reason
      const message = reason?.message || (typeof reason === "string" ? reason : "Promise rejeitada")
      send(message, { stack: reason?.stack ?? null, source: "unhandledrejection" })
    }

    window.addEventListener("error", onError)
    window.addEventListener("unhandledrejection", onRejection)
    return () => {
      window.removeEventListener("error", onError)
      window.removeEventListener("unhandledrejection", onRejection)
    }
  }, [])

  return null
}
