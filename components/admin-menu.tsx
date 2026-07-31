"use client"

import { useState, useRef, useEffect, useTransition } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { Profile } from "@/lib/types"
import { approveUser, rejectUser } from "@/app/actions/users"
import { cn } from "@/lib/utils"
import { ShieldCheck, Check, X, Users, UserCheck, MessageSquareWarning, FolderKanban } from "lucide-react"

/**
 * Menu único de administração na sidebar. Reúne, num só ícone, tudo que é
 * função de admin: solicitações de acesso (aprovar/rejeitar) e atalhos de gestão.
 */
export function AdminMenu({ pending, collapsed }: { pending: Profile[]; collapsed: boolean }) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const ref = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const count = pending.length

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [open])

  const links = [
    { href: "/usuarios", label: "Usuários", icon: Users },
    { href: "/admin/projetos", label: "Todos os projetos", icon: FolderKanban },
    { href: "/admin/feedback", label: "Feedback", icon: MessageSquareWarning },
  ]

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Administração"
        title="Administração"
        className={cn(
          "relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-white/5 hover:text-foreground",
          collapsed && "justify-center px-0",
        )}
      >
        <span className="relative">
          <ShieldCheck size={18} />
          {count > 0 && (
            <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-negative px-1 text-[10px] font-bold text-white">
              {count}
            </span>
          )}
        </span>
        {!collapsed && "Admin"}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-2 w-64 rounded-2xl border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-2)] p-2 shadow-2xl">
          <div className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
            <UserCheck size={13} /> Solicitações de acesso
          </div>
          {count === 0 ? (
            <p className="px-2 pb-2 pt-1 text-sm text-muted">Nenhuma pendência.</p>
          ) : (
            <ul className="mb-1 flex flex-col gap-1">
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

          <div className="my-1 border-t border-border" />

          {links.map((l) => {
            const Icon = l.icon
            const active = pathname === l.href || pathname.startsWith(l.href + "/")
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-2 py-2 text-sm font-medium transition-colors",
                  active ? "bg-primary/10 text-primary" : "text-muted hover:bg-white/5 hover:text-foreground",
                )}
              >
                <Icon size={16} />
                {l.label}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
