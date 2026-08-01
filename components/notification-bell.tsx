"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import {
  Bell,
  Check,
  UserPlus,
  UserCheck,
  MessageSquare,
  Bug,
  Megaphone,
  FolderPlus,
  MessageSquareWarning,
  Volume2,
  VolumeX,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { markNotificationRead, markAllNotificationsRead } from "@/app/actions/social"
import type { Notification } from "@/lib/data"
import { cn } from "@/lib/utils"
import { playNotificationSound, isSoundMuted, setSoundMuted } from "@/lib/sound"

const typeIcon: Record<string, { icon: typeof Bell; tone: string }> = {
  friend_request: { icon: UserPlus, tone: "text-sky-300" },
  friend_accepted: { icon: UserCheck, tone: "text-primary" },
  direct_message: { icon: MessageSquare, tone: "text-primary" },
  project_invite: { icon: FolderPlus, tone: "text-sky-300" },
  join_request: { icon: FolderPlus, tone: "text-amber-300" },
  join_response: { icon: FolderPlus, tone: "text-primary" },
  feedback: { icon: MessageSquareWarning, tone: "text-amber-300" },
  auto_bug: { icon: Bug, tone: "text-danger" },
  global: { icon: Megaphone, tone: "text-sky-300" },
}

export function NotificationBell({
  meId,
  initial,
}: {
  meId: string
  initial: Notification[]
}) {
  const [items, setItems] = useState<Notification[]>(initial)
  const [open, setOpen] = useState(false)
  const [muted, setMuted] = useState(false)
  const [, startTransition] = useTransition()
  const router = useRouter()
  const ref = useRef<HTMLDivElement>(null)

  const unread = items.filter((n) => !n.read_at).length

  // Sincroniza o estado de mudo com o localStorage (compartilhado com o chat).
  useEffect(() => {
    setMuted(isSoundMuted())
    const onMute = (e: Event) => setMuted(Boolean((e as CustomEvent).detail))
    window.addEventListener("dash-sound-mute", onMute)
    return () => window.removeEventListener("dash-sound-mute", onMute)
  }, [])

  // Realtime: novas notificações do usuário chegam sem refresh (e tocam som).
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`notifications:${meId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${meId}` },
        (payload) => {
          setItems((prev) => [payload.new as Notification, ...prev].slice(0, 30))
          playNotificationSound()
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [meId])

  function toggleMute() {
    const next = !muted
    setMuted(next)
    setSoundMuted(next)
  }

  // Fecha ao clicar fora.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  function openNotification(n: Notification) {
    // Ao ler, remove da aba (mantém o painel limpo, como pedido).
    setItems((prev) => prev.filter((x) => x.id !== n.id))
    if (!n.read_at) startTransition(() => void markNotificationRead(n.id))
    setOpen(false)
    if (n.link) router.push(n.link)
  }

  function markAll() {
    setItems([])
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
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleMute}
                aria-label={muted ? "Ativar som das notificações" : "Silenciar notificações"}
                title={muted ? "Som desativado" : "Som ativado"}
                className="flex items-center gap-1 text-xs text-muted transition-colors hover:text-foreground"
              >
                {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              </button>
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
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted">Nenhuma notificação.</p>
            ) : (
              items.map((n) => {
                const meta = typeIcon[n.type] ?? { icon: Bell, tone: "text-muted" }
                const Icon = meta.icon
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => openNotification(n)}
                    className={cn(
                      "flex w-full items-start gap-2.5 border-b border-[color:var(--color-border)] px-3 py-2 text-left transition-colors hover:bg-white/[0.03]",
                      !n.read_at && "bg-primary/[0.06]",
                    )}
                  >
                    <span className={cn("mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/5", meta.tone)}>
                      <Icon size={14} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        {!n.read_at && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                        <span className="truncate">{n.title}</span>
                      </span>
                      {n.body && <span className="line-clamp-2 text-xs text-muted">{n.body}</span>}
                      <span className="text-[10px] text-muted">
                        {new Date(n.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
                      </span>
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
