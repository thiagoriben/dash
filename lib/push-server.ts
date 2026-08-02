import webpush from "web-push"
import { createClient } from "@/lib/supabase/server"

const VAPID_PUBLIC_KEY =
  process.env.VAPID_PUBLIC_KEY ||
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  "BLnF17klfFXsfCmayro8yc8HI7xbtZ_iQwi565pIC8WN1-p9-kJ200UrqFR4YUUx83rirg4E2-AeEsQsAUnBFJs"

const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY ||
  "uogiZO9FeL7LAZ-jvPdf79vi54LvmdCIW1zuz_PPlyY"

webpush.setVapidDetails(
  "mailto:suporte@bandodash.com",
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
)

/**
 * Envia uma notificação Web Push VAPID em segundo plano para todos os dispositivos inscritos do usuário.
 */
export async function sendWebPushNotification(
  userId: string,
  payloadData: { title: string; body: string; url?: string; tag?: string }
) {
  const supabase = await createClient()
  const { data } = await supabase.from("profiles").select("prefs").eq("id", userId).maybeSingle()

  const prefs = (data?.prefs ?? {}) as Record<string, unknown>
  const subscriptions = (prefs.push_subscriptions as any[]) ?? []

  if (subscriptions.length === 0) return { sent: 0 }

  const payload = JSON.stringify({
    title: payloadData.title,
    body: payloadData.body,
    url: payloadData.url || "/organizacao/tarefas",
    tag: payloadData.tag
  })

  let count = 0
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(sub, payload)
      count++
    } catch (err: any) {
      console.warn("Error sending Web Push notification:", err?.statusCode || err?.message)
    }
  }

  return { sent: count }
}
