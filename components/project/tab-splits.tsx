"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { DailyMetric, Expense, FunnelProduct, Profile, Project, ProfitSplit } from "@/lib/types"
import { toBRL } from "@/lib/currency"
import { computeDre } from "@/lib/finance"
import { formatCurrency, formatPercent } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle, Button, Field, Input, Select, Table, Th, Td, Badge } from "@/components/ui"
import { Modal } from "@/components/modal"
import { setProfitSplit, deleteProfitSplit } from "@/app/actions/projects"
import { Plus, Trash2 } from "lucide-react"

export function TabSplits({
  project,
  splits,
  profiles,
  metrics,
  expenses,
  funnel,
  usdBrl,
}: {
  project: Project
  splits: ProfitSplit[]
  profiles: Profile[]
  metrics: DailyMetric[]
  expenses: Expense[]
  funnel: FunnelProduct[]
  usdBrl: number
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string>()
  const router = useRouter()

  const netProfit = useMemo(() => {
    const cur = project.currency
    const revenue = metrics.reduce((s, m) => s + toBRL(m.revenue, cur, usdBrl), 0)
    const sales = metrics.reduce((s, m) => s + m.sales, 0)
    const frontCost = funnel.find((f) => f.kind === "front")?.product_cost ?? 0
    const productCost = frontCost * sales
    const gatewayFees = revenue * 0.05
    const taxes = revenue * 0.06
    const metricAdSpend = metrics.reduce((s, m) => s + toBRL(m.spend, cur, usdBrl), 0)
    const expenseAdSpend = expenses
      .filter((e) => e.type === "ads")
      .reduce((s, e) => s + toBRL(e.amount, e.currency, usdBrl), 0)
    const adSpend = Math.max(metricAdSpend, expenseAdSpend)
    const toolSpend = expenses
      .filter((e) => e.type !== "ads")
      .reduce((s, e) => s + toBRL(e.amount, e.currency, usdBrl), 0)
    return computeDre({ revenue, productCost, gatewayFees, taxes, adSpend, toolSpend }).lucroLiquido
  }, [metrics, expenses, funnel, project.currency, usdBrl])

  const nameOf = (id: string) => profiles.find((p) => p.id === id)?.full_name || profiles.find((p) => p.id === id)?.username || "—"
  const totalPct = splits.reduce((s, x) => s + Number(x.percentage), 0)
  const remaining = 100 - totalPct

  function onSubmit(formData: FormData) {
    setError(undefined)
    startTransition(async () => {
      const res = await setProfitSplit(project.id, formData)
      if (res?.error) setError(res.error)
      else {
        setOpen(false)
        router.refresh()
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold">Repartição de lucro</h2>
          <p className="text-sm text-muted">
            Lucro do período: <span className="font-mono text-foreground">{formatCurrency(netProfit)}</span>
          </p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus size={16} /> Definir sócio
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Badge tone={totalPct === 100 ? "positive" : totalPct > 100 ? "negative" : "warning"}>
          {formatPercent(totalPct, 0)} distribuído
        </Badge>
        {remaining !== 0 ? (
          <span className="text-xs text-muted">
            {remaining > 0 ? `${formatPercent(remaining, 0)} sem dono` : `${formatPercent(-remaining, 0)} acima de 100%`}
          </span>
        ) : null}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <thead>
              <tr>
                <Th>Sócio</Th>
                <Th className="text-right">Percentual</Th>
                <Th className="text-right">Valor a receber</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {splits.length === 0 ? (
                <tr>
                  <Td colSpan={4} className="py-10 text-center text-muted">Nenhuma repartição definida.</Td>
                </tr>
              ) : (
                splits.map((s) => (
                  <tr key={s.id}>
                    <Td>{nameOf(s.user_id)}</Td>
                    <Td className="text-right font-mono">{formatPercent(Number(s.percentage), 0)}</Td>
                    <Td className="text-right font-mono text-positive">
                      {formatCurrency((netProfit * Number(s.percentage)) / 100)}
                    </Td>
                    <Td className="text-right">
                      <button
                        onClick={() =>
                          startTransition(async () => {
                            await deleteProfitSplit(project.id, s.id)
                            router.refresh()
                          })
                        }
                        className="text-muted transition-colors hover:text-negative"
                        aria-label="Remover sócio"
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

      <Modal open={open} onClose={() => setOpen(false)} title="Definir repartição">
        <form action={onSubmit} className="flex flex-col gap-4">
          <Field label="Sócio">
            <Select name="user_id" required defaultValue="">
              <option value="" disabled>Selecione…</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name || p.username}</option>
              ))}
            </Select>
          </Field>
          <Field label="Percentual (%)">
            <Input name="percentage" inputMode="decimal" placeholder="Ex: 50" required />
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
