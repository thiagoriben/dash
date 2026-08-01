import { redirect } from "next/navigation"
import { getCurrentProfile, getShortcutCategories, getTodos } from "@/lib/data"
import { OrganizacaoClient } from "@/components/organizacao-client"

export const metadata = { title: "Tarefas | Dash" }

export default async function TarefasPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect("/login")
  const [categories, todos] = await Promise.all([
    getShortcutCategories(profile.id, null),
    getTodos(profile.id, null),
  ])
  const prefs = profile.prefs ?? {}
  const reminders = prefs.task_reminders ?? {}
  const notifEnabled = prefs.notif_settings?.task_reminders !== false
  return (
    <OrganizacaoClient
      projectId={null}
      only="tarefas"
      title="Tarefas"
      description="Organize suas tarefas por áreas e filtre por prazo."
      categories={categories}
      shortcuts={[]}
      notes={[]}
      todos={todos}
      reminders={reminders}
      notifEnabled={notifEnabled}
    />
  )
}
