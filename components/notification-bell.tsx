"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { Bell, Check } from "lucide-react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { markNotificationRead, markAllNotificationsRead } from "@/app/actions/social"
import type { Notification } from "@/lib/data"
import { cn } from "@/lib/utils"

export function NotificationBell({
  meId,
  initial,
}: {
  meId: string
  initial: Notification[]
}) {
  const [items, setItems] = useState<Notification[]>(initial)
  const [open, setOpen] = useState(false)
  const [, startTransition] = useTransition()
  const router = useRouter()
  const ref = useRef<HTMLDivElement>(null)

  const unread = items.filter((n) => !n.read_at).length

  // Realtime: novas notificações do usuário chegam sem refresh.
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`notifications:${meId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${meId}` },
        (payload) => {
          setItems((prev) => [payload.new as Notification, ...prev].slice(0, 30))
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [meId])

  // Fecha ao clicar fora.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  function openNotification(n: Notification) {
    if (!n.read_at) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)))
      startTransition(() => void markNotificationRead(n.id))
    }
    setOpen(false)
    if (n.link) router.push(n.link)
  }

  function markAll() {
    setItems((prev) => prev.map((x) => ({ ...x, read_at: x.read_at ?? new Date().toISOString() })))
    startTransition(() => void markAllNotificationsRead())
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notificações"
        className="relative grid h-9 w-9 place-items-center rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] text-muted transition-colors hover:text-foreground"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-2)] shadow-2xl">
          <div className="flex items-center justify-between border-b border-[color:var(--color-border)] px-3 py-2">
            <span className="text-sm font-medium">Notificações</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAll}
                className="flex items-center gap-1 text-xs text-muted transition-colors hover:text-foreground"
              >
                <Check className="h-3 w-3" /> Marcar todas
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted">Nenhuma notificação.</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => openNotification(n)}
                  className={cn(
                    "flex w-full flex-col gap-0.5 border-b border-[color:var(--color-border)] px-3 py-2 text-left transition-colors hover:bg-white/[0.03]",
                    !n.read_at && "bg-primary/[0.06]",
                  )}
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {!n.read_at && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                    {n.title}
                  </span>
                  {n.body && <span className="line-clamp-2 text-xs text-muted">{n.body}</span>}
                  <span className="text-[10px] text-muted">
                    {new Date(n.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
