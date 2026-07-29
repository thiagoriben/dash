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
