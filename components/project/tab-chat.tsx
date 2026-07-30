"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { createClient } from "@/lib/supabase/client"
import { sendChatMessage } from "@/app/actions/social"
import type { Profile } from "@/lib/types"
import type { ChatMessage } from "@/lib/data"
import { Card, CardContent } from "@/components/ui"
import { Send, MessagesSquare } from "lucide-react"

export function TabChat({
  projectId,
  meId,
  profiles,
}: {
  projectId: string
  meId: string
  profiles: Profile[]
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [text, setText] = useState("")
  const [loading, setLoading] = useState(true)
  const [pending, startTransition] = useTransition()
  const scrollRef = useRef<HTMLDivElement>(null)
  const supabase = useRef(createClient()).current

  const nameFor = (id: string) => {
    const p = profiles.find((x) => x.id === id)
    return p?.full_name || p?.username || "Usuário"
  }

  // Carrega histórico inicial.
  useEffect(() => {
    let active = true
    ;(async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(100)
      if (active) {
        setMessages(((data ?? []) as ChatMessage[]).reverse())
        setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [projectId, supabase])

  // Assina novas mensagens em tempo real.
  useEffect(() => {
    const channel = supabase
      .channel(`chat:${projectId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `project_id=eq.${projectId}` },
        (payload) => {
          const msg = payload.new as ChatMessage
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [projectId, supabase])

  // Rola pro fim quando chega mensagem.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (e.nativeEvent instanceof KeyboardEvent && (e.nativeEvent as any).isComposing) return
    const body = text.trim()
    if (!body) return
    setText("")
    startTransition(async () => {
      const res = await sendChatMessage(projectId, body)
      if (res?.error) setText(body) // devolve o texto em caso de erro
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <MessagesSquare size={18} className="text-primary" /> Chat da sociedade
        </h2>
        <p className="text-sm text-muted">Conversa privada entre o dono e os sócios deste projeto.</p>
      </div>

      <Card className="flex h-[520px] flex-col overflow-hidden">
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted">Carregando mensagens…</p>
          ) : messages.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">
              Nenhuma mensagem ainda. Diga olá aos seus sócios!
            </p>
          ) : (
            messages.map((m) => {
              const mine = m.sender_id === meId
              return (
                <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                  {!mine && (
                    <span className="mb-0.5 px-1 text-xs text-muted">{nameFor(m.sender_id)}</span>
                  )}
                  <div
                    className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                      mine
                        ? "bg-primary text-[color:var(--color-accent-fg)]"
                        : "bg-surface-2 text-foreground"
                    }`}
                  >
                    {m.body}
                  </div>
                  <span className="mt-0.5 px-1 text-[10px] text-muted">
                    {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              )
            })
          )}
        </div>

        <CardContent className="border-t border-[color:var(--color-border)] p-3">
          <form onSubmit={submit} className="flex items-center gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Escreva uma mensagem…"
              className="flex-1 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3.5 py-2.5 text-sm outline-none placeholder:text-muted focus:border-[color:var(--color-border-strong)]"
            />
            <button
              type="submit"
              disabled={pending || !text.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-[color:var(--color-accent-fg)] transition-opacity disabled:opacity-40"
              aria-label="Enviar mensagem"
            >
              <Send size={17} />
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
