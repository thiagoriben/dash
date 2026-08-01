"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getCurrentProfile } from "@/lib/data"
import type { TodoDueKind } from "@/lib/types"

/** Data local YYYY-MM-DD (sem fuso). */
function today(offsetDays = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

/** Deriva o due_kind (legado) a partir de uma data real, para manter compat. */
function dueKindFromDate(date: string | null): TodoDueKind {
  if (!date) return "sem_prazo"
  if (date <= today(0)) return "hoje"
  if (date === today(1)) return "amanha"
  return "sem_prazo"
}

/** Categoria (área). Vazio vira null; a UI mostra null como "Outros". */
function parseCategory(v: unknown): string | null {
  const s = String(v ?? "").trim()
  return s && s.toLowerCase() !== "outros" ? s : null
}

function pathFor(projectId: string | null) {
  // Rota dedicada de tarefas (pessoal) + fallback legado da organização.
  return projectId ? `/projetos/${projectId}` : "/organizacao/tarefas"
}

/**
 * Salva/remove o horário e antecedência do lembrete de uma tarefa nas prefs
 * do usuário (não há colunas no banco). time = "HH:MM", lead = minutos antes.
 */
async function saveTaskReminder(userId: string, todoId: string, time: string, lead: number) {
  const supabase = await createClient()
  const { data } = await supabase.from("profiles").select("prefs").eq("id", userId).maybeSingle()
  const prefs = (data?.prefs ?? {}) as Record<string, unknown>
  const map = { ...((prefs.task_reminders as Record<string, { time?: string; lead?: number }>) ?? {}) }
  if (time) map[todoId] = { time, lead: Number.isFinite(lead) ? lead : 0 }
  else delete map[todoId]
  await supabase
    .from("profiles")
    .update({ prefs: { ...prefs, task_reminders: map } })
    .eq("id", userId)
}

export async function createTodo(projectId: string | null, formData: FormData) {
  const supabase = await createClient()
  const me = await getCurrentProfile()
  if (!me) return { error: "Sessão expirada." }
  const title = String(formData.get("title") ?? "").trim()
  if (!title) return { error: "Escreva a tarefa." }
  const category = parseCategory(formData.get("category"))
  const due_date = String(formData.get("due_date") ?? "").trim() || null
  const assignee_id = String(formData.get("assignee_id") ?? "").trim() || null
  const { data: created, error } = await supabase
    .from("todo_items")
    .insert({
      owner_id: me.id,
      project_id: projectId,
      assignee_id: projectId ? assignee_id : null,
      category,
      title,
      due_date,
      due_kind: dueKindFromDate(due_date),
    })
    .select("id")
    .maybeSingle()
  if (error) return { error: error.message }
  // Horário + antecedência do lembrete (salvos nas prefs).
  const time = String(formData.get("time") ?? "").trim()
  const lead = Number.parseInt(String(formData.get("lead") ?? "0"), 10) || 0
  if (created?.id) await saveTaskReminder(me.id, created.id, time, lead)
  revalidatePath(pathFor(projectId))
  return { ok: true }
}

export async function updateTodo(id: string, formData: FormData) {
  const supabase = await createClient()
  const me = await getCurrentProfile()
  if (!me) return { error: "Sessão expirada." }
  const patch: Record<string, unknown> = {}
  const title = formData.get("title")
  const category = formData.get("category")
  const due_date = formData.get("due_date")
  const assignee_id = formData.get("assignee_id")
  if (title != null) patch.title = String(title).trim()
  if (category != null) patch.category = parseCategory(category)
  if (due_date != null) {
    const d = String(due_date).trim() || null
    patch.due_date = d
    patch.due_kind = dueKindFromDate(d)
  }
  if (assignee_id != null) patch.assignee_id = String(assignee_id).trim() || null
  // Atribuir/mover a tarefa a um projeto (ou de volta ao pessoal).
  if (formData.has("project_id")) {
    const newScope = String(formData.get("project_id") ?? "").trim() || null
    patch.project_id = newScope
    if (!newScope) patch.assignee_id = null // pessoal não tem responsável
  }
  const { data, error } = await supabase
    .from("todo_items")
    .update(patch)
    .eq("id", id)
    .select("project_id")
    .maybeSingle()
  if (error) return { error: error.message }
  // Atualiza horário/antecedência do lembrete se enviados.
  const time = formData.get("time")
  if (time != null) {
    const lead = Number.parseInt(String(formData.get("lead") ?? "0"), 10) || 0
    await saveTaskReminder(me.id, id, String(time).trim(), lead)
  }
  revalidatePath(pathFor(data?.project_id ?? null))
  return { ok: true }
}

export async function toggleTodo(id: string, done: boolean) {
  const supabase = await createClient()
  const me = await getCurrentProfile()
  if (!me) return { error: "Sessão expirada." }
  // Concluir apenas risca a tarefa; reabrir também tira de "Feitas" (desarquiva).
  const patch = done ? { done: true } : { done: false, archived: false }
  const { data, error } = await supabase
    .from("todo_items")
    .update(patch)
    .eq("id", id)
    .select("project_id")
    .maybeSingle()
  if (error) return { error: error.message }
  revalidatePath(pathFor(data?.project_id ?? null))
  return { ok: true }
}

/** Move uma tarefa concluída para "Feitas" (ou traz de volta). */
export async function archiveTodo(id: string, archived: boolean) {
  const supabase = await createClient()
  const me = await getCurrentProfile()
  if (!me) return { error: "Sessão expirada." }
  const { data, error } = await supabase
    .from("todo_items")
    .update({ archived, done: archived ? true : undefined })
    .eq("id", id)
    .select("project_id")
    .maybeSingle()
  if (error) return { error: error.message }
  revalidatePath(pathFor(data?.project_id ?? null))
  return { ok: true }
}

export async function deleteTodo(id: string) {
  const supabase = await createClient()
  const me = await getCurrentProfile()
  if (!me) return { error: "Sessão expirada." }
  const { data } = await supabase.from("todo_items").select("project_id").eq("id", id).maybeSingle()
  const { error } = await supabase.from("todo_items").delete().eq("id", id)
  if (error) return { error: error.message }
  revalidatePath(pathFor(data?.project_id ?? null))
  return { ok: true }
}
