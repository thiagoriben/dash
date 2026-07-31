import { redirect } from "next/navigation"
import { getCurrentProfile, getShortcutCategories, getNotes } from "@/lib/data"
import { OrganizacaoClient } from "@/components/organizacao-client"

export const metadata = { title: "Notas | Dash" }

export default async function NotasPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect("/login")
  const [categories, notes] = await Promise.all([
    getShortcutCategories(profile.id, null),
    getNotes(profile.id, null),
  ])
  return (
    <OrganizacaoClient
      projectId={null}
      only="notas"
      title="Notas"
      description="Suas anotações pessoais e compartilhadas, organizadas por categoria."
      categories={categories}
      shortcuts={[]}
      notes={notes}
    />
  )
}
