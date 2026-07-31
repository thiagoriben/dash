"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { Profile, Project } from "@/lib/types"
import type { ProjectMemberWithProfile, JoinRequestView, FriendView } from "@/lib/data"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Field,
  Input,
  Select,
  Table,
  Th,
  Td,
  Badge,
} from "@/components/ui"
import { Modal } from "@/components/modal"
import { addProjectMember, removeProjectMember, leaveProject } from "@/app/actions/projects"
import { respondJoinRequest, inviteFriendToProject } from "@/app/actions/social"
import { Plus, Trash2, Crown, Users, Copy, Check, UserCheck, Inbox, UserPlus, LogOut } from "lucide-react"

export function TabMembers({
  project,
  members,
  owner,
  isOwner,
  joinRequests = [],
  friends = [],
  meId,
}: {
  project: Project
  members: ProjectMemberWithProfile[]
  owner: Profile | null
  isOwner: boolean
  joinRequests?: JoinRequestView[]
  friends?: FriendView[]
  meId?: string
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string>()
  const [copied, setCopied] = useState(false)
  const [invitedIds, setInvitedIds] = useState<string[]>([])
  const [inviteError, setInviteError] = useState<string>()
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [leaveError, setLeaveError] = useState<string>()
  const router = useRouter()

  // Sócio (colaborador que não é dono) pode sair do projeto.
  const isMember = !isOwner && !!meId && members.some((m) => m.user_id === meId)

  function leave() {
    setLeaveError(undefined)
    startTransition(async () => {
      const res = await leaveProject(project.id)
      if (res?.error) setLeaveError(res.error)
      else router.push("/projetos")
    })
  }

  // Amigos que ainda não participam do projeto (nem dono, nem membro).
  const memberIds = new Set([project.owner_id, ...members.map((m) => m.user_id)])
  const invitableFriends = friends.filter((f) => !memberIds.has(f.profile.id))

  function invite(friendId: string) {
    setInviteError(undefined)
    startTransition(async () => {
      const res = await inviteFriendToProject(project.id, friendId)
      if (res?.error) setInviteError(res.error)
      else {
        setInvitedIds((prev) => [...prev, friendId])
        router.refresh()
      }
    })
  }

  function copyId() {
    navigator.clipboard?.writeText(project.id)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function resolveJoin(id: string, accept: boolean) {
    startTransition(async () => {
      await respondJoinRequest(id, accept)
      router.refresh()
    })
  }

  function onSubmit(formData: FormData) {
    setError(undefined)
    startTransition(async () => {
      const res = await addProjectMember(project.id, formData)
      if (res?.error) setError(res.error)
      else {
        setOpen(false)
        router.refresh()
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Colaboradores</h2>
          <p className="text-sm text-muted">
            Quem pode ver e editar este projeto. Colaboradores enxergam o projeto no painel deles.
          </p>
        </div>
        {isOwner ? (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus size={16} /> Adicionar
          </Button>
        ) : null}
      </div>

      {/* ID do projeto para convidar por entrada */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted">ID do projeto (compartilhe para receberem pedido de entrada)</p>
            <p className="truncate font-mono text-sm">{project.id}</p>
          </div>
          <Button size="sm" variant="outline" onClick={copyId}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copiado" : "Copiar ID"}
          </Button>
        </CardContent>
      </Card>

      {/* Convidar amigos direto para o projeto */}
      {isOwner && invitableFriends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus size={16} className="text-primary" /> Convidar amigos
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <p className="text-sm text-muted">
              Convide um amigo direto para este projeto. Ele recebe uma notificação e vira sócio ao aceitar.
            </p>
            {invitableFriends.map((f) => {
              const invited = invitedIds.includes(f.profile.id)
              return (
                <div
                  key={f.profile.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[color:var(--color-border)] p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{f.profile.full_name || f.profile.username}</p>
                    <p className="truncate text-xs text-muted">@{f.profile.username}</p>
                  </div>
                  <Button size="sm" variant="outline" disabled={pending || invited} onClick={() => invite(f.profile.id)}>
                    {invited ? (
                      <>
                        <Check size={14} /> Convidado
                      </>
                    ) : (
                      <>
                        <UserPlus size={14} /> Convidar
                      </>
                    )}
                  </Button>
                </div>
              )
            })}
            {inviteError ? <p className="text-sm text-negative">{inviteError}</p> : null}
          </CardContent>
        </Card>
      )}

      {/* Pedidos de entrada pendentes (só dono aprova) */}
      {isOwner && joinRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Inbox size={16} className="text-warning" />
              Pedidos de entrada
              <Badge tone="warning">{joinRequests.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {joinRequests.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-[color:var(--color-border)] p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {r.profile?.full_name || r.profile?.username || r.user_id}
                  </p>
                  {r.message ? <p className="truncate text-xs text-muted">{r.message}</p> : null}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => resolveJoin(r.id, true)} disabled={pending}>
                    <UserCheck size={14} /> Aceitar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => resolveJoin(r.id, false)} disabled={pending}>
                    Recusar
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users size={16} className="text-primary" />
            Equipe do projeto
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <thead>
              <tr>
                <Th>Usuário</Th>
                <Th>Papel</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              <tr>
                <Td>
                  <span className="flex items-center gap-2">
                    <Crown size={14} className="text-warning" />
                    {owner?.full_name || owner?.username || "—"}
                  </span>
                </Td>
                <Td>
                  <Badge tone="warning">Dono</Badge>
                </Td>
                <Td />
              </tr>
              {members.length === 0 ? (
                <tr>
                  <Td colSpan={3} className="py-8 text-center text-muted">
                    Nenhum colaborador ainda.
                  </Td>
                </tr>
              ) : (
                members.map((m) => (
                  <tr key={m.id}>
                    <Td>{m.profile?.full_name || m.profile?.username || m.user_id}</Td>
                    <Td>
                      <Badge tone="secondary">{m.role}</Badge>
                    </Td>
                    <Td className="text-right">
                      {isOwner ? (
                        <button
                          onClick={() =>
                            startTransition(async () => {
                              await removeProjectMember(project.id, m.id)
                              router.refresh()
                            })
                          }
                          className="text-muted transition-colors hover:text-negative"
                          aria-label="Remover colaborador"
                        >
                          <Trash2 size={16} />
                        </button>
                      ) : null}
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </CardContent>
      </Card>

      {/* Sócio pode sair do projeto por conta própria */}
      {isMember && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-negative">
              <LogOut size={16} /> Sair do projeto
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              Você deixa de ser sócio e perde o acesso a este projeto. Pode voltar a pedir entrada depois.
            </p>
            <Button size="sm" variant="outline" onClick={() => setLeaveOpen(true)} disabled={pending}>
              <LogOut size={14} /> Sair
            </Button>
          </CardContent>
        </Card>
      )}

      <Modal open={leaveOpen} onClose={() => setLeaveOpen(false)} title="Sair do projeto">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            Tem certeza que quer sair de <span className="font-medium text-foreground">{project.name}</span>? Você perde o
            acesso imediatamente.
          </p>
          {leaveError ? <p className="text-sm text-negative">{leaveError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => setLeaveOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="danger" onClick={leave} disabled={pending}>
              {pending ? "Saindo..." : "Sair do projeto"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={open} onClose={() => setOpen(false)} title="Adicionar colaborador">
        <form action={onSubmit} className="flex flex-col gap-4">
          <Field label="Usuário">
            <Input name="username" placeholder="ex: joao" required autoComplete="off" />
          </Field>
          <Field label="Papel">
            <Select name="role" defaultValue="editor">
              <option value="editor">Editor</option>
              <option value="viewer">Visualizador</option>
            </Select>
          </Field>
          <p className="text-xs text-muted">
            Informe o nome de usuário exato de quem já tem conta na plataforma.
          </p>
          {error ? <p className="text-sm text-negative">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Adicionando..." : "Adicionar"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
