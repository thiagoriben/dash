import { createClient } from "@/lib/supabase/server"
import type { ActivityLog, Profile } from "@/lib/types"

type LogInput = {
  actor: Profile | null
  action: string
  entity?: string
  entityId?: string | null
  projectId?: string | null
  ownerId?: string | null
  summary?: string
  meta?: Record<string, unknown>
}

/** Registra uma atividade. Nunca lança — falha de log não deve quebrar a ação. */
export async function logActivity(input: LogInput) {
  try {
    const supabase = await createClient()
    if (!input.actor) return
    await supabase.from("activity_log").insert({
      actor_id: input.actor.id,
      actor_name: input.actor.full_name || input.actor.username,
      owner_id: input.ownerId ?? input.actor.id,
      project_id: input.projectId ?? null,
      action: input.action,
      entity: input.entity ?? null,
      entity_id: input.entityId ?? null,
      summary: input.summary ?? null,
      meta: input.meta ?? {},
    })
  } catch {
    // silencioso
  }
}

export async function getActivity(opts: {
  projectId?: string
  limit?: number
}): Promise<ActivityLog[]> {
  const supabase = await createClient()
  let q = supabase.from("activity_log").select("*").order("created_at", { ascending: false })
  if (opts.projectId) q = q.eq("project_id", opts.projectId)
  q = q.limit(opts.limit ?? 50)
  const { data } = await q
  return (data ?? []) as ActivityLog[]
}

export type DayCount = { date: string; count: number }

/**
 * Conta atividades do usuário (actor) por dia nos últimos `days` dias.
 * Alimenta o heatmap estilo GitHub no perfil.
 */
export async function getActivityByDay(actorId: string, days = 133): Promise<DayCount[]> {
  const supabase = await createClient()
  const since = new Date()
  since.setDate(since.getDate() - days)
  const { data } = await supabase
    .from("activity_log")
    .select("created_at")
    .eq("actor_id", actorId)
    .gte("created_at", since.toISOString())
    .limit(5000)
  const counts = new Map<string, number>()
  for (const r of (data ?? []) as { created_at: string }[]) {
    const day = r.created_at.slice(0, 10)
    counts.set(day, (counts.get(day) ?? 0) + 1)
  }
  return Array.from(counts.entries()).map(([date, count]) => ({ date, count }))
}

/**
 * Registra um "acesso" no máximo uma vez por dia por usuário.
 * Garante que o heatmap marque os dias em que o usuário entrou no app.
 */
export async function markDailyAccess(actor: Profile | null) {
  if (!actor) return
  try {
    const supabase = await createClient()
    const today = new Date().toISOString().slice(0, 10)
    const { data } = await supabase
      .from("activity_log")
      .select("id")
      .eq("actor_id", actor.id)
      .eq("action", "acesso")
      .gte("created_at", today + "T00:00:00.000Z")
      .limit(1)
    if ((data ?? []).length > 0) return
    await supabase.from("activity_log").insert({
      actor_id: actor.id,
      actor_name: actor.full_name || actor.username,
      owner_id: actor.id,
      action: "acesso",
      summary: "Acessou o app",
      meta: {},
    })
  } catch {
    // silencioso
  }
}
