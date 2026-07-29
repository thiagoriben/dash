"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getCurrentProfile, savePrefs } from "@/lib/data"
import { computeSaleNet, receivableDateFor } from "@/lib/finance"
import { normalizeCurrency } from "@/lib/currency"
import { logActivity } from "@/lib/activity"

const num = (v: FormDataEntryValue | null) =>
  Number.parseFloat(String(v ?? "0").replace(",", ".")) || 0

const int = (v: FormDataEntryValue | null) => Number.parseInt(String(v ?? "0"), 10) || 0

/** Checkbox com hidden "off" antes: pega o último valor enviado. */
const checkbox = (formData: FormData, name: string) => {
  const all = formData.getAll(name)
  return all[all.length - 1] === "on"
}

/* ---------- Preferências globais (listas editáveis, sidebar) ---------- */
export async function saveListPref(
  key: "regions" | "currencies" | "offer_types" | "sources",
  values: string[],
) {
  const clean = [...new Set(values.map((v) => v.trim().toLowerCase()).filter(Boolean))]
  await savePrefs({ [key]: clean })
  revalidatePath("/config")
  revalidatePath("/projetos")
  return { ok: true }
}

export async function setSidebarCollapsed(collapsed: boolean) {
  await savePrefs({ sidebar_collapsed: collapsed })
  return { ok: true }
}

export async function createProject(formData: FormData) {
  const supabase = await createClient()
  const profile = await getCurrentProfile()
  if (!profile) return { error: "Não autenticado." }

  const name = String(formData.get("name") ?? "").trim()
  if (!name) return { error: "Informe o nome do projeto." }

  const region = String(formData.get("region") ?? "br").toLowerCase()
  const offer_type = String(formData.get("offer_type") ?? "").toLowerCase() || null
  const currency = normalizeCurrency(String(formData.get("currency") ?? "brl"))

  const { data: created, error } = await supabase
    .from("projects")
    .insert({
      name,
      offer_type,
      region,
      currency,
      status: String(formData.get("status") ?? "ativo"),
      visibility: String(formData.get("visibility") ?? "privado"),
      owner_id: profile.id,
    })
    .select("id")
    .maybeSingle()
  if (error) return { error: error.message }

  await savePrefs({ region, offer_type: offer_type ?? undefined, currency })
  await logActivity({
    actor: profile,
    action: "create",
    entity: "project",
    entityId: created?.id ?? null,
    projectId: created?.id ?? null,
    summary: `Criou o projeto "${name}"`,
  })
  revalidatePath("/projetos")
  revalidatePath("/")
  return { ok: true }
}

