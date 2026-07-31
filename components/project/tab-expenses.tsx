"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { AdAccount, CardCharge, Expense, Project } from "@/lib/types"
import { toBRL, currencySymbol } from "@/lib/currency"
import { formatCurrency } from "@/lib/utils"
import { buildBreakdown } from "@/lib/money"
import { Card, CardContent, Button, Field, Input, Select, Badge, Table, Th, Td } from "@/components/ui"
import { Modal } from "@/components/modal"
import { createExpense, updateExpense, deleteExpense, upsertCurrentAdSpend } from "@/app/actions/projects"
import { Plus, Trash2, Repeat, Pencil, Gauge } from "lucide-react"

const TYPES: { value: Expense["type"]; label: string }[] = [
  { value: "ads", label: "Tráfego (Ads)" },
  { value: "ferramenta", label: "Ferramenta" },
  { value: "servico", label: "Serviço / Equipe" },
  { value: "outro", label: "Outro" },
]

function typeLabel(t: string) {
  return TYPES.find((x) => x.value === t)?.label ?? t
}

const today = () => new Date().toISOString().slice(0, 10)

export function TabExpenses({
  project,
  expenses,
  usdBrl,
  currencies = ["BRL", "USD", "EUR"],
  adAccounts = [],
  cardCharges = [],
  metaTaxPct = 0,
}: {
  project: Project
  expenses: Expense[]
  usdBrl: number
  /** Moedas que o usuário acompanha — permite lançar o gasto na moeda real da conta. */
  currencies?: string[]
  adAccounts?: AdAccount[]
  cardCharges?: CardCharge[]
  metaTaxPct?: number
}) {
  // Garante que a moeda do projeto e o BRL estejam sempre disponíveis no seletor.
  const currencyOptions = Array.from(new Set([project.currency, "BRL", ...currencies].map((c) => c.toUpperCase())))
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [spendOpen, setSpendOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string>()
  const router = useRouter()

  // Estado do "gasto atual": conta + dia definem qual gasto está sendo atualizado.
  const [spendAccount, setSpendAccount] = useState<string>("")
  const [spendDate, setSpendDate] = useState<string>(today())
  const currentAdSpend = useMemo(() => {
    const found = expenses.find(
      (e) =>
        e.type === "ads" &&
        e.spent_at === spendDate &&
        (e.ad_account_id ?? "") === spendAccount,
    )
    return found ?? null
  }, [expenses, spendDate, spendAccount])

  const totalBRL = expenses.reduce((s, e) => s + toBRL(e.amount, e.currency, usdBrl), 0)
  const byType = TYPES.map((t) => ({
    ...t,
    total: expenses
      .filter((e) => e.type === t.value)
      .reduce((s, e) => s + toBRL(e.amount, e.currency, usdBrl), 0),
  })).filter((t) => t.total > 0)

  // Imposto da Meta = cobrança no cartão − gasto em anúncios (ou % estimada).
  const breakdown = useMemo(
    () => buildBreakdown({ projects: [project], metrics: [], expenses, sales: [], cardCharges }, usdBrl, { metaTaxPct }),
    [project, expenses, cardCharges, usdBrl, metaTaxPct],
  )

  const accountName = (id: string | null) =>
    id ? (adAccounts.find((a) => a.id === id)?.account_name ?? "Conta removida") : null

  function submitNew(formData: FormData) {
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

  function submitEdit(formData: FormData) {
    if (!editing) return
    setError(undefined)
    startTransition(async () => {
      const res = await updateExpense(project.id, editing.id, formData)
      if (res?.error) setError(res.error)
      else {
        setEditing(null)
        router.refresh()
      }
    })
  }

  function submitSpend(formData: FormData) {
    setError(undefined)
    startTransition(async () => {
      const res = await upsertCurrentAdSpend(project.id, formData)
      if (res?.error) setError(res.error)
      else {
        setSpendOpen(false)
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Gastos</h2>
          <p className="text-sm text-muted">Total (convertido p/ BRL): {formatCurrency(totalBRL)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => { setSpendAccount(""); setSpendDate(today()); setError(undefined); setSpendOpen(true) }}>
            <Gauge size={16} /> Atualizar gasto atual
          </Button>
          <Button size="sm" onClick={() => { setError(undefined); setOpen(true) }}>
            <Plus size={16} /> Novo gasto
          </Button>
        </div>
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

      {/* Imposto da Meta: cobrança − gasto */}
      {breakdown.adSpend > 0 || breakdown.cardCharged > 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted">Gasto em anúncios</div>
              <div className="mt-1 font-mono text-lg font-semibold">{formatCurrency(breakdown.adSpend)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted">Cobrado no cartão</div>
              <div className="mt-1 font-mono text-lg font-semibold">
                {breakdown.cardCharged > 0 ? formatCurrency(breakdown.cardCharged) : "—"}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted">Imposto da Meta {breakdown.cardCharged > 0 ? "(cartão − gasto)" : "(estimado)"}</div>
              <div className="mt-1 font-mono text-lg font-semibold text-warning">{formatCurrency(breakdown.trafficTax)}</div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <thead>
                <tr>
                  <Th>Data</Th>
                  <Th>Tipo</Th>
                  <Th>Conta</Th>
                  <Th>Descrição</Th>
                  <Th className="text-right">Valor</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 ? (
                  <tr>
                    <Td className="py-10 text-center text-muted" colSpan={6}>
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
                      <Td className="text-muted">{accountName(e.ad_account_id) ?? "—"}</Td>
                      <Td className="text-muted">{e.description ?? "—"}</Td>
                      <Td className="whitespace-nowrap text-right font-mono">
                        {formatCurrency(e.amount, e.currency)}
                      </Td>
                      <Td className="text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => { setError(undefined); setEditing(e) }}
                            disabled={pending}
                            className="text-muted transition-colors hover:text-primary"
                            aria-label="Editar gasto"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => remove(e.id)}
                            disabled={pending}
                            className="text-muted transition-colors hover:text-negative"
                            aria-label="Excluir gasto"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Novo / Editar gasto */}
      <Modal open={open || !!editing} onClose={() => { setOpen(false); setEditing(null) }} title={editing ? "Editar gasto" : "Novo gasto"}>
        <form action={editing ? submitEdit : submitNew} className="flex flex-col gap-4">
          <Field label="Tipo">
            <Select name="type" defaultValue={editing?.type ?? "ads"}>
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Select>
          </Field>
          {adAccounts.length > 0 ? (
            <Field label="Conta de anúncio (opcional)">
              <Select name="ad_account_id" defaultValue={editing?.ad_account_id ?? ""}>
                <option value="">Não vincular</option>
                {adAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.account_name}{a.bm_name ? ` — ${a.bm_name}` : ""}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor">
              <Input name="amount" inputMode="decimal" placeholder="0,00" defaultValue={editing?.amount ?? ""} required />
            </Field>
            <Field label="Moeda">
              <Select name="currency" defaultValue={editing?.currency ?? project.currency}>
                {currencyOptions.map((c) => (
                  <option key={c} value={c}>
                    {c} ({currencySymbol(c)})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Data">
              <Input name="spent_at" type="date" defaultValue={editing?.spent_at ?? today()} />
            </Field>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input name="recurring" type="checkbox" defaultChecked={editing?.recurring ?? false} className="size-4 accent-[var(--color-primary)]" />
              <span>Recorrente</span>
            </label>
          </div>
          <Field label="Descrição">
            <Input name="description" placeholder="Opcional" defaultValue={editing?.description ?? ""} />
          </Field>
          {error ? <p className="text-sm text-negative">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => { setOpen(false); setEditing(null) }}>Cancelar</Button>
            <Button type="submit" disabled={pending}>{pending ? "Salvando..." : "Salvar"}</Button>
          </div>
        </form>
      </Modal>

      {/* Atualizar gasto atual (substitui, não soma) */}
      <Modal open={spendOpen} onClose={() => setSpendOpen(false)} title="Atualizar gasto atual">
        <form action={submitSpend} className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            Informe o total gasto até agora no dia — este valor <strong>substitui</strong> o gasto do dia (não soma).
            Assim você vai atualizando conforme o dia avança.
          </p>
          {adAccounts.length > 0 ? (
            <Field label="Conta de anúncio">
              <Select name="ad_account_id" value={spendAccount} onChange={(e) => setSpendAccount(e.target.value)}>
                <option value="">Geral (sem conta)</option>
                {adAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.account_name}{a.bm_name ? ` — ${a.bm_name}` : ""}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <input type="hidden" name="ad_account_id" value="" />
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Dia">
              <Input name="spent_at" type="date" value={spendDate} onChange={(e) => setSpendDate(e.target.value)} />
            </Field>
            <Field label="Moeda">
              <Select name="currency" defaultValue={currentAdSpend?.currency ?? project.currency}>
                {currencyOptions.map((c) => (
                  <option key={c} value={c}>
                    {c} ({currencySymbol(c)})
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="rounded-lg border border-border bg-surface-2 p-3 text-sm">
            Gasto atual registrado:{" "}
            <strong className="font-mono">
              {currentAdSpend ? formatCurrency(currentAdSpend.amount, currentAdSpend.currency) : "nenhum"}
            </strong>
          </div>
          <Field label="Novo total gasto até agora">
            <Input
              key={`${spendAccount}-${spendDate}`}
              name="amount"
              inputMode="decimal"
              placeholder="0,00"
              defaultValue={currentAdSpend?.amount ?? ""}
              required
            />
          </Field>
          {error ? <p className="text-sm text-negative">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => setSpendOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={pending}>{pending ? "Salvando..." : "Atualizar"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
