"use client"

import { useState, useRef, useEffect, useTransition } from "react"
import type { Profile } from "@/lib/types"
import { approveUser, rejectUser } from "@/app/actions/users"
import { cn } from "@/lib/utils"
import { UserCheck, Check, X } from "lucide-react"

export function ApprovalsButton({
  pending,
  collapsed,
}: {
  pending: Profile[]
  collapsed: boolean
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const ref = useRef<HTMLDivElement>(null)
  const count = pending.length

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Solicitações de acesso"
        title="Solicitações de acesso"
        className={cn(
          "relative flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted transition-colors hover:bg-white/5 hover:text-foreground",
          collapsed && "justify-center px-0",
        )}
      >
        <span className="relative">
          <UserCheck size={18} />
          {count > 0 && (
            <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-negative px-1 text-[10px] font-bold text-white">
              {count}
            </span>
          )}
        </span>
        {!collapsed && "Solicitações"}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-2 w-64 rounded-2xl border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-2)] p-2 shadow-2xl">
          <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
            Solicitações de acesso
          </div>
          {count === 0 ? (
            <p className="px-2 py-3 text-sm text-muted">Nenhuma pendência.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {pending.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-xl px-2 py-1.5 hover:bg-white/5"
                >
                  <span className="min-w-0 truncate text-sm font-medium">{p.username}</span>
                  <span className="flex shrink-0 gap-1">
                    <button
                      disabled={isPending}
                      onClick={() => startTransition(() => void approveUser(p.id))}
                      aria-label={`Aprovar ${p.username}`}
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-positive/15 text-positive transition-colors hover:bg-positive/25"
                    >
                      <Check size={15} />
                    </button>
                    <button
                      disabled={isPending}
                      onClick={() => startTransition(() => void rejectUser(p.id))}
                      aria-label={`Rejeitar ${p.username}`}
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-negative/15 text-negative transition-colors hover:bg-negative/25"
                    >
                      <X size={15} />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
