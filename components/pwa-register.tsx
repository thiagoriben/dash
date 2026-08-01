"use client"

import { useEffect } from "react"
import { registerServiceWorker } from "@/lib/pwa"

/** Registra o service worker uma vez, no carregamento do app. */
export function PwaRegister() {
  useEffect(() => {
    void registerServiceWorker()
  }, [])
  return null
}
