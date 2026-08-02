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
  | "create_sale"
  | "delete_sale"
  | "create_daily_metric"
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
 * Extrai horários formatados (ex: "2h00", "15:30", "14h") em HH:MM.
 */
function extractTime(str: string): { timeStr: string | null; cleanText: string } {
  let cleanText = str
  let timeStr: string | null = null

  const timeRegex = /\b([01]?\d|2[0-3])(?:[:hH]([0-5]\d)?)\b/g
  const match = timeRegex.exec(str)
  if (match) {
    const hh = match[1].padStart(2, "0")
    const mm = match[2] ? match[2].padStart(2, "0") : "00"
    timeStr = `${hh}:${mm}`
    cleanText = cleanText.replace(match[0], "").trim()
  }
  return { timeStr, cleanText }
}

/**
 * Parser inteligente de IA MULTI-INTENÇÃO.
 * Suporta mensagens complexas contendo múltiplos pedidos em uma única frase ou áudio.
 */
export async function processAiCommand(
  prompt: string,
  context?: { projectId?: string | null }
): Promise<AiProcessResult> {
  try {
    const supabase = await createClient()
    const me = await getCurrentProfile()
    if (!me) return { reply: "Sessão expirada. Por favor, faça login novamente." }

    let text = prompt.trim()
    if (!text) return { reply: "Por favor, digite ou fale o que você deseja realizar." }

    const { projects, categories } = await getAiContextData()
    const norm = normalize(text)

    // --- GEMINI API MULTI-INTENT ENGINE ---
    const geminiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY

    if (geminiKey) {
      try {
        const systemPrompt = `Você é o assistente inteligente do SaaS "Dash Tráfego".
O usuário dará comandos que PODEM CONTER UMA OU MÚLTIPLAS INTENÇÕES AO MESMO TEMPO (ex: atualizar métricas + registrar venda + criar tarefa + salvar nota + lançar caixa).
Projetos do usuário: ${JSON.stringify(projects)}.
Categorias do usuário: ${JSON.stringify(categories)}.

EXTRAIA E RETORNE TODAS AS AÇÕES SOLICITADAS NO ARRAY "actions".
Ações suportadas:
- create_todo: { title, category, project_id, due_date, time }
- create_note: { title, body, category_id, project_id }
- create_shortcut: { title, url, kind }
- create_category: { name, color }
- create_cash_entry: { description, amount, type ("entrada"|"saida"), category, project_id }
- create_sale: { gross_amount, payment_method ("pix"|"cartao"), project_id }
- create_daily_metric: { spend, impressions, clicks, sales, revenue, project_id, date }
- create_project: { name, currency, region }
- delete_todo, delete_note, delete_shortcut, delete_project, toggle_todo

Responda ESTRITAMENTE em JSON:
{
  "reply": "Resumo amigável de todas as ações entendidas",
  "actions": [ ...todas as ações extraídas... ]
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
              reply: parsed.reply || `Entendi seu pedido! Preparei ${parsed.actions?.length || 0} ação(ões).`,
              actions: (parsed.actions || []).map((a: any, idx: number) => ({
                ...a,
                id: a.id || `act_${Date.now()}_${idx}`
              })),
              questions: [],
              requiresConfirmation: (parsed.actions || []).length > 0,
              availableContext: { projects, categories }
            }
          }
        }
      } catch (e) {
        console.warn("Gemini API error, using local multi-intent NLP fallback engine:", e)
      }
    }

    // --- ENGINE MULTI-INTENÇÃO LOCAL (DIVISÃO DE CLÁUSULAS E PARSER COMPLETO) ---
    const actions: ProposedAction[] = []

    // Divide a mensagem em frases/cláusulas por separadores comuns
    const clauses = text
      .split(/(?:\.|\n|;|\b(?:e|tambem|alem disso)\b)/gi)
      .map((c) => c.trim())
      .filter(Boolean)

    const todayStr = new Date().toISOString().slice(0, 10)

    for (let idx = 0; idx < clauses.length; idx++) {
      const clause = clauses[idx]
      const normClause = normalize(clause)

      let matchedProject = context?.projectId ?? null
      for (const p of projects) {
        if (normClause.includes(normalize(p.name))) {
          matchedProject = p.id
          break
        }
      }

      const isDelete = normClause.includes("excluir") || normClause.includes("deletar") || normClause.includes("remover") || normClause.includes("apagar")
      const isToggle = normClause.includes("concluir") || normClause.includes("marcar feita") || normClause.includes("finalizar") || normClause.includes("concluida")

      // 1. MÉTRICAS DIÁRIAS (ex: "atualizar métricas", "gasto com ads 500", "impressões 1000")
      if (normClause.includes("metrica") || normClause.includes("impressao") || normClause.includes("impressões") || normClause.includes("cliques") || (normClause.includes("gasto") && normClause.includes("ads"))) {
        const amountMatch = clause.match(/(?:R\$|usd|\$)?\s*(\d+(?:[.,]\d{1,2})?)/i)
        const amount = amountMatch ? parseFloat(amountMatch[1].replace(",", ".")) : 0

        actions.push({
          id: `act_${Date.now()}_metric_${idx}`,
          type: "create_daily_metric",
          title: `Atualizar Métricas Diárias`,
          description: `Gasto Ads: R$ ${amount.toFixed(2)} · Projeto: ${projects.find((p) => p.id === matchedProject)?.name || "Geral"}`,
          payload: {
            spend: amount,
            project_id: matchedProject,
            date: todayStr
          }
        })
      }

      // 2. REGISTRAR VENDA (ex: "adicionar venda de 197 no pix", "vendi 297")
      else if (normClause.includes("venda") || normClause.includes("vendi") || normClause.includes("faturei")) {
        const amountMatch = clause.match(/(?:R\$|usd|\$)?\s*(\d+(?:[.,]\d{1,2})?)/i)
        const amount = amountMatch ? parseFloat(amountMatch[1].replace(",", ".")) : 0
        const isPix = normClause.includes("pix")
        const isCard = normClause.includes("cartao") || normClause.includes("credito")

        actions.push({
          id: `act_${Date.now()}_sale_${idx}`,
          type: "create_sale",
          title: `Registrar Venda (${isPix ? "PIX" : isCard ? "Cartão" : "Geral"})`,
          description: `Valor Bruto: R$ ${amount.toFixed(2)} · Projeto: ${projects.find((p) => p.id === matchedProject)?.name || "Geral"}`,
          payload: {
            gross_amount: amount,
            payment_method: isCard ? "cartao" : "pix",
            project_id: matchedProject
          }
        })
      }

      // 3. TAREFAS / LEMBRETES
      else if (normClause.includes("lembr") || normClause.includes("tarefa") || normClause.includes("to do") || normClause.includes("agendar")) {
        let partText = clause
          .replace(/^(?:me\s+)?lembr[aeiou](?:-me)?\s+de\s+/gi, "")
          .replace(/^(?:criar|nova|adicionar|agendar)\s+tarefa\s+/gi, "")
          .trim()

        const { timeStr, cleanText } = extractTime(partText || clause)
        let title = cleanText.charAt(0).toUpperCase() + cleanText.slice(1)
        if (!title) title = clause

        let category = "Outros"
        if (normClause.includes("academia") || normClause.includes("saude")) category = "Saúde / Pessoal"
        else if (normClause.includes("casa") || normClause.includes("limpar") || normClause.includes("almoco")) category = "Casa / Pessoal"
        else if (normClause.includes("anuncio") || normClause.includes("criativo") || normClause.includes("trafego")) category = "Tráfego"

        actions.push({
          id: `act_${Date.now()}_todo_${idx}`,
          type: "create_todo",
          title: `Criar Tarefa: "${title}"`,
          description: `${timeStr ? `⏰ Horário: ${timeStr} · ` : ""}Categoria: ${category}`,
          payload: {
            title,
            category,
            project_id: matchedProject,
            due_date: todayStr,
            time: timeStr || ""
          }
        })
      }

      // 4. CRIAR NOTA
      else if (normClause.includes("nota") || normClause.includes("anotacao") || normClause.includes("anotar")) {
        let title = clause.replace(/(?:criar|nova|adicionar|anotar)\s+nota/gi, "").replace(/^:\s*/, "").trim()
        if (!title) title = "Anotação rápida"

        actions.push({
          id: `act_${Date.now()}_note_${idx}`,
          type: "create_note",
          title: `Criar Nota: "${title}"`,
          description: `Conteúdo da nota gerado`,
          payload: {
            title,
            body: clause,
            category_id: categories[0]?.id ?? null,
            project_id: matchedProject
          }
        })
      }

      // 5. CAIXA FINANCEIRO
      else if (normClause.includes("caixa") || normClause.includes("gasto") || normClause.includes("despesa") || normClause.includes("receita") || normClause.includes("paguei")) {
        const isSaida = normClause.includes("gasto") || normClause.includes("despesa") || normClause.includes("saida") || normClause.includes("paguei")
        const amountMatch = clause.match(/(?:R\$|usd|\$)?\s*(\d+(?:[.,]\d{1,2})?)/i)
        const amount = amountMatch ? parseFloat(amountMatch[1].replace(",", ".")) : 0

        actions.push({
          id: `act_${Date.now()}_cash_${idx}`,
          type: "create_cash_entry",
          title: `Lançamento no Caixa (${isSaida ? "Saída" : "Entrada"})`,
          description: `Valor: R$ ${amount.toFixed(2)}`,
          payload: {
            description: clause,
            amount,
            type: isSaida ? "saida" : "entrada",
            category: isSaida ? "Despesas" : "Receita",
            project_id: matchedProject
          }
        })
      }

      // 6. EXCLUIR ITEM
      else if (isDelete) {
        let searchTarget = clause.replace(/(?:excluir|deletar|remover|apagar)\s+(?:a|o|uma|um)?\s*/gi, "").trim()
        if (normClause.includes("nota")) {
          actions.push({
            id: `act_${Date.now()}_del_note_${idx}`,
            type: "delete_note",
            title: `Excluir Nota: "${searchTarget}"`,
            description: `Remoção de nota`,
            payload: { title: searchTarget }
          })
        } else {
          actions.push({
            id: `act_${Date.now()}_del_todo_${idx}`,
            type: "delete_todo",
            title: `Excluir Tarefa: "${searchTarget}"`,
            description: `Remoção de tarefa`,
            payload: { title: searchTarget }
          })
        }
      }

      // 7. CONCLUIR TAREFA
      else if (isToggle) {
        let searchTarget = clause.replace(/(?:marcar|concluir|finalizar)\s+(?:como\s+concluida)?\s*/gi, "").trim()
        actions.push({
          id: `act_${Date.now()}_toggle_${idx}`,
          type: "toggle_todo",
          title: `Concluir Tarefa: "${searchTarget}"`,
          description: `Alterar status para feito ✅`,
          payload: { title: searchTarget, done: true }
        })
      }
    }

    // Se nenhuma cláusula gerou ação específica, cria uma tarefa direta com o texto para o usuário revisar
    if (actions.length === 0) {
      actions.push({
        id: `act_${Date.now()}_todo_fallback`,
        type: "create_todo",
        title: `Criar Tarefa: "${text}"`,
        description: `Categoria: Outros`,
        payload: {
          title: text,
          category: "Outros",
          project_id: context?.projectId ?? null,
          due_date: todayStr
        }
      })
    }

    return {
      reply: `Preparei ${actions.length} ação(ões) com base na sua mensagem. Confira e ajuste os campos abaixo se desejar:`,
      actions,
      questions: [],
      requiresConfirmation: true,
      availableContext: { projects, categories }
    }
  } catch (err: any) {
    console.error("Critical error in processAiCommand:", err)
    return {
      reply: `Ocorreu um erro ao processar seu comando. Tente novamente com termos simples. (${err?.message || "Erro de execução"})`,
      actions: [],
      questions: []
    }
  }
}

/**
 * Executa em lote todas as ações confirmadas (Criar, Deletar, Concluir, Vendas, Métricas, Caixa).
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
          } else if (act.payload.title) {
            const { data: todos } = await supabase.from("todo_items").select("id, title").limit(20)
            const matched = (todos ?? []).find((t) => normalize(t.title).includes(normalize(act.payload.title)))
            if (matched) {
              await deleteTodo(matched.id)
              count++
            }
          }
        } else if (act.type === "toggle_todo") {
          const idToToggle = act.targetId || act.payload.id
          if (idToToggle) {
            await toggleTodo(idToToggle, act.payload.done ?? true)
            count++
          } else if (act.payload.title) {
            const { data: todos } = await supabase.from("todo_items").select("id, title").limit(20)
            const matched = (todos ?? []).find((t) => normalize(t.title).includes(normalize(act.payload.title)))
            if (matched) {
              await toggleTodo(matched.id, act.payload.done ?? true)
              count++
            }
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

        // 3. VENDAS
        else if (act.type === "create_sale") {
          const targetProj = act.payload.project_id || projectId
          if (targetProj) {
            const gross = parseFloat(act.payload.gross_amount) || 0
            await supabase.from("sales").insert({
              project_id: targetProj,
              gross_amount: gross,
              net_amount: gross,
              payment_method: act.payload.payment_method || "pix",
              sold_at: new Date().toISOString().slice(0, 10)
            })
            count++
          }
        }

        // 4. MÉTRICAS DIÁRIAS
        else if (act.type === "create_daily_metric") {
          const targetProj = act.payload.project_id || projectId
          if (targetProj) {
            const date = act.payload.date || new Date().toISOString().slice(0, 10)
            const spend = parseFloat(act.payload.spend) || 0
            await supabase.from("daily_metrics").upsert(
              {
                project_id: targetProj,
                date,
                spend
              },
              { onConflict: "project_id,date" }
            )
            count++
          }
        }

        // 5. CAIXA & OUTROS
        else if (act.type === "create_cash_entry") {
          await supabase.from("cash_entries").insert({
            owner_id: me.id,
            project_id: act.payload.project_id || projectId || null,
            type: act.payload.type || "entrada",
            description: act.payload.description || "Lançamento via IA",
            amount: parseFloat(act.payload.amount) || 0,
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
