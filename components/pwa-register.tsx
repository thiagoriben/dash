"use client"

import { useEffect } from "react"
import { registerServiceWorker } from "@/lib/pwa"
import { primeSound } from "@/lib/sound"

/** Registra o service worker uma vez, no carregamento do app. */
export function PwaRegister() {
  useEffect(() => {
    void registerServiceWorker()
    // Destrava o AudioContext no primeiro gesto para os sons de notificação
    // poderem tocar depois (política de autoplay dos navegadores).
    const unlock = () => primeSound()
    window.addEventListener("pointerdown", unlock, { once: true })
    window.addEventListener("keydown", unlock, { once: true })
    return () => {
      window.removeEventListener("pointerdown", unlock)
      window.removeEventListener("keydown", unlock)
    }
  }, [])
  return null
}
