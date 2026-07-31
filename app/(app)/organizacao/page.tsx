import { redirect } from "next/navigation"
import { getCurrentProfile, getShortcutCategories, getShortcuts, getNotes, getTodos } from "@/lib/data"
import { OrganizacaoClient } from "@/components/organizacao-client"

export const metadata = { title: "Organização | Dash" }

export default async function OrganizacaoPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect("/login")
  const [categories, shortcuts, notes, todos] = await Promise.all([
    getShortcutCategories(profile.id, null),
    getShortcuts(profile.id, null),
    getNotes(profile.id, null),
    getTodos(profile.id, null),
  ])
  return (
    <OrganizacaoClient
      projectId={null}
      categories={categories}
      shortcuts={shortcuts}
      notes={notes}
      todos={todos}
    />
  )
}
