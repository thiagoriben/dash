"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getCurrentProfile, savePrefs } from "@/lib/data"
import { computeSaleNet } from "@/lib/finance"

const num = (v: FormDataEntryValue | null) =>
  Number.parseFloat(String(v ?? "0").replace(",", ".")) || 0

/** Checkbox com hidden "off" antes: pega o último valor enviado. */
const checkbox = (formData: FormData, name: string) => {
  const all = formData.getAll(name)
  return all[all.length - 1] === "on"
}

export async function createProject(formData: FormData) {
  const supabase = await createClient()
  const profile = await getCurrentProfile()
  if (!profile) return { error: "Não autenticado." }

  const name = String(formData.get("name") ?? "").trim()
  if (!name) return { error: "Informe o nome do projeto." }

  const region = String(formData.get("region") ?? "BR")
  const offer_type = String(formData.get("offer_type") ?? "") || null
  const currency = String(formData.get("currency") ?? "BRL")

  const { error } = await supabase.from("projects").insert({
    name,
    offer_type,
    region,
    currency,
    status: String(formData.get("status") ?? "ativo"),
    visibility: String(formData.get("visibility") ?? "privado"),
    owner_id: profile.id,
  })
  if (error) return { error: error.message }

  await savePrefs({ region, offer_type: offer_type ?? undefined, currency })
  revalidatePath("/projetos")
  revalidatePath("/")
  return { ok: true }
}

export async function updateProject(id: string, formData: FormData) {
  const supabase = await createClient()
  const patch: Record<string, unknown> = {
    name: String(formData.get("name") ?? "").trim(),
    offer_type: String(formData.get("offer_type") ?? "") || null,
    region: String(formData.get("region") ?? "BR"),
    currency: String(formData.get("currency") ?? "BRL"),
    status: String(formData.get("status") ?? "ativo"),
    visibility: String(formData.get("visibility") ?? "privado"),
  }
  if (formData.has("tax_pct")) patch.tax_pct = num(formData.get("tax_pct"))
  const { error } = await supabase.from("projects").update(patch).eq("id", id)
  if (error) return { error: error.message }
  revalidatePath(`/projetos/${id}`)
  revalidatePath("/projetos")
  return { ok: true }
}

/** Atualiza só o imposto do projeto (config na dashboard do projeto). */
export async function setProjectTax(id: string, taxPct: number) {
  const supabase = await createClient()
  const { error } = await supabase.from("projects").update({ tax_pct: taxPct }).eq("id", id)
  if (error) return { error: error.message }
  revalidatePath(`/projetos/${id}`)
  return { ok: true }
}

export async function deleteProject(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("projects").delete().eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/projetos")
  return { ok: true }
}

/* ---------- Colaboradores ---------- */
export async function addProjectMember(projectId: string, formData: FormData) {
  const supabase = await createClient()
  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase()
  if (!username) return { error: "Informe o usuário." }

  const { data: prof } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle()
  if (!prof) return { error: "Usuário não encontrado." }

  const { error } = await supabase.from("project_members").insert({
    project_id: projectId,
    user_id: prof.id,
    role: String(formData.get("role") ?? "editor"),
  })
  if (error) {
    return { error: error.code === "23505" ? "Este usuário já é colaborador." : error.message }
  }
  revalidatePath(`/projetos/${projectId}`)
  return { ok: true }
}

export async function removeProjectMember(projectId: string, id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("project_members").delete().eq("id", id)
  if (error) return { error: error.message }
  revalidatePath(`/projetos/${projectId}`)
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
    activated_at:
      String(formData.get("activated_at") ?? "") || new Date().toISOString().slice(0, 10),
    spend: num(formData.get("spend")),
    sales: Number.parseInt(String(formData.get("sales") ?? "0"), 10) || 0,
    revenue: num(formData.get("revenue")),
    notes: String(formData.get("notes") ?? "") || null,
  })
  if (error) return { error: error.message }
  revalidatePath(`/projetos/${projectId}`)
  return { ok: true }
}

