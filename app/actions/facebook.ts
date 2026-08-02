"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getCurrentProfile } from "@/lib/data"

const APP_ID = process.env.FACEBOOK_APP_ID || process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || "1581224863381354"
const APP_SECRET = process.env.FACEBOOK_APP_SECRET || "b2b007d2d11812035b77bc615f02f786"
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://bandodash.vercel.app"

function getRedirectUri() {
  const base = process.env.NODE_ENV === "production" ? "https://bandodash.vercel.app" : "http://localhost:3000"
  return `${base}/api/auth/facebook/callback`
}

/**
 * Gera a URL oficial de conexão OAuth do Facebook Ads (Login do Facebook para Empresas).
 */
export async function getFacebookConnectUrl(projectId: string) {
  const redirectUri = getRedirectUri()
  const scope = "ads_read,read_insights,public_profile"
  const url = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${APP_ID}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&state=${projectId}&scope=${scope}`
  return { url }
}

/**
 * Salva manualmente um Token de Acesso da Meta ou ID da Conta de Anúncios.
 */
export async function saveFacebookCredentials(projectId: string, token: string, adAccountId?: string) {
  const supabase = await createClient()
  const me = await getCurrentProfile()
  if (!me) return { error: "Sessão expirada." }

  const { data: proj } = await supabase.from("projects").select("id, name").eq("id", projectId).maybeSingle()
  if (!proj) return { error: "Projeto não encontrado." }

  // Salva os dados de conexão Meta nos metadados do projeto (prefs) ou tabela
  const { data } = await supabase.from("projects").select("meta_token, meta_ad_account_id").eq("id", projectId).maybeSingle()

  const updatePayload: Record<string, any> = {}
  if (token) updatePayload.meta_token = token.trim()
  if (adAccountId) updatePayload.meta_ad_account_id = adAccountId.trim()

  const { error } = await supabase.from("projects").update(updatePayload).eq("id", projectId)
  if (error) return { error: error.message }

  revalidatePath(`/projetos/${projectId}`)
  return { ok: true }
}

/**
 * Sincroniza em tempo real os gastos e métricas do Facebook Ads via Meta Graph API.
 */
export async function syncFacebookAdMetrics(projectId: string) {
  try {
    const supabase = await createClient()
    const { data: proj } = await supabase
      .from("projects")
      .select("id, name, currency, meta_token, meta_ad_account_id")
      .eq("id", projectId)
      .maybeSingle()

    if (!proj || !proj.meta_token || !proj.meta_ad_account_id) {
      return { error: "Conta do Facebook Ads não conectada neste projeto." }
    }

    const cleanActId = proj.meta_ad_account_id.replace(/^act_/i, "")
    const actId = `act_${cleanActId}`

    // Chamada oficial à Meta Graph API
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${actId}/insights?fields=spend,impressions,clicks,cpc,cpm,ctr&date_preset=today&access_token=${proj.meta_token}`
    )

    if (!res.ok) {
      const errData = await res.json()
      console.error("Meta Graph API error:", errData)
      return { error: errData?.error?.message || "Falha ao consultar a API do Facebook Ads." }
    }

    const data = await res.json()
    const insight = data.data?.[0]
    const spend = insight ? parseFloat(insight.spend) || 0 : 0
    const todayStr = new Date().toISOString().slice(0, 10)

    // Insere ou atualiza o gasto com anúncios em daily_metrics
    const { error: upsertErr } = await supabase.from("daily_metrics").upsert(
      {
        project_id: projectId,
        date: todayStr,
        spend
      },
      { onConflict: "project_id,date" }
    )

    if (upsertErr) return { error: upsertErr.message }

    revalidatePath(`/projetos/${projectId}`)
    return { ok: true, spend, insight }
  } catch (err: any) {
    console.error("Sync Facebook error:", err)
    return { error: err?.message || "Erro de rede ao conectar com a Meta." }
  }
}
