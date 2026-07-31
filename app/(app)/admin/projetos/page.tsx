import { redirect } from "next/navigation"
import Link from "next/link"
import { getCurrentProfile, getAllProjects, getProfiles } from "@/lib/data"
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui"
import { FolderKanban } from "lucide-react"

export const metadata = { title: "Todos os projetos | Dash" }

export default async function AdminProjetosPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect("/login")
  if (profile.role !== "admin") redirect("/")

  const [projects, profiles] = await Promise.all([getAllProjects(profile), getProfiles()])
  const ownerName = new Map(profiles.map((p) => [p.id, p.full_name || p.username]))

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-semibold">Todos os projetos</h1>
        <p className="text-sm text-muted">
          Visão global de administrador — todos os projetos de todos os usuários. Usuários comuns
          só veem os próprios projetos e aqueles em que são sócios.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderKanban size={16} className="text-primary" /> {projects.length} projeto(s)
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {projects.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">Nenhum projeto cadastrado.</p>
          ) : (
            projects.map((p) => (
              <Link
                key={p.id}
                href={`/projetos/${p.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-[color:var(--color-border)] p-3 transition-colors hover:bg-white/5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                  <p className="truncate text-xs text-muted">
                    Dono: {ownerName.get(p.owner_id) ?? "—"} · {p.region?.toUpperCase()} ·{" "}
                    {p.currency?.toUpperCase()}
                  </p>
                </div>
                <Badge tone={p.status === "ativo" ? "positive" : "secondary"}>{p.status}</Badge>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
