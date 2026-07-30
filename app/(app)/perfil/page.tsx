import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCurrentProfile } from "@/lib/data"
import { PerfilClient } from "@/components/perfil-client"

export const dynamic = "force-dynamic"

export default async function PerfilPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect("/login")

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [ownedRes, collabRes, friendsRes] = await Promise.all([
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("owner_id", profile.id),
    supabase
      .from("project_members")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id),
    supabase
      .from("friendships")
      .select("id", { count: "exact", head: true })
      .eq("status", "accepted")
      .or(`requester_id.eq.${profile.id},addressee_id.eq.${profile.id}`),
  ])

  const stats = {
    owned: ownedRes.count ?? 0,
    collaborations: collabRes.count ?? 0,
    partners: friendsRes.count ?? 0,
    createdAt: profile.created_at,
    lastSignIn: user?.last_sign_in_at ?? null,
  }

  return <PerfilClient profile={profile} stats={stats} />
}
