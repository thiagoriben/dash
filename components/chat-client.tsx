"use client"

import { useState, useEffect, useRef, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { sendDirectMessage } from "@/app/actions/social"
import type { Profile } from "@/lib/types"
import type { DirectMessage } from "@/lib/data"
import { Send, MessageSquare, Users } from "lucide-react"
import { cn } from "@/lib/utils"

export function ChatClient({
  meId,
  partners,
  activeId,
  initialMessages,
}: {
  meId: string
  partners: Profile[]
  activeId: string | null
  initialMessages: DirectMessage[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [messages, setMessages] = useState<DirectMessage[]>(initialMessages)
  const [text, setText] = useState("")
  const [pending, startTransition] = useTransition()
  const scrollRef = useRef<HTMLDivElement>(null)

  const active = partners.find((p) => p.id === activeId) ?? null

  // Sincroniza mensagens quando muda o sócio ativo (server envia novas).
  useEffect(() => {
    setMessages(initialMessages)
  }, [initialMessages])

  async function refresh() {
    if (!activeId) return
    const { data } = await supabase
      .from("direct_messages")
      .select("*")
      .or(
        `and(sender_id.eq.${meId},recipient_id.eq.${activeId}),and(sender_id.eq.${activeId},recipient_id.eq.${meId})`,
      )
      .order("created_at", { ascending: true })
      .limit(200)
    setMessages((data ?? []) as DirectMessage[])
  }

  // Realtime: escuta inserts onde eu sou destinatário e recarrega.
  useEffect(() => {
    if (!activeId) return
    const channel = supabase
      .channel(`dm-${meId}-${activeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages" },
        () => void refresh(),
      )
      .subscribe()
    const poll = setInterval(() => void refresh(), 8000)
    return () => {
      supabase.removeChannel(channel)
      clearInterval(poll)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, meId])

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
      const res = await sendDirectMessage(activeId, body)
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
        {/* Lista de sócios */}
        <aside className="flex flex-col gap-1 overflow-y-auto rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]/40 p-2">
          <div className="flex items-center gap-2 px-2 py-2 text-xs font-semibold uppercase tracking-wider text-muted">
            <Users size={14} /> Sócios
          </div>
          {partners.length === 0 ? (
            <p className="px-2 py-4 text-sm text-muted">Adicione sócios para conversar.</p>
          ) : (
            partners.map((p) => (
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
                <span className="min-w-0 truncate">{p.full_name || p.username}</span>
              </button>
            ))
          )}
        </aside>

        {/* Conversa */}
        <section className="flex flex-col overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]/40">
          {!active ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted">
              <MessageSquare size={32} />
              <p className="text-sm">Selecione um sócio para conversar.</p>
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
                    return (
                      <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                        <div
                          className={cn(
                            "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm",
                            mine
                              ? "bg-primary text-[color:var(--brand-fg)]"
                              : "bg-white/5 text-foreground",
                          )}
                        >
                          {m.body}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              <form onSubmit={submit} className="flex items-center gap-2 border-t border-[color:var(--color-border)] p-3">
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
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
