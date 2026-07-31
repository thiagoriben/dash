import { redirect } from "next/navigation"
import { getCurrentProfile, getShortcutCategories, getNotes, getFriends } from "@/lib/data"
import { OrganizacaoClient } from "@/components/organizacao-client"

export const metadata = { title: "Notas | Dash" }

export default async function NotasPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect("/login")
  const [categories, notes, friendData] = await Promise.all([
    getShortcutCategories(profile.id, null),
    getNotes(profile.id, null),
    getFriends(profile.id),
  ])
  const friends = friendData.friends.map((f) => ({
    id: f.profile.id,
    name: f.profile.full_name || f.profile.username || "Amigo",
  }))
  return (
    <OrganizacaoClient
      projectId={null}
      only="notas"
      title="Notas"
      description="Suas anotações pessoais e compartilhadas, organizadas por categoria."
      categories={categories}
      shortcuts={[]}
      notes={notes}
      friends={friends}
      meId={profile.id}
    />
  )
}