export async function updateProject(id: string, formData: FormData) {
  const supabase = await createClient()
  const profile = await getCurrentProfile()
  const name = String(formData.get("name") ?? "").trim()
  const patch: Record<string, unknown> = {
    name,
    offer_type: String(formData.get("offer_type") ?? "").toLowerCase() || null,
    region: String(formData.get("region") ?? "br").toLowerCase(),
    currency: normalizeCurrency(String(formData.get("currency") ?? "brl")),
    status: String(formData.get("status") ?? "ativo"),
    visibility: String(formData.get("visibility") ?? "privado"),
  }
  if (formData.has("tax_pct")) patch.tax_pct = num(formData.get("tax_pct"))
  const { error } = await supabase.from("projects").update(patch).eq("id", id)
  if (error) return { error: error.message }
  await logActivity({
    actor: profile,
    action: "update",
    entity: "project",
    entityId: id,
    projectId: id,
    summary: `Editou o projeto "${name}"`,
  })
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
  await logActivity({
    actor: profile,
    action: "create",
    entity: "expense",
    projectId,
    summary: `Lançou gasto de ${amount.toFixed(2)}`,
  })
  revalidatePath(`/projetos/${projectId}`)
  revalidatePath("/")
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

/* ---------- Métricas diárias (todas opcionais) ---------- */
export async function upsertDailyMetric(projectId: string, formData: FormData) {
  const supabase = await createClient()
  const profile = await getCurrentProfile()
  const date = String(formData.get("date") ?? new Date().toISOString().slice(0, 10))
  const { error } = await supabase.from("daily_metrics").upsert(
    {
      project_id: projectId,
      date,
      spend: num(formData.get("spend")),
      impressions: int(formData.get("impressions")),
      clicks: int(formData.get("clicks")),
      page_views: int(formData.get("page_views")),
      checkouts_initiated: int(formData.get("checkouts_initiated")),
      sales: int(formData.get("sales")),
      revenue: num(formData.get("revenue")),
      ad_account_id: String(formData.get("ad_account_id") ?? "") || null,
    },
    { onConflict: "project_id,date" },
  )
  if (error) return { error: error.message }
  await logActivity({
    actor: profile,
    action: "update",
    entity: "daily_metric",
    projectId,
    summary: `Atualizou métricas de ${date}`,
  })
  revalidatePath(`/projetos/${projectId}`)
  revalidatePath("/")
  return { ok: true }
}

/* ---------- Contas de anúncio (BM + conta) ---------- */
export async function saveAdAccount(projectId: string, formData: FormData) {
  const supabase = await createClient()
  const profile = await getCurrentProfile()
  const id = String(formData.get("id") ?? "")
  const accountName = String(formData.get("account_name") ?? "").trim()
  if (!accountName) return { error: "Informe o nome da conta." }
  const payload = {
    bm_name: String(formData.get("bm_name") ?? "") || null,
    account_name: accountName,
  }
  const { error } = id
    ? await supabase.from("ad_accounts").update(payload).eq("id", id)
    : await supabase.from("ad_accounts").insert({ ...payload, project_id: projectId })
  if (error) return { error: error.message }
  await logActivity({
    actor: profile,
    action: id ? "update" : "create",
    entity: "ad_account",
    projectId,
    summary: `${id ? "Editou" : "Adicionou"} conta de anúncio "${accountName}"`,
  })
  revalidatePath(`/projetos/${projectId}`)
  return { ok: true }
}

export async function deleteAdAccount(projectId: string, id: string) {
  const supabase = await createClient()
  await supabase.from("ad_accounts").delete().eq("id", id)
  revalidatePath(`/projetos/${projectId}`)
  return { ok: true }
}

/* ---------- Cobranças no cartão (imposto = cobrança - gasto) ---------- */
export async function createCardCharge(projectId: string, formData: FormData) {
  const supabase = await createClient()
  const profile = await getCurrentProfile()
  const amount = num(formData.get("amount"))
  if (amount <= 0) return { error: "Informe o valor cobrado." }
  const { error } = await supabase.from("card_charges").insert({
    project_id: projectId,
    ad_account_id: String(formData.get("ad_account_id") ?? "") || null,
    amount,
    charged_at: String(formData.get("charged_at") ?? new Date().toISOString().slice(0, 10)),
    notes: String(formData.get("notes") ?? "") || null,
    created_by: profile?.id ?? null,
  })
  if (error) return { error: error.message }
  await logActivity({
    actor: profile,
    action: "create",
    entity: "card_charge",
    projectId,
    summary: `Lançou cobrança no cartão de ${amount.toFixed(2)}`,
  })
  revalidatePath(`/projetos/${projectId}`)
  revalidatePath("/")
  return { ok: true }
}

export async function deleteCardCharge(projectId: string, id: string) {
  const supabase = await createClient()
  await supabase.from("card_charges").delete().eq("id", id)
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
    term_days_pix: int(formData.get("term_days_pix")),
    term_days_card: int(formData.get("term_days_card")),
  }
  const { error } = id
    ? await supabase.from("payment_gateways").update(payload).eq("id", id)
    : await supabase.from("payment_gateways").insert({ ...payload, owner_id: profile.id })
  if (error) {
    return { error: error.code === "23505" ? "Já existe um gateway com esse nome." : error.message }
  }
  revalidatePath("/config/gateways")
  return { ok: true }
}

