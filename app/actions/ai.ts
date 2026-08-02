"use server"

import { revalidatePath } from "next/cache"
import { createClient, createAdminClient } from "@/lib/supabase/server"
import { getCurrentProfile, savePrefs } from "@/lib/data"
import { createTodo, updateTodo, toggleTodo, deleteTodo } from "@/app/actions/todo"
import { createNote, updateNote, deleteNote, createShortcut, deleteShortcut, createCategory, deleteCategory } from "@/app/actions/organizacao"
import { createProject, deleteProject } from "@/app/actions/projects"
import { getUsdBrlRate } from "@/lib/currency-server"
import { inputToProject, currencySymbol, fmtMoney } from "@/lib/currency"

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
    projects: { id: string; name: string; currency: string }[]
    categories: { id: string; name: string }[]
    memories: string[]
    usdBrlRate: number
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
 * VISÃO E CONHECIMENTO OMNISCIENTE DO SAAS:
 * Coleta Projetos, Métricas de Hoje, Vendas, Tarefas Pendentes, Notas, Caixa e Equipe do Usuário.
 */
export async function getAiContextData() {
  try {
    const supabase = await createClient()
    const me = await getCurrentProfile()
    if (!me) return { projects: [], categories: [], memories: [], usdBrlRate: 5.0, liveSummary: {} }

    const todayStr = new Date().toISOString().slice(0, 10)

    const [
      { data: projects },
      { data: categories },
      { data: pendingTodos },
      { data: notes },
      { data: cashEntries },
      { data: todaySales },
      { data: todayMetrics },
      usdBrlRate
    ] = await Promise.all([
      supabase.from("projects").select("id, name, currency").order("name"),
      supabase.from("shortcut_categories").select("id, name").order("name"),
      supabase.from("todo_items").select("id, title, due_date, category, done").eq("owner_id", me.id).eq("done", false).limit(20),
      supabase.from("notes").select("id, title, category_id").eq("owner_id", me.id).limit(10),
      supabase.from("cash_entries").select("amount, type, currency").eq("owner_id", me.id),
      supabase.from("sales").select("gross_amount, project_id").eq("sold_at", todayStr),
      supabase.from("daily_metrics").select("spend, project_id").eq("date", todayStr),
      getUsdBrlRate()
    ])

    const memories = (me.prefs?.ai_memories as string[]) ?? []
    const taskReminders = ((me.prefs?.task_reminders as Record<string, any>) ?? {})

    // Agregação em tempo real do caixa
    let totalEntradas = 0
    let totalSaidas = 0
    for (const c of cashEntries ?? []) {
      const amt = Number(c.amount) || 0
      if (c.type === "entrada") totalEntradas += amt
      else totalSaidas += amt
    }

    // Vendas e Ads de hoje
    const salesTodayTotal = (todaySales ?? []).reduce((acc, s) => acc + (Number(s.gross_amount) || 0), 0)
    const adsSpendTodayTotal = (todayMetrics ?? []).reduce((acc, m) => acc + (Number(m.spend) || 0), 0)

    return {
      projects: (projects ?? []).map((p: any) => ({
        id: p.id,
        name: p.name,
        currency: (p.currency || "BRL").toUpperCase()
      })),
      categories: (categories ?? []) as { id: string; name: string }[],
      memories,
      usdBrlRate,
      liveSummary: {
        pendingTodos: (pendingTodos ?? []).map((t) => ({
          ...t,
          time: taskReminders[t.id]?.time || null
        })),
        notesCount: notes?.length || 0,
        cashBalance: totalEntradas - totalSaidas,
        salesTodayTotal,
        adsSpendTodayTotal
      }
    }
  } catch (err) {
    console.error("Error fetching context data:", err)
    return { projects: [], categories: [], memories: [], usdBrlRate: 5.0, liveSummary: {} }
  }
}

/**
 * Registra aprendizado permanente do usuário.
 */
