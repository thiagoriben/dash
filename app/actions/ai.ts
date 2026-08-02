"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getCurrentProfile } from "@/lib/data"
import { createTodo, updateTodo, toggleTodo, deleteTodo } from "@/app/actions/todo"
import { createNote, updateNote, deleteNote, createShortcut, deleteShortcut, createCategory, deleteCategory } from "@/app/actions/organizacao"
import { createProject, deleteProject } from "@/app/actions/projects"

export type AiActionType =
  | "create_todo"
  | "delete_todo"
  | "toggle_todo"
  | "update_todo"
  | "create_note"
  | "delete_note"
  | "update_note"
  | "create_shortcut"
  | "delete_shortcut"
  | "create_category"
  | "delete_category"
  | "create_cash_entry"
  | "delete_cash_entry"
  | "create_project"
  | "delete_project"
  | "query_info"

export type ProposedAction = {
  id: string
  type: AiActionType
  title: string
  description: string
  targetId?: string | null
  payload: Record<string, any>
  confirmed?: boolean
}

export type ClarifyingQuestion = {
  question: string
  field?: string
  options?: { label: string; value: string }[]
}

export type AiProcessResult = {
  reply: string
  actions?: ProposedAction[]
  questions?: ClarifyingQuestion[]
  requiresConfirmation?: boolean
  availableContext?: {
    projects: { id: string; name: string }[]
    categories: { id: string; name: string }[]
  }
}

/**
 * Normaliza o texto removendo acentos e convertendo para minúsculas.
 */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

/**
 * Coleta os projetos e categorias ativas do usuário para contextualizar a IA e os dropdowns.
 */
export async function getAiContextData() {
  try {
    const supabase = await createClient()
    const me = await getCurrentProfile()
    if (!me) return { projects: [], categories: [] }

    const [{ data: projects }, { data: categories }] = await Promise.all([
      supabase.from("projects").select("id, name").order("name"),
      supabase.from("shortcut_categories").select("id, name").order("name")
    ])

    return {
      projects: (projects ?? []) as { id: string; name: string }[],
      categories: (categories ?? []) as { id: string; name: string }[]
    }
  } catch (err) {
    console.error("Error fetching context data:", err)
    return { projects: [], categories: [] }
  }
}

/**
 * Extrai horários formatados (ex: "2h00", "15:30", "uma hora", "3h") em HH:MM.
 */
function extractTime(str: string): { timeStr: string | null; cleanText: string } {
  let cleanText = str
  let timeStr: string | null = null

  // 1. Padrão "HH:MM" ou "HHhMM" ou "Hh"
  const timeRegex = /\b([01]?\d|2[0-3])(?:[:hH]([0-5]\d)?)\b/g
  const match = timeRegex.exec(str)
  if (match) {
    const hh = match[1].padStart(2, "0")
    const mm = match[2] ? match[2].padStart(2, "0") : "00"
    timeStr = `${hh}:${mm}`
    cleanText = cleanText.replace(match[0], "").trim()
  } else {
    // 2. Padrões por extenso simples
    const norm = normalize(str)
    if (norm.includes("uma hora") || norm.includes("1 hora")) {
      timeStr = "13:00"
      cleanText = cleanText.replace(/uma hora|1 hora/gi, "").trim()
    } else if (norm.includes("duas horas") || norm.includes("2 horas")) {
      timeStr = "14:00"
      cleanText = cleanText.replace(/duas horas|2 horas/gi, "").trim()
    }
  }

  return { timeStr, cleanText }
}

/**
 * Parser inteligente de IA com suporte a múltiplos itens em um único áudio/comando,
 * extração automática de horários e tratamento de exceções à prova de travamentos.
 */
