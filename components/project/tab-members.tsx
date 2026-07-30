"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { Profile, Project } from "@/lib/types"
import type { ProjectMemberWithProfile, JoinRequestView } from "@/lib/data"
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
import { addProjectMember, removeProjectMember } from "@/app/actions/projects"
import { respondJoinRequest } from "@/app/actions/social"
import { Plus, Trash2, Crown, Users, Copy, Check, UserCheck, Inbox } from "lucide-react"

export function TabMembers({
  project,
  members,
  owner,
  isOwner,
  joinRequests = [],
}: {
  project: Project
  members: ProjectMemberWithProfile[]
  owner: Profile | null
  isOwner: boolean
  joinRequests?: JoinRequestView[]
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string>()
  const [copied, setCopied] = useState(false)
  const router = useRouter()

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
