import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sendWebPushNotification } from "@/lib/push-server"

export const dynamic = "force-dynamic"

/**
 * Endpoint de Cron / Agendador para verificar tarefas com horário de lembrete
 * e disparar notificações Web Push VAPID direto para os celulares dos usuários.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const secret = searchParams.get("secret") || request.headers.get("x-cron-secret")
    const expectedSecret = process.env.CRON_SECRET || "35223281tT!"

    if (secret !== expectedSecret && process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const supabase = await createClient()

    // 1. Busca todos os perfis com preferências de tarefas (task_reminders)
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, prefs")
      .not("prefs", "is", null)

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ ok: true, sentCount: 0 })
    }

    const now = new Date()
    const todayStr = now.toISOString().slice(0, 10)
    const currentHH = String(now.getHours()).padStart(2, "0")
    const currentMM = String(now.getMinutes()).padStart(2, "0")
    const currentTimeStr = `${currentHH}:${currentMM}`

    let totalSent = 0

    for (const p of profiles) {
      const prefs = (p.prefs ?? {}) as Record<string, any>
      const taskReminders = (prefs.task_reminders ?? {}) as Record<string, { time?: string; lead?: number }>

      const todoIds = Object.keys(taskReminders)
      if (todoIds.length === 0) continue

      // Busca as tarefas ativas e não concluídas do usuário
      const { data: todos } = await supabase
        .from("todo_items")
        .select("id, title, due_date, done, archived")
        .eq("owner_id", p.id)
        .in("id", todoIds)
        .eq("done", false)
        .eq("archived", false)
        .eq("due_date", todayStr)

      if (!todos || todos.length === 0) continue

      for (const t of todos) {
        const reminder = taskReminders[t.id]
        if (!reminder?.time) continue

        // Verifica se o horário do lembrete (considerando a antecedência/lead) bate com o minuto atual
        const [hh, mm] = reminder.time.split(":").map(Number)
        const leadMin = reminder.lead || 0

        const remDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh || 0, mm || 0, 0, 0)
        remDate.setMinutes(remDate.getMinutes() - leadMin)

        const remHH = String(remDate.getHours()).padStart(2, "0")
        const remMM = String(remDate.getMinutes()).padStart(2, "0")
        const remTimeStr = `${remHH}:${remMM}`

        if (remTimeStr === currentTimeStr) {
          const res = await sendWebPushNotification(p.id, {
            title: "⏰ Lembrete de Tarefa",
            body: t.title,
            url: "/organizacao/tarefas",
            tag: `todo_${t.id}`
          })
          totalSent += res.sent
        }
      }
    }

    return NextResponse.json({ ok: true, sentCount: totalSent, time: currentTimeStr })
  } catch (err: any) {
    console.error("Cron reminders error:", err)
    return NextResponse.json({ error: err?.message || "Erro interno no agendador" }, { status: 500 })
  }
}
