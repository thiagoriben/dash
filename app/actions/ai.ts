"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getCurrentProfile } from "@/lib/data"
import { createTodo } from "@/app/actions/todo"
import { createNote, createShortcut, createCategory } from "@/app/actions/organizacao"
import { createProject } from "@/app/actions/projects"

export type AiActionType =
  | "create_todo"
  | "create_note"
  | "create_shortcut"
  | "create_category"
  | "create_cash_entry"
  | "create_sale"
  | "create_product"
  | "create_project"
  | "query_info"

export type ProposedAction = {
  id: string
  type: AiActionType
  title: string
  description: string
  payload: Record<string, any>
  confirmed?: boolean
}

export type ClarifyingQuestion = {
  question: string
  options?: { label: string; value: string }[]
  field?: string
}

export type AiProcessResult = {
  reply: string
  actions?: ProposedAction[]
  questions?: ClarifyingQuestion[]
  requiresConfirmation?: boolean
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
 * Parser inteligente de IA (Fallback Local & Gemini API).
 */
export async function processAiCommand(
  prompt: string,
  context?: { projectId?: string | null }
): Promise<AiProcessResult> {
  const supabase = await createClient()
  const me = await getCurrentProfile()
  if (!me) return { reply: "Sessão expirada. Por favor, faça login novamente." }

  const text = prompt.trim()
  if (!text) return { reply: "Por favor, digite ou fale o que você deseja realizar." }

  const geminiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY

  if (geminiKey) {
    try {
      const systemPrompt = `Você é o assistente inteligente do SaaS "Dash Tráfego". O usuário dará comandos para organizar tarefas, notas, atalhos, caixa financeiro, vendas, produtos ou consultar dados.
Você deve responder ESTRITAMENTE em JSON no seguinte formato:
{
  "reply": "Mensagem amigável resumindo o que entendeu",
  "questions": [ {"question": "pergunta?", "options": [{"label": "Texto", "value": "Valor"}], "field": "campo"} ],
  "actions": [
    {
      "id": "act_1",
      "type": "create_todo" | "create_note" | "create_shortcut" | "create_category" | "create_cash_entry" | "create_sale" | "create_product" | "create_project" | "query_info",
      "title": "Título resumido da ação",
      "description": "Explicação breve do que será feito",
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
            contents: [
              { role: "user", parts: [{ text: `${systemPrompt}\n\nComando do usuário: "${text}"` }] }
            ],
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
            requiresConfirmation: (parsed.actions || []).length > 0
          }
        }
      }
    } catch (e) {
      console.warn("Gemini API call error, falling back to local NLP engine:", e)
    }
  }

  // --- ENGINE DE INTENÇÕES LOCAL (DETERMINÍSTICO E ROBUSTO) ---
  const norm = normalize(text)
  const actions: ProposedAction[] = []
  let reply = ""

  // 1. Criar Tarefa
  if (norm.includes("tarefa") || norm.includes("lembrar de") || norm.includes("fazer") || norm.includes("to do")) {
    let title = text
      .replace(/(?:criar|nova|adicionar|agendar|lembrar de)\s+tarefa/gi, "")
      .replace(/^:\s*/, "")
      .trim()
    if (!title) title = text

    let category = "Outros"
    if (norm.includes("trafego") || norm.includes("anuncio") || norm.includes("meta") || norm.includes("criativo")) {
      category = "Tráfego"
    } else if (norm.includes("pessoal") || norm.includes("casa")) {
      category = "Pessoal"
    }

    actions.push({
      id: `act_${Date.now()}_todo`,
      type: "create_todo",
      title: `Criar Tarefa: "${title}"`,
      description: `Categoria: ${category}`,
      payload: {
        title,
        category,
        due_date: new Date().toISOString().slice(0, 10),
        project_id: context?.projectId ?? null
      }
    })
    reply = `Identifiquei que você deseja criar uma tarefa!`
  }

  // 2. Criar Nota
  else if (norm.includes("nota") || norm.includes("anotacao") || norm.includes("anotar") || norm.includes("escreva")) {
    let title = text
      .replace(/(?:criar|nova|adicionar|anotar)\s+nota/gi, "")
      .replace(/^:\s*/, "")
      .trim()
    if (!title) title = "Anotação rápida"

    actions.push({
      id: `act_${Date.now()}_note`,
      type: "create_note",
      title: `Criar Nota: "${title}"`,
      description: `Conteúdo extraído do seu comando`,
      payload: {
        title,
        body: text,
        project_id: context?.projectId ?? null
      }
    })
    reply = `Identifiquei que você deseja salvar uma anotação!`
  }

  // 3. Criar Categoria
  else if (norm.includes("categoria")) {
    let name = text
      .replace(/(?:criar|nova|adicionar)\s+categoria/gi, "")
      .replace(/^:\s*/, "")
      .trim()
    if (!name) name = "Nova Categoria"

    actions.push({
      id: `act_${Date.now()}_cat`,
      type: "create_category",
      title: `Criar Categoria: "${name}"`,
      description: `Cor azul ciano`,
      payload: {
        name,
        color: "#2de2e6"
      }
    })
    reply = `Vou criar a categoria "${name}" para você!`
  }

  // 4. Atalhos (Links, vídeos, etc)
  else if (norm.includes("atalho") || norm.includes("link") || norm.includes("salvar link")) {
    const urlMatch = text.match(/https?:\/\/[^\s]+/)
    const url = urlMatch ? urlMatch[0] : ""
    let title = text.replace(url, "").replace(/(?:salvar|criar|novo)\s+(?:atalho|link)/gi, "").trim()
    if (!title) title = url ? "Link salvo" : "Novo atalho"

    actions.push({
      id: `act_${Date.now()}_sc`,
      type: "create_shortcut",
      title: `Criar Atalho: "${title}"`,
      description: url ? `Link: ${url}` : `Atalho de texto`,
      payload: {
        title,
        url,
        kind: url ? "link" : "nota"
      }
    })
    reply = `Identifiquei o salvamento de atalho!`
  }

  // 5. Caixa / Finanças (Entrada ou Saída)
  else if (norm.includes("caixa") || norm.includes("gasto") || norm.includes("despesa") || norm.includes("receita") || norm.includes("pagamento") || norm.includes("lancamento")) {
    const isSaida = norm.includes("gasto") || norm.includes("despesa") || norm.includes("saida") || norm.includes("paguei")
    const amountMatch = text.match(/(?:R\$|usd|\$)?\s*(\d+(?:[.,]\d{1,2})?)/i)
    const amount = amountMatch ? parseFloat(amountMatch[1].replace(",", ".")) : 0

    actions.push({
      id: `act_${Date.now()}_cash`,
      type: "create_cash_entry",
      title: `Lançamento no Caixa (${isSaida ? "Saída/Despesa" : "Entrada/Receita"})`,
      description: `Valor: ${amount > 0 ? `R$ ${amount.toFixed(2)}` : "Não especificado"}`,
      payload: {
        description: text,
        amount,
        type: isSaida ? "saida" : "entrada",
        category: isSaida ? "Despesas" : "Receita"
      }
    })
    reply = `Processando lançamento financeiro para o Caixa.`
  }

  // 6. Projeto
  else if (norm.includes("projeto")) {
    let name = text.replace(/(?:criar|novo)\s+projeto/gi, "").trim()
    if (!name) name = "Novo Projeto"

    actions.push({
      id: `act_${Date.now()}_proj`,
      type: "create_project",
      title: `Criar Projeto: "${name}"`,
      description: `Moeda: BRL · Região: Brasil`,
      payload: {
        name,
        currency: "BRL",
        region: "Brasil"
      }
    })
    reply = `Vou preparar a criação do projeto "${name}".`
  }

  // Fallback geral
  else {
    reply = `Entendi o seu comando: "${text}". Selecione como deseja registrar essa informação:`
    return {
      reply,
      questions: [
        {
          question: "Escolha uma ação:",
          options: [
            { label: "✅ Criar Tarefa", value: "criar_tarefa" },
            { label: "📝 Salvar Nota", value: "salvar_nota" },
            { label: "💰 Lançar no Caixa", value: "lancar_caixa" },
            { label: "🔗 Salvar Atalho", value: "salvar_atalho" }
          ]
        }
      ]
    }
  }

  return {
    reply,
    actions,
    requiresConfirmation: actions.length > 0
  }
}

/**
 * Executa as ações confirmadas pelo usuário.
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
      if (act.type === "create_todo") {
        const fd = new FormData()
        fd.append("title", act.payload.title || "Nova tarefa IA")
        fd.append("category", act.payload.category || "Outros")
        if (act.payload.due_date) fd.append("due_date", act.payload.due_date)
        if (act.payload.time) fd.append("time", act.payload.time)
        await createTodo(act.payload.project_id || projectId || null, fd)
        count++
      } else if (act.type === "create_note") {
        const fd = new FormData()
        fd.append("title", act.payload.title || "Nota IA")
        fd.append("body", act.payload.body || "")
        if (act.payload.category_id) fd.append("category_id", act.payload.category_id)
        await createNote(act.payload.project_id || projectId || null, fd)
        count++
      } else if (act.type === "create_shortcut") {
        const fd = new FormData()
        fd.append("title", act.payload.title || "Atalho IA")
        fd.append("url", act.payload.url || "")
        fd.append("kind", act.payload.kind || "link")
        await createShortcut(projectId || null, fd)
        count++
      } else if (act.type === "create_category") {
        const fd = new FormData()
        fd.append("name", act.payload.name || "Nova Categoria")
        fd.append("color", act.payload.color || "#2de2e6")
        await createCategory(projectId || null, fd)
        count++
      } else if (act.type === "create_cash_entry") {
        await supabase.from("cash_entries").insert({
          owner_id: me.id,
          project_id: projectId || null,
          type: act.payload.type || "entrada",
          description: act.payload.description || "Lançamento via IA",
          amount: act.payload.amount || 0,
          occurred_at: new Date().toISOString().slice(0, 10),
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
