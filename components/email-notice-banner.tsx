"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { Mail, X } from "lucide-react"
import { dismissEmailNotice } from "@/app/actions/profile"

/**
 * Aviso global (uma única vez) para usuários que ainda usam o email padrão
 * gerado no cadastro e não cadastraram um email real. Some ao dispensar ou
 * quando um email é configurado (controlado pelo layout).
 */
export function EmailNoticeBanner() {
  const [hidden, setHidden] = useState(false)
  const [, startTransition] = useTransition()

  if (hidden) return null

  function dismiss() {
    setHidden(true)
    startTransition(() => void dismissEmailNotice())
  }

  return (
    <div className="border-b border-primary/20 bg-primary/10">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-2.5 md:px-6">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
          <Mail size={15} />
        </span>
        <p className="min-w-0 flex-1 text-sm text-foreground text-pretty">
          Você ainda não cadastrou um email real. Adicione um email para conseguir recuperar sua senha e receber avisos
          importantes.
        </p>
        <Link
          href="/perfil"
          onClick={dismiss}
          className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Adicionar email
        </Link>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dispensar aviso"
          className="grid h-7 w-7 place-items-center rounded-lg text-muted transition-colors hover:bg-white/5 hover:text-foreground"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
