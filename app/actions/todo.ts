"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getCurrentProfile } from "@/lib/data"
import type { TodoDueKind } from "@/lib/types"

const DUE_KINDS: TodoDueKind[] = ["hoje", "amanha", "sem_prazo"]
function parseDue(v: string): TodoDueKind {
  return (DUE_KINDS as string[]).includes(v) ? (v as TodoDueKind) : "sem_prazo"
}

function pathFor(projectId: string | null) {
  return projectId ? `/projetos/${projectId}` : "/organizacao"
}

export async function createTodo(projectId: string | null, formData: FormData) {
  const supabase = await createClient()
  const me = await getCurrentProfile()
  if (!me) return { error: "Sessão expirada." }
  const title = String(formData.get("title") ?? "").trim()
  if (!title) return { error: "Escreva a tarefa." }
  const category = String(formData.get("category") ?? "").trim() || null
  const due_kind = parseDue(String(formData.get("due_kind") ?? "sem_prazo"))
  const assignee_id = String(formData.get("assignee_id") ?? "").trim() || null
  const { error } = await supabase.from("todo_items").insert({
    owner_id: me.id,
    project_id: projectId,
    assignee_id: projectId ? assignee_id : null,
    category,
    title,
    due_kind,
  })
  if (error) return { error: error.message }
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
  const due_kind = formData.get("due_kind")
  const assignee_id = formData.get("assignee_id")
  if (title != null) patch.title = String(title).trim()
  if (category != null) patch.category = String(category).trim() || null
  if (due_kind != null) patch.due_kind = parseDue(String(due_kind))
  if (assignee_id != null) patch.assignee_id = String(assignee_id).trim() || null
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

export async function toggleTodo(id: string, done: boolean) {
  const supabase = await createClient()
  const me = await getCurrentProfile()
  if (!me) return { error: "Sessão expirada." }
  const { data, error } = await supabase
    .from("todo_items")
    .update({ done })
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
