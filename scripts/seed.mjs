import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error("Faltam env vars NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const USERNAME = "admin"
const EMAIL = `${USERNAME}@dash.local`
const PASSWORD = "traffic123"

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}
const rand = (min, max) => Math.round(min + Math.random() * (max - min))

async function ensureUser() {
  // procura usuário existente
  const { data: list } = await admin.auth.admin.listUsers()
  let user = list?.users?.find((u) => u.email === EMAIL)
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { username: USERNAME, full_name: "Administrador" },
    })
    if (error) throw error
    user = data.user
    console.log("Usuário criado:", EMAIL)
  } else {
    console.log("Usuário já existe:", EMAIL)
  }

  await admin.from("profiles").upsert({
    id: user.id,
    username: USERNAME,
    full_name: "Administrador",
    role: "admin",
  })
  return user
}

async function seedProject(ownerId, cfg) {
  // evita duplicar projeto pelo nome
  const { data: existing } = await admin
    .from("projects")
    .select("id")
    .eq("name", cfg.name)
    .maybeSingle()
  if (existing) {
    console.log("Projeto já existe:", cfg.name)
    return existing.id
  }

  const { data: project, error } = await admin
    .from("projects")
    .insert({
      name: cfg.name,
      offer_type: cfg.offer_type,
      region: cfg.region,
      currency: cfg.currency,
      status: "ativo",
      visibility: "publico",
      owner_id: ownerId,
    })
    .select()
    .single()
  if (error) throw error
  const pid = project.id

  // métricas diárias (30 dias)
  const metrics = []
  for (let i = 30; i >= 0; i--) {
    const spend = rand(cfg.spendMin, cfg.spendMax)
    const impressions = spend * rand(180, 260)
    const clicks = Math.round(impressions * (rand(8, 18) / 1000))
    const checkouts = Math.round(clicks * (rand(6, 14) / 100))
    const sales = Math.round(checkouts * (rand(30, 55) / 100))
    const revenue = sales * cfg.ticket
    metrics.push({
      project_id: pid,
      date: daysAgo(i),
      spend,
      impressions,
      clicks,
      checkouts_initiated: checkouts,
      sales,
      revenue,
    })
  }
  await admin.from("daily_metrics").insert(metrics)

  // gastos fixos (ferramentas) + alguns extras
  await admin.from("expenses").insert([
    {
      project_id: pid,
      type: "ferramenta",
      category: "Copy/IA",
      amount: 97,
      currency: cfg.currency,
      description: "Assinatura ferramenta de copy",
      spent_at: daysAgo(15),
      recurring: true,
      created_by: ownerId,
    },
    {
      project_id: pid,
      type: "ferramenta",
      category: "Espionagem",
      amount: 150,
      currency: cfg.currency,
      description: "Ferramenta de espionagem de criativos",
      spent_at: daysAgo(15),
      recurring: true,
      created_by: ownerId,
    },
    {
      project_id: pid,
      type: "custo",
      category: "Designer",
      amount: 400,
      currency: cfg.currency,
      description: "Pacote de criativos",
      spent_at: daysAgo(10),
      recurring: false,
      created_by: ownerId,
    },
  ])

  // criativos
  await admin.from("creatives").insert([
    { project_id: pid, name: "VSL Hook Dor", status: "escalando", activated_at: daysAgo(20), spend: 3200, sales: 62, revenue: 62 * cfg.ticket, notes: "Melhor CPA da conta" },
    { project_id: pid, name: "Depoimento UGC", status: "ativo", activated_at: daysAgo(12), spend: 1800, sales: 24, revenue: 24 * cfg.ticket },
    { project_id: pid, name: "Carrossel Benefícios", status: "testando", activated_at: daysAgo(3), spend: 220, sales: 1, revenue: cfg.ticket },
    { project_id: pid, name: "Anúncio Preço", status: "pausado", activated_at: daysAgo(18), spend: 640, sales: 0, revenue: 0, notes: "Sem venda após budget de teste" },
  ])

  // funil
  await admin.from("funnel_products").insert([
    { project_id: pid, name: "Front-end", kind: "front", price: cfg.front, product_cost: cfg.front * 0.1 },
    { project_id: pid, name: "Order Bump", kind: "bump", price: cfg.bump, product_cost: 0 },
    { project_id: pid, name: "Upsell 1", kind: "upsell", price: cfg.upsell, product_cost: 0 },
  ])

  console.log("Projeto criado:", cfg.name)
  return pid
}

async function main() {
  const user = await ensureUser()

  const p1 = await seedProject(user.id, {
    name: "Emagrecimento - Chá Detox",
    offer_type: "Low ticket",
    region: "BR",
    currency: "BRL",
    ticket: 127,
    front: 97,
    bump: 27,
    upsell: 197,
    spendMin: 300,
    spendMax: 700,
  })

  const p2 = await seedProject(user.id, {
    name: "Renda Extra - Curso US",
    offer_type: "Mid ticket",
    region: "US",
    currency: "USD",
    ticket: 47,
    front: 37,
    bump: 17,
    upsell: 97,
    spendMin: 120,
    spendMax: 400,
  })

  // repartição de lucro no projeto 1
  await admin.from("profit_splits").upsert({ project_id: p1, user_id: user.id, percentage: 100 })

  console.log("\nSeed concluído.")
  console.log("Login:", EMAIL, "/ senha:", PASSWORD)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
