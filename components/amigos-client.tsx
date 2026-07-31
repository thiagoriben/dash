"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import type { FriendView, JoinRequestView, ProjectInvitationView } from "@/lib/data"
import { Card, CardContent, CardHeader, CardTitle, Button, Field, Input, Badge } from "@/components/ui"
import {
  UserPlus,
  Check,
  X,
  Users,
  Clock,
  FolderInput,
  Trash2,
  MessageSquare,
  UserCircle,
  Mail,
} from "lucide-react"
import {
  sendFriendRequest,
  respondFriendRequest,
  removeFriend,
  requestJoinProject,
  respondProjectInvitation,
} from "@/app/actions/social"

function initials(s?: string | null) {
  return (s ?? "?").slice(0, 2).toUpperCase()
}

export function AmigosClient({
  friends,
  incoming,
  outgoing,
  joinRequests,
  projectInvites = [],
}: {
  friends: FriendView[]
  incoming: FriendView[]
  outgoing: FriendView[]
  joinRequests: JoinRequestView[]
  projectInvites?: ProjectInvitationView[]
}) {
  const [pending, startTransition] = useTransition()
  const [friendError, setFriendError] = useState<string>()
  const [friendMsg, setFriendMsg] = useState<string>()
  const [joinError, setJoinError] = useState<string>()
  const [joinMsg, setJoinMsg] = useState<string>()
  const router = useRouter()

  function onAddFriend(formData: FormData) {
    setFriendError(undefined)
    setFriendMsg(undefined)
    startTransition(async () => {
      const res = await sendFriendRequest(formData)
      if (res?.error) setFriendError(res.error)
      else {
        setFriendMsg(res.accepted ? "Pedido aceito — vocês já são sócios!" : "Pedido enviado.")
        router.refresh()
      }
    })
  }

  function onJoin(formData: FormData) {
    setJoinError(undefined)
    setJoinMsg(undefined)
    startTransition(async () => {
      const res = await requestJoinProject(formData)
      if (res?.error) setJoinError(res.error)
      else {
        setJoinMsg(`Pedido enviado${res.projectName ? ` para "${res.projectName}"` : ""}. Aguarde aprovação.`)
        router.refresh()
      }
    })
  }

  function respond(id: string, accept: boolean) {
    startTransition(async () => {
      await respondFriendRequest(id, accept)
      router.refresh()
    })
  }

  function unfriend(id: string) {
    startTransition(async () => {
      await removeFriend(id)
      router.refresh()
    })
  }

  function respondInvite(id: string, accept: boolean) {
    startTransition(async () => {
      await respondProjectInvitation(id, accept)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-semibold">Sócios & Sociedades</h1>
        <p className="text-sm text-muted">
          Convide sócios por nome de usuário (o pedido precisa ser aceito) ou peça para entrar num projeto com o ID dele.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Adicionar amigo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus size={16} className="text-primary" /> Convidar sócio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form action={onAddFriend} className="flex items-end gap-2">
              <Field label="Nome de usuário" className="flex-1">
                <Input name="username" placeholder="ex: joao" autoComplete="off" required />
              </Field>
              <Button type="submit" disabled={pending}>
                Enviar
              </Button>
            </form>
            {friendError && <p className="mt-2 text-sm text-negative">{friendError}</p>}
            {friendMsg && <p className="mt-2 text-sm text-positive">{friendMsg}</p>}
          </CardContent>
        </Card>

        {/* Entrar em projeto por ID */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderInput size={16} className="text-primary" /> Entrar num projeto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form action={onJoin} className="flex items-end gap-2">
              <Field label="ID do projeto" className="flex-1">
                <Input name="project_id" placeholder="cole o ID do projeto" autoComplete="off" required />
              </Field>
              <Button type="submit" disabled={pending}>
                Pedir
              </Button>
            </form>
            {joinError && <p className="mt-2 text-sm text-negative">{joinError}</p>}
            {joinMsg && <p className="mt-2 text-sm text-positive">{joinMsg}</p>}
          </CardContent>
        </Card>
      </div>

      {/* Pedidos de amizade recebidos */}
      {incoming.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock size={16} className="text-warning" /> Pedidos recebidos
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {incoming.map((f) => (
              <div key={f.friendshipId} className="flex items-center justify-between gap-3 rounded-lg border border-[color:var(--color-border)] p-3">
                <PersonRow name={f.profile.full_name || f.profile.username} sub={`@${f.profile.username}`} />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => respond(f.friendshipId, true)} disabled={pending}>
                    <Check size={14} /> Aceitar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => respond(f.friendshipId, false)} disabled={pending}>
                    <X size={14} /> Recusar
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Convites para projetos (recebidos de amigos) */}
      {projectInvites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail size={16} className="text-primary" /> Convites para projetos
              <Badge tone="secondary">{projectInvites.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {projectInvites.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-3 rounded-lg border border-[color:var(--color-border)] p-3">
                <div className="flex items-center gap-2 text-sm">
                  <FolderInput size={15} className="text-muted" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{inv.projectName ?? "Projeto"}</p>
                    <p className="truncate text-xs text-muted">
                      Convite de {inv.inviter?.full_name || inv.inviter?.username || "um sócio"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => respondInvite(inv.id, true)} disabled={pending}>
                    <Check size={14} /> Aceitar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => respondInvite(inv.id, false)} disabled={pending}>
                    <X size={14} /> Recusar
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Sócios */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users size={16} className="text-primary" /> Seus sócios
            <span className="text-sm font-normal text-muted">({friends.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {friends.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">Você ainda não tem sócios. Convide alguém pelo usuário.</p>
          ) : (
            friends.map((f) => (
              <div key={f.friendshipId} className="flex items-center justify-between gap-3 rounded-lg border border-[color:var(--color-border)] p-3">
                <PersonRow name={f.profile.full_name || f.profile.username} sub={`@${f.profile.username}`} />
                <div className="flex items-center gap-1.5">
                  <Link
                    href={`/chat?u=${f.profile.id}`}
                    className="flex items-center gap-1 rounded-lg border border-[color:var(--color-border)] px-2.5 py-1.5 text-xs text-muted transition-colors hover:text-foreground"
                  >
                    <MessageSquare size={14} /> Conversar
                  </Link>
                  {f.profile.is_public && (
                    <Link
                      href={`/u/${f.profile.username}`}
                      className="flex items-center gap-1 rounded-lg border border-[color:var(--color-border)] px-2.5 py-1.5 text-xs text-muted transition-colors hover:text-foreground"
                    >
                      <UserCircle size={14} /> Perfil
                    </Link>
                  )}
                  <button
                    onClick={() => unfriend(f.friendshipId)}
                    className="ml-1 text-muted transition-colors hover:text-negative"
                    aria-label="Desfazer sociedade"
                    disabled={pending}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Pedidos enviados */}
      {(outgoing.length > 0 || joinRequests.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock size={16} className="text-muted" /> Pedidos enviados
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {outgoing.map((f) => (
              <div key={f.friendshipId} className="flex items-center justify-between gap-3 rounded-lg border border-[color:var(--color-border)] p-3">
                <PersonRow name={f.profile.full_name || f.profile.username} sub={`@${f.profile.username}`} />
                <Badge tone="secondary">Sociedade pendente</Badge>
              </div>
            ))}
            {joinRequests.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-[color:var(--color-border)] p-3">
                <div className="flex items-center gap-2 text-sm">
                  <FolderInput size={15} className="text-muted" />
                  <span className="font-medium">{r.projectName ?? "Projeto"}</span>
                </div>
                <Badge tone={r.status === "accepted" ? "positive" : r.status === "rejected" ? "danger" : "secondary"}>
                  {r.status === "accepted" ? "Aprovado" : r.status === "rejected" ? "Recusado" : "Aguardando"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function PersonRow({ name, sub }: { name: string | null; sub: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary/15 font-mono text-sm font-semibold text-secondary">
        {initials(name ?? sub)}
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{name ?? sub}</div>
        <div className="truncate text-xs text-muted">{sub}</div>
      </div>
    </div>
  )
}
