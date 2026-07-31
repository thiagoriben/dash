"use client"

import { useState, useEffect, useRef, useTransition, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { sendDirectMessage, markMessagesRead, markMessagesDelivered } from "@/app/actions/social"
import type { Profile } from "@/lib/types"
import type { DirectMessage } from "@/lib/data"
import { Send, MessageSquare, Users, Check, CheckCheck, Timer } from "lucide-react"
import { cn } from "@/lib/utils"

const TTL_OPTIONS: { value: string; label: string }[] = [
  { value: "off", label: "Permanente" },
  { value: "1m", label: "1 minuto" },
  { value: "5m", label: "5 minutos" },
  { value: "24h", label: "24 horas" },
  { value: "7d", label: "7 dias" },
  { value: "15d", label: "15 dias" },
  { value: "30d", label: "30 dias" },
]

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}

function ttlLabelFor(m: DirectMessage): string | null {
  if (!m.expires_at) return null
  const ms = new Date(m.expires_at).getTime() - Date.now()
  if (ms <= 0) return "expirando…"
  const mins = Math.round(ms / 60000)
  if (mins < 60) return `some em ${mins}min`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `some em ${hrs}h`
  return `some em ${Math.round(hrs / 24)}d`
}

export function ChatClient({
  meId,
  partners,
  activeId,
  initialMessages,
  unreadByPartner,
}: {
  meId: string
  partners: Profile[]
  activeId: string | null
  initialMessages: DirectMessage[]
  unreadByPartner: Record<string, number>
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [messages, setMessages] = useState<DirectMessage[]>(initialMessages)
  const [text, setText] = useState("")
  const [ttl, setTtl] = useState<string>("15d")
  const [unread, setUnread] = useState<Record<string, number>>(unreadByPartner)
  const [pending, startTransition] = useTransition()
  const scrollRef = useRef<HTMLDivElement>(null)

  const active = partners.find((p) => p.id === activeId) ?? null

  useEffect(() => {
    setMessages(initialMessages)
  }, [initialMessages])

  useEffect(() => {
    setUnread(unreadByPartner)
  }, [unreadByPartner])

  const refresh = useCallback(async () => {
    if (!activeId) return
    const nowIso = new Date().toISOString()
    const { data } = await supabase
      .from("direct_messages")
      .select("*")
      .or(
        `and(sender_id.eq.${meId},recipient_id.eq.${activeId}),and(sender_id.eq.${activeId},recipient_id.eq.${meId})`,
      )
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .order("created_at", { ascending: true })
      .limit(200)
    setMessages((data ?? []) as DirectMessage[])
  }, [activeId, meId, supabase])

  // Ao abrir a conversa: marca entregue + lida e zera contador local.
  useEffect(() => {
    if (!activeId) return
    void markMessagesDelivered(activeId)
    void markMessagesRead(activeId).then(() => {
      setUnread((u) => ({ ...u, [activeId]: 0 }))
      router.refresh()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])

  // Realtime: qualquer mudança em direct_messages recarrega e reprocessa leitura.
  useEffect(() => {
    const channel = supabase
      .channel(`dm-${meId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "direct_messages" },
        (payload) => {
          const row = (payload.new ?? payload.old ?? {}) as Partial<DirectMessage>
          const involvesActive =
            activeId && (row.sender_id === activeId || row.recipient_id === activeId)
          if (involvesActive) {
            void refresh()
            if (row.sender_id === activeId && row.recipient_id === meId) {
              void markMessagesDelivered(activeId)
              void markMessagesRead(activeId)
            }
          } else if (row.recipient_id === meId && row.sender_id) {
            // Mensagem de outro parceiro: incrementa badge.
            const from = row.sender_id
            setUnread((u) => ({ ...u, [from]: (u[from] ?? 0) + 1 }))
          }
        },
      )
      .subscribe()
    const poll = setInterval(() => void refresh(), 6000)
    return () => {
      supabase.removeChannel(channel)
      clearInterval(poll)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, meId])

  // Expira mensagens visualmente sem precisar de refresh do servidor.
  useEffect(() => {
    const t = setInterval(() => {
      setMessages((ms) => ms.filter((m) => !m.expires_at || new Date(m.expires_at).getTime() > Date.now()))
    }, 15000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages])

  function selectPartner(id: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("u", id)
    router.push(`/chat?${params.toString()}`)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (e.nativeEvent instanceof KeyboardEvent && (e.nativeEvent as any).isComposing) return
    const body = text.trim()
    if (!body || !activeId) return
    setText("")
    startTransition(async () => {
      const res = await sendDirectMessage(activeId, body, ttl)
      if (res?.error) {
        setText(body)
        return
      }
      await refresh()
    })
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col p-4 md:p-6">
      <h1 className="mb-4 font-display text-2xl font-semibold">Chat</h1>
      <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden md:grid-cols-[260px_1fr]">
        {/* Lista de amigos */}
        <aside className="flex flex-col gap-1 overflow-y-auto rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]/40 p-2">
          <div className="flex items-center gap-2 px-2 py-2 text-xs font-semibold uppercase tracking-wider text-muted">
            <Users size={14} /> Amigos
          </div>
          {partners.length === 0 ? (
            <p className="px-2 py-4 text-sm text-muted">Adicione amigos para conversar.</p>
          ) : (
            partners.map((p) => {
              const n = unread[p.id] ?? 0
              return (
                <button
                  key={p.id}
                  onClick={() => selectPartner(p.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                    p.id === activeId ? "bg-primary/10 text-primary" : "text-muted hover:bg-white/5 hover:text-foreground",
                  )}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 font-mono text-xs font-semibold text-primary">
                    {p.username.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{p.full_name || p.username}</span>
                  {n > 0 && p.id !== activeId && (
                    <span className="ml-auto grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-[color:var(--brand-fg)]">
                      {n > 99 ? "99+" : n}
                    </span>
                  )}
                </button>
              )
            })
          )}
        </aside>

        {/* Conversa */}
        <section className="flex flex-col overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]/40">
          {!active ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted">
              <MessageSquare size={32} />
              <p className="text-sm">Selecione um amigo para conversar.</p>
            </div>
          ) : (
            <>
              <header className="flex items-center gap-3 border-b border-[color:var(--color-border)] p-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 font-mono text-sm font-semibold text-primary">
                  {active.username.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <div className="text-sm font-medium">{active.full_name || active.username}</div>
                  <div className="text-xs text-muted">@{active.username}</div>
                </div>
              </header>

              <div ref={scrollRef} className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
                {messages.length === 0 ? (
                  <p className="m-auto text-sm text-muted">Nenhuma mensagem ainda. Diga oi!</p>
                ) : (
                  messages.map((m) => {
                    const mine = m.sender_id === meId
                    const ttlLabel = ttlLabelFor(m)
                    return (
                      <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                        <div
                          className={cn(
                            "flex max-w-[75%] flex-col gap-1 rounded-2xl px-3.5 py-2 text-sm",
                            mine ? "bg-primary text-[color:var(--brand-fg)]" : "bg-white/5 text-foreground",
                          )}
                        >
                          <span className="whitespace-pre-wrap break-words">{m.body}</span>
                          <span
                            className={cn(
                              "flex items-center justify-end gap-1 text-[10px]",
                              mine ? "text-[color:var(--brand-fg)]/70" : "text-muted",
                            )}
                          >
                            {ttlLabel && (
                              <span className="flex items-center gap-0.5">
                                <Timer size={10} />
                                {ttlLabel}
                              </span>
                            )}
                            <span>{fmtTime(m.created_at)}</span>
                            {mine && (
                              <StatusTicks read={m.read} delivered={!!m.delivered_at} />
                            )}
                          </span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              <form onSubmit={submit} className="flex flex-col gap-2 border-t border-[color:var(--color-border)] p-3">
                <div className="flex items-center gap-2">
                  <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Escreva uma mensagem…"
                    className="flex-1 rounded-xl border border-[color:var(--color-border)] bg-transparent px-3.5 py-2.5 text-sm outline-none focus:border-primary"
                  />
                  <button
                    type="submit"
                    disabled={pending || !text.trim()}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-[color:var(--brand-fg)] disabled:opacity-50"
                    aria-label="Enviar"
                  >
                    <Send size={16} />
                  </button>
                </div>
                <label className="flex items-center gap-2 self-start text-xs text-muted">
                  <Timer size={13} />
                  Mensagem temporária:
                  <select
                    value={ttl}
                    onChange={(e) => setTtl(e.target.value)}
                    className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-2 py-1 text-xs text-foreground outline-none focus:border-primary"
                  >
                    {TTL_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  )
}

function StatusTicks({ read, delivered }: { read: boolean; delivered: boolean }) {
  if (read) return <CheckCheck size={12} className="text-sky-300" aria-label="Visualizada" />
  if (delivered) return <CheckCheck size={12} aria-label="Entregue" />
  return <Check size={12} aria-label="Enviada" />
}
