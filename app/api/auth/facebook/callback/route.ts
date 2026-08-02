import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

const APP_ID = process.env.FACEBOOK_APP_ID || process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || "1581224863381354"
const APP_SECRET = process.env.FACEBOOK_APP_SECRET || "b2b007d2d11812035b77bc615f02f786"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const projectId = searchParams.get("state")
  const userError = searchParams.get("error") || searchParams.get("error_reason")

  const host = request.headers.get("host") || "bandodash.vercel.app"
  const protocol = host.includes("localhost") ? "http" : "https"
  const redirectUri = `${protocol}://${host}/api/auth/facebook/callback`

  if (userError || !code || !projectId) {
    const targetPath = projectId ? `/projetos/${projectId}?facebook=cancelled` : `/projetos?facebook=cancelled`
    return NextResponse.redirect(`${protocol}://${host}${targetPath}`)
  }

  try {
    // 1. Troca o código pelo Token de Acesso de Curto Prazo
    const tokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${APP_ID}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&client_secret=${APP_SECRET}&code=${code}`

    const tokenRes = await fetch(tokenUrl)

    if (!tokenRes.ok) {
      const errJson = await tokenRes.json()
      console.error("Facebook token exchange error:", errJson)
      return NextResponse.redirect(`${protocol}://${host}/projetos/${projectId}?error=facebook_token_failed`)
    }

    const tokenData = await tokenRes.json()
    const shortToken = tokenData.access_token

    // 2. Converte para Token de Longa Duração (60 dias)
    const longTokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${shortToken}`
    const longTokenRes = await fetch(longTokenUrl)

    let finalToken = shortToken
    if (longTokenRes.ok) {
      const longTokenData = await longTokenRes.json()
      if (longTokenData.access_token) finalToken = longTokenData.access_token
    }

    // 3. Busca as Contas de Anúncios ativas do usuário na Meta
    const adAccountsRes = await fetch(
      `https://graph.facebook.com/v19.0/me/adaccounts?fields=id,name,account_status,currency&access_token=${finalToken}`
    )

    let defaultAdAccountId = null
    if (adAccountsRes.ok) {
      const accountsData = await adAccountsRes.json()
      if (accountsData.data && accountsData.data.length > 0) {
        defaultAdAccountId = accountsData.data[0].id
      }
    }

    // 4. Salva no banco de dados usando Admin Client com bypass RLS
    const supabase = createAdminClient()
    await supabase
      .from("projects")
      .update({
        meta_token: finalToken,
        meta_ad_account_id: defaultAdAccountId
      })
      .eq("id", projectId)

    // 5. Tenta sincronizar gastos imediatamente
    if (defaultAdAccountId) {
      try {
        const cleanActId = defaultAdAccountId.replace(/^act_/i, "")
        const insightsRes = await fetch(
          `https://graph.facebook.com/v19.0/act_${cleanActId}/insights?fields=spend&date_preset=today&access_token=${finalToken}`
        )
        if (insightsRes.ok) {
          const insightsData = await insightsRes.json()
          const spend = insightsData.data?.[0]?.spend ? parseFloat(insightsData.data[0].spend) : 0
          const todayStr = new Date().toISOString().slice(0, 10)
          await supabase.from("daily_metrics").upsert(
            {
              project_id: projectId,
              date: todayStr,
              spend
            },
            { onConflict: "project_id,date" }
          )
        }
      } catch (syncErr) {
        console.warn("Initial sync error:", syncErr)
      }
    }

    return NextResponse.redirect(`${protocol}://${host}/projetos/${projectId}?tab=contas&facebook=connected`)
  } catch (err: any) {
    console.error("Facebook callback error:", err)
    return NextResponse.redirect(`${protocol}://${host}/projetos/${projectId}?error=facebook_internal_error`)
  }
}
