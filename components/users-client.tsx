"use client"

import { useActionState, useState, useTransition } from "react"
import { Card, Button, Input, Select, Badge } from "@/components/ui"
import { Modal } from "@/components/modal"
import { createUser, updateUserRole, deleteUser } from "@/app/actions/users"
import type { Profile } from "@/lib/types"
import { fmtDate } from "@/lib/finance"
import { UserPlus, Trash2 } from "lucide-react"

export function UsersClient({
  profiles,
  currentUserId,
}: {
  profiles: Profile[]
  currentUserId: string
}) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(createUser, undefined)
  const [, startTransition] = useTransition()

  // fecha o modal ao criar com sucesso
  if (state?.ok && open) setOpen(false)

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Usuários</h1>
          <p className="text-sm text-muted">
            Crie contas de acesso por usuário e senha e defina permissões.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <UserPlus className="size-4" /> Novo usuário
        </Button>
      </header>

      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">Usuário</th>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Telefone</th>
              <th className="px-4 py-3 font-medium">Papel</th>
              <th className="px-4 py-3 font-medium">Criado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id} className="border-b border-border/50 last:border-0">
                <td className="px-4 py-3 font-mono">{p.username}</td>
                <td className="px-4 py-3">{p.full_name ?? "—"}</td>
                <td className="px-4 py-3">{p.phone ?? "—"}</td>
                <td className="px-4 py-3">
                  <RoleSelect
                    userId={p.id}
                    role={p.role}
                    disabled={p.id === currentUserId}
                    startTransition={startTransition}
                  />
                </td>
                <td className="px-4 py-3 text-muted">{fmtDate(p.created_at)}</td>
                <td className="px-4 py-3 text-right">
                  {p.id !== currentUserId ? (
                    <button
                      className="text-muted transition-colors hover:text-danger"
                      aria-label={`Remover ${p.username}`}
                      onClick={() => {
                        if (confirm(`Remover o usuário ${p.username}?`))
                          startTransition(() => deleteUser(p.id))
                      }}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  ) : (
                    <Badge tone="primary">você</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Novo usuário">
        <form action={formAction} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="mb-1 block text-muted">Usuário</span>
              <Input name="username" placeholder="joao" required />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted">Senha</span>
              <Input name="password" type="password" placeholder="mínimo 6" required />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted">Nome completo</span>
              <Input name="full_name" placeholder="João Silva" />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted">Telefone</span>
              <Input name="phone" placeholder="(11) 90000-0000" />
            </label>
            <label className="col-span-2 block text-sm">
              <span className="mb-1 block text-muted">Papel</span>
              <Select name="role" defaultValue="member">
                <option value="member">Membro</option>
                <option value="admin">Administrador</option>
              </Select>
            </label>
          </div>
          {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Criando..." : "Criar usuário"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

function RoleSelect({
  userId,
  role,
  disabled,
  startTransition,
}: {
  userId: string
  role: string
  disabled: boolean
  startTransition: (cb: () => void) => void
}) {
  return (
    <Select
      className="h-8 w-36 py-0 text-xs"
      defaultValue={role}
      disabled={disabled}
      onChange={(e) => {
        const v = e.target.value
        startTransition(() => updateUserRole(userId, v))
      }}
    >
      <option value="member">Membro</option>
      <option value="admin">Administrador</option>
    </Select>
  )
}
