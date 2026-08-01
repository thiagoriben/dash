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
import { WorkspaceTabs, type WorkspaceTab } from "@/components/workspace-tabs"

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

  const openCount = (list: typeof todos) => list.filter((t) => !t.done && !t.archived).length

  const tabs: WorkspaceTab[] = [
    {
      key: "pessoal",
      label: "Pessoal",
      kind: "pessoal",
      count: openCount(todos),
      content: (
        <OrganizacaoClient
          projectId={null}
          only="tarefas"
          embedded
          categories={categories}
          shortcuts={[]}
          notes={[]}
          todos={todos}
          reminders={reminders}
          notifEnabled={notifEnabled}
          projectOptions={projectOptions}
        />
      ),
    },
    ...projects.map((p) => {
      const list = projectTodos.filter((t) => t.project_id === p.id)
      return {
        key: p.id,
        label: p.name,
        kind: "projeto" as const,
        count: openCount(list),
        content: (
          <TodoBoard
            projectId={p.id}
            todos={list}
            members={membersByProject[p.id] ?? []}
            reminders={reminders}
            notifEnabled={notifEnabled}
            projectOptions={projectOptions}
          />
        ),
      }
    }),
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold text-foreground">Tarefas</h1>
        <p className="text-sm text-muted">
          Alterne entre suas tarefas pessoais e as de cada projeto. Atribua uma tarefa a um projeto pelo botão de
          editar.
        </p>
      </div>
      <WorkspaceTabs tabs={tabs} />
    </div>
  )
}