export async function recordAiMemory(memoryText: string) {
  try {
    const me = await getCurrentProfile()
    if (!me) return
    const current = (me.prefs?.ai_memories as string[]) ?? []
    if (!current.includes(memoryText)) {
      const updated = [memoryText, ...current].slice(0, 50)
      await savePrefs({ ai_memories: updated })
    }
  } catch (e) {
    console.error("Error recording AI memory:", e)
  }
}

/**
 * Extrai limpo o título da tarefa, horário (HH:MM) e data a partir do texto em português.
 */
function cleanTaskPrompt(clause: string): { title: string; timeStr: string | null; dueDate: string } {
  let text = clause.trim()
  const today = new Date()

  // 1. Horário
  let timeStr: string | null = null
  const timeMatch = text.match(/(?:às|as|para as|na|no)?\s*([01]?\d|2[0-3])(?::([0-5]\d)|h([0-5]\d)?| horas?)/i)
  if (timeMatch) {
    const hh = timeMatch[1].padStart(2, "0")
    const mm = timeMatch[2] || timeMatch[3] || "00"
    timeStr = `${hh}:${mm}`
    text = text.replace(timeMatch[0], "").trim()
  }

  // 2. Data
  let dueDate = today.toISOString().slice(0, 10)
  const norm = normalize(text)
  if (norm.includes("amanha")) {
    const tmr = new Date(today)
    tmr.setDate(tmr.getDate() + 1)
    dueDate = tmr.toISOString().slice(0, 10)
    text = text.replace(/\bamanh[aã]\b/gi, "").trim()
  } else if (norm.includes("hoje")) {
    text = text.replace(/\bhoje\b/gi, "").trim()
  }

  // 3. Limpeza de prefixos de ruído
  let cleanTitle = text
    .replace(/^(?:me\s+)?lembr[aeiou](?:-me)?\s+(?:de|pra|que)?\s*/gi, "")
    .replace(/^(?:criar|nova|adicionar|agendar)\s+tarefa\s+(?:de|pra)?\s*/gi, "")
    .replace(/^(?:preciso|tenho que|devo)\s+/gi, "")
    .replace(/(?:\s+às|\s+as|\s+para as|\s+horas)\s*$/gi, "")
    .trim()

  if (cleanTitle) {
    cleanTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1)
  } else {
    cleanTitle = clause
  }

  return { title: cleanTitle, timeStr, dueDate }
}

/**
 * Detecta explicitamente a moeda informada pelo usuário no texto ("reais", "dolar", "usd", "brl").
 */
function detectInputCurrency(str: string, defaultCurrency = "BRL"): string {
  const norm = normalize(str)
  if (norm.includes("dolar") || norm.includes("dolares") || norm.includes("usd") || norm.includes("us$")) {
    return "USD"
  }
  if (norm.includes("real") || norm.includes("reais") || norm.includes("brl") || norm.includes("r$")) {
    return "BRL"
  }
  if (norm.includes("euro") || norm.includes("euros") || norm.includes("eur") || norm.includes("€")) {
    return "EUR"
  }
  return defaultCurrency
}

