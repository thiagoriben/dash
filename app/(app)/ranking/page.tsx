import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCurrentProfile } from "@/lib/data"
import { getMonthlyRevenueRanking } from "@/lib/ranking"
import { RankingClient } from "@/components/ranking-client"

export const dynamic = "force-dynamic"
export const metadata = { title: "Ranking | Dash" }

export default async function RankingPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect("/login")

  // Sócios (amizades aceitas) para o ranking restrito.
  const supabase = await createClient()
  const { data: friends } = await supabase
    .from("friendships")
    .select("requester_id, addressee_id, status")
    .eq("status", "accepted")
    .or(`requester_id.eq.${profile.id},addressee_id.eq.${profile.id}`)

  const partnerIds = (friends ?? []).map((f) =>
    f.requester_id === profile.id ? f.addressee_id : f.requester_id,
  )

  const [geral, socios] = await Promise.all([
    getMonthlyRevenueRanking(profile.id),
    getMonthlyRevenueRanking(profile.id, partnerIds),
  ])

  const optedIn = profile.prefs?.ranking_opt_in === true

  return <RankingClient geral={geral} socios={socios} optedIn={optedIn} />
}
