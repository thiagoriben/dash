"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getCurrentProfile } from "@/lib/data"
import type { ShortcutKind } from "@/lib/types"

const SHORTCUT_KINDS: ShortcutKind[] = ["link", "imagem", "video", "nota", "id"]
function parseShortcutKind(v: string): ShortcutKind {
  return (SHORTCUT_KINDS as string[]).includes(v) ? (v as ShortcutKind) : "link"
}

function pathFor(projectId: string | null) {
  return projectId ? `/projetos/${projectId}` : "/organizacao"
}

/* ---------------- Categorias ---------------- */

export async function createCategory(projectId: string | null, formData: FormData) {
  const supabase = await createClient()
  const me = await getCurrentProfile()
  if (!me) return { error: "Sessão expirada." }
  const name = String(formData.get("name") ?? "").trim()
  if (!name) return { error: "Dê um nome para a categoria." }
  const color = String(formData.get("color") ?? "").trim() || null
  const { error } = await supabase.from("shortcut_categories").insert({
    owner_id: me.id,
    project_id: projectId,
    name,
    color,
  })
  if (error) return { error: error.message }
  revalidatePath(pathFor(projectId))
  return { ok: true }
}

export async function updateCategory(id: string, formData: FormData) {
  const supabase = await createClient()
  const me = await getCurrentProfile()
  if (!me) return { error: "Sessão expirada." }
  const patch: Record<string, unknown> = {}
  const name = formData.get("name")
  const color = formData.get("color")
  if (name != null) patch.name = String(name).trim()
  if (color != null) patch.color = String(color).trim() || null
  const { data, error } = await supabase
    .from("shortcut_categories")
    .update(patch)
    .eq("id", id)
    .select("project_id")
    .maybeSingle()
  if (error) return { error: error.message }
  revalidatePath(pathFor(data?.project_id ?? null))
  return { ok: true }
}

export async function deleteCategory(id: string) {
  const supabase = await createClient()
  const me = await getCurrentProfile()
  if (!me) return { error: "Sessão expirada." }
  const { data } = await supabase.from("shortcut_categories").select("project_id").eq("id", id).maybeSingle()
  // Solta os atalhos/notas da categoria (não apaga o conteúdo do usuário).
  await supabase.from("shortcuts").update({ category_id: null }).eq("category_id", id)
  await supabase.from("notes").update({ category_id: null }).eq("category_id", id)
  const { error } = await supabase.from("shortcut_categories").delete().eq("id", id)
  if (error) return { error: error.message }
  revalidatePath(pathFor(data?.project_id ?? null))
  return { ok: true }
}

/* ---------------- Atalhos ---------------- */

export async function createShortcut(projectId: string | null, formData: FormData) {
  const supabase = await createClient()
  const me = await getCurrentProfile()
  if (!me) return { error: "Sessão expirada." }
  const title = String(formData.get("title") ?? "").trim()
  if (!title) return { error: "Dê um título para o atalho." }
  const kind = parseShortcutKind(String(formData.get("kind") ?? "link"))
  const url = String(formData.get("url") ?? "").trim() || null
  const body = String(formData.get("body") ?? "").trim() || null
  const categoryId = String(formData.get("category_id") ?? "").trim() || null
  const { error } = await supabase.from("shortcuts").insert({
    owner_id: me.id,
    project_id: projectId,
    category_id: categoryId,
    title,
    kind,
    url,
    body,
  })
  if (error) return { error: error.message }
  revalidatePath(pathFor(projectId))
  return { ok: true }
}

export async function updateShortcut(id: string, formData: FormData) {
  const supabase = await createClient()
  const me = await getCurrentProfile()
  if (!me) return { error: "Sessão expirada." }
  const patch: Record<string, unknown> = {}
  const title = formData.get("title")
  const kind = formData.get("kind")
  const url = formData.get("url")
  const body = formData.get("body")
  const categoryId = formData.get("category_id")
  if (title != null) patch.title = String(title).trim()
  if (kind != null) patch.kind = parseShortcutKind(String(kind))
  if (url != null) patch.url = String(url).trim() || null
  if (body != null) patch.body = String(body).trim() || null
  if (categoryId != null) patch.category_id = String(categoryId).trim() || null
  const { data, error } = await supabase
    .from("shortcuts")
    .update(patch)
    .eq("id", id)
    .select("project_id")
    .maybeSingle()
  if (error) return { error: error.message }
  revalidatePath(pathFor(data?.project_id ?? null))
  return { ok: true }
}

