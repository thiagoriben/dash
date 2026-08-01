"use server"

import { createClient } from "@/lib/supabase/server"

type SubInput = {
  endpoint: string
  p256dh: string
  auth: string
  userAgent?: string
}

/** Salva (ou atualiza) a assinatura push do dispositivo atual do usuário logado. */
export async function savePushSubscription(sub: SubInput): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autenticado." }
  if (!sub?.endpoint || !sub?.p256dh || !sub?.auth) return { error: "Assinatura inválida." }

  // upsert por endpoint (único): reassinar o mesmo device não duplica.
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
      user_agent: sub.userAgent ?? null,
    },
    { onConflict: "endpoint" },
  )
  if (error) return { error: error.message }
  return { ok: true }
}

/** Remove a assinatura do dispositivo atual (ao desativar notificações). */
export async function removePushSubscription(endpoint: string): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autenticado." }
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", user.id)
  if (error) return { error: error.message }
  return { ok: true }
}