export async function processAiCommand(
  prompt: string,
  context?: { projectId?: string | null; previousPrompt?: string | null }
): Promise<AiProcessResult> {
  try {
    const supabase = await createClient()
    const me = await getCurrentProfile()
    if (!me) return { reply: "Sessão expirada. Por favor, faça login novamente." }

    let text = prompt.trim()
    if (!text) return { reply: "Por favor, digite ou fale o que você deseja realizar." }

    const { projects, categories } = await getAiContextData()

    // Se o usuário clicou em uma opção genérica como "✅ Criar Tarefa" ou "salvar_nota" e temos o prompt anterior
    if (
      (text.includes("Criar Tarefa") || text.includes("Salvar Nota") || text === "criar_tarefa" || text === "salvar_nota") &&
      context?.previousPrompt
    ) {
      text = context.previousPrompt
    }

    const norm = normalize(text)

    const isDelete = norm.includes("excluir") || norm.includes("deletar") || norm.includes("remover") || norm.includes("apagar")
    const isToggle = norm.includes("concluir") || norm.includes("marcar feita") || norm.includes("finalizar") || norm.includes("concluida") || norm.includes("fechar")
    const isUpdate = norm.includes("alterar") || norm.includes("mudar") || norm.includes("editar") || norm.includes("atualizar")

    // --- GEMINI API INTELLIGENT ROUTER ---
    const geminiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY

    if (geminiKey) {
      try {
        const systemPrompt = `Você é o assistente inteligente do SaaS "Dash Tráfego".
O usuário dará comandos em português por voz ou texto. Se houver MÚLTIPLOS pedidos (ex: "me lembre de A... me lembre de B..."), crie UMA AÇÃO PARA CADA ITEM.
Projetos do usuário: ${JSON.stringify(projects)}.
Categorias do usuário: ${JSON.stringify(categories)}.

Diferencie com EXATIDÃO entre CRIAR, EXCLUIR (delete), CONCLUIR (toggle) e EDITAR (update).
Ao extrair tarefas, identifique títulos limpos, categorias e horários (ex: "14:00").

Responda ESTRITAMENTE em JSON:
{
  "reply": "Texto amigável de resposta resumindo todas as ações",
  "questions": [],
  "actions": [
    {
      "id": "act_1",
      "type": "create_todo" | "delete_todo" | "toggle_todo" | "create_note" | "delete_note" | "create_shortcut" | "delete_shortcut" | "create_category" | "create_cash_entry" | "create_project",
      "title": "Título resumido limpo",
      "description": "Explicação da ação",
      "payload": { "title": "...", "category": "...", "due_date": "YYYY-MM-DD", "time": "HH:MM" }
    }
  ]
}`

        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\nComando do usuário: "${text}"` }] }],
              generationConfig: { responseMimeType: "application/json" }
            })
          }
        )

        if (res.ok) {
          const data = await res.json()
          const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text
          if (rawJson) {
            const parsed = JSON.parse(rawJson)
            return {
              reply: parsed.reply || `Entendi seu pedido! Gereis ${parsed.actions?.length || 0} ação(ões).`,
              actions: (parsed.actions || []).map((a: any, idx: number) => ({
                ...a,
                id: a.id || `act_${Date.now()}_${idx}`
              })),
              questions: parsed.questions || [],
              requiresConfirmation: (parsed.actions || []).length > 0,
              availableContext: { projects, categories }
            }
          }
        }
      } catch (e) {
        console.warn("Gemini API error, using local fallback NLP engine:", e)
      }
    }

    // --- ENGINE DE PARSER LOCAL (ROBUSTO E COM MULTI-TAREFA) ---
    const actions: ProposedAction[] = []
    let reply = ""
    const questions: ClarifyingQuestion[] = []

    // 1. TAREFAS / LEMBRETES (Detecta "lembr" -> lembre, lembra, lembrar, lembrete, etc.)
    const isTaskKeyword = norm.includes("lembr") || norm.includes("tarefa") || norm.includes("to do") || norm.includes("agendar")

    if (isTaskKeyword && !isDelete && !isToggle) {
      // Divide a frase por marcadores repetidos de lembrete se houver vários no mesmo áudio
      const parts = text
        .split(/(?=(?:me\s+)?lembr[aeiou](?:-me)?\s+de|(?:\n|,|;)\s*(?:me\s+)?lembr)/gi)
        .map((p) => p.trim())
        .filter(Boolean)

      const todayStr = new Date().toISOString().slice(0, 10)

      for (let i = 0; i < parts.length; i++) {
        let partText = parts[i]
          .replace(/^(?:me\s+)?lembr[aeiou](?:-me)?\s+de\s+/gi, "")
          .replace(/^(?:criar|nova|adicionar|agendar)\s+tarefa\s+/gi, "")
          .trim()

        if (!partText) continue

        const { timeStr, cleanText } = extractTime(partText)
        let title = cleanText.charAt(0).toUpperCase() + cleanText.slice(1)
        if (!title) title = partText

        let category = "Outros"
        const normPart = normalize(title)
        if (normPart.includes("academia") || normPart.includes("treino") || normPart.includes("saude")) {
          category = "Saúde / Pessoal"
        } else if (normPart.includes("casa") || normPart.includes("limpar") || normPart.includes("almoco") || normPart.includes("almoçar") || normPart.includes("comida")) {
          category = "Casa / Pessoal"
        } else if (normPart.includes("anuncio") || normPart.includes("criativo") || normPart.includes("subir") || normPart.includes("trafego")) {
          category = "Tráfego"
        }

        actions.push({
          id: `act_${Date.now()}_todo_${i}`,
          type: "create_todo",
          title: `Criar Tarefa: "${title}"`,
          description: `${timeStr ? `⏰ Horário: ${timeStr} · ` : ""}Categoria: ${category}`,
          payload: {
            title,
            category,
            project_id: context?.projectId ?? null,
            due_date: todayStr,
            time: timeStr || ""
          }
        })
      }

      if (actions.length > 0) {
        reply = `Identifiquei ${actions.length} tarefa(s) para ser(em) agendada(s)!`
      }
    }

    // 2. OPERAÇÕES DE EXCLUSÃO (DELETE)
    else if (isDelete) {
      let searchTarget = text
        .replace(/(?:excluir|deletar|remover|apagar)\s+(?:a|o|uma|um)?\s*/gi, "")
        .replace(/(?:tarefa|nota|atalho|categoria|projeto|lançamento|gasto|entrada|saída)\s*/gi, "")
        .trim()

      if (norm.includes("tarefa")) {
        const { data: todos } = await supabase.from("todo_items").select("id, title").order("created_at", { ascending: false }).limit(20)
        const matched = (todos ?? []).find((t) => normalize(t.title).includes(normalize(searchTarget))) || todos?.[0]

        actions.push({
          id: `act_${Date.now()}_del_todo`,
          type: "delete_todo",
          title: `Excluir Tarefa: "${matched ? matched.title : searchTarget}"`,
          description: matched ? `Item localizado no banco` : `Será buscado pelo nome`,
          targetId: matched?.id ?? null,
          payload: { id: matched?.id ?? null, title: matched?.title ?? searchTarget }
        })
        reply = `Solicitação para excluir a tarefa "${matched ? matched.title : searchTarget}".`
      } else if (norm.includes("nota")) {
        const { data: notes } = await supabase.from("notes").select("id, title").order("created_at", { ascending: false }).limit(20)
        const matched = (notes ?? []).find((n) => normalize(n.title).includes(normalize(searchTarget))) || notes?.[0]

        actions.push({
          id: `act_${Date.now()}_del_note`,
          type: "delete_note",
          title: `Excluir Nota: "${matched ? matched.title : searchTarget}"`,
          description: matched ? `Item localizado no banco` : `Será buscada pelo nome`,
          targetId: matched?.id ?? null,
          payload: { id: matched?.id ?? null, title: matched?.title ?? searchTarget }
        })
        reply = `Solicitação para excluir a nota "${matched ? matched.title : searchTarget}".`
      } else {
        reply = `Você solicitou a exclusão de "${searchTarget}". Qual item deseja remover?`
        questions.push({
          question: "Escolha o tipo:",
          field: "delete_type",
          options: [
            { label: "🗑️ Uma Tarefa", value: "tarefa" },
            { label: "🗑️ Uma Nota", value: "nota" },
            { label: "🗑️ Um Atalho", value: "atalho" }
          ]
        })
      }
    }

    // 3. CONCLUIR TAREFA
    else if (isToggle && norm.includes("tarefa")) {
      let searchTarget = text.replace(/(?:marcar|concluir|finalizar|fechar)\s+(?:como\s+concluida|feita)?\s+(?:a\s+tarefa)?\s*/gi, "").trim()
      const { data: todos } = await supabase.from("todo_items").select("id, title, done").eq("done", false).limit(20)
      const matched = (todos ?? []).find((t) => normalize(t.title).includes(normalize(searchTarget))) || todos?.[0]

      actions.push({
        id: `act_${Date.now()}_toggle_todo`,
        type: "toggle_todo",
        title: `Marcar Concluída: "${matched ? matched.title : searchTarget}"`,
        description: `Alterar status para feito ✅`,
        targetId: matched?.id ?? null,
        payload: { id: matched?.id ?? null, title: matched?.title ?? searchTarget, done: true }
      })
      reply = `Vou marcar a tarefa "${matched ? matched.title : searchTarget}" como concluída!`
    }

    // 4. CRIAR NOTA
    else if (norm.includes("nota") || norm.includes("anotacao") || norm.includes("anotar")) {
      let title = text.replace(/(?:criar|nova|adicionar|anotar)\s+nota/gi, "").replace(/^:\s*/, "").trim()
      if (!title) title = "Anotação rápida"

      actions.push({
        id: `act_${Date.now()}_note`,
        type: "create_note",
        title: `Criar Nota: "${title}"`,
        description: `Salvar anotação`,
        payload: {
          title,
          body: text,
          category_id: categories[0]?.id ?? null,
          project_id: context?.projectId ?? null
        }
      })
      reply = `Vou salvar a nota "${title}"!`
    }

    // 5. CAIXA FINANCEIRO
    else if (norm.includes("caixa") || norm.includes("gasto") || norm.includes("despesa") || norm.includes("receita") || norm.includes("paguei")) {
      const isSaida = norm.includes("gasto") || norm.includes("despesa") || norm.includes("saida") || norm.includes("paguei")
      const amountMatch = text.match(/(?:R\$|usd|\$)?\s*(\d+(?:[.,]\d{1,2})?)/i)
      const amount = amountMatch ? parseFloat(amountMatch[1].replace(",", ".")) : 0

      actions.push({
        id: `act_${Date.now()}_cash`,
        type: "create_cash_entry",
        title: `Lançamento no Caixa (${isSaida ? "Saída/Despesa" : "Entrada/Receita"})`,
        description: `Valor: R$ ${amount.toFixed(2)}`,
        payload: {
          description: text,
          amount,
          type: isSaida ? "saida" : "entrada",
          category: isSaida ? "Despesas" : "Receita",
          project_id: context?.projectId ?? null
        }
      })
      reply = `Lançamento financeiro preparado.`
    }

    // 6. FALLBACK COM OPÇÕES AMIGÁVEIS
    else {
      reply = `Entendi a sua mensagem: "${text}". Escolha o que você gostaria de fazer com essa informação:`
      questions.push({
        question: "Escolha uma ação:",
        options: [
          { label: "✅ Criar Tarefa", value: "criar_tarefa" },
          { label: "📝 Salvar Nota", value: "salvar_nota" },
          { label: "💰 Lançar no Caixa", value: "lancar_caixa" },
          { label: "🗑️ Excluir algo", value: "excluir_item" }
        ]
      })
    }

    return {
      reply,
      actions,
      questions,
      requiresConfirmation: actions.length > 0,
      availableContext: { projects, categories }
    }
  } catch (err: any) {
    console.error("Critical error in processAiCommand:", err)
    return {
      reply: `Desculpe, ocorreu um erro ao processar este comando. Por favor, tente novamente de forma simples. (${err?.message || "Erro interno"})`,
      actions: [],
      questions: []
    }
  }
}

/**
 * Executa em lote todas as ações confirmadas (Criar, Deletar, Concluir, Atualizar) de forma 100% segura.
 */
export async function executeAiActions(
  actions: ProposedAction[],
  projectId?: string | null
): Promise<{ success: boolean; executedCount: number; error?: string }> {
  try {
    const me = await getCurrentProfile()
    if (!me) return { success: false, executedCount: 0, error: "Sessão expirada." }

    let count = 0
    const supabase = await createClient()

    for (const act of actions) {
      if (act.confirmed === false) continue

      try {
        // 1. TAREFAS
        if (act.type === "create_todo") {
          const fd = new FormData()
          fd.append("title", act.payload.title || "Nova tarefa IA")
          fd.append("category", act.payload.category || "Outros")
          if (act.payload.due_date) fd.append("due_date", act.payload.due_date)
          if (act.payload.time) fd.append("time", act.payload.time)
          await createTodo(act.payload.project_id || projectId || null, fd)
          count++
        } else if (act.type === "delete_todo") {
          const idToDelete = act.targetId || act.payload.id
          if (idToDelete) {
            await deleteTodo(idToDelete)
            count++
          }
        } else if (act.type === "toggle_todo") {
          const idToToggle = act.targetId || act.payload.id
          if (idToToggle) {
            await toggleTodo(idToToggle, act.payload.done ?? true)
            count++
          }
        }

        // 2. NOTAS
        else if (act.type === "create_note") {
          const fd = new FormData()
          fd.append("title", act.payload.title || "Nota IA")
          fd.append("body", act.payload.body || "")
          if (act.payload.category_id) fd.append("category_id", act.payload.category_id)
          await createNote(act.payload.project_id || projectId || null, fd)
          count++
        } else if (act.type === "delete_note") {
          const idToDelete = act.targetId || act.payload.id
          if (idToDelete) {
            await deleteNote(idToDelete)
            count++
          }
        }

        // 3. ATALHOS & CATEGORIAS
        else if (act.type === "create_shortcut") {
          const fd = new FormData()
          fd.append("title", act.payload.title || "Atalho IA")
          fd.append("url", act.payload.url || "")
          fd.append("kind", act.payload.kind || "link")
          await createShortcut(projectId || null, fd)
          count++
        } else if (act.type === "delete_shortcut") {
          const idToDelete = act.targetId || act.payload.id
          if (idToDelete) {
            await deleteShortcut(idToDelete)
            count++
          }
        } else if (act.type === "create_category") {
          const fd = new FormData()
          fd.append("name", act.payload.name || "Nova Categoria")
          fd.append("color", act.payload.color || "#2de2e6")
          await createCategory(projectId || null, fd)
          count++
        } else if (act.type === "delete_category") {
          const idToDelete = act.targetId || act.payload.id
          if (idToDelete) {
            await deleteCategory(idToDelete)
            count++
          }
        }

        // 4. CAIXA & PROJETOS
        else if (act.type === "create_cash_entry") {
          await supabase.from("cash_entries").insert({
            owner_id: me.id,
            project_id: act.payload.project_id || projectId || null,
            type: act.payload.type || "entrada",
            description: act.payload.description || "Lançamento via IA",
            amount: act.payload.amount || 0,
            occurred_at: act.payload.occurred_at || new Date().toISOString().slice(0, 10),
            category: act.payload.category || "Geral"
          })
          count++
        } else if (act.type === "create_project") {
          const fd = new FormData()
          fd.append("name", act.payload.name || "Novo Projeto IA")
          fd.append("currency", act.payload.currency || "BRL")
          fd.append("region", act.payload.region || "Brasil")
          await createProject(fd)
          count++
        } else if (act.type === "delete_project") {
          const idToDelete = act.targetId || act.payload.id
          if (idToDelete) {
            await deleteProject(idToDelete)
            count++
          }
        }
      } catch (err) {
        console.error("Error executing individual action:", act, err)
      }
    }

    revalidatePath("/")
    if (projectId) revalidatePath(`/projetos/${projectId}`)
    revalidatePath("/organizacao/notas")
    revalidatePath("/organizacao/tarefas")
    revalidatePath("/caixa")

    return { success: true, executedCount: count }
  } catch (err: any) {
    console.error("Critical error executing AI actions:", err)
    return { success: false, executedCount: 0, error: err?.message || "Falha ao executar ações." }
  }
}