export async function deleteGateway(id: string) {
  const supabase = await createClient()
  await supabase.from("payment_gateways").delete().eq("id", id)
  revalidatePath("/config/gateways")
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
  const creativeId = String(formData.get("creative_id") ?? "") || null
  const paymentMethod = String(formData.get("payment_method") ?? "pix")
  const source = String(formData.get("source") ?? "").toLowerCase() || null
  const soldAt = String(formData.get("sold_at") ?? new Date().toISOString().slice(0, 10))

  // taxa + prazos do gateway
  let feePct = 0
  let feeFixed = 0
  let gwTerms: { term_days_pix: number; term_days_card: number } | null = null
  if (gatewayId) {
    const { data: gw } = await supabase
      .from("payment_gateways")
      .select("fee_pct, fee_fixed, term_days_pix, term_days_card")
      .eq("id", gatewayId)
      .maybeSingle()
    feePct = gw?.fee_pct ?? 0
    feeFixed = gw?.fee_fixed ?? 0
    gwTerms = gw ? { term_days_pix: gw.term_days_pix, term_days_card: gw.term_days_card } : null
  }
  // imposto do projeto
  const { data: proj } = await supabase
    .from("projects")
    .select("tax_pct")
    .eq("id", projectId)
    .maybeSingle()
  const taxPct = proj?.tax_pct ?? 0

  const { fee, tax, net } = computeSaleNet({ gross, applyFee, feePct, feeFixed, taxPct })
  const { date: receivableDate, hasTerm } = receivableDateFor(soldAt, paymentMethod, gwTerms)

  const { data: sale, error } = await supabase
    .from("sales")
    .insert({
      project_id: projectId,
      product_id: productId,
      creative_id: creativeId,
      gateway_id: gatewayId,
      gross_amount: gross,
      apply_gateway_fee: applyFee,
      fee_amount: fee,
      tax_amount: tax,
      net_amount: net,
      payment_method: paymentMethod,
      source,
      sold_at: soldAt,
      has_term: hasTerm,
      receivable_date: receivableDate,
      received: !hasTerm,
      notes: String(formData.get("notes") ?? "") || null,
      created_by: profile.id,
    })
    .select("id")
    .maybeSingle()
  if (error) return { error: error.message }

  // Entrada no caixa apenas quando o dinheiro já entrou (venda sem prazo/recebida)
  if (sale && !hasTerm) {
    await supabase.from("cash_entries").insert({
      owner_id: profile.id,
      project_id: projectId,
      direction: "entrada",
      amount: net,
      category: "venda",
      description: source ? `Venda (${source})` : "Venda",
      occurred_at: soldAt,
      sale_id: sale.id,
      created_by: profile.id,
    })
  }

  await savePrefs({
    payment_method: paymentMethod,
    source: source ?? undefined,
    gateway_id: gatewayId ?? undefined,
  })
  await logActivity({
    actor: profile,
    action: "create",
    entity: "sale",
    entityId: sale?.id ?? null,
    projectId,
    summary: `Registrou venda de ${gross.toFixed(2)}${hasTerm ? ` (recebe em ${receivableDate})` : ""}`,
    meta: { gross, net, method: paymentMethod },
  })
  revalidatePath(`/projetos/${projectId}`)
  revalidatePath("/")
  revalidatePath("/caixa")
  revalidatePath("/recebiveis")
  return { ok: true }
}

/** Marca uma venda com prazo como recebida e lança a entrada no caixa. */
export async function markSaleReceived(projectId: string, id: string) {
  const supabase = await createClient()
  const profile = await getCurrentProfile()
  const { data: sale } = await supabase.from("sales").select("*").eq("id", id).maybeSingle()
  if (!sale) return { error: "Venda não encontrada." }
  if (sale.received) return { ok: true }

  await supabase.from("sales").update({ received: true }).eq("id", id)
  await supabase.from("cash_entries").insert({
    owner_id: sale.created_by ?? profile?.id ?? null,
    project_id: projectId,
    direction: "entrada",
    amount: sale.net_amount,
    category: "venda",
    description: "Recebimento de venda",
    occurred_at: new Date().toISOString().slice(0, 10),
    sale_id: sale.id,
    created_by: profile?.id ?? null,
  })
  await logActivity({
    actor: profile,
    action: "update",
    entity: "sale",
    entityId: id,
    projectId,
    summary: `Confirmou recebimento de ${Number(sale.net_amount).toFixed(2)}`,
  })
  revalidatePath(`/projetos/${projectId}`)
  revalidatePath("/caixa")
  revalidatePath("/recebiveis")
  return { ok: true }
}

export async function deleteSale(projectId: string, id: string) {
  const supabase = await createClient()
  const profile = await getCurrentProfile()
  await supabase.from("cash_entries").delete().eq("sale_id", id)
  await supabase.from("sales").delete().eq("id", id)
  await logActivity({
    actor: profile,
    action: "delete",
    entity: "sale",
    entityId: id,
    projectId,
    summary: "Excluiu uma venda",
  })
  revalidatePath(`/projetos/${projectId}`)
  revalidatePath("/caixa")
  revalidatePath("/recebiveis")
  return { ok: true }
}

/* ---------- Caixa ---------- */
export async function createCashEntry(formData: FormData) {
  const supabase = await createClient()
  const profile = await getCurrentProfile()
  if (!profile) return { error: "Não autenticado." }
  const amount = num(formData.get("amount"))
  if (amount <= 0) return { error: "Informe um valor." }
  const direction = String(formData.get("direction") ?? "entrada")
  const projectId = String(formData.get("project_id") ?? "") || null
  const { error } = await supabase.from("cash_entries").insert({
    owner_id: profile.id,
    project_id: projectId,
    direction,
    amount,
    category: String(formData.get("category") ?? "") || null,
    description: String(formData.get("description") ?? "") || null,
    occurred_at: String(formData.get("occurred_at") ?? new Date().toISOString().slice(0, 10)),
    created_by: profile.id,
  })
  if (error) return { error: error.message }
  await logActivity({
    actor: profile,
    action: "create",
    entity: "cash_entry",
    projectId,
    summary: `${direction === "saida" ? "Retirada" : "Entrada"} no caixa de ${amount.toFixed(2)}`,
  })
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