/**
 * ENGINE CENTRAL DE INTELICÊNCIA OMNISCIENTE DO SAAS:
 * Compreende relatórios, consultas diretas e ações de qualquer ferramenta do SaaS.
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

    const { projects, categories, memories, usdBrlRate, liveSummary } = await getAiContextData()

    if (
      (text.includes("Criar Tarefa") || text.includes("Salvar Nota") || text === "criar_tarefa" || text === "salvar_nota") &&
      context?.previousPrompt
    ) {
      text = context.previousPrompt
    }

    const norm = normalize(text)

    // Se o usuário está ensinando a IA diretamente
    if (norm.startsWith("aprenda que") || norm.startsWith("lembre que") || norm.startsWith("guarde que")) {
      const memoryFact = text.replace(/^(?:aprenda|lembre|guarde)\s+que\s+/gi, "").trim()
      await recordAiMemory(memoryFact)
      return {
        reply: `🧠 Aprendizado permanente gravado! Guardei na memória: "${memoryFact}".`,
        actions: [],
        questions: [],
        availableContext: { projects, categories, memories: [memoryFact, ...memories], usdBrlRate }
      }
    }

    // --- CONSULTAS E RELATÓRIOS EM TEMPO REAL (SEM NECESSITAR CONFIRMAÇÃO DE AÇÃO) ---
    if (norm.includes("quanto vendi") || norm.includes("vendas hoje") || norm.includes("faturamento hoje")) {
      const val = (liveSummary as any)?.salesTodayTotal || 0
      return {
        reply: `📊 **Faturamento de Hoje**: R$ ${val.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} em vendas registradas nos seus projetos.`,
        actions: [],
        availableContext: { projects, categories, memories, usdBrlRate }
      }
    }

    if (norm.includes("gasto ads hoje") || norm.includes("gasto em ads hoje") || norm.includes("quanto gastei hoje")) {
      const val = (liveSummary as any)?.adsSpendTodayTotal || 0
      return {
        reply: `📢 **Gasto com Anúncios Hoje**: R$ ${val.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} investidos em Ads.`,
        actions: [],
        availableContext: { projects, categories, memories, usdBrlRate }
      }
    }

    if (norm.includes("saldo caixa") || norm.includes("saldo no caixa") || norm.includes("quanto tenho no caixa")) {
      const val = (liveSummary as any)?.cashBalance || 0
      return {
        reply: `💰 **Saldo Atual no Caixa**: R$ ${val.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`,
        actions: [],
        availableContext: { projects, categories, memories, usdBrlRate }
      }
    }

    if (norm.includes("tarefas pendentes") || norm.includes("quais minhas tarefas") || norm.includes("minhas tarefas")) {
      const list = ((liveSummary as any)?.pendingTodos ?? []) as any[]
      if (list.length === 0) {
        return {
          reply: `✅ Você não possui nenhuma tarefa pendente no momento! Tudo organizado.`,
          actions: [],
          availableContext: { projects, categories, memories, usdBrlRate }
        }
      }
      const formatted = list.map((t) => `• **${t.title}** ${t.time ? `(⏰ ${t.time})` : ""} - Data: ${t.due_date || "Sem data"}`).join("\n")
      return {
        reply: `📌 **Suas Tarefas Pendentes (${list.length})**:\n\n${formatted}`,
        actions: [],
        availableContext: { projects, categories, memories, usdBrlRate }
      }
    }

    // --- GEMINI API OMNISCIENT ROUTER ---
    const geminiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY

    if (geminiKey) {
      try {
        const systemPrompt = `Você é a IA central do SaaS "Dash Tráfego", responsável por controlar 100% de todas as ferramentas do sistema.

ESTADO ATUAL EM TEMPO REAL DO SAAS:
- Projetos cadastrados: ${JSON.stringify(projects)}
- Categorias cadastradas: ${JSON.stringify(categories)}
- Memórias/Preferências aprendidas do usuário: ${JSON.stringify(memories)}
- Cotação USD/BRL atual: 1 USD = ${usdBrlRate} BRL
- Resumo em tempo real do usuário: ${JSON.stringify(liveSummary)}

MANDAMENTO DE EXTRAÇÃO E PROCESSAMENTO:
1. TAREFAS (create_todo):
   - Extraia SEMPRE o título limpo sem palavras de ruído ("me lembra de", "às 15h").
   - Extraia o horário exato ("time": "HH:MM", ex: "15:00").
   - Identifique a categoria ("Saúde / Pessoal", "Tráfego", "Casa / Pessoal", etc.).
2. METRICAS / CAIXA / VENDAS:
   - Identifique a moeda ("input_currency": "BRL" ou "USD").
3. CONSULTAS / PERGUNTAS:
   - Se o usuário apenas perguntar uma informação do sistema, responda direto em "reply" com os dados do resumo em tempo real e deixe "actions": [].

Responda ESTRITAMENTE em JSON:
{
  "reply": "Resumo amigável das ações ou resposta da consulta",
  "actions": [
    {
      "id": "act_1",
      "type": "create_todo" | "delete_todo" | "toggle_todo" | "create_note" | "delete_note" | "create_shortcut" | "create_category" | "create_cash_entry" | "create_sale" | "create_daily_metric" | "create_project",
      "title": "Título da ação",
      "description": "Explicação detalhada da ação",
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
              reply: parsed.reply || `Entendi seu pedido! Preparei ${parsed.actions?.length || 0} ação(ões).`,
              actions: (parsed.actions || []).map((a: any, idx: number) => ({
                ...a,
                id: a.id || `act_${Date.now()}_${idx}`
              })),
              questions: [],
              requiresConfirmation: (parsed.actions || []).length > 0,
              availableContext: { projects, categories, memories, usdBrlRate }
            }
          }
        }
      } catch (e) {
        console.warn("Gemini API error, using local fallback NLP engine:", e)
      }
    }

    // --- ENGINE MULTI-INTENÇÃO LOCAL COM SUPORTE COMPLETO A TODAS AS FERRAMENTAS ---
    const actions: ProposedAction[] = []
    const clauses = text.split(/(?:\.|\n|;|\b(?:e|tambem|alem disso)\b)/gi).map((c) => c.trim()).filter(Boolean)
    const todayStr = new Date().toISOString().slice(0, 10)

    for (let idx = 0; idx < clauses.length; idx++) {
      const clause = clauses[idx]
      const normClause = normalize(clause)

      let matchedProjectObj = projects.find((p) => normClause.includes(normalize(p.name)))
      if (!matchedProjectObj && context?.projectId) {
        matchedProjectObj = projects.find((p) => p.id === context.projectId)
      }
      const projId = matchedProjectObj?.id ?? null
      const projCurrency = matchedProjectObj?.currency ?? "BRL"

      const inputCurrency = detectInputCurrency(clause, "BRL")
      const inputSymbol = currencySymbol(inputCurrency)
      const projectSymbol = currencySymbol(projCurrency)

      const isDelete = normClause.includes("excluir") || normClause.includes("deletar") || normClause.includes("remover") || normClause.includes("apagar")
      const isToggle = normClause.includes("concluir") || normClause.includes("marcar feita") || normClause.includes("finalizar") || normClause.includes("concluida")

      // 1. TAREFAS / LEMBRETES
      if (normClause.includes("lembr") || normClause.includes("tarefa") || normClause.includes("to do") || normClause.includes("agendar") || normClause.includes("ir a") || normClause.includes("ir pra")) {
        const { title, timeStr, dueDate } = cleanTaskPrompt(clause)

        let category = "Outros"
        if (normClause.includes("academia") || normClause.includes("saude") || normClause.includes("treino")) category = "Saúde / Pessoal"
        else if (normClause.includes("casa") || normClause.includes("limpar") || normClause.includes("almoco") || normClause.includes("mercado")) category = "Casa / Pessoal"
        else if (normClause.includes("anuncio") || normClause.includes("criativo") || normClause.includes("trafego") || normClause.includes("campanha")) category = "Tráfego"

        actions.push({
          id: `act_${Date.now()}_todo_${idx}`,
          type: "create_todo",
          title: `Criar Tarefa: "${title}"`,
          description: `${timeStr ? `⏰ Horário do Lembrete: ${timeStr} · ` : ""}Categoria: ${category}`,
          payload: {
            title,
            category,
            project_id: projId,
            due_date: dueDate,
            time: timeStr || ""
          }
        })
      }

      // 2. MÉTRICAS DIÁRIAS (GASTO ADS)
      else if (normClause.includes("metrica") || normClause.includes("impressao") || normClause.includes("impressões") || normClause.includes("cliques") || (normClause.includes("gasto") && normClause.includes("ads"))) {
        const amountMatch = clause.match(/(?:R\$|usd|\$)?\s*(\d+(?:[.,]\d{1,2})?)/i)
        const rawAmount = amountMatch ? parseFloat(amountMatch[1].replace(",", ".")) : 0

        const convertedInProject = inputToProject(rawAmount, inputCurrency, projCurrency, usdBrlRate)
        const conversionDesc = inputCurrency !== projCurrency
          ? ` (${inputSymbol} ${rawAmount.toFixed(2)} ➔ ${projectSymbol} ${convertedInProject.toFixed(2)} no projeto)`
          : ""

        actions.push({
          id: `act_${Date.now()}_metric_${idx}`,
          type: "create_daily_metric",
          title: `Atualizar Métricas Diárias`,
          description: `Gasto Ads: ${inputSymbol} ${rawAmount.toFixed(2)}${conversionDesc} · Projeto: ${matchedProjectObj?.name || "Geral"}`,
          payload: {
            spend: rawAmount,
            input_currency: inputCurrency,
            project_id: projId,
            date: todayStr
          }
        })
      }

      // 3. REGISTRAR VENDA
      else if (normClause.includes("venda") || normClause.includes("vendi") || normClause.includes("faturei")) {
        const amountMatch = clause.match(/(?:R\$|usd|\$)?\s*(\d+(?:[.,]\d{1,2})?)/i)
        const rawAmount = amountMatch ? parseFloat(amountMatch[1].replace(",", ".")) : 0
        const isPix = normClause.includes("pix")
        const isCard = normClause.includes("cartao") || normClause.includes("credito")

        const saleCurrency = detectInputCurrency(clause, projCurrency)
        const saleSymbol = currencySymbol(saleCurrency)

        actions.push({
          id: `act_${Date.now()}_sale_${idx}`,
          type: "create_sale",
          title: `Registrar Venda (${isPix ? "PIX" : isCard ? "Cartão" : "Geral"})`,
          description: `Valor Bruto: ${saleSymbol} ${rawAmount.toFixed(2)} · Projeto: ${matchedProjectObj?.name || "Geral"}`,
          payload: {
            gross_amount: rawAmount,
            input_currency: saleCurrency,
            payment_method: isCard ? "cartao" : "pix",
            project_id: projId
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
          description: `Salvar anotação`,
          payload: {
            title,
            body: clause,
            category_id: categories[0]?.id ?? null,
            project_id: projId
          }
        })
      }

      // 5. CAIXA FINANCEIRO
      else if (normClause.includes("caixa") || normClause.includes("gasto") || normClause.includes("despesa") || normClause.includes("receita") || normClause.includes("paguei")) {
        const isSaida = normClause.includes("gasto") || normClause.includes("despesa") || normClause.includes("saida") || normClause.includes("paguei")
        const amountMatch = clause.match(/(?:R\$|usd|\$)?\s*(\d+(?:[.,]\d{1,2})?)/i)
        const rawAmount = amountMatch ? parseFloat(amountMatch[1].replace(",", ".")) : 0

        actions.push({
          id: `act_${Date.now()}_cash_${idx}`,
          type: "create_cash_entry",
          title: `Lançamento no Caixa (${isSaida ? "Saída" : "Entrada"})`,
          description: `Valor: ${inputSymbol} ${rawAmount.toFixed(2)}`,
          payload: {
            description: clause,
            amount: rawAmount,
            input_currency: inputCurrency,
            type: isSaida ? "saida" : "entrada",
            category: isSaida ? "Despesas" : "Receita",
            project_id: projId
          }
        })
      }

      // 6. EXCLUIR ITEM
      else if (isDelete) {
        let searchTarget = clause.replace(/(?:excluir|deletar|remover|apagar)\s+(?:a|o|uma|um)?\s*/gi, "").trim()
        actions.push({
          id: `act_${Date.now()}_del_${idx}`,
          type: normClause.includes("nota") ? "delete_note" : "delete_todo",
          title: `Excluir Item: "${searchTarget}"`,
          description: `Remoção de registro`,
          payload: { title: searchTarget }
        })
      }
    }

    if (actions.length === 0) {
      const { title, timeStr, dueDate } = cleanTaskPrompt(text)
      actions.push({
        id: `act_${Date.now()}_todo_fallback`,
        type: "create_todo",
        title: `Criar Tarefa: "${title}"`,
        description: `Categoria: Outros`,
        payload: {
          title,
          category: "Outros",
          project_id: context?.projectId ?? null,
          due_date: dueDate,
          time: timeStr || ""
        }
      })
    }

    return {
      reply: `Preparei ${actions.length} ação(ões) para o seu SaaS. Confira abaixo:`,
      actions,
      questions: [],
      requiresConfirmation: true,
      availableContext: { projects, categories, memories, usdBrlRate }
    }
  } catch (err: any) {
    console.error("Critical error in processAiCommand:", err)
    return {
      reply: `Ocorreu um erro ao processar seu comando. (${err?.message || "Erro de execução"})`,
      actions: [],
      questions: []
    }
  }
}