export async function deleteShortcut(id: string) {
  const supabase = await createClient()
  const me = await getCurrentProfile()
  if (!me) return { error: "Sessão expirada." }
  const { data } = await supabase.from("shortcuts").select("project_id").eq("id", id).maybeSingle()
  const { error } = await supabase.from("shortcuts").delete().eq("id", id)
  if (error) return { error: error.message }
  revalidatePath(pathFor(data?.project_id ?? null))
  return { ok: true }
}

/* ---------------- Notas ---------------- */

export async function createNote(projectId: string | null, formData: FormData) {
  const supabase = await createClient()
  const me = await getCurrentProfile()
  if (!me) return { error: "Sessão expirada." }
  const title = String(formData.get("title") ?? "").trim()
  if (!title) return { error: "Dê um título para a nota." }
  const body = String(formData.get("body") ?? "").trim() || null
  const categoryId = String(formData.get("category_id") ?? "").trim() || null
  const visibility = String(formData.get("visibility") ?? "privado") === "compartilhado" ? "compartilhado" : "privado"
  const { error } = await supabase.from("notes").insert({
    owner_id: me.id,
    project_id: projectId,
    category_id: categoryId,
    title,
    body,
    visibility,
  })
  if (error) return { error: error.message }
  revalidatePath(pathFor(projectId))
  return { ok: true }
}

export async function updateNote(id: string, formData: FormData) {
  const supabase = await createClient()
  const me = await getCurrentProfile()
  if (!me) return { error: "Sessão expirada." }
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  const title = formData.get("title")
  const body = formData.get("body")
  const categoryId = formData.get("category_id")
  const visibility = formData.get("visibility")
  if (title != null) patch.title = String(title).trim()
  if (body != null) patch.body = String(body).trim() || null
  if (categoryId != null) patch.category_id = String(categoryId).trim() || null
  if (visibility != null) patch.visibility = String(visibility) === "compartilhado" ? "compartilhado" : "privado"
  const { data, error } = await supabase
    .from("notes")
    .update(patch)
    .eq("id", id)
    .select("project_id")
    .maybeSingle()
  if (error) return { error: error.message }
  revalidatePath(pathFor(data?.project_id ?? null))
  return { ok: true }
}

export async function deleteNote(id: string) {
  const supabase = await createClient()
  const me = await getCurrentProfile()
  if (!me) return { error: "Sessão expirada." }
  const { data } = await supabase.from("notes").select("project_id").eq("id", id).maybeSingle()
  const { error } = await supabase.from("notes").delete().eq("id", id)
  if (error) return { error: error.message }
  revalidatePath(pathFor(data?.project_id ?? null))
  return { ok: true }
}

/* ---------------- Seed de exemplos ---------------- */

/** Cria 2 categorias + 2 atalhos + 1 nota de exemplo (uma vez por escopo). */
export async function seedOrganizationExamples(projectId: string | null) {
  const supabase = await createClient()
  const me = await getCurrentProfile()
  if (!me) return { error: "Sessão expirada." }

  // Só semeia se o escopo estiver vazio (sem categorias e sem atalhos).
  let catQ = supabase.from("shortcut_categories").select("id")
  catQ = projectId ? catQ.eq("project_id", projectId) : catQ.is("project_id", null).eq("owner_id", me.id)
  const { data: cats } = await catQ
  if ((cats ?? []).length > 0) return { ok: true }

  const { data: created } = await supabase
    .from("shortcut_categories")
    .insert([
      { owner_id: me.id, project_id: projectId, name: "Concorrentes", color: "#f59e0b", position: 0 },
      { owner_id: me.id, project_id: projectId, name: "Referências", color: "#2de2e6", position: 1 },
    ])
    .select("id, name")
  const byName = new Map((created ?? []).map((c: { id: string; name: string }) => [c.name, c.id]))

  await supabase.from("shortcuts").insert([
    {
      owner_id: me.id,
      project_id: projectId,
      category_id: byName.get("Concorrentes") ?? null,
      title: "Biblioteca de anúncios (Meta)",
      kind: "link",
      url: "https://www.facebook.com/ads/library/",
      position: 0,
    },
    {
      owner_id: me.id,
      project_id: projectId,
      category_id: byName.get("Referências") ?? null,
      title: "ID de exemplo",
      kind: "id",
      body: "Cole aqui qualquer ID, código ou observação para reaproveitar depois.",
      position: 1,
    },
  ])

  await supabase.from("notes").insert({
    owner_id: me.id,
    project_id: projectId,
    category_id: byName.get("Referências") ?? null,
    title: "Bem-vindo à Organização",
    body: "Crie categorias, salve links, imagens, vídeos, IDs e anotações. Tudo fácil de ver, copiar e editar.",
    visibility: "privado",
  })

  revalidatePath(pathFor(projectId))
  return { ok: true }
}
