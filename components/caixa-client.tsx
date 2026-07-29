"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { CashEntry, Project } from "@/lib/types"
import { formatCurrency } from "@/lib/utils"
import { Card, CardContent, Button, Field, Input, Select, Badge, Table, Th, Td } from "@/components/ui"
import { Modal } from "@/components/modal"
import { RowActions } from "@/components/row-actions"
import { createCashEntry, deleteCashEntry } from "@/app/actions/projects"
import { Plus, ArrowUpRight, ArrowDownRight, Wallet } from "lucide-react"

const today = () => new Date().toISOString().slice(0, 10)

export function CaixaClient({
  entries,
  projects,
}: {
  entries: CashEntry[]
  projects: Project[]
}) {
  const [open, setOpen] = useState(false)
  const [direction, setDirection] = useState<"entrada" | "saida">("entrada")
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const { saldo, entradas, saidas } = useMemo(() => {
    let e = 0
    let s = 0
    for (const c of entries) {
      if (c.direction === "entrada") e += c.amount
      else s += c.amount
    }
    return { saldo: e - s, entradas: e, saidas: s }
  }, [entries])

  function openNew(dir: "entrada" | "saida") {
    setDirection(dir)
    setError(undefined)
    setOpen(true)
  }

  function onSubmit(formData: FormData) {
    setError(undefined)
    startTransition(async () => {
      const res = await createCashEntry(formData)
      if (res?.error) setError(res.error)
      else {
        setOpen(false)
        router.refresh()
      }
    })
  }

  const projectName = (id: string | null) => projects.find((p) => p.id === id)?.name ?? "Geral"

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Caixa</h1>
          <p className="text-sm text-muted">
            Saldo em conta, entradas e saídas. Vendas registradas entram aqui automaticamente.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => openNew("saida")}>
            <ArrowDownRight size={16} /> Saída
          </Button>
          <Button size="sm" onClick={() => openNew("entrada")}>
            <Plus size={16} /> Entrada
          </Button>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Wallet size={18} />
            </div>
            <div>
              <p className="text-xs text-muted">Saldo atual</p>
              <p className="font-mono text-xl font-semibold">{formatCurrency(saldo)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-positive/10 text-positive">
              <ArrowUpRight size={18} />
            </div>
            <div>
              <p className="text-xs text-muted">Entradas</p>
              <p className="font-mono text-xl font-semibold">{formatCurrency(entradas)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-negative/10 text-negative">
              <ArrowDownRight size={18} />
            </div>
            <div>
              <p className="text-xs text-muted">Saídas</p>
              <p className="font-mono text-xl font-semibold">{formatCurrency(saidas)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {entries.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted">
              Nenhuma movimentação ainda. Registre uma entrada ou saída.
            </p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Data</Th>
                  <Th>Descrição</Th>
                  <Th>Projeto</Th>
                  <Th>Categoria</Th>
                  <Th className="text-right">Valor</Th>
                  <Th className="text-right">Ações</Th>
                </tr>
              </thead>
              <tbody>
                {entries.map((c) => (
                  <tr key={c.id}>
                    <Td className="whitespace-nowrap text-muted">
                      {new Date(c.occurred_at + "T00:00:00").toLocaleDateString("pt-BR")}
                    </Td>
                    <Td className="font-medium">{c.description ?? "—"}</Td>
                    <Td className="text-muted">{projectName(c.project_id)}</Td>
                    <Td>
                      <Badge>{c.category ?? "—"}</Badge>
                    </Td>
                    <Td
                      className={`text-right font-mono font-medium ${
                        c.direction === "entrada" ? "text-positive" : "text-negative"
                      }`}
                    >
                      {c.direction === "entrada" ? "+" : "−"}
                      {formatCurrency(c.amount)}
                    </Td>
                    <Td className="text-right">
                      <RowActions onDelete={() => deleteCashEntry(c.id)} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={direction === "entrada" ? "Nova entrada" : "Nova saída"}
      >
        <form action={onSubmit} className="flex flex-col gap-4">
          <input type="hidden" name="direction" value={direction} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor (R$)">
              <Input name="amount" inputMode="decimal" placeholder="0,00" required />
            </Field>
            <Field label="Data">
              <Input name="occurred_at" type="date" defaultValue={today()} />
            </Field>
          </div>
          <Field label="Descrição">
            <Input name="description" placeholder="Ex: Pagamento gestor" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoria">
              <Input name="category" placeholder="Ex: ferramentas, pró-labore" />
            </Field>
            <Field label="Projeto (opcional)">
              <Select name="project_id" defaultValue="">
                <option value="">Geral (sem projeto)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </Field>
          </div>
          {error && <p className="text-sm text-negative">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
