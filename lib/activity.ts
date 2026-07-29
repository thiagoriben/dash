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

/** "há 3 min", "há 2 h", "há 5 dias" — relativo ao agora. */
export function timeAgo(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime())
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return "agora mesmo"
  const min = Math.floor(sec / 60)
  if (min < 60) return `há ${min} min`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `há ${hour} h`
  const day = Math.floor(hour / 24)
  if (day < 30) return `há ${day} ${day === 1 ? "dia" : "dias"}`
  const month = Math.floor(day / 30)
  if (month < 12) return `há ${month} ${month === 1 ? "mês" : "meses"}`
  const year = Math.floor(month / 12)
  return `há ${year} ${year === 1 ? "ano" : "anos"}`
}

/** Rótulo curto em português para a ação registrada. */
export function actionLabel(action: string): string {
  switch (action) {
    case "create":
      return "criou"
    case "update":
      return "editou"
    case "delete":
      return "excluiu"
    default:
      return action
  }
}
