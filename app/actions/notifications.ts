"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

/** Salva as configurações de notificação do usuário (objeto aninhado em prefs). */
export async function saveNotifSettings(settings: {
  enabled?: boolean
  task_reminders?: boolean
  default_lead?: number
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Sessão expirada." }
  const { data } = await supabase.from("profiles").select("prefs").eq("id", user.id).maybeSingle()
  const prefs = (data?.prefs ?? {}) as Record<string, unknown>
  const current = (prefs.notif_settings as Record<string, unknown>) ?? {}
  await supabase
    .from("profiles")
    .update({ prefs: { ...prefs, notif_settings: { ...current, ...settings } } })
    .eq("id", user.id)
  revalidatePath("/perfil")
  revalidatePath("/organizacao/tarefas")
  return { ok: true }
}
