"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { Expense, Project } from "@/lib/types"
import { toBRL, currencySymbol } from "@/lib/currency"
import { formatCurrency } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle, Button, Field, Input, Select, Badge, Table, Th, Td } from "@/components/ui"
import { Modal } from "@/components/modal"
import { createExpense, deleteExpense } from "@/app/actions/projects"
import { Plus, Trash2, Repeat } from "lucide-react"

const TYPES: { value: Expense["type"]; label: string }[] = [
  { value: "ads", label: "Tráfego (Ads)" },
  { value: "ferramenta", label: "Ferramenta" },
  { value: "servico", label: "Serviço / Equipe" },
  { value: "outro", label: "Outro" },
]

function typeLabel(t: string) {
  return TYPES.find((x) => x.value === t)?.label ?? t
}

export function TabExpenses({
  project,
  expenses,
  usdBrl,
  currencies = ["BRL", "USD", "EUR"],
}: {
  project: Project
  expenses: Expense[]
  usdBrl: number
  /** Moedas que o usuário acompanha — permite lançar o gasto na moeda real da conta. */
  currencies?: string[]
}) {
  // Garante que a moeda do projeto e o BRL estejam sempre disponíveis no seletor.
  const currencyOptions = Array.from(new Set([project.currency, "BRL", ...currencies].map((c) => c.toUpperCase())))
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string>()
  const router = useRouter()

  const totalBRL = expenses.reduce((s, e) => s + toBRL(e.amount, e.currency, usdBrl), 0)
  const byType = TYPES.map((t) => ({
    ...t,
    total: expenses
      .filter((e) => e.type === t.value)
      .reduce((s, e) => s + toBRL(e.amount, e.currency, usdBrl), 0),
  })).filter((t) => t.total > 0)

  function onSubmit(formData: FormData) {
    setError(undefined)
    startTransition(async () => {
      const res = await createExpense(project.id, formData)
      if (res?.error) setError(res.error)
      else {
        setOpen(false)
        router.refresh()
      }
    })
  }

  function remove(id: string) {
    startTransition(async () => {
      await deleteExpense(project.id, id)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold">Gastos</h2>
          <p className="text-sm text-muted">Total (convertido p/ BRL): {formatCurrency(totalBRL)}</p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus size={16} /> Novo gasto
        </Button>
      </div>

      {byType.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {byType.map((t) => (
            <Card key={t.value}>
              <CardContent className="p-4">
                <div className="text-xs text-muted">{t.label}</div>
                <div className="mt-1 font-mono text-lg font-semibold">{formatCurrency(t.total)}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      <Card>
        <CardContent className="p-0">
          <Table>
            <thead>
              <tr>
                <Th>Data</Th>
                <Th>Tipo</Th>
                <Th>Descrição</Th>
                <Th className="text-right">Valor</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 ? (
                <tr>
                  <Td className="py-10 text-center text-muted" colSpan={5}>
                    Nenhum gasto registrado ainda.
                  </Td>
                </tr>
              ) : (
                expenses.map((e) => (
                  <tr key={e.id}>
                    <Td className="whitespace-nowrap text-muted">
                      {new Date(e.spent_at + "T00:00:00").toLocaleDateString("pt-BR")}
                    </Td>
                    <Td>
                      <span className="inline-flex items-center gap-1.5">
                        <Badge>{typeLabel(e.type)}</Badge>
                        {e.recurring ? <Repeat size={12} className="text-muted" aria-label="Recorrente" /> : null}
                      </span>
                    </Td>
                    <Td className="text-muted">{e.description ?? "—"}</Td>
                    <Td className="whitespace-nowrap text-right font-mono">
                      {formatCurrency(e.amount, e.currency)}
                    </Td>
                    <Td className="text-right">
                      <button
                        onClick={() => remove(e.id)}
                        disabled={pending}
                        className="text-muted transition-colors hover:text-negative"
                        aria-label="Excluir gasto"
                      >
                        <Trash2 size={16} />
                      </button>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Novo gasto">
        <form action={onSubmit} className="flex flex-col gap-4">
          <Field label="Tipo">
            <Select name="type" defaultValue="ads">
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor">
              <Input name="amount" inputMode="decimal" placeholder="0,00" required />
            </Field>
            <Field label="Moeda">
              <Select name="currency" defaultValue={project.currency}>
                {currencyOptions.map((c) => (
                  <option key={c} value={c}>
                    {c} ({currencySymbol(c)})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Data">
              <Input name="spent_at" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
            </Field>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input name="recurring" type="checkbox" className="size-4 accent-[var(--color-primary)]" />
              <span>Recorrente</span>
            </label>
          </div>
          <Field label="Descrição">
            <Input name="description" placeholder="Opcional" />
          </Field>
          {error ? <p className="text-sm text-negative">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={pending}>{pending ? "Salvando..." : "Salvar"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
