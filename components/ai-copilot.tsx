"use client"

import * as React from "react"
import { Sparkles, Mic, MicOff, Send, Trash2, Check, Loader2, Edit3, AlertCircle, HelpCircle, Folder, Tag, Calendar, DollarSign, Plus } from "lucide-react"
import { Button, Input, Card, Badge, Select } from "@/components/ui"
import { Modal } from "@/components/modal"
import { cn } from "@/lib/utils"
import {
  processAiCommand,
  executeAiActions,
  getAiContextData,
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

  const [contextData, setContextData] = React.useState<{
    projects: { id: string; name: string }[]
    categories: { id: string; name: string }[]
  }>({ projects: [], categories: [] })

  const [messages, setMessages] = React.useState<Message[]>([
    {
      id: "welcome",
      sender: "ai",
      text: "Olá! Sou o assistente do Dash. Diga ou digite o que você precisa (ex: 'Criar tarefa de subir ads', 'Excluir nota de teste', 'Lançar 500 no caixa') que cuidarei de tudo para você!",
      timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    }
  ])
  const [executing, setExecuting] = React.useState(false)
  const [recognition, setRecognition] = React.useState<any>(null)
  const chatBottomRef = React.useRef<HTMLDivElement>(null)

  // Carrega projetos e categorias do usuário ao abrir o modal
  React.useEffect(() => {
    if (open) {
      getAiContextData().then(setContextData)
    }
  }, [open])

  // Atalho de teclado Ctrl + K ou Cmd + K
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

  // Web Speech API para Transcrição de Voz
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
      // Encontra a última mensagem enviada pelo usuário como contexto
      const lastUserMsg = [...messages].reverse().find((m) => m.sender === "user")?.text ?? null
      const res: AiProcessResult = await processAiCommand(query, {
        projectId,
        previousPrompt: lastUserMsg
      })

      if (res.availableContext) {
        setContextData(res.availableContext)
      }

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

  const removeAction = (msgId: string, actionId: string) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId || !m.actions) return m
        const newActions = m.actions.filter((act) => act.id !== actionId)
        return {
          ...m,
          actions: newActions,
          requiresConfirmation: newActions.length > 0
        }
      })
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir Assistente Dash (Ctrl+K)"
        title="Abrir Assistente Dash (Ctrl+K)"
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40 flex h-13 w-13 items-center justify-center rounded-full bg-primary text-[#04140b] shadow-lg shadow-primary/25 transition-all hover:scale-105 hover:bg-primary/90 focus:outline-none"
      >
        <Sparkles size={24} className="animate-pulse" />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="✨ Assistente Dash (IA por Voz/Texto)">
        <div className="flex flex-col gap-4">
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

                {/* Opções Interativas de Esclarecimento (Chips clicáveis) */}
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
                              className="rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs text-primary transition-colors hover:bg-primary hover:text-[#04140b]"
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Card de Confirmação & Edição 100% Personalizável */}
                {m.actions && m.actions.length > 0 && (
                  <div className="mt-2 flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 text-xs font-semibold text-primary">
                        <AlertCircle size={14} /> Confirmação & Ajustes de Ações ({m.actions.length}):
                      </span>
                      <span className="text-[10px] text-muted">Edite os campos abaixo antes de executar</span>
                    </div>

                    {m.actions.map((act) => {
                      const isDelete = act.type.startsWith("delete_")
                      const isToggle = act.type.startsWith("toggle_")
                      return (
                        <Card key={act.id} className="flex flex-col gap-2.5 p-3 text-xs">
                          <div className="flex items-center justify-between gap-2 border-b border-[color:var(--color-border)] pb-2">
                            <div className="flex items-center gap-1.5 font-semibold text-foreground">
                              {isDelete ? <Trash2 size={13} className="text-negative" /> : isToggle ? <Check size={13} className="text-positive" /> : <Plus size={13} className="text-primary" />}
                              <span>{act.title}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Badge tone={isDelete ? "negative" : isToggle ? "positive" : "primary"}>
                                {act.type.replace("create_", "").replace("delete_", "excluir_").replace("toggle_", "concluir_")}
                              </Badge>
                              <button
                                type="button"
                                onClick={() => removeAction(m.id, act.id)}
                                title="Remover esta ação"
                                className="rounded p-1 text-muted hover:bg-negative/20 hover:text-negative"
                              >
                                <X size={13} />
                              </button>
                            </div>
                          </div>

                          {/* CAMPO DE TÍTULO / DESCRIÇÃO */}
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-muted">Título / Nome:</label>
                            <Input
                              value={act.payload.title || act.payload.name || act.payload.description || ""}
                              onChange={(e) => {
                                updateActionPayload(m.id, act.id, "title", e.target.value)
                                updateActionPayload(m.id, act.id, "name", e.target.value)
                                updateActionPayload(m.id, act.id, "description", e.target.value)
                              }}
                              className="h-8 text-xs"
                            />
                          </div>

                          {/* VINCULAR PROJETO */}
                          {contextData.projects.length > 0 && !isDelete && (
                            <div className="flex flex-col gap-1">
                              <label className="flex items-center gap-1 text-[10px] text-muted">
                                <Folder size={10} /> Projeto:
                              </label>
                              <Select
                                value={act.payload.project_id || ""}
                                onChange={(e) => updateActionPayload(m.id, act.id, "project_id", e.target.value || null)}
                                className="h-8 text-xs"
                              >
                                <option value="">👤 Pessoal (Sem projeto)</option>
                                {contextData.projects.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    📁 {p.name}
                                  </option>
                                ))}
                              </Select>
                            </div>
                          )}

                          {/* VINCULAR CATEGORIA */}
                          {!isDelete && (act.type === "create_todo" || act.type === "create_note" || act.type === "create_shortcut") && (
                            <div className="flex flex-col gap-1">
                              <label className="flex items-center gap-1 text-[10px] text-muted">
                                <Tag size={10} /> Categoria:
                              </label>
                              <Input
                                value={act.payload.category || ""}
                                onChange={(e) => updateActionPayload(m.id, act.id, "category", e.target.value)}
                                placeholder="Ex.: Tráfego, Pessoal..."
                                className="h-8 text-xs"
                              />
                            </div>
                          )}

                          {/* VALOR E TIPO FINANCEIRO (CAIXA) */}
                          {act.type === "create_cash_entry" && (
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="flex items-center gap-1 text-[10px] text-muted">
                                  <DollarSign size={10} /> Valor (R$):
                                </label>
                                <Input
                                  type="number"
                                  value={act.payload.amount || 0}
                                  onChange={(e) => updateActionPayload(m.id, act.id, "amount", parseFloat(e.target.value) || 0)}
                                  className="h-8 text-xs"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-muted">Tipo:</label>
                                <Select
                                  value={act.payload.type || "saida"}
                                  onChange={(e) => updateActionPayload(m.id, act.id, "type", e.target.value)}
                                  className="h-8 text-xs"
                                >
                                  <option value="saida">Saída (Despesa)</option>
                                  <option value="entrada">Entrada (Receita)</option>
                                </Select>
                              </div>
                            </div>
                          )}

                          {/* REGISTRAR VENDA */}
                          {act.type === "create_sale" && (
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="flex items-center gap-1 text-[10px] text-muted">
                                  <DollarSign size={10} /> Valor Bruto (R$):
                                </label>
                                <Input
                                  type="number"
                                  value={act.payload.gross_amount || 0}
                                  onChange={(e) => updateActionPayload(m.id, act.id, "gross_amount", parseFloat(e.target.value) || 0)}
                                  className="h-8 text-xs"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-muted">Pagamento:</label>
                                <Select
                                  value={act.payload.payment_method || "pix"}
                                  onChange={(e) => updateActionPayload(m.id, act.id, "payment_method", e.target.value)}
                                  className="h-8 text-xs"
                                >
                                  <option value="pix">PIX</option>
                                  <option value="cartao">Cartão de Crédito</option>
                                </Select>
                              </div>
                            </div>
                          )}

                          {/* MÉTRICAS DIÁRIAS (GASTO ADS) */}
                          {act.type === "create_daily_metric" && (
                            <div className="flex flex-col gap-1">
                              <label className="flex items-center gap-1 text-[10px] text-muted">
                                <DollarSign size={10} /> Gasto com Ads (R$):
                              </label>
                              <Input
                                type="number"
                                value={act.payload.spend || 0}
                                onChange={(e) => updateActionPayload(m.id, act.id, "spend", parseFloat(e.target.value) || 0)}
                                className="h-8 text-xs"
                              />
                            </div>
                          )}

                          {/* PRAZO / DATA */}
                          {act.type === "create_todo" && (
                            <div className="flex flex-col gap-1">
                              <label className="flex items-center gap-1 text-[10px] text-muted">
                                <Calendar size={10} /> Prazo:
                              </label>
                              <Input
                                type="date"
                                value={act.payload.due_date || ""}
                                onChange={(e) => updateActionPayload(m.id, act.id, "due_date", e.target.value)}
                                className="h-8 text-xs"
                              />
                            </div>
                          )}
                        </Card>
                      )
                    })}

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
              placeholder={listening ? "Ouvindo... Fale agora..." : "Digite ou fale (ex: 'Excluir nota de teste' ou 'Lançar 500 no caixa')..."}
              className="flex-1"
              autoFocus
            />

            <Button type="submit" disabled={pending || !prompt.trim()}>
              <Send size={16} />
            </Button>
          </form>

          <p className="text-[11px] text-muted text-center">
            Pressione <kbd className="rounded bg-white/10 px-1 py-0.5 text-[10px]">Ctrl + K</kbd> para abrir/fechar o assistente.
          </p>
        </div>
      </Modal>
    </>
  )
}
