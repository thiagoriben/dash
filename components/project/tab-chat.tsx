"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { createClient } from "@/lib/supabase/client"
import { sendChatMessage, markChatRead } from "@/app/actions/social"
import type { Profile } from "@/lib/types"
import type { ChatMessage } from "@/lib/data"
import { Card, CardContent } from "@/components/ui"
import { Send, MessagesSquare, Timer, Check, CheckCheck } from "lucide-react"
import { playNotificationSound } from "@/lib/sound"

// Mesmas opções de expiração do chat global.
const TTL_OPTIONS: { value: string; label: string }[] = [
  { value: "off", label: "Permanente" },
  { value: "1m", label: "1 minuto" },
  { value: "5m", label: "5 minutos" },
  { value: "24h", label: "24 horas" },
  { value: "7d", label: "7 dias" },
  { value: "15d", label: "15 dias" },
  { value: "30d", label: "30 dias" },
]

function ttlLabelFor(m: ChatMessage): string | null {
  if (!m.expires_at) return null
  const ms = new Date(m.expires_at).getTime() - Date.now()
  if (ms <= 0) return "expirando…"
  const mins = Math.round(ms / 60000)
  if (mins < 60) return `some em ${mins}min`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `some em ${hrs}h`
  return `some em ${Math.round(hrs / 24)}d`
}

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
  const [ttl, setTtl] = useState<string>("15d")
  const [loading, setLoading] = useState(true)
  const [pending, startTransition] = useTransition()
  const scrollRef = useRef<HTMLDivElement>(null)
  const supabase = useRef(createClient()).current
  // Guarda ids já vistos para tocar som só em mensagem realmente nova de outro membro.
  const seenIds = useRef<Set<string>>(new Set())

  const nameFor = (id: string) => {
    const p = profiles.find((x) => x.id === id)
    return p?.full_name || p?.username || "Usuário"
  }
  // Total de destinatários possíveis (todos menos quem enviou).
  const audience = Math.max(profiles.length - 1, 0)

  // Carrega histórico inicial.
  useEffect(() => {
    let active = true
    ;(async () => {
      const rows = await fetchMessages()
      if (active) {
        rows.forEach((m) => seenIds.current.add(m.id))
        setMessages(rows)
        setLoading(false)
      }
    })()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  // Assina novas mensagens em tempo real (toca som + marca leitura).
  useEffect(() => {
    const channel = supabase
      .channel(`chat:${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_messages", filter: `project_id=eq.${projectId}` },
        () => {
          void refresh()
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  // Fallback: recarrega a cada 8s caso o realtime não entregue.
  useEffect(() => {
    const t = setInterval(() => void refresh(), 8000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  // Expira mensagens visualmente sem esperar o servidor.
  useEffect(() => {
    const t = setInterval(() => {
      setMessages((ms) => ms.filter((m) => !m.expires_at || new Date(m.expires_at).getTime() > Date.now()))
    }, 15000)
    return () => clearInterval(t)
  }, [])

  // Rola pro fim quando chega mensagem.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages])

  async function fetchMessages(): Promise<ChatMessage[]> {
    const nowIso = new Date().toISOString()
    const { data } = await supabase
      .from("chat_messages")
      .select("*, chat_reads(user_id)")
      .eq("project_id", projectId)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .order("created_at", { ascending: false })
      .limit(100)
    const rows = ((data ?? []) as any[]).map((m) => {
      const { chat_reads, ...rest } = m
      return { ...(rest as ChatMessage), read_by: (chat_reads ?? []).map((r: { user_id: string }) => r.user_id) }
    })
    return rows.reverse()
  }

  async function refresh() {
    const rows = await fetchMessages()
    // Toca som se chegou mensagem nova de outro membro.
    const incoming = rows.find((m) => !seenIds.current.has(m.id) && m.sender_id !== meId)
    rows.forEach((m) => seenIds.current.add(m.id))
    setMessages(rows)
    if (incoming) playNotificationSound()

    // Marca como lidas as mensagens de outros que eu ainda não li.
    const unread = rows
      .filter((m) => m.sender_id !== meId && !(m.read_by ?? []).includes(meId))
      .map((m) => m.id)
    if (unread.length) void markChatRead(projectId, unread)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (e.nativeEvent instanceof KeyboardEvent && (e.nativeEvent as any).isComposing) return
    const body = text.trim()
    if (!body) return
    setText("")
    startTransition(async () => {
      const res = await sendChatMessage(projectId, body, ttl)
      if (res?.error) {
        setText(body)
        return
      }
      await refresh()
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
            <p className="py-8 text-center text-sm text-muted">Nenhuma mensagem ainda. Diga olá aos seus sócios!</p>
          ) : (
            messages.map((m) => {
              const mine = m.sender_id === meId
              const ttlLabel = ttlLabelFor(m)
              // Quantos outros membros já leram (ignora o remetente).
              const readers = (m.read_by ?? []).filter((id) => id !== m.sender_id).length
              return (
                <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                  {!mine && <span className="mb-0.5 px-1 text-xs text-muted">{nameFor(m.sender_id)}</span>}
                  <div
                    className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                      mine ? "bg-primary text-[color:var(--color-accent-fg)]" : "bg-surface-2 text-foreground"
                    }`}
                  >
                    {m.body}
                  </div>
                  <span
                    className={`mt-0.5 flex items-center gap-1 px-1 text-[10px] ${
                      mine ? "text-muted" : "text-muted"
                    }`}
                  >
                    {ttlLabel && (
                      <span className="flex items-center gap-0.5">
                        <Timer size={10} />
                        {ttlLabel}
                      </span>
                    )}
                    <span>
                      {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {mine &&
                      (readers >= audience && audience > 0 ? (
                        <CheckCheck size={12} className="text-sky-300" aria-label={`Lida por ${readers}`} />
                      ) : readers > 0 ? (
                        <span className="flex items-center gap-0.5">
                          <CheckCheck size={12} aria-label={`Lida por ${readers}`} />
                          {audience > 1 ? readers : null}
                        </span>
                      ) : (
                        <Check size={12} aria-label="Enviada" />
                      ))}
                  </span>
                </div>
              )
            })
          )}
        </div>

        <CardContent className="border-t border-[color:var(--color-border)] p-3">
          <form onSubmit={submit} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
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
        </CardContent>
      </Card>
    </div>
  )
}
