import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { getCurrentProfile, getPublicProfileByUsername, getFriends } from "@/lib/data"
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui"
import { MessageSquare, UserCircle, ArrowLeft } from "lucide-react"

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params
  const me = await getCurrentProfile()
  if (!me) redirect("/login")

  const profile = await getPublicProfileByUsername(username, me.id)
  if (!profile) notFound()

  const { friends } = await getFriends(me.id)
  const isPartner = friends.some((f) => f.profile.id === profile.id)
  const isSelf = profile.id === me.id

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-4 md:p-6">
      <Link href="/socios" className="flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft size={16} /> Voltar
      </Link>

      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/15 font-mono text-2xl font-semibold text-primary">
            {profile.username.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold">
              {profile.full_name || profile.username}
            </h1>
            <p className="text-sm text-muted">@{profile.username}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={profile.role === "admin" ? "primary" : "default"}>{profile.role}</Badge>
            {isPartner && <Badge tone="primary">Sócio</Badge>}
          </div>
          {!isSelf && isPartner && (
            <Link
              href={`/chat?u=${profile.id}`}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-[color:var(--brand-fg)]"
            >
              <MessageSquare size={16} /> Conversar
            </Link>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCircle size={16} className="text-primary" /> Sobre
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted">
          {isPartner
            ? "Vocês são sócios. Podem conversar e compartilhar projetos."
            : "Envie um pedido de sociedade na página de Sócios para poder conversar."}
        </CardContent>
      </Card>
    </div>
  )
}
