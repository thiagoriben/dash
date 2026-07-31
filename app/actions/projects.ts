"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { createClient, createAdminClient } from "@/lib/supabase/server"
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
  // "sources" preserva a caixa digitada (ex.: "Facebook Ads") para casar com as opções do
  // seletor e evitar duplicatas em minúsculo. As demais listas seguem normalizadas em minúsculo.
  const preserveCase = key === "sources"
  const seen = new Set<string>()
  const clean: string[] = []
  for (const raw of values) {
    const v = preserveCase ? raw.trim() : raw.trim().toLowerCase()
    if (!v) continue
    const dedupeKey = v.toLowerCase()
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)
    clean.push(v)
  }
  await savePrefs({ [key]: clean })
  revalidatePath("/config")
  revalidatePath("/perfil")
  revalidatePath("/projetos")
  return { ok: true }
}

/** Rótulos válidos de item de venda. */
const SALE_ITEM_ROLES = ["front", "order_bump", "upsell", "downsell"] as const

/** Interpreta os itens de venda (multi-produto) enviados como JSON no formulário. */
function parseSaleItems(raw: FormDataEntryValue | null): {
  product_id: string | null
  role: (typeof SALE_ITEM_ROLES)[number]
  gross_amount: number
  quantity: number
}[] {
  if (!raw) return []
  try {
    const arr = JSON.parse(String(raw))
    if (!Array.isArray(arr)) return []
    return arr
      .map((it) => ({
        product_id: it.product_id ? String(it.product_id) : null,
        role: SALE_ITEM_ROLES.includes(it.role) ? it.role : "front",
        gross_amount: Number(it.gross_amount) || 0,
        quantity: Math.max(1, Number.parseInt(String(it.quantity ?? 1), 10) || 1),
      }))
      .filter((it) => it.product_id || it.gross_amount > 0)
  } catch {
    return []
  }
}

export async function setSidebarCollapsed(collapsed: boolean) {
  await savePrefs({ sidebar_collapsed: collapsed })
  return { ok: true }
}

