import { redirect } from "next/navigation"
import { getCurrentProfile, getProfiles } from "@/lib/data"
import { UsersClient } from "@/components/users-client"

export const metadata = { title: "Usuários | Dash" }

export default async function UsuariosPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect("/login")
  if (profile.role !== "admin") redirect("/")

  const profiles = await getProfiles()
  return <UsersClient profiles={profiles} currentUserId={profile.id} />
}
