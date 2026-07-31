"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { PaymentGateway } from "@/lib/types"
import type { GatewayBalance } from "@/lib/gateways"
import { formatCurrency, formatPercent } from "@/lib/utils"
import { Card, CardContent, Button, Field, Input, Select, Table, Th, Td } from "@/components/ui"
import { Modal } from "@/components/modal"
import { RowActions } from "@/components/row-actions"
import { saveGateway, deleteGateway, withdrawFromGateway } from "@/app/actions/projects"
import { Plus, CreditCard, ArrowDownToLine } from "lucide-react"

type NamedRef = { id: string; name: string }

export function GatewaysClient({
  gateways,
  balances = {},
  accounts = [],
  projects = [],
}: {
  gateways: PaymentGateway[]
  balances?: Record<string, GatewayBalance>
  accounts?: NamedRef[]
  projects?: NamedRef[]
}) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<PaymentGateway | null>(null)
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()

  // Estado do modal de saque
  const [wOpen, setWOpen] = useState(false)
  const [wGateway, setWGateway] = useState<PaymentGateway | null>(null)
  const [wError, setWError] = useState<string>()
  const [wGross, setWGross] = useState("")
  const [wDestKind, setWDestKind] = useState<"carteira" | "projeto">("carteira")
  const [wPending, startW] = useTransition()

  const router = useRouter()

  function openNew() {
    setEditing(null)
    setError(undefined)
    setOpen(true)
  }
  function openEdit(g: PaymentGateway) {
    setEditing(g)
    setError(undefined)
    setOpen(true)
  }
  function openWithdraw(g: PaymentGateway) {
    setWGateway(g)
    setWGross("")
    setWDestKind("carteira")
    setWError(undefined)
    setWOpen(true)
  }

  function onSubmit(formData: FormData) {
    setError(undefined)
    startTransition(async () => {
      const res = await saveGateway(formData)
      if (res?.error) setError(res.error)
      else {
        setOpen(false)
        router.refresh()
      }
    })
  }

  function onWithdraw(formData: FormData) {
    setWError(undefined)
    startW(async () => {
      const res = await withdrawFromGateway(formData)
      if (res?.error) setWError(res.error)
      else {
        setWOpen(false)
        router.refresh()
      }
    })
  }

  // Prévia do líquido no modal de saque
  const wPreview = useMemo(() => {
    const gross = Number(String(wGross).replace(",", ".")) || 0
    const feePct = wGateway?.withdraw_fee_pct ?? 0
    const feeFixed = wGateway?.withdraw_fee_fixed ?? 0
    const fee = +(gross * (feePct / 100) + feeFixed).toFixed(2)
    return { gross, fee, net: +(gross - fee).toFixed(2), feePct, feeFixed }
  }, [wGross, wGateway])

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold">Gateways de pagamento</h1>
        <p className="text-sm text-muted text-pretty">
          Taxas e prazos por gateway. A taxa de venda é deduzida do bruto ao registrar a venda; a
          taxa de saque incide quando você retira o saldo para uma carteira ou projeto.
        </p>
      </header>

      <Card>
        <div className="flex items-center justify-between border-b border-[color:var(--color-border)] px-5 py-4">
          <div className="flex items-center gap-2">
            <CreditCard size={18} className="text-primary" />
            <h2 className="font-medium">Gateways</h2>
          </div>
          <Button size="sm" onClick={openNew}>
            <Plus size={16} /> Novo gateway
          </Button>
        </div>
        <CardContent className="p-0">
          {gateways.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted">Nenhum gateway cadastrado.</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Gateway</Th>
                  <Th>Taxa venda</Th>
                  <Th>Taxa saque</Th>
                  <Th>Prazos</Th>
                  <Th className="text-right">Saldo disponível</Th>
                  <Th className="text-right">Ações</Th>
                </tr>
              </thead>
              <tbody>
                {gateways.map((g) => {
                  const bal = balances[g.id]?.available ?? 0
                  return (
                    <tr key={g.id}>
                      <Td className="font-medium">{g.name}</Td>
                      <Td>
                        {formatPercent(g.fee_pct)}
                        {g.fee_fixed ? ` + ${formatCurrency(g.fee_fixed)}` : ""}
                      </Td>
                      <Td>
                        {formatPercent(g.withdraw_fee_pct ?? 0)}
                        {g.withdraw_fee_fixed ? ` + ${formatCurrency(g.withdraw_fee_fixed)}` : ""}
                      </Td>
                      <Td className="text-xs text-muted">
                        pix {g.term_days_pix === 0 ? "na hora" : `D+${g.term_days_pix}`} · cartão{" "}
                        {g.term_days_card === 0 ? "na hora" : `D+${g.term_days_card}`}
                      </Td>
                      <Td className="text-right">
                        <span
                          className={`money font-mono font-medium ${bal > 0 ? "text-positive" : "text-muted"}`}
                          data-money
                        >
                          {formatCurrency(bal)}
                        </span>
                      </Td>
                      <Td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openWithdraw(g)}
                            disabled={bal <= 0}
                            title={bal <= 0 ? "Sem saldo para sacar" : "Sacar saldo"}
                          >
                            <ArrowDownToLine size={14} /> Sacar
                          </Button>
                          <RowActions onEdit={() => openEdit(g)} onDelete={() => deleteGateway(g.id)} />
                        </div>
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal criar/editar gateway */}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Editar gateway" : "Novo gateway"}>
        <form action={onSubmit} className="flex flex-col gap-4">
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <Field label="Nome">
            <Input name="name" placeholder="Ex: Hotmart" defaultValue={editing?.name} required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Taxa de venda (%)">
              <Input name="fee_pct" inputMode="decimal" placeholder="0,00" defaultValue={editing?.fee_pct} />
            </Field>
            <Field label="Taxa fixa (R$)">
              <Input name="fee_fixed" inputMode="decimal" placeholder="0,00" defaultValue={editing?.fee_fixed} />
            </Field>
            <Field label="Taxa de saque (%)">
              <Input
                name="withdraw_fee_pct"
                inputMode="decimal"
                placeholder="0,00"
                defaultValue={editing?.withdraw_fee_pct}
              />
            </Field>
            <Field label="Taxa de saque fixa (R$)">
              <Input
                name="withdraw_fee_fixed"
                inputMode="decimal"
                placeholder="0,00"
                defaultValue={editing?.withdraw_fee_fixed}
              />
            </Field>
            <Field label="Prazo pix (dias)">
              <Input name="term_days_pix" inputMode="numeric" placeholder="0" defaultValue={editing?.term_days_pix} />
            </Field>
            <Field label="Prazo cartão (dias)">
              <Input name="term_days_card" inputMode="numeric" placeholder="0" defaultValue={editing?.term_days_card} />
            </Field>
          </div>
          <p className="text-xs text-muted text-pretty">
            Prazo 0 = recebimento na hora. A taxa de saque só é aplicada quando você retira o saldo.
          </p>
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

      {/* Modal de saque */}
      <Modal open={wOpen} onClose={() => setWOpen(false)} title={`Sacar de ${wGateway?.name ?? ""}`}>
        <form action={onWithdraw} className="flex flex-col gap-4">
          <input type="hidden" name="gateway_id" value={wGateway?.id ?? ""} />
          <div className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm">
            Saldo disponível:{" "}
            <span className="font-mono font-medium text-positive">
              {formatCurrency(wGateway ? balances[wGateway.id]?.available ?? 0 : 0)}
            </span>
          </div>

          <Field label="Valor sacado (bruto, R$)">
            <Input
              name="gross_amount"
              inputMode="decimal"
              placeholder="0,00"
              value={wGross}
              onChange={(e) => setWGross(e.target.value)}
              required
            />
          </Field>

          {wPreview.feePct > 0 || wPreview.feeFixed > 0 ? (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg border border-border px-3 py-2">
                <p className="text-xs text-muted">
                  Taxa de saque
                  {wPreview.feePct > 0 ? ` (${formatPercent(wPreview.feePct)}` : " ("}
                  {wPreview.feePct > 0 && wPreview.feeFixed > 0 ? " + " : ""}
                  {wPreview.feeFixed > 0 ? formatCurrency(wPreview.feeFixed) : ""}
                  {")"}
                </p>
                <p className="font-mono text-negative">− {formatCurrency(wPreview.fee)}</p>
              </div>
              <div className="rounded-lg border border-border px-3 py-2">
                <p className="text-xs text-muted">Líquido creditado</p>
                <p className="font-mono font-medium text-positive">{formatCurrency(wPreview.net)}</p>
              </div>
            </div>
          ) : null}

          <Field label="Destino">
            <Select
              name="dest_kind"
              value={wDestKind}
              onChange={(e) => setWDestKind(e.target.value as "carteira" | "projeto")}
            >
              <option value="carteira">Carteira / conta bancária</option>
              <option value="projeto">Caixa de um projeto</option>
            </Select>
          </Field>

          {wDestKind === "carteira" ? (
            <Field label="Conta de destino">
              <Select name="dest_account_id" required>
                <option value="">Selecione…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field label="Projeto de destino">
              <Select name="dest_project_id" required>
                <option value="">Selecione…</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <Field label="Data do saque">
            <Input name="withdrawn_at" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
          </Field>
          <Field label="Observação (opcional)">
            <Input name="note" placeholder="Ex: saque quinzenal" />
          </Field>

          {wError && <p className="text-sm text-negative">{wError}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setWOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={wPending}>
              {wPending ? "Sacando…" : "Confirmar saque"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
