"use client"

import * as React from "react"
import { Sparkles, Mic, MicOff, Send, X, Check, Loader2, Edit2, AlertCircle, HelpCircle, ChevronRight } from "lucide-react"
import { Button, Input, Card, Badge } from "@/components/ui"
import { Modal } from "@/components/modal"
import { cn } from "@/lib/utils"
import {
  processAiCommand,
  executeAiActions,
  type ProposedAction,
  type ClarifyingQuestion,
  type AiProcessResult
} from "@/app/actions/ai"

type Message = {
  id: string
  sender: "user" | "ai"
  text: string
  actions?: ProposedAction[]
  questions?: ClarifyingQuestion[]
  requiresConfirmation?: boolean
  timestamp: string
}

export function AiCopilot({ projectId }: { projectId?: string | null }) {
  const [open, setOpen] = React.useState(false)
  const [prompt, setPrompt] = React.useState("")
  const [listening, setListening] = React.useState(false)
  const [pending, startTransition] = React.useTransition()
  const [messages, setMessages] = React.useState<Message[]>([
    {
      id: "welcome",
      sender: "ai",
      text: "Olá! Sou seu assistente de IA do Dash. Digite ou fale o que você deseja criar (tarefas, notas, atalhos, lançamentos no caixa, projetos) ou consulte suas informações!",
      timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    }
  ])
  const [executing, setExecuting] = React.useState(false)
  const [recognition, setRecognition] = React.useState<any>(null)
  const chatBottomRef = React.useRef<HTMLDivElement>(null)

  // Atalho de teclado Ctrl + K ou Cmd + K para abrir o assistente
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  // Inicializa a Web Speech API para Transcrição de Voz nativa e gratuita
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (SpeechRecognition) {
        const rec = new SpeechRecognition()
        rec.continuous = true
        rec.interimResults = true
        rec.lang = "pt-BR"

        rec.onresult = (event: any) => {
          let currentText = ""
          for (let i = event.resultIndex; i < event.results.length; i++) {
            currentText += event.results[i][0].transcript
          }
          if (currentText) {
            setPrompt(currentText)
          }
        }

        rec.onerror = (e: any) => {
          console.warn("Speech recognition error:", e)
          setListening(false)
        }

        rec.onend = () => {
          setListening(false)
        }

        setRecognition(rec)
      }
    }
  }, [])

  // Auto scroll para o final da conversa
  React.useEffect(() => {
    if (open) {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, open])

  const toggleListening = () => {
    if (!recognition) {
      alert("A transcrição por voz não é suportada neste navegador. Tente usar o Google Chrome, Edge ou Safari.")
      return
    }
    if (listening) {
      recognition.stop()
      setListening(false)
    } else {
      try {
        recognition.start()
        setListening(true)
      } catch (err) {
        console.error("Error starting speech recognition:", err)
      }
    }
  }

  const handleSend = (textToSend?: string) => {
    const query = (textToSend || prompt).trim()
    if (!query || pending) return

    if (listening && recognition) {
      recognition.stop()
      setListening(false)
    }

    const userMsg: Message = {
      id: `user_${Date.now()}`,
      sender: "user",
      text: query,
      timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    }

    setMessages((prev) => [...prev, userMsg])
    setPrompt("")

    startTransition(async () => {
      const res: AiProcessResult = await processAiCommand(query, { projectId })
      const aiMsg: Message = {
        id: `ai_${Date.now()}`,
        sender: "ai",
        text: res.reply,
        actions: res.actions,
        questions: res.questions,
        requiresConfirmation: res.requiresConfirmation,
        timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      }
      setMessages((prev) => [...prev, aiMsg])
    })
  }

  const handleConfirmAction = async (msgId: string, actions: ProposedAction[]) => {
    setExecuting(true)
    const res = await executeAiActions(actions, projectId)
    setExecuting(false)

    if (res.success) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? { ...m, requiresConfirmation: false, text: `${m.text} ✅ (${res.executedCount} ação(ões) executadas com sucesso!)` }
            : m
        )
      )
    } else {
      alert(`Erro ao executar ações: ${res.error}`)
    }
  }

  const updateActionPayload = (msgId: string, actionId: string, field: string, value: any) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId || !m.actions) return m
        return {
          ...m,
          actions: m.actions.map((act) =>
            act.id === actionId
              ? { ...act, payload: { ...act.payload, [field]: value } }
              : act
          )
        }
      })
    )
  }

  return (
    <>
      {/* Botão Flutuante (Trigger Copilot) no canto inferior direito */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir Assistente de IA (Ctrl+K)"
        title="Abrir Assistente de IA (Ctrl+K)"
        className="fixed bottom-5 right-5 z-40 flex h-13 w-13 items-center justify-center rounded-full bg-primary text-[#04121a] shadow-lg shadow-primary/20 transition-all hover:scale-105 hover:bg-primary/90 focus:outline-none"
      >
        <Sparkles size={24} className="animate-pulse" />
      </button>

      {/* Modal / Panel do Assistente */}
      <Modal open={open} onClose={() => setOpen(false)} title="✨ Dash Copilot (IA por Voz/Texto)">
        <div className="flex flex-col gap-4">
          {/* Timeline de Mensagens */}
          <div className="flex max-h-[60vh] min-h-[300px] flex-col gap-3 overflow-y-auto rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]/40 p-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "flex flex-col gap-2 rounded-xl p-3 text-sm",
                  m.sender === "user"
                    ? "self-end bg-primary/20 text-foreground max-w-[85%]"
                    : "self-start bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] max-w-[95%]"
                )}
              >
                <div className="flex items-center justify-between gap-2 text-xs font-semibold text-muted">
                  <span className="flex items-center gap-1">
                    {m.sender === "ai" ? <Sparkles size={12} className="text-primary" /> : null}
                    {m.sender === "user" ? "Você" : "Dash IA"}
                  </span>
                  <span>{m.timestamp}</span>
                </div>
                <p className="whitespace-pre-wrap">{m.text}</p>

                {/* Opções de Esclarecimento (Chips clicáveis) */}
                {m.questions && m.questions.length > 0 && (
                  <div className="mt-2 flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 p-2.5">
                    {m.questions.map((q, idx) => (
                      <div key={idx} className="flex flex-col gap-1.5">
                        <span className="flex items-center gap-1 text-xs font-medium text-primary">
                          <HelpCircle size={12} /> {q.question}
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {q.options?.map((opt, oIdx) => (
                            <button
                              key={oIdx}
                              type="button"
                              onClick={() => handleSend(opt.label)}
                              className="rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs text-primary transition-colors hover:bg-primary hover:text-[#04121a]"
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Card de Confirmação de Ações Propostas */}
                {m.actions && m.actions.length > 0 && (
                  <div className="mt-2 flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
                    <span className="flex items-center gap-1 text-xs font-semibold text-primary">
                      <AlertCircle size={14} /> Confirmação de Ações ({m.actions.length}):
                    </span>

                    {m.actions.map((act) => (
                      <Card key={act.id} className="flex flex-col gap-2 p-2.5 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-foreground">{act.title}</span>
                          <Badge tone="primary">{act.type.replace("create_", "")}</Badge>
                        </div>
                        <p className="text-muted">{act.description}</p>

                        {/* Campos Editáveis antes da Confirmação */}
                        {act.type === "create_todo" && (
                          <div className="mt-1 flex flex-col gap-1">
                            <label className="text-[10px] text-muted">Título da Tarefa:</label>
                            <Input
                              value={act.payload.title || ""}
                              onChange={(e) => updateActionPayload(m.id, act.id, "title", e.target.value)}
                              className="h-7 text-xs"
                            />
                          </div>
                        )}

                        {act.type === "create_cash_entry" && (
                          <div className="mt-1 grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-muted">Valor (R$):</label>
                              <Input
                                type="number"
                                value={act.payload.amount || 0}
                                onChange={(e) => updateActionPayload(m.id, act.id, "amount", parseFloat(e.target.value) || 0)}
                                className="h-7 text-xs"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-muted">Tipo:</label>
                              <select
                                value={act.payload.type || "saida"}
                                onChange={(e) => updateActionPayload(m.id, act.id, "type", e.target.value)}
                                className="h-7 w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-2 text-xs"
                              >
                                <option value="entrada">Entrada</option>
                                <option value="saida">Saída</option>
                              </select>
                            </div>
                          </div>
                        )}
                      </Card>
                    ))}

                    {m.requiresConfirmation && (
                      <Button
                        size="sm"
                        disabled={executing}
                        onClick={() => handleConfirmAction(m.id, m.actions!)}
                        className="mt-1 w-full justify-center"
                      >
                        {executing ? (
                          <>
                            <Loader2 size={14} className="animate-spin" /> Executando...
                          </>
                        ) : (
                          <>
                            <Check size={14} /> Confirmar e Executar ({m.actions.length})
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}

            {pending && (
              <div className="flex items-center gap-2 self-start rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-3 text-xs text-muted">
                <Loader2 size={14} className="animate-spin text-primary" /> IA analisando seu comando...
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Campo de Entrada (Voz + Texto) */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSend()
            }}
            className="flex items-center gap-2"
          >
            {/* Botão de Transcrição de Voz NATIVO */}
            <Button
              type="button"
              variant={listening ? "negative" : "outline"}
              onClick={toggleListening}
              title={listening ? "Parar transcrição de voz" : "Falar por voz"}
              className={cn("shrink-0", listening && "animate-pulse")}
            >
              {listening ? <MicOff size={16} /> : <Mic size={16} />}
            </Button>

            <Input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={listening ? "Ouvindo... Fale agora..." : "Digite ou fale o que quer criar (ex: 'Criar tarefa de subir ads')..."}
              className="flex-1"
              autoFocus
            />

            <Button type="submit" disabled={pending || !prompt.trim()}>
              <Send size={16} />
            </Button>
          </form>

          <p className="text-[11px] text-muted text-center">
            Dica: Pressione <kbd className="rounded bg-white/10 px-1 py-0.5 text-[10px]">Ctrl + K</kbd> em qualquer tela para abrir este assistente.
          </p>
        </div>
      </Modal>
    </>
  )
}