/** Preferências de exibição das dashboards (gasto, base do lucro, % imposto, widgets). */
export async function saveViewPrefs(patch: {
  spend_view?: string
  profit_base?: string
  meta_tax_pct?: number
  dash_widgets?: string[]
  project_widgets?: string[]
}) {
  await savePrefs(patch)
  revalidatePath("/")
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
  if (formData.has("card_color")) patch.card_color = String(formData.get("card_color") ?? "") || null
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
    currency: normalizeCurrency(String(formData.get("currency") ?? "BRL")),
    description: String(formData.get("description") ?? "") || null,
    spent_at: String(formData.get("spent_at") ?? new Date().toISOString().slice(0, 10)),
    recurring: formData.get("recurring") === "on",
    ad_account_id: String(formData.get("ad_account_id") ?? "") || null,
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
    withdraw_fee_pct: num(formData.get("withdraw_fee_pct")),
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

/**
 * Saque de um gateway. Recebe o valor BRUTO sacado; o líquido é
 * bruto − (bruto × withdraw_fee_pct). Lança a entrada LÍQUIDA no destino
 * (carteira pessoal = bank_account, ou caixa de projeto = cash_entry) e
 * registra o saque para abater do saldo do gateway.
 */
export async function withdrawFromGateway(formData: FormData) {
  const supabase = await createClient()
  const profile = await getCurrentProfile()
  if (!profile) return { error: "Não autenticado." }

  const gatewayId = String(formData.get("gateway_id") ?? "")
  const gross = num(formData.get("gross_amount"))
  if (!gatewayId) return { error: "Gateway inválido." }
  if (gross <= 0) return { error: "Informe o valor sacado." }

  const { data: gw } = await supabase
    .from("payment_gateways")
    .select("id, withdraw_fee_pct")
    .eq("id", gatewayId)
    .maybeSingle()
  if (!gw) return { error: "Gateway não encontrado." }

  const feePct = Number(gw.withdraw_fee_pct) || 0
  const fee = +(gross * (feePct / 100)).toFixed(2)
  const net = +(gross - fee).toFixed(2)

  const destKind = String(formData.get("dest_kind") ?? "carteira") === "projeto" ? "projeto" : "carteira"
  const destAccountId = String(formData.get("dest_account_id") ?? "") || null
  const destProjectId = String(formData.get("dest_project_id") ?? "") || null
  const withdrawnAt = String(formData.get("withdrawn_at") ?? new Date().toISOString().slice(0, 10))
  const note = String(formData.get("note") ?? "") || null

  if (destKind === "carteira" && !destAccountId) return { error: "Escolha a conta de destino." }
  if (destKind === "projeto" && !destProjectId) return { error: "Escolha o projeto de destino." }

  const { error: wErr } = await supabase.from("gateway_withdrawals").insert({
    owner_id: profile.id,
    gateway_id: gatewayId,
    gross_amount: gross,
    fee_amount: fee,
    net_amount: net,
    currency: "BRL",
    dest_kind: destKind,
    dest_account_id: destKind === "carteira" ? destAccountId : null,
    dest_project_id: destKind === "projeto" ? destProjectId : null,
    note,
    withdrawn_at: withdrawnAt,
  })
  if (wErr) return { error: wErr.message }

  // Lança a entrada líquida no destino escolhido.
  if (destKind === "carteira" && destAccountId) {
    await supabase.from("cash_entries").insert({
      owner_id: profile.id,
      project_id: null,
      direction: "entrada",
      amount: net,
      currency: "BRL",
      category: "saque_gateway",
      description: "Saque de gateway",
      occurred_at: withdrawnAt,
      bank_account_id: destAccountId,
      created_by: profile.id,
    })
    await applyBankDelta(supabase, destAccountId, net)
  } else if (destKind === "projeto" && destProjectId) {
    await supabase.from("cash_entries").insert({
      owner_id: profile.id,
      project_id: destProjectId,
      direction: "entrada",
      amount: net,
      currency: "BRL",
      category: "saque_gateway",
      description: "Saque de gateway",
      occurred_at: withdrawnAt,
      created_by: profile.id,
    })
  }

  await logActivity({
    actor: profile,
    action: "create",
    entity: "cash_entry",
    projectId: destKind === "projeto" ? destProjectId ?? undefined : undefined,
    summary: `Saque de gateway: bruto ${gross.toFixed(2)}, líquido ${net.toFixed(2)}`,
  })

  revalidatePath("/config/gateways")
  revalidatePath("/caixa")
  if (destProjectId) revalidatePath(`/projetos/${destProjectId}`)
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
  // Mantém o texto exato da origem (ex.: "Facebook Ads") para casar com as opções e evitar
  // duplicatas em minúsculo no seletor "Outro".
  const source = String(formData.get("source") ?? "").trim() || null
  const adAccountId = String(formData.get("ad_account_id") ?? "") || null
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
      ad_account_id: adAccountId,
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

  // Itens da venda (multi-produto). Chega como JSON serializado no campo "items".
  if (sale) {
    const items = parseSaleItems(formData.get("items"))
    if (items.length > 0) {
      await supabase
        .from("sale_items")
        .insert(items.map((it) => ({ ...it, sale_id: sale.id })))
    }
  }

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

/** Edita uma venda existente, recalculando taxas/impostos e regravando os itens. */
export async function updateSale(projectId: string, saleId: string, formData: FormData) {
  const supabase = await createClient()
  const profile = await getCurrentProfile()
  if (!profile) return { error: "Não autenticado." }

  const gross = num(formData.get("gross_amount"))
  if (gross <= 0) return { error: "Informe o valor da venda." }

  const applyFee = checkbox(formData, "apply_gateway_fee")
  const gatewayId = String(formData.get("gateway_id") ?? "") || null
  const productId = String(formData.get("product_id") ?? "") || null
  const creativeId = String(formData.get("creative_id") ?? "") || null
  const adAccountId = String(formData.get("ad_account_id") ?? "") || null
  const paymentMethod = String(formData.get("payment_method") ?? "pix")
  const source = String(formData.get("source") ?? "").trim() || null
  const soldAt = String(formData.get("sold_at") ?? new Date().toISOString().slice(0, 10))

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
  const { data: proj } = await supabase.from("projects").select("tax_pct").eq("id", projectId).maybeSingle()
  const taxPct = proj?.tax_pct ?? 0

  const { fee, tax, net } = computeSaleNet({ gross, applyFee, feePct, feeFixed, taxPct })
  const { date: receivableDate, hasTerm } = receivableDateFor(soldAt, paymentMethod, gwTerms)

  const { error } = await supabase
    .from("sales")
    .update({
      product_id: productId,
      creative_id: creativeId,
      gateway_id: gatewayId,
      ad_account_id: adAccountId,
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
      notes: String(formData.get("notes") ?? "") || null,
    })
    .eq("id", saleId)
  if (error) return { error: error.message }

  // Regrava os itens: apaga os antigos e insere os novos.
  await supabase.from("sale_items").delete().eq("sale_id", saleId)
  const items = parseSaleItems(formData.get("items"))
  if (items.length > 0) {
    await supabase.from("sale_items").insert(items.map((it) => ({ ...it, sale_id: saleId })))
  }

  // Sincroniza a entrada de caixa vinculada (quando existir) com o novo valor líquido.
  await supabase.from("cash_entries").update({ amount: net }).eq("sale_id", saleId)

  await savePrefs({
    payment_method: paymentMethod,
    source: source ?? undefined,
    gateway_id: gatewayId ?? undefined,
  })
  await logActivity({
    actor: profile,
    action: "update",
    entity: "sale",
    entityId: saleId,
    projectId,
    summary: `Editou venda (${gross.toFixed(2)})`,
    meta: { gross, net },
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
  const bankAccountId = String(formData.get("bank_account_id") ?? "") || null
  const currency = normalizeCurrency(String(formData.get("currency") ?? "BRL"))

  // Tipo do lançamento (só faz sentido em saídas de projeto, mas guardamos sempre).
  const allowedTypes = ["comum", "aporte_pix", "gasto_anuncio", "cobranca_cartao"]
  const rawType = String(formData.get("entry_type") ?? "comum")
  const entryType = allowedTypes.includes(rawType) ? rawType : "comum"
  const linkedEntryId = String(formData.get("linked_entry_id") ?? "") || null

  const toDashboard = checkbox(formData, "to_dashboard")
  // Gasto com anúncio sempre conta como "gasto" na dashboard; cobrança no cartão não.
  const dashboardKind =
    entryType === "gasto_anuncio"
      ? "gasto"
      : toDashboard
        ? direction === "saida"
          ? String(formData.get("dashboard_kind") ?? "gasto")
          : "faturamento"
        : null

  // Categoria automática amigável quando o usuário não digita uma.
  const autoCategory =
    entryType === "aporte_pix"
      ? "Aporte (fundos/pix)"
      : entryType === "gasto_anuncio"
        ? "Gasto com anúncio"
        : entryType === "cobranca_cartao"
          ? "Cobrança no cartão"
          : null
  const category = String(formData.get("category") ?? "").trim() || autoCategory

  const { data: inserted, error } = await supabase
    .from("cash_entries")
    .insert({
      owner_id: profile.id,
      project_id: projectId,
      direction,
      amount,
      currency,
      category,
      description: String(formData.get("description") ?? "") || null,
      occurred_at: String(formData.get("occurred_at") ?? new Date().toISOString().slice(0, 10)),
      bank_account_id: bankAccountId,
      to_dashboard: entryType === "gasto_anuncio" ? true : toDashboard,
      dashboard_kind: dashboardKind,
      entry_type: entryType,
      linked_entry_id: linkedEntryId,
      created_by: profile.id,
    })
    .select("id")
    .maybeSingle()
  if (error) return { error: error.message }

  // Vínculo recíproco: se este lançamento aponta para outro, o outro passa a apontar de volta.
  if (linkedEntryId && inserted?.id) {
    await supabase.from("cash_entries").update({ linked_entry_id: inserted.id }).eq("id", linkedEntryId)
  }

  // Lembra a última moeda escolhida por usuário (memória do formulário).
  try {
    const store = await cookies()
    store.set("last_cash_currency", currency, { path: "/", maxAge: 31536000 })
  } catch {}

  // Reflete no saldo da conta bancária, quando vinculada.
  if (bankAccountId) await applyBankDelta(supabase, bankAccountId, direction === "saida" ? -amount : amount)

  await logActivity({
    actor: profile,
    action: "create",
    entity: "cash_entry",
    projectId,
    summary: `${direction === "saida" ? "Retirada" : "Entrada"} no caixa de ${amount.toFixed(2)}`,
  })
  revalidatePath("/caixa")
  if (projectId) revalidatePath(`/projetos/${projectId}`)
  if (toDashboard) revalidatePath("/")
  return { ok: true }
}

export async function deleteCashEntry(id: string) {
  const supabase = await createClient()
  const { data: entry } = await supabase.from("cash_entries").select("*").eq("id", id).maybeSingle()
  // Se fizer parte de uma transferência, remove as duas pernas e desfaz saldos.
  if (entry?.transfer_group) {
    const { data: legs } = await supabase
      .from("cash_entries")
      .select("*")
      .eq("transfer_group", entry.transfer_group)
    for (const leg of legs ?? []) {
      if (leg.bank_account_id)
        await applyBankDelta(supabase, leg.bank_account_id, leg.direction === "saida" ? leg.amount : -leg.amount)
    }
    await supabase.from("cash_entries").delete().eq("transfer_group", entry.transfer_group)
  } else {
    if (entry?.bank_account_id)
      await applyBankDelta(supabase, entry.bank_account_id, entry.direction === "saida" ? entry.amount : -entry.amount)
    await supabase.from("cash_entries").delete().eq("id", id)
  }
  revalidatePath("/caixa")
  if (entry?.project_id) revalidatePath(`/projetos/${entry.project_id}`)
  return { ok: true }
}

/**
 * Transferência entre caixas: pessoal → projeto, projeto → pessoal, ou sócio → sócio.
 * Cria as duas pernas (saída de uma origem, entrada em um destino) com o mesmo transfer_group.
 */
export async function transferCash(formData: FormData) {
  const supabase = await createClient()
  const profile = await getCurrentProfile()
  if (!profile) return { error: "Não autenticado." }
  const amount = num(formData.get("amount"))
  if (amount <= 0) return { error: "Informe um valor." }

  const fromProject = String(formData.get("from_project_id") ?? "") || null
  const toProject = String(formData.get("to_project_id") ?? "") || null
  const toUser = String(formData.get("to_user_id") ?? "") || profile.id
  const bankAccountId = String(formData.get("bank_account_id") ?? "") || null
  const occurredAt = String(formData.get("occurred_at") ?? new Date().toISOString().slice(0, 10))
  const currency = normalizeCurrency(String(formData.get("currency") ?? "BRL"))
  const group = crypto.randomUUID()
  const desc = String(formData.get("description") ?? "") || "Transferência"

  // Perna de SAÍDA (origem = quem envia)
  const outRow = {
    owner_id: profile.id,
    project_id: fromProject,
    direction: "saida" as const,
    amount,
    currency,
    category: "transferência",
    description: desc,
    occurred_at: occurredAt,
    bank_account_id: fromProject ? null : bankAccountId,
    transfer_group: group,
    counterparty_id: toUser,
    to_dashboard: false,
    dashboard_kind: null,
    created_by: profile.id,
  }
  // Perna de ENTRADA (destino = quem recebe)
  const inRow = {
    owner_id: toUser,
    project_id: toProject,
    direction: "entrada" as const,
    amount,
    currency,
    category: "transferência",
    description: desc,
    occurred_at: occurredAt,
    bank_account_id: toProject ? null : bankAccountId,
    transfer_group: group,
    counterparty_id: profile.id,
    to_dashboard: false,
    dashboard_kind: null,
    created_by: profile.id,
  }

  // Admin client: a perna de entrada pode pertencer a outro sócio (owner_id != auth.uid()),
  // o que a RLS de cash_entries bloquearia. O ator já foi validado acima.
  const admin = createAdminClient()
  const { error } = await admin.from("cash_entries").insert([outRow, inRow])
  if (error) return { error: error.message }

  // Ajusta saldo da conta bancária: sai se origem pessoal, entra se destino pessoal.
  if (bankAccountId) {
    if (!fromProject) await applyBankDelta(supabase, bankAccountId, -amount)
    if (!toProject) await applyBankDelta(supabase, bankAccountId, amount)
  }

  await logActivity({
    actor: profile,
    action: "create",
    entity: "transfer",
    projectId: fromProject ?? toProject,
    summary: `Transferiu ${amount.toFixed(2)}`,
  })
  revalidatePath("/caixa")
  if (fromProject) revalidatePath(`/projetos/${fromProject}`)
  if (toProject) revalidatePath(`/projetos/${toProject}`)
  return { ok: true }
}

/* ---------- Contas bancárias (gestor financeiro pessoal) ---------- */
async function applyBankDelta(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bankAccountId: string,
  delta: number,
) {
  const { data: acc } = await supabase
    .from("bank_accounts")
    .select("balance")
    .eq("id", bankAccountId)
    .maybeSingle()
  if (!acc) return
  await supabase
    .from("bank_accounts")
    .update({ balance: Number(acc.balance) + delta })
    .eq("id", bankAccountId)
}

export async function saveBankAccount(formData: FormData) {
  const supabase = await createClient()
  const profile = await getCurrentProfile()
  if (!profile) return { error: "Não autenticado." }
  const id = String(formData.get("id") ?? "")
  const name = String(formData.get("name") ?? "").trim()
  if (!name) return { error: "Informe o nome da conta." }
  const payload = {
    name,
    kind: String(formData.get("kind") ?? "banco"),
    balance: num(formData.get("balance")),
    currency: normalizeCurrency(String(formData.get("currency") ?? "BRL")),
  }
  const { error } = id
    ? await supabase.from("bank_accounts").update(payload).eq("id", id)
    : await supabase.from("bank_accounts").insert({ ...payload, owner_id: profile.id })
  if (error) return { error: error.message }
  revalidatePath("/caixa")
  return { ok: true }
}

export async function deleteBankAccount(id: string) {
  const supabase = await createClient()
  await supabase.from("bank_accounts").delete().eq("id", id)
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
