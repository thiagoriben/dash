"use client"

import { useMemo } from "react"
import type { Project, Sale } from "@/lib/types"
import { formatCurrency } from "@/lib/utils"
import { fmtDate } from "@/lib/finance"
import { toBRL } from "@/lib/currency"
import { Card, CardContent, Table, Th, Td, Badge } from "@/components/ui"
import { KpiCard } from "@/components/kpi-card"
import { CalendarClock, Wallet, AlertTriangle } from "lucide-react"

type Row = Sale & { projectName: string; currency: string }

export function ReceivablesClient({
  rows,
  projects: _projects,
  usdBrl,
}: {
  rows: Row[]
  projects: Project[]
  usdBrl: number
}) {
  const today = new Date().toISOString().slice(0, 10)

  const byDate = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of rows) {
      const date = s.receivable_date ?? s.sold_at
      map.set(date, (map.get(date) ?? 0) + toBRL(s.net_amount, s.currency, usdBrl))
    }
    return [...map.entries()]
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [rows, usdBrl])

  const total = rows.reduce((s, v) => s + toBRL(v.net_amount, v.currency, usdBrl), 0)
  const overdue = rows
    .filter((s) => (s.receivable_date ?? s.sold_at) < today)
    .reduce((s, v) => s + toBRL(v.net_amount, v.currency, usdBrl), 0)
  const next7 = rows
    .filter((s) => {
      const d = s.receivable_date ?? s.sold_at
      return d >= today && d <= addDays(today, 7)
    })
    .reduce((s, v) => s + toBRL(v.net_amount, v.currency, usdBrl), 0)

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold">Recebíveis</h1>
        <p className="text-sm text-muted">
          Projeção consolidada de todos os projetos (convertida para BRL). Vendeu no dia X, recebe
          no dia Y.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Total a receber" value={formatCurrency(total)} icon={<Wallet size={14} />} accent="primary" />
        <KpiCard label="Próximos 7 dias" value={formatCurrency(next7)} icon={<CalendarClock size={14} />} accent="positive" />
        <KpiCard label="Vencido" value={formatCurrency(overdue)} icon={<AlertTriangle size={14} />} accent={overdue > 0 ? "warning" : "secondary"} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-0">
            <div className="border-b border-[color:var(--color-border)] px-5 py-3 text-sm font-medium">
              Por data
            </div>
            <Table>
              <thead>
                <tr>
                  <Th>Recebe em</Th>
                  <Th className="text-right">Valor</Th>
                </tr>
              </thead>
              <tbody>
                {byDate.length === 0 ? (
                  <tr>
                    <Td colSpan={2} className="py-10 text-center text-muted">
                      Nenhum recebível em aberto.
                    </Td>
                  </tr>
                ) : (
                  byDate.map((r) => (
                    <tr key={r.date}>
                      <Td className="whitespace-nowrap">
                        <span className="flex items-center gap-2">
                          {fmtDate(r.date)}
                          {r.date < today ? <Badge tone="warning">vencido</Badge> : null}
                        </span>
                      </Td>
                      <Td className="text-right font-mono text-positive">
                        {formatCurrency(r.amount)}
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="border-b border-[color:var(--color-border)] px-5 py-3 text-sm font-medium">
              Vendas a receber
            </div>
            <Table>
              <thead>
                <tr>
                  <Th>Projeto</Th>
                  <Th>Recebe em</Th>
                  <Th className="text-right">Líquido</Th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <Td colSpan={3} className="py-10 text-center text-muted">
                      Nada pendente.
                    </Td>
                  </tr>
                ) : (
                  rows.map((s) => (
                    <tr key={s.id}>
                      <Td className="font-medium">{s.projectName}</Td>
                      <Td className="whitespace-nowrap text-muted">
                        {fmtDate(s.receivable_date ?? s.sold_at)}
                      </Td>
                      <Td className="text-right font-mono text-positive">
                        {formatCurrency(s.net_amount, s.currency)}
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function addDays(dateISO: string, days: number) {
  const d = new Date(dateISO + "T00:00:00")
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}
