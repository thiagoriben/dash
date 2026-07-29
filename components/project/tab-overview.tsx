"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { DailyMetric, Expense, Project } from "@/lib/types"
import { aggregateTotals, timeSeries } from "@/lib/aggregate"
import { diagnoseFunnel } from "@/lib/finance"
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils"
import { KpiCard } from "@/components/kpi-card"
import { SpendRevenueChart } from "@/components/spend-revenue-chart"
import { Card, CardContent, CardHeader, CardTitle, Button, Field, Input } from "@/components/ui"
import { SemaphoreDot } from "@/components/semaphore"
import { upsertDailyMetric } from "@/app/actions/projects"
import { Wallet, TrendingUp, PiggyBank, Target, Plus } from "lucide-react"
import { Modal } from "@/components/modal"

export function TabOverview({
  project,
  metrics,
  expenses,
  usdBrl,
}: {
  project: Project
  metrics: DailyMetric[]
  expenses: Expense[]
  usdBrl: number
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string>()
  const router = useRouter()

  const totals = aggregateTotals(metrics, expenses, [project], usdBrl)
  const series = timeSeries(metrics, [project], usdBrl)

  const funnelTot = metrics.reduce(
    (a, m) => ({
      impressions: a.impressions + m.impressions,
      clicks: a.clicks + m.clicks,
      checkouts: a.checkouts + m.checkouts_initiated,
      sales: a.sales + m.sales,
    }),
    { impressions: 0, clicks: 0, checkouts: 0, sales: 0 },
  )
  const diag = diagnoseFunnel(funnelTot)

  function onSubmit(formData: FormData) {
    setError(undefined)
    startTransition(async () => {
      const res = await upsertDailyMetric(project.id, formData)
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
        <h2 className="font-display text-lg font-semibold">Desempenho</h2>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus size={16} />
          Lançar métrica do dia
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard label="Gasto" value={formatCurrency(totals.totalSpend)} icon={<Wallet size={14} />} accent="secondary" />
        <KpiCard label="Faturamento" value={formatCurrency(totals.revenue)} icon={<TrendingUp size={14} />} accent="primary" />
        <KpiCard label="Lucro" value={formatCurrency(totals.profit)} icon={<PiggyBank size={14} />} accent={totals.profit >= 0 ? "positive" : "negative"} />
        <KpiCard label="ROAS" value={`${formatNumber(totals.roas, 2)}x`} icon={<Target size={14} />} accent="warning" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Gasto x Faturamento</CardTitle>
          </CardHeader>
          <CardContent>
            {series.length > 1 ? (
              <SpendRevenueChart data={series} />
            ) : (
              <div className="flex h-[280px] items-center justify-center text-center text-sm text-muted">
                Sem métricas ainda — lance o primeiro dia para ver a evolução.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Diagnóstico do funil</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <Metric label="CTR" value={formatPercent(diag.ctr)} />
              <Metric label="Pág→Check" value={formatPercent(diag.pageToCheckout)} />
              <Metric label="Check→Venda" value={formatPercent(diag.checkoutToSale)} />
            </div>
            <ul className="flex flex-col gap-2">
              {diag.findings.map((f, i) => (
                <li key={i} className="flex items-start gap-2 rounded-xl border border-[color:var(--color-border)] bg-white/[0.02] px-3 py-2 text-sm">
                  <span className="mt-1">
                    <SemaphoreDot color={f.level} />
                  </span>
                  <span className="text-foreground/90">{f.label}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Lançar métrica diária" description="Um registro por dia. Reenviar a mesma data atualiza os valores.">
        <form action={onSubmit} className="flex flex-col gap-4">
          <Field label="Data">
            <Input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Gasto (${project.currency})`}>
              <Input name="spend" inputMode="decimal" placeholder="0,00" />
            </Field>
            <Field label={`Faturamento (${project.currency})`}>
              <Input name="revenue" inputMode="decimal" placeholder="0,00" />
            </Field>
            <Field label="Impressões">
              <Input name="impressions" inputMode="numeric" placeholder="0" />
            </Field>
            <Field label="Cliques">
              <Input name="clicks" inputMode="numeric" placeholder="0" />
            </Field>
            <Field label="Checkouts iniciados">
              <Input name="checkouts_initiated" inputMode="numeric" placeholder="0" />
            </Field>
            <Field label="Vendas">
              <Input name="sales" inputMode="numeric" placeholder="0" />
            </Field>
          </div>
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[color:var(--color-border)] bg-white/[0.02] p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
      <div className="font-mono text-sm font-semibold text-foreground">{value}</div>
    </div>
  )
}