export async function updateCreative(projectId: string, id: string, formData: FormData) {
  const supabase = await createClient()
  const name = String(formData.get("name") ?? "").trim()
  if (!name) return { error: "Informe o nome do criativo." }
  const { error } = await supabase
    .from("creatives")
    .update({
      name,
      status: String(formData.get("status") ?? "testando"),
      activated_at: String(formData.get("activated_at") ?? "") || null,
      spend: num(formData.get("spend")),
      sales: Number.parseInt(String(formData.get("sales") ?? "0"), 10) || 0,
      revenue: num(formData.get("revenue")),
      notes: String(formData.get("notes") ?? "") || null,
    })
    .eq("id", id)
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

export async function duplicateCreative(projectId: string, id: string) {
  const supabase = await createClient()
  const { data: c } = await supabase.from("creatives").select("*").eq("id", id).maybeSingle()
  if (!c) return { error: "Criativo não encontrado." }
  const { id: _omit, created_at: _omit2, ...rest } = c as Record<string, unknown>
  await supabase.from("creatives").insert({ ...rest, name: `${c.name} (cópia)` })
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

/* ---------- Produtos ---------- */
export async function createProduct(projectId: string, formData: FormData) {
  const supabase = await createClient()
  const name = String(formData.get("name") ?? "").trim()
  if (!name) return { error: "Informe o nome do produto." }
  const { error } = await supabase.from("products").insert({
    project_id: projectId,
    name,
    kind: String(formData.get("kind") ?? "front"),
    price: num(formData.get("price")),
    product_cost: num(formData.get("product_cost")),
    gateway_id: String(formData.get("gateway_id") ?? "") || null,
    in_funnel: checkbox(formData, "in_funnel"),
  })
  if (error) return { error: error.message }
  revalidatePath(`/projetos/${projectId}`)
  return { ok: true }
}

export async function updateProduct(projectId: string, id: string, formData: FormData) {
  const supabase = await createClient()
  const name = String(formData.get("name") ?? "").trim()
  if (!name) return { error: "Informe o nome do produto." }
  const { error } = await supabase
    .from("products")
    .update({
      name,
      kind: String(formData.get("kind") ?? "front"),
      price: num(formData.get("price")),
      product_cost: num(formData.get("product_cost")),
      gateway_id: String(formData.get("gateway_id") ?? "") || null,
      in_funnel: checkbox(formData, "in_funnel"),
    })
    .eq("id", id)
  if (error) return { error: error.message }
  revalidatePath(`/projetos/${projectId}`)
  return { ok: true }
}

export async function duplicateProduct(projectId: string, id: string) {
  const supabase = await createClient()
  const { data: p } = await supabase.from("products").select("*").eq("id", id).maybeSingle()
  if (!p) return { error: "Produto não encontrado." }
  const { id: _a, created_at: _b, ...rest } = p as Record<string, unknown>
  await supabase.from("products").insert({ ...rest, name: `${p.name} (cópia)` })
  revalidatePath(`/projetos/${projectId}`)
  return { ok: true }
}

export async function deleteProduct(projectId: string, id: string) {
  const supabase = await createClient()
  await supabase.from("products").delete().eq("id", id)
  revalidatePath(`/projetos/${projectId}`)
  return { ok: true }
}

/* ---------- Gateways de pagamento (global do usuário) ---------- */
export async function saveGateway(formData: FormData) {
  const supabase = await createClient()
  const profile = await getCurrentProfile()
  if (!profile) return { error: "Não autenticado." }
  const id = String(formData.get("id") ?? "")
  const name = String(formData.get("name") ?? "").trim()
  if (!name) return { error: "Informe o nome do gateway." }
  const payload = {
    name,
    fee_pct: num(formData.get("fee_pct")),
    fee_fixed: num(formData.get("fee_fixed")),
  }
  const { error } = id
    ? await supabase.from("payment_gateways").update(payload).eq("id", id)
    : await supabase.from("payment_gateways").insert({ ...payload, owner_id: profile.id })
  if (error) {
    return { error: error.code === "23505" ? "Já existe um gateway com esse nome." : error.message }
  }
  revalidatePath("/config")
  return { ok: true }
}

export async function deleteGateway(id: string) {
  const supabase = await createClient()
  await supabase.from("payment_gateways").delete().eq("id", id)
  revalidatePath("/config")
  return { ok: true }
}

/* ---------- Vendas ---------- */
export async function createSale(projectId: string, formData: FormData) {
  const supabase = await createClient()
  const profile = await getCurrentProfile()
  if (!profile) return { error: "Não autenticado." }

  const gross = num(formData.get("gross_amount"))
  if (gross <= 0) return { error: "Informe o valor da venda." }

  const applyFee = checkbox(formData, "apply_gateway_fee")
  const gatewayId = String(formData.get("gateway_id") ?? "") || null
  const productId = String(formData.get("product_id") ?? "") || null
  const paymentMethod = String(formData.get("payment_method") ?? "pix")
  const source = String(formData.get("source") ?? "") || null

  // taxa do gateway
  let feePct = 0
  let feeFixed = 0
  if (gatewayId) {
    const { data: gw } = await supabase
      .from("payment_gateways")
      .select("fee_pct, fee_fixed")
      .eq("id", gatewayId)
      .maybeSingle()
    feePct = gw?.fee_pct ?? 0
    feeFixed = gw?.fee_fixed ?? 0
  }
  // imposto do projeto
  const { data: proj } = await supabase
    .from("projects")
    .select("tax_pct")
    .eq("id", projectId)
    .maybeSingle()
  const taxPct = proj?.tax_pct ?? 0

  const { fee, tax, net } = computeSaleNet({ gross, applyFee, feePct, feeFixed, taxPct })

  const { data: sale, error } = await supabase
    .from("sales")
    .insert({
      project_id: projectId,
      product_id: productId,
      gateway_id: gatewayId,
      gross_amount: gross,
      apply_gateway_fee: applyFee,
      fee_amount: fee,
      tax_amount: tax,
      net_amount: net,
      payment_method: paymentMethod,
      source,
      sold_at: String(formData.get("sold_at") ?? new Date().toISOString().slice(0, 10)),
      notes: String(formData.get("notes") ?? "") || null,
      created_by: profile.id,
    })
    .select("id")
    .maybeSingle()
  if (error) return { error: error.message }

  // Entrada automática no caixa (líquido da venda)
  if (sale) {
    await supabase.from("cash_entries").insert({
      owner_id: profile.id,
      project_id: projectId,
      direction: "entrada",
      amount: net,
      category: "venda",
      description: source ? `Venda (${source})` : "Venda",
      occurred_at: String(formData.get("sold_at") ?? new Date().toISOString().slice(0, 10)),
      sale_id: sale.id,
      created_by: profile.id,
    })
  }

  await savePrefs({
    payment_method: paymentMethod,
    source: source ?? undefined,
    gateway_id: gatewayId ?? undefined,
  })
  revalidatePath(`/projetos/${projectId}`)
  revalidatePath("/")
  revalidatePath("/caixa")
  return { ok: true }
}

export async function deleteSale(projectId: string, id: string) {
  const supabase = await createClient()
  await supabase.from("cash_entries").delete().eq("sale_id", id)
  await supabase.from("sales").delete().eq("id", id)
  revalidatePath(`/projetos/${projectId}`)
  revalidatePath("/caixa")
  return { ok: true }
}

/* ---------- Caixa ---------- */
export async function createCashEntry(formData: FormData) {
  const supabase = await createClient()
  const profile = await getCurrentProfile()
  if (!profile) return { error: "Não autenticado." }
  const amount = num(formData.get("amount"))
  if (amount <= 0) return { error: "Informe um valor." }
  const { error } = await supabase.from("cash_entries").insert({
    owner_id: profile.id,
    project_id: String(formData.get("project_id") ?? "") || null,
    direction: String(formData.get("direction") ?? "entrada"),
    amount,
    category: String(formData.get("category") ?? "") || null,
    description: String(formData.get("description") ?? "") || null,
    occurred_at: String(formData.get("occurred_at") ?? new Date().toISOString().slice(0, 10)),
    created_by: profile.id,
  })
  if (error) return { error: error.message }
  revalidatePath("/caixa")
  return { ok: true }
}

export async function deleteCashEntry(id: string) {
  const supabase = await createClient()
  await supabase.from("cash_entries").delete().eq("id", id)
  revalidatePath("/caixa")
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
