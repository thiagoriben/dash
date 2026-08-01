import { redirect } from "next/navigation"
import {
  getCurrentProfile,
  getShortcutCategories,
  getTodos,
  getVisibleProjects,
  getTodosForProjects,
  getMembersForProjects,
} from "@/lib/data"
import { OrganizacaoClient } from "@/components/organizacao-client"
import { TodoBoard } from "@/components/todo-board"

export const metadata = { title: "Tarefas | Dash" }

export default async function TarefasPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect("/login")

  const [categories, todos, projects] = await Promise.all([
    getShortcutCategories(profile.id, null),
    getTodos(profile.id, null),
    getVisibleProjects(profile),
  ])

  const projectIds = projects.map((p) => p.id)
  const [projectTodos, membersByProject] = await Promise.all([
    getTodosForProjects(projectIds),
    getMembersForProjects(projectIds),
  ])

  const prefs = profile.prefs ?? {}
  const reminders = prefs.task_reminders ?? {}
  const notifEnabled = prefs.notif_settings?.task_reminders !== false
  const projectOptions = projects.map((p) => ({ id: p.id, name: p.name }))

  return (
    <div className="flex flex-col gap-8">
      <OrganizacaoClient
        projectId={null}
        only="tarefas"
        title="Tarefas"
        description="Organize suas tarefas pessoais. Atribua uma tarefa a um projeto pelo botão de editar."
        categories={categories}
        shortcuts={[]}
        notes={[]}
        todos={todos}
        reminders={reminders}
        notifEnabled={notifEnabled}
        projectOptions={projectOptions}
      />

      {projects.length > 0 && (
        <section className="flex flex-col gap-6 border-t border-[color:var(--color-border)] pt-6">
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-xl font-semibold text-foreground">Tarefas de projetos</h2>
            <p className="text-sm text-muted">
              Tarefas dos projetos em que você participa. Atribua a você ou aos sócios do projeto.
            </p>
          </div>
          {projects.map((p) => (
            <div key={p.id} className="flex flex-col gap-3">
              <h3 className="flex items-center gap-2 font-display text-base font-semibold text-primary">
                {p.name}
              </h3>
              <TodoBoard
                projectId={p.id}
                todos={projectTodos.filter((t) => t.project_id === p.id)}
                members={membersByProject[p.id] ?? []}
                reminders={reminders}
                notifEnabled={notifEnabled}
                projectOptions={projectOptions}
              />
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
