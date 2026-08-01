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

  // Só mostra seções de projetos que têm notas.
  const sections = projects
    .map((p) => ({
      project: p,
      notes: projectNotes.filter((n) => n.project_id === p.id),
      categories: projectCats.filter((c) => c.project_id === p.id),
    }))
    .filter((s) => s.notes.length > 0)

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-1">
        <OrganizacaoClient
          projectId={null}
          only="notas"
          title="Notas"
          description="Suas anotações pessoais e compartilhadas. Atribua uma nota a um projeto pelo botão de editar."
          categories={categories}
          shortcuts={[]}
          notes={notes}
          friends={friends}
          meId={profile.id}
          projectOptions={projectOptions}
        />
      </section>

      {sections.length > 0 && (
        <section className="flex flex-col gap-5 border-t border-[color:var(--color-border)] pt-6">
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-xl font-semibold text-foreground">Notas de projetos</h2>
            <p className="text-sm text-muted">
              Notas dos projetos em que você participa. Qualquer membro pode ver e editar.
            </p>
          </div>
          {sections.map((s) => (
            <OrganizacaoClient
              key={s.project.id}
              projectId={s.project.id}
              only="notas"
              embedded
              title={s.project.name}
              categories={s.categories}
              shortcuts={[]}
              notes={s.notes}
              meId={profile.id}
              projectOptions={projectOptions}
            />
          ))}
        </section>
      )}
    </div>
  )
}
