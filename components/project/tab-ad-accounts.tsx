"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { AdAccount, CardCharge, DailyMetric, Project } from "@/lib/types"
import { formatCurrency, formatPercent } from "@/lib/utils"
import { fmtDate, computeTrafficTax } from "@/lib/finance"
import {
  Card,
  CardContent,
  Button,
  Field,
  Input,
  Select,
  Table,
  Th,
  Td,
} from "@/components/ui"
import { KpiCard } from "@/components/kpi-card"
import { Modal } from "@/components/modal"
import { RowActions } from "@/components/row-actions"
import {
  saveAdAccount,
  deleteAdAccount,
  createCardCharge,
  deleteCardCharge,
} from "@/app/actions/projects"
import { Plus, Wallet, CreditCard, Receipt } from "lucide-react"

export function TabAdAccounts({
  project,
  adAccounts,
  cardCharges,
  metrics,
  usdBrl: _usdBrl,
}: {
  project: Project
  adAccounts: AdAccount[]
  cardCharges: CardCharge[]
  metrics: DailyMetric[]
  usdBrl: number
}) {
  const [accOpen, setAccOpen] = useState(false)
  const [chargeOpen, setChargeOpen] = useState(false)
  const [editingAcc, setEditingAcc] = useState<AdAccount | null>(null)
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const adSpend = metrics.reduce((s, m) => s + m.spend, 0)
  const cardCharged = cardCharges.reduce((s, c) => s + c.amount, 0)
  const tax = computeTrafficTax(adSpend, cardCharged)

  function submitAcc(formData: FormData) {
    setError(undefined)
    startTransition(async () => {
      const res = await saveAdAccount(project.id, formData)
      if (res?.error) setError(res.error)
      else {
        setAccOpen(false)
        setEditingAcc(null)
        router.refresh()
      }
    })
  }

  function submitCharge(formData: FormData) {
    setError(undefined)
    startTransition(async () => {
      const res = await createCardCharge(project.id, formData)
      if (res?.error) setError(res.error)
      else {
        setChargeOpen(false)
        router.refresh()
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-lg font-semibold">Contas de anúncio</h2>
        <p className="text-sm text-muted">
          Suas BMs e contas, e as cobranças reais no cartão. O imposto do tráfego é a diferença
          entre o cobrado no cartão e o gasto lançado em anúncios.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Gasto em anúncios" value={formatCurrency(adSpend, project.currency)} icon={<Wallet size={14} />} accent="secondary" />
        <KpiCard label="Cobrado no cartão" value={formatCurrency(cardCharged, project.currency)} icon={<CreditCard size={14} />} accent="primary" />
        <KpiCard
          label={`Imposto do tráfego (${formatPercent(tax.pct)})`}
          value={formatCurrency(tax.tax, project.currency)}
          icon={<Receipt size={14} />}
          accent="warning"
        />
      </div>

      {/* Contas */}
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Contas / BMs</h3>
        <Button
          size="sm"
          onClick={() => {
            setEditingAcc(null)
            setError(undefined)
            setAccOpen(true)
          }}
        >
          <Plus size={16} /> Nova conta
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <thead>
              <tr>
                <Th>Conta</Th>
                <Th>BM</Th>
                <Th className="text-right">Ações</Th>
              </tr>
            </thead>
            <tbody>
              {adAccounts.length === 0 ? (
                <tr>
                  <Td colSpan={3} className="py-8 text-center text-muted">
                    Nenhuma conta cadastrada.
                  </Td>
                </tr>
              ) : (
                adAccounts.map((a) => (
                  <tr key={a.id}>
                    <Td className="font-medium">{a.account_name}</Td>
                    <Td className="text-muted">{a.bm_name ?? "—"}</Td>
                    <Td className="text-right">
                      <RowActions
                        onEdit={() => {
                          setEditingAcc(a)
                          setError(undefined)
                          setAccOpen(true)
                        }}
                        onDelete={() => deleteAdAccount(project.id, a.id)}
                      />
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </CardContent>
      </Card>

      {/* Cobranças no cartão */}
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Cobranças no cartão</h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setError(undefined)
            setChargeOpen(true)
          }}
        >
          <Plus size={16} /> Nova cobrança
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <thead>
              <tr>
                <Th>Data</Th>
                <Th>Conta</Th>
                <Th>Obs.</Th>
                <Th className="text-right">Valor</Th>
                <Th className="text-right">Ações</Th>
              </tr>
            </thead>
            <tbody>
              {cardCharges.length === 0 ? (
                <tr>
                  <Td colSpan={5} className="py-8 text-center text-muted">
                    Nenhuma cobrança lançada.
                  </Td>
                </tr>
              ) : (
                cardCharges.map((c) => {
                  const acc = adAccounts.find((a) => a.id === c.ad_account_id)
                  return (
                    <tr key={c.id}>
                      <Td className="whitespace-nowrap text-muted">{fmtDate(c.charged_at)}</Td>
                      <Td>{acc?.account_name ?? "—"}</Td>
                      <Td className="text-muted">{c.notes ?? "—"}</Td>
                      <Td className="text-right font-mono">
                        {formatCurrency(c.amount, project.currency)}
                      </Td>
                      <Td className="text-right">
                        <RowActions onDelete={() => deleteCardCharge(project.id, c.id)} />
                      </Td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal conta */}
      <Modal
        open={accOpen}
        onClose={() => setAccOpen(false)}
        title={editingAcc ? "Editar conta" : "Nova conta de anúncio"}
      >
        <form action={submitAcc} className="flex flex-col gap-4">
          {editingAcc ? <input type="hidden" name="id" value={editingAcc.id} /> : null}
          <Field label="Nome da conta">
            <Input name="account_name" defaultValue={editingAcc?.account_name} required />
          </Field>
          <Field label="Nome da BM (opcional)">
            <Input name="bm_name" defaultValue={editingAcc?.bm_name ?? ""} />
          </Field>
          {error ? <p className="text-sm text-negative">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => setAccOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal cobrança */}
      <Modal open={chargeOpen} onClose={() => setChargeOpen(false)} title="Nova cobrança no cartão">
        <form action={submitCharge} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Valor cobrado (${project.currency})`}>
              <Input name="amount" inputMode="decimal" placeholder="0,00" required />
            </Field>
            <Field label="Data">
              <Input
                name="charged_at"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </Field>
          </div>
          <Field label="Conta (opcional)">
            <Select name="ad_account_id" defaultValue="">
              <option value="">Sem conta</option>
              {adAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.account_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Observação (opcional)">
            <Input name="notes" placeholder="Ex: fatura Nubank" />
          </Field>
          {error ? <p className="text-sm text-negative">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => setChargeOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
