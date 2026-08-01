"use client"

import { useEffect } from "react"
import { registerServiceWorker, primeAudio } from "@/lib/pwa"

/** Registra o service worker uma vez, no carregamento do app. */
export function PwaRegister() {
  useEffect(() => {
    void registerServiceWorker()
    // Destrava o AudioContext no primeiro gesto para o "ding" das notificações
    // poder tocar depois (política de autoplay dos navegadores).
    const unlock = () => primeAudio()
    window.addEventListener("pointerdown", unlock, { once: true })
    window.addEventListener("keydown", unlock, { once: true })
    return () => {
      window.removeEventListener("pointerdown", unlock)
      window.removeEventListener("keydown", unlock)
    }
  }, [])
  return null
}
