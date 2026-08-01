import { NextResponse } from "next/server"
import webpush from "web-push"
import { createAdminClient } from "@/lib/supabase/server"

// web-push depende de crypto do Node — força runtime Node e execução dinâmica.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Sub = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string }
type Reminder = { time?: string; lead?: number }

// Brasil não tem mais horário de verão: offset fixo -03:00.
const BR_OFFSET = "-03:00"
// Janela de tolerância (ms) para pegar minutos perdidos entre execuções do cron.
const GRACE_MS = 6 * 60_000

function configureVapid(): boolean {
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return false
  webpush.setVapidDetails("mailto:notificacoes@dash.app", pub, priv)
  return true
}

export async function GET(req: Request) {
  // Proteção: só o cron da Vercel (ou quem tiver o CRON_SECRET) executa.
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get("authorization")
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }
  }

  if (!configureVapid()) {
    return NextResponse.json({ error: "VAPID não configurado" }, { status: 500 })
  }

  const supabase = createAdminClient()
  const now = Date.now()

  // 1) Perfis com lembretes configurados e notificações habilitadas.
  const { data: profiles, error: profErr } = await supabase
    .from("profiles")
    .select("id, prefs")
    .not("prefs", "is", null)
  if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 })

  type Due = { userId: string; todoId: string; fireAt: number; lead: number }
  const candidates: Due[] = []
  const todoIds = new Set<string>()

  for (const p of profiles ?? []) {
    const prefs = (p.prefs ?? {}) as {
      task_reminders?: Record<string, Reminder>
      notif_settings?: { task_reminders?: boolean; enabled?: boolean }
    }
    if (prefs.notif_settings?.task_reminders === false) continue
    if (prefs.notif_settings?.enabled === false) continue
    const map = prefs.task_reminders ?? {}
    for (const [todoId, r] of Object.entries(map)) {
      if (!r?.time) continue
      todoIds.add(todoId)
      candidates.push({ userId: p.id, todoId, fireAt: 0, lead: r.lead ?? 0 })
      // fireAt é preenchido depois, quando soubermos a due_date da tarefa.
      ;(candidates[candidates.length - 1] as Due & { time: string }).time = r.time
    }
  }

  if (todoIds.size === 0) return NextResponse.json({ ok: true, checked: 0, sent: 0 })

  // 2) Dados das tarefas referenciadas.
  const { data: todos, error: todoErr } = await supabase
    .from("todos")
    .select("id, title, due_date, done, archived")
    .in("id", Array.from(todoIds))
  if (todoErr) return NextResponse.json({ error: todoErr.message }, { status: 500 })

  const todoById = new Map(
    (todos ?? []).map((t) => [t.id as string, t as { id: string; title: string; due_date: string | null; done: boolean; archived: boolean }]),
  )

  // 3) Filtra os que devem disparar agora (dentro da janela) e ainda não foram enviados.
  const toSend: { userId: string; todo: { id: string; title: string }; fireAt: number }[] = []
  for (const c of candidates as (Due & { time: string })[]) {
    const t = todoById.get(c.todoId)
    if (!t || t.done || t.archived || !t.due_date) continue
    const base = Date.parse(`${t.due_date}T${c.time}:00${BR_OFFSET}`)
    if (Number.isNaN(base)) continue
    const fireAt = base - c.lead * 60_000
    // Deve disparar: horário já chegou, dentro da janela de tolerância.
    if (fireAt <= now && now - fireAt <= GRACE_MS) {
      toSend.push({ userId: c.userId, todo: { id: t.id, title: t.title }, fireAt })
    }
  }

  if (toSend.length === 0) return NextResponse.json({ ok: true, checked: todoIds.size, sent: 0 })

  // 4) Assinaturas push de todos os usuários envolvidos.
  const userIds = Array.from(new Set(toSend.map((s) => s.userId)))
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .in("user_id", userIds)
  const subsByUser = new Map<string, Sub[]>()
  for (const s of (subs ?? []) as Sub[]) {
    const list = subsByUser.get(s.user_id) ?? []
    list.push(s)
    subsByUser.set(s.user_id, list)
  }

  let sent = 0
  const staleSubIds: string[] = []

  for (const item of toSend) {
    // Dedupe: grava no log ANTES de enviar. Se já existe (conflito), pula.
    const fireIso = new Date(item.fireAt).toISOString()
    const { error: logErr } = await supabase
      .from("reminder_log")
      .insert({ user_id: item.userId, todo_id: item.todo.id, fire_at: fireIso })
    if (logErr) continue // conflito de unicidade = já enviado

    const userSubs = subsByUser.get(item.userId) ?? []
    const payload = JSON.stringify({
      title: "Lembrete de tarefa",
      body: item.todo.title,
      url: "/organizacao/tarefas",
      tag: `todo-${item.todo.id}`,
    })

    for (const s of userSubs) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        )
        sent++
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode
        // 404/410 = assinatura expirada/removida no navegador: limpa do banco.
        if (status === 404 || status === 410) staleSubIds.push(s.id)
      }
    }
  }

  if (staleSubIds.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", staleSubIds)
  }

  return NextResponse.json({ ok: true, checked: todoIds.size, candidates: toSend.length, sent })
}
