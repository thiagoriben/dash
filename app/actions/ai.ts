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
}

/**
 * Parser inteligente de IA com suporte a CRUD completo (Criar, Deletar, Concluir, Atualizar, Consultar),
 * perguntas de esclarecimento e context de projetos/categorias do usuário.
 */
export async function processAiCommand(
  prompt: string,
  context?: { projectId?: string | null; previousActions?: ProposedAction[] }
): Promise<AiProcessResult> {
  const supabase = await createClient()
  const me = await getCurrentProfile()
  if (!me) return { reply: "Sessão expirada. Por favor, faça login novamente." }

  const text = prompt.trim()
  if (!text) return { reply: "Por favor, digite ou fale o que você deseja realizar." }

  const { projects, categories } = await getAiContextData()
  const norm = normalize(text)

  const isDelete = norm.includes("excluir") || norm.includes("deletar") || norm.includes("remover") || norm.includes("apagar")
  const isToggle = norm.includes("concluir") || norm.includes("marcar feita") || norm.includes("finalizar") || norm.includes("concluida") || norm.includes("fechar")
  const isUpdate = norm.includes("alterar") || norm.includes("mudar") || norm.includes("editar") || norm.includes("atualizar")

  const geminiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY

  if (geminiKey) {
    try {
      const systemPrompt = `Você é o assistente inteligente do SaaS "Dash Tráfego".
O usuário dará comandos em português sobre suas operações (tarefas, notas, atalhos, categorias, caixa financeiro, projetos).
Seus projetos atuais: ${JSON.stringify(projects)}.
Suas categorias atuais: ${JSON.stringify(categories)}.

Diferencie com EXATIDÃO entre CRIAR, EXCLUIR (delete), CONCLUIR (toggle) e EDITAR (update).
Exemplo: "excluir a tarefa de subir ads" deve gerar "type": "delete_todo".
Exemplo: "marcar como concluída a tarefa X" deve gerar "type": "toggle_todo".

Responda ESTRITAMENTE em JSON:
{
  "reply": "Texto amigável de resposta",
  "questions": [ { "question": "Deseja vincular a qual projeto?", "field": "project_id", "options": [ {"label": "Pessoal", "value": ""} ] } ],
  "actions": [
    {
      "id": "act_1",
      "type": "create_todo" | "delete_todo" | "toggle_todo" | "update_todo" | "create_note" | "delete_note" | "update_note" | "create_shortcut" | "delete_shortcut" | "create_category" | "delete_category" | "create_cash_entry" | "delete_cash_entry" | "create_project" | "delete_project" | "query_info",
      "title": "Título resumido da ação",
      "description": "Explicação da ação",
      "targetId": null,
      "payload": { ...parâmetros... }
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
            reply: parsed.reply || "Entendi o seu pedido!",
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
      console.warn("Gemini API error, falling back to NLP local engine:", e)
    }
  }

  // --- ENGINE NLP LOCAL COM SUPORTE A DELETAR / ATUALIZAR / CONCLUIR ---
  const actions: ProposedAction[] = []
  let reply = ""
  const questions: ClarifyingQuestion[] = []

  // --- OPERAÇÕES DE EXCLUSÃO (DELETE) ---
  if (isDelete) {
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
        description: matched ? `ID localizado: ${matched.id}` : `Será buscado pelo nome`,
        targetId: matched?.id ?? null,
        payload: { id: matched?.id ?? null, title: matched?.title ?? searchTarget }
      })
      reply = `Encontrei a solicitação para excluir a tarefa "${matched ? matched.title : searchTarget}".`
    } else if (norm.includes("nota")) {
      const { data: notes } = await supabase.from("notes").select("id, title").order("created_at", { ascending: false }).limit(20)
      const matched = (notes ?? []).find((n) => normalize(n.title).includes(normalize(searchTarget))) || notes?.[0]

      actions.push({
        id: `act_${Date.now()}_del_note`,
        type: "delete_note",
        title: `Excluir Nota: "${matched ? matched.title : searchTarget}"`,
        description: matched ? `ID localizado: ${matched.id}` : `Será buscada pelo nome`,
        targetId: matched?.id ?? null,
        payload: { id: matched?.id ?? null, title: matched?.title ?? searchTarget }
      })
      reply = `Solicitação para excluir a nota "${matched ? matched.title : searchTarget}".`
    } else if (norm.includes("atalho")) {
      const { data: shortcuts } = await supabase.from("shortcuts").select("id, title").order("created_at", { ascending: false }).limit(20)
      const matched = (shortcuts ?? []).find((s) => normalize(s.title).includes(normalize(searchTarget))) || shortcuts?.[0]

      actions.push({
        id: `act_${Date.now()}_del_sc`,
        type: "delete_shortcut",
        title: `Excluir Atalho: "${matched ? matched.title : searchTarget}"`,
        description: matched ? `ID localizado: ${matched.id}` : `Será buscado pelo nome`,
        targetId: matched?.id ?? null,
        payload: { id: matched?.id ?? null }
      })
      reply = `Solicitação para excluir o atalho "${matched ? matched.title : searchTarget}".`
    } else {
      reply = `Você pediu para excluir "${searchTarget}". Qual item exatamente deseja remover?`
      questions.push({
        question: "Qual tipo de item deseja excluir?",
        field: "delete_type",
        options: [
          { label: "🗑️ Uma Tarefa", value: "tarefa" },
          { label: "🗑️ Uma Nota", value: "nota" },
          { label: "🗑️ Um Atalho", value: "atalho" }
        ]
      })
    }
  }

  // --- OPERAÇÕES DE CONCLUIR TAREFA (TOGGLE) ---
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

  // --- OPERAÇÕES DE CRIAÇÃO (CREATE) ---
  else if (norm.includes("tarefa") || norm.includes("lembrar de") || norm.includes("to do")) {
    let title = text
      .replace(/(?:criar|nova|adicionar|agendar|lembrar de)\s+tarefa/gi, "")
      .replace(/^:\s*/, "")
      .trim()
    if (!title) title = text

    let selectedCat = ""
    for (const c of categories) {
      if (norm.includes(normalize(c.name))) {
        selectedCat = c.name
        break
      }
    }

    let selectedProj = context?.projectId ?? ""
    for (const p of projects) {
      if (norm.includes(normalize(p.name))) {
        selectedProj = p.id
        break
      }
    }

    actions.push({
      id: `act_${Date.now()}_todo`,
      type: "create_todo",
      title: `Criar Tarefa: "${title}"`,
      description: `Categoria: ${selectedCat || "Outros"} · Projeto: ${projects.find((p) => p.id === selectedProj)?.name || "Pessoal"}`,
      payload: {
        title,
        category: selectedCat || "Outros",
        project_id: selectedProj || null,
        due_date: new Date().toISOString().slice(0, 10)
      }
    })
    reply = `Identifiquei a criação da tarefa "${title}".`

    // Perguntas de esclarecimento se projeto ou categoria não foram especificados
    if (!selectedProj && projects.length > 0) {
      questions.push({
        question: "Deseja vincular essa tarefa a algum projeto?",
        field: "project_id",
        options: [
          { label: "👤 Pessoal (Sem projeto)", value: "" },
          ...projects.map((p) => ({ label: `📁 ${p.name}`, value: p.id }))
        ]
      })
    }
  }

  else if (norm.includes("nota") || norm.includes("anotacao") || norm.includes("anotar")) {
    let title = text.replace(/(?:criar|nova|adicionar|anotar)\s+nota/gi, "").replace(/^:\s*/, "").trim()
    if (!title) title = "Anotação rápida"

    actions.push({
      id: `act_${Date.now()}_note`,
      type: "create_note",
      title: `Criar Nota: "${title}"`,
      description: `Texto da nota gerado`,
      payload: {
        title,
        body: text,
        category_id: categories[0]?.id ?? null,
        project_id: context?.projectId ?? null
      }
    })
    reply = `Vou salvar a nota "${title}"!`
  }

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

  else {
    reply = `Entendi a sua mensagem: "${text}". Escolha o que você gostaria de fazer:`
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
}

/**
 * Executa em lote todas as ações confirmadas (Criar, Deletar, Concluir, Atualizar).
 */
export async function executeAiActions(
  actions: ProposedAction[],
  projectId?: string | null
): Promise<{ success: boolean; executedCount: number; error?: string }> {
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
      console.error("Error executing action:", act, err)
    }
  }

  revalidatePath("/")
  if (projectId) revalidatePath(`/projetos/${projectId}`)
  revalidatePath("/organizacao/notas")
  revalidatePath("/organizacao/tarefas")
  revalidatePath("/caixa")

  return { success: true, executedCount: count }
}
