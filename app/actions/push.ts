"use server"

import { createClient } from "@/lib/supabase/server"
import { getCurrentProfile } from "@/lib/data"

export type PushSubscriptionPayload = {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

/**
 * Salva ou atualiza a inscrição Web Push VAPID do dispositivo do usuário nas suas preferências.
 */
export async function savePushSubscription(sub: PushSubscriptionPayload) {
  if (!sub || !sub.endpoint) return { error: "Inscrição inválida." }

  const supabase = await createClient()
  const me = await getCurrentProfile()
  if (!me) return { error: "Sessão expirada." }

  const { data } = await supabase.from("profiles").select("prefs").eq("id", me.id).maybeSingle()
  const prefs = (data?.prefs ?? {}) as Record<string, unknown>
  const currentSubs = (prefs.push_subscriptions as PushSubscriptionPayload[]) ?? []

  // Evita duplicados pela URL do endpoint
  const filtered = currentSubs.filter((s) => s.endpoint !== sub.endpoint)
  const updatedSubs = [...filtered, sub]

  const { error } = await supabase
    .from("profiles")
    .update({ prefs: { ...prefs, push_subscriptions: updatedSubs } })
    .eq("id", me.id)

  if (error) return { error: error.message }
  return { ok: true }
}
