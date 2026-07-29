"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getCurrentProfile } from "@/lib/data"

export async function createProject(formData: FormData) {
  const supabase = await createClient()
  const profile = await getCurrentProfile()
  if (!profile) return { error: "Não autenticado." }

  const name = String(formData.get("name") ?? "").trim()
  if (!name) return { error: "Informe o nome do projeto." }

  const { error } = await supabase.from("projects").insert({
    name,
    offer_type: String(formData.get("offer_type") ?? "") || null,
    region: String(formData.get("region") ?? "BR"),
    currency: String(formData.get("currency") ?? "BRL"),
    status: String(formData.get("status") ?? "ativo"),
    visibility: String(formData.get("visibility") ?? "privado"),
    owner_id: profile.id,
  })
  if (error) return { error: error.message }

  revalidatePath("/projetos")
  revalidatePath("/")
  return { ok: true }
}

export async function updateProject(id: string, formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("projects")
    .update({
      name: String(formData.get("name") ?? "").trim(),
      offer_type: String(formData.get("offer_type") ?? "") || null,
      region: String(formData.get("region") ?? "BR"),
      currency: String(formData.get("currency") ?? "BRL"),
      status: String(formData.get("status") ?? "ativo"),
      visibility: String(formData.get("visibility") ?? "privado"),
    })
    .eq("id", id)
  if (error) return { error: error.message }
  revalidatePath(`/projetos/${id}`)
  revalidatePath("/projetos")
  return { ok: true }
}

export async function deleteProject(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("projects").delete().eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/projetos")
  return { ok: true }
}

/* ---------- Gastos ---------- */
export async function createExpense(projectId: string, formData: FormData) {
  const supabase = await createClient()
  const profile = await getCurrentProfile()
  const amount = Number.parseFloat(String(formData.get("amount") ?? "0").replace(",", "."))
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Valor inválido." }

  const { error } = await supabase.from("expenses").insert({
    project_id: projectId,
    type: String(formData.get("type") ?? "ads"),
    category: String(formData.get("category") ?? "") || null,
    amount,
    currency: String(formData.get("currency") ?? "BRL"),
    description: String(formData.get("description") ?? "") || null,
    spent_at: String(formData.get("spent_at") ?? new Date().toISOString().slice(0, 10)),
    recurring: formData.get("recurring") === "on",
    created_by: profile?.id ?? null,
  })
  if (error) return { error: error.message }
  revalidatePath(`/projetos/${projectId}`)
  return { ok: true }
}

export async function deleteExpense(projectId: string, id: string) {
  const supabase = await createClient()
  await supabase.from("expenses").delete().eq("id", id)
  revalidatePath(`/projetos/${projectId}`)
  return { ok: true }
}

/* ---------- Criativos ---------- */
export async function createCreative(projectId: string, formData: FormData) {
  const supabase = await createClient()
  const name = String(formData.get("name") ?? "").trim()
  if (!name) return { error: "Informe o nome do criativo." }
  const { error } = await supabase.from("creatives").insert({
    project_id: projectId,
    name,
    status: String(formData.get("status") ?? "testando"),
    activated_at: String(formData.get("activated_at") ?? "") || null,
    spend: Number.parseFloat(String(formData.get("spend") ?? "0").replace(",", ".")) || 0,
    sales: Number.parseInt(String(formData.get("sales") ?? "0"), 10) || 0,
    revenue: Number.parseFloat(String(formData.get("revenue") ?? "0").replace(",", ".")) || 0,
    notes: String(formData.get("notes") ?? "") || null,
  })
  if (error) return { error: error.message }
  revalidatePath(`/projetos/${projectId}`)
  return { ok: true }
}

export async function updateCreativeStatus(projectId: string, id: string, status: string) {
  const supabase = await createClient()
  await supabase.from("creatives").update({ status }).eq("id", id)
  revalidatePath(`/projetos/${projectId}`)
  return { ok: true }
}

export async function deleteCreative(projectId: string, id: string) {
  const supabase = await createClient()
  await supabase.from("creatives").delete().eq("id", id)
  revalidatePath(`/projetos/${projectId}`)
  return { ok: true }
}

/* ---------- Métricas diárias ---------- */
export async function upsertDailyMetric(projectId: string, formData: FormData) {
  const supabase = await createClient()
  const date = String(formData.get("date") ?? new Date().toISOString().slice(0, 10))
  const { error } = await supabase.from("daily_metrics").upsert(
    {
      project_id: projectId,
      date,
      spend: Number.parseFloat(String(formData.get("spend") ?? "0").replace(",", ".")) || 0,
      impressions: Number.parseInt(String(formData.get("impressions") ?? "0"), 10) || 0,
      clicks: Number.parseInt(String(formData.get("clicks") ?? "0"), 10) || 0,
      checkouts_initiated:
        Number.parseInt(String(formData.get("checkouts_initiated") ?? "0"), 10) || 0,
      sales: Number.parseInt(String(formData.get("sales") ?? "0"), 10) || 0,
      revenue: Number.parseFloat(String(formData.get("revenue") ?? "0").replace(",", ".")) || 0,
    },
    { onConflict: "project_id,date" },
  )
  if (error) return { error: error.message }
  revalidatePath(`/projetos/${projectId}`)
  return { ok: true }
}

/* ---------- Produtos do funil ---------- */
export async function createFunnelProduct(projectId: string, formData: FormData) {
  const supabase = await createClient()
  const name = String(formData.get("name") ?? "").trim()
  const price = Number.parseFloat(String(formData.get("price") ?? "0").replace(",", "."))
  if (!name || !Number.isFinite(price)) return { error: "Dados inválidos." }
  const { error } = await supabase.from("funnel_products").insert({
    project_id: projectId,
    name,
    kind: String(formData.get("kind") ?? "front"),
    price,
    product_cost:
      Number.parseFloat(String(formData.get("product_cost") ?? "0").replace(",", ".")) || 0,
  })
  if (error) return { error: error.message }
  revalidatePath(`/projetos/${projectId}`)
  return { ok: true }
}

export async function deleteFunnelProduct(projectId: string, id: string) {
  const supabase = await createClient()
  await supabase.from("funnel_products").delete().eq("id", id)
  revalidatePath(`/projetos/${projectId}`)
  return { ok: true }
}

/* ---------- Repartição de lucro ---------- */
export async function setProfitSplit(projectId: string, formData: FormData) {
  const supabase = await createClient()
  const userId = String(formData.get("user_id") ?? "")
  const percentage = Number.parseFloat(String(formData.get("percentage") ?? "0").replace(",", "."))
  if (!userId || !Number.isFinite(percentage)) return { error: "Dados inválidos." }
  const { error } = await supabase
    .from("profit_splits")
    .upsert({ project_id: projectId, user_id: userId, percentage }, { onConflict: "project_id,user_id" })
  if (error) return { error: error.message }
  revalidatePath(`/projetos/${projectId}`)
  return { ok: true }
}

export async function deleteProfitSplit(projectId: string, id: string) {
  const supabase = await createClient()
  await supabase.from("profit_splits").delete().eq("id", id)
  revalidatePath(`/projetos/${projectId}`)
  return { ok: true }
}
