"use client"

import { useMemo, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { Project, Sale } from "@/lib/types"
import { formatCurrency } from "@/lib/utils"
import { fmtDate, groupReceivablesByDate } from "@/lib/finance"
import { Card, CardContent, Button, Table, Th, Td, Badge } from "@/components/ui"
import { markSaleReceived } from "@/app/actions/projects"
import { CalendarClock } from "lucide-react"

export function TabReceivables({
  project,
  receivables,
  usdBrl: _usdBrl,
}: {
  project: Project
  receivables: Sale[]
  usdBrl: number
}) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const byDate = useMemo(() => groupReceivablesByDate(receivables), [receivables])
  const totalPending = receivables.reduce((s, v) => s + v.net_amount, 0)
  const today = new Date().toISOString().slice(0, 10)
  const overdue = receivables
    .filter((s) => (s.receivable_date ?? s.sold_at) < today)
    .reduce((s, v) => s + v.net_amount, 0)

  function receive(id: string) {
    startTransition(async () => {
      await markSaleReceived(project.id, id)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-lg font-semibold">Recebíveis</h2>
        <p className="text-sm text-muted">
          Vendas com prazo em aberto. Total a receber{" "}
          <span className="text-positive">{formatCurrency(totalPending, project.currency)}</span>
          {overdue > 0 ? (
            <>
              {" · "}
              <span className="text-warning">
                {formatCurrency(overdue, project.currency)} vencido
              </span>
            </>
          ) : null}
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <thead>
              <tr>
                <Th>Recebe em</Th>
                <Th className="text-right">Vendas</Th>
                <Th className="text-right">Valor</Th>
              </tr>
            </thead>
            <tbody>
              {byDate.length === 0 ? (
                <tr>
                  <Td colSpan={3} className="py-10 text-center text-muted">
                    Nenhum recebível em aberto.
                  </Td>
                </tr>
              ) : (
                byDate.map((r) => (
                  <tr key={r.date}>
                    <Td className="whitespace-nowrap">
                      <span className="flex items-center gap-2">
                        <CalendarClock size={15} className="text-muted" />
                        {fmtDate(r.date)}
                        {r.date < today ? <Badge tone="warning">vencido</Badge> : null}
                      </span>
                    </Td>
                    <Td className="text-right text-muted">{r.count}</Td>
                    <Td className="text-right font-mono text-positive">
                      {formatCurrency(r.amount, project.currency)}
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </CardContent>
      </Card>

      <h3 className="font-medium">Vendas a receber</h3>
      <Card>
        <CardContent className="p-0">
          <Table>
            <thead>
              <tr>
                <Th>Vendido em</Th>
                <Th>Recebe em</Th>
                <Th>Pagamento</Th>
                <Th className="text-right">Líquido</Th>
                <Th className="text-right">Ação</Th>
              </tr>
            </thead>
            <tbody>
              {receivables.length === 0 ? (
                <tr>
                  <Td colSpan={5} className="py-10 text-center text-muted">
                    Nada pendente.
                  </Td>
                </tr>
              ) : (
                receivables.map((s) => (
                  <tr key={s.id}>
                    <Td className="whitespace-nowrap text-muted">{fmtDate(s.sold_at)}</Td>
                    <Td className="whitespace-nowrap">{fmtDate(s.receivable_date ?? s.sold_at)}</Td>
                    <Td className="capitalize">{s.payment_method}</Td>
                    <Td className="text-right font-mono text-positive">
                      {formatCurrency(s.net_amount, project.currency)}
                    </Td>
                    <Td className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => receive(s.id)}
                      >
                        Marcar recebido
                      </Button>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
