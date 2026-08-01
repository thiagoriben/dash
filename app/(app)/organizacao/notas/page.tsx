import { redirect } from "next/navigation"
import {
  getCurrentProfile,
  getShortcutCategories,
  getNotes,
  getFriends,
  getVisibleProjects,
  getNotesForProjects,
  getShortcutCategoriesForProjects,
} from "@/lib/data"
import { OrganizacaoClient } from "@/components/organizacao-client"
import { WorkspaceTabs, type WorkspaceTab } from "@/components/workspace-tabs"

export const metadata = { title: "Notas | Dash" }

export default async function NotasPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect("/login")

  const [categories, notes, friendData, projects] = await Promise.all([
    getShortcutCategories(profile.id, null),
    getNotes(profile.id, null),
    getFriends(profile.id),
    getVisibleProjects(profile),
  ])

  const projectIds = projects.map((p) => p.id)
  const [projectNotes, projectCats] = await Promise.all([
    getNotesForProjects(projectIds),
    getShortcutCategoriesForProjects(projectIds),
  ])

  const friends = friendData.friends.map((f) => ({
    id: f.profile.id,
    name: f.profile.full_name || f.profile.username || "Amigo",
  }))
  const projectOptions = projects.map((p) => ({ id: p.id, name: p.name }))

  const tabs: WorkspaceTab[] = [
    {
      key: "pessoal",
      label: "Pessoal",
      kind: "pessoal",
      count: notes.length,
      content: (
        <OrganizacaoClient
          projectId={null}
          only="notas"
          embedded
          categories={categories}
          shortcuts={[]}
          notes={notes}
          friends={friends}
          meId={profile.id}
          projectOptions={projectOptions}
        />
      ),
    },
    ...projects.map((p) => {
      const pNotes = projectNotes.filter((n) => n.project_id === p.id)
      return {
        key: p.id,
        label: p.name,
        kind: "projeto" as const,
        count: pNotes.length,
        content: (
          <OrganizacaoClient
            projectId={p.id}
            only="notas"
            embedded
            categories={projectCats.filter((c) => c.project_id === p.id)}
            shortcuts={[]}
            notes={pNotes}
            meId={profile.id}
            projectOptions={projectOptions}
          />
        ),
      }
    }),
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold text-foreground">Notas</h1>
        <p className="text-sm text-muted">
          Alterne entre suas notas pessoais e as de cada projeto. Atribua uma nota a um projeto pelo botão de editar.
        </p>
      </div>
      <WorkspaceTabs tabs={tabs} />
    </div>
  )
}