/**
 * Executa as ações confirmadas.
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
    const usdBrlRate = await getUsdBrlRate()

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
          const targetProjId = act.payload.project_id || projectId
          if (targetProjId) {
            const { data: p } = await supabase.from("projects").select("currency").eq("id", targetProjId).single()
            const projCurrency = p?.currency || "BRL"
            const rawGross = parseFloat(act.payload.gross_amount) || 0
            const inputCurrency = act.payload.input_currency || projCurrency
            const finalGross = inputToProject(rawGross, inputCurrency, projCurrency, usdBrlRate)

            await supabase.from("sales").insert({
              project_id: targetProjId,
              gross_amount: finalGross,
              net_amount: finalGross,
              payment_method: act.payload.payment_method || "pix",
              sold_at: new Date().toISOString().slice(0, 10)
            })
            count++
          }
        }

        // 4. MÉTRICAS DIÁRIAS (GASTO ADS)
        else if (act.type === "create_daily_metric") {
          const targetProjId = act.payload.project_id || projectId
          if (targetProjId) {
            const { data: p } = await supabase.from("projects").select("currency").eq("id", targetProjId).single()
            const projCurrency = p?.currency || "BRL"
            const rawSpend = parseFloat(act.payload.spend) || 0
            const inputCurrency = act.payload.input_currency || "BRL"
            const finalSpend = inputToProject(rawSpend, inputCurrency, projCurrency, usdBrlRate)
            const date = act.payload.date || new Date().toISOString().slice(0, 10)

            await supabase.from("daily_metrics").upsert(
              {
                project_id: targetProjId,
                date,
                spend: finalSpend
              },
              { onConflict: "project_id,date" }
            )
            count++
          }
        }

        // 5. CAIXA
        else if (act.type === "create_cash_entry") {
          const targetProjId = act.payload.project_id || projectId
          let projCurrency = "BRL"
          if (targetProjId) {
            const { data: p } = await supabase.from("projects").select("currency").eq("id", targetProjId).maybeSingle()
            if (p?.currency) projCurrency = p.currency
          }
          const rawAmount = parseFloat(act.payload.amount) || 0
          const inputCurrency = act.payload.input_currency || projCurrency
          const finalAmount = inputToProject(rawAmount, inputCurrency, projCurrency, usdBrlRate)

          await supabase.from("cash_entries").insert({
            owner_id: me.id,
            project_id: targetProjId || null,
            type: act.payload.type || "entrada",
            description: act.payload.description || "Lançamento via IA",
            amount: finalAmount,
            currency: projCurrency,
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
