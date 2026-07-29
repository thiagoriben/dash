"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { Creative, PaymentGateway, Prefs, Product, Project, Sale } from "@/lib/types"
import { formatCurrency } from "@/lib/utils"
import { computeSaleNet, fmtDate } from "@/lib/finance"
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
  Badge,
} from "@/components/ui"
import { Modal } from "@/components/modal"
import { RowActions } from "@/components/row-actions"
import { SelectOrOther } from "@/components/select-or-other"
import { createSale, deleteSale } from "@/app/actions/projects"
import { Plus } from "lucide-react"

const PAYMENT_METHODS = ["Pix", "Cartão", "Boleto", "PayPal"]
const SOURCES = ["Facebook Ads", "Google Ads", "Orgânico", "Instagram", "Afiliado", "Direto"]

export function TabSales({
  project,
  sales,
  products,
  creatives,
  gateways,
  prefs,
}: {
  project: Project
  sales: Sale[]
  products: Product[]
  creatives: Creative[]
  gateways: PaymentGateway[]
  prefs: Prefs | null
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string>()
  const router = useRouter()

  // preview de líquido ao vivo
  const [gross, setGross] = useState(0)
  const [gatewayId, setGatewayId] = useState(prefs?.gateway_id ?? "")
  const [applyFee, setApplyFee] = useState(true)

  const preview = useMemo(() => {
    const gw = gateways.find((g) => g.id === gatewayId)
    return computeSaleNet({
      gross,
      applyFee,
      feePct: gw?.fee_pct ?? 0,
      feeFixed: gw?.fee_fixed ?? 0,
      taxPct: project.tax_pct,
    })
  }, [gross, gatewayId, applyFee, gateways, project.tax_pct])

  const totals = sales.reduce(
    (a, s) => ({ gross: a.gross + s.gross_amount, net: a.net + s.net_amount, count: a.count + 1 }),
    { gross: 0, net: 0, count: 0 },
  )

  function openNew() {
    setError(undefined)
    setGross(0)
    setGatewayId(prefs?.gateway_id ?? "")
    setApplyFee(true)
    setOpen(true)
  }

  function onSubmit(formData: FormData) {
    setError(undefined)
    startTransition(async () => {
      const res = await createSale(project.id, formData)
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
          <h2 className="font-display text-lg font-semibold">Vendas</h2>
          <p className="text-sm text-muted">
            {totals.count} vendas · bruto {formatCurrency(totals.gross, project.currency)} · líquido{" "}
            <span className="text-positive">{formatCurrency(totals.net, project.currency)}</span>
          </p>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus size={16} /> Registrar venda
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <thead>
              <tr>
                <Th>Data</Th>
                <Th>Produto</Th>
                <Th>Criativo</Th>
                <Th>Origem</Th>
                <Th>Pagamento</Th>
                <Th className="text-right">Bruto</Th>
                <Th className="text-right">Taxas</Th>
                <Th className="text-right">Imposto</Th>
                <Th className="text-right">Líquido</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {sales.length === 0 ? (
                <tr>
                  <Td colSpan={10} className="py-10 text-center text-muted">
                    Nenhuma venda registrada.
                  </Td>
                </tr>
              ) : (
                sales.map((s) => {
                  const prod = products.find((p) => p.id === s.product_id)
                  const creative = creatives.find((c) => c.id === s.creative_id)
                  return (
                    <tr key={s.id}>
                      <Td className="whitespace-nowrap text-muted">{fmtDate(s.sold_at)}</Td>
                      <Td>{prod?.name ?? "—"}</Td>
                      <Td className="text-muted">{creative?.name ?? "—"}</Td>
                      <Td>{s.source ? <Badge>{s.source}</Badge> : <span className="text-muted">—</span>}</Td>
                      <Td className="capitalize">{s.payment_method}</Td>
                      <Td className="text-right font-mono">
                        {formatCurrency(s.gross_amount, project.currency)}
                      </Td>
                      <Td className="text-right font-mono text-muted">
                        {formatCurrency(s.fee_amount, project.currency)}
                      </Td>
                      <Td className="text-right font-mono text-muted">
                        {formatCurrency(s.tax_amount, project.currency)}
                      </Td>
                      <Td className="text-right font-mono text-positive">
                        {formatCurrency(s.net_amount, project.currency)}
                      </Td>
                      <Td>
                        <RowActions onDelete={() => deleteSale(project.id, s.id)} />
                      </Td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </Table>
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Registrar venda">
        <form action={onSubmit} className="flex flex-col gap-4">
          <Field label="Produto (opcional)">
            <Select
              name="product_id"
              onChange={(e) => {
                const p = products.find((x) => x.id === e.target.value)
                if (p) {
                  setGross(p.price)
                  if (p.gateway_id) setGatewayId(p.gateway_id)
                }
              }}
            >
              <option value="">Sem produto</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {formatCurrency(p.price, project.currency)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Criativo que vendeu (opcional)">
            <Select name="creative_id" defaultValue="">
              <option value="">Sem criativo</option>
              {creatives.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={`Valor bruto (${project.currency})`}>
              <Input
                name="gross_amount"
                inputMode="decimal"
                placeholder="0,00"
                value={gross || ""}
                onChange={(e) => setGross(Number.parseFloat(e.target.value.replace(",", ".")) || 0)}
                required
              />
            </Field>
            <Field label="Data">
              <Input name="sold_at" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Onde vendeu (gateway)">
              <Select
                name="gateway_id"
                value={gatewayId}
                onChange={(e) => setGatewayId(e.target.value)}
              >
                <option value="">Nenhum</option>
                {gateways.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.fee_pct}%{g.fee_fixed ? ` + ${g.fee_fixed}` : ""})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Forma de pagamento">
              <SelectOrOther
                name="payment_method"
                options={PAYMENT_METHODS}
                defaultValue={prefs?.payment_method ?? "Pix"}
              />
            </Field>
          </div>

          <Field label="Origem do tráfego">
            <SelectOrOther
              name="source"
              options={SOURCES}
              defaultValue={prefs?.source}
              allowEmpty
              emptyLabel="Não informar"
            />
          </Field>

          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="hidden" name="apply_gateway_fee" value="off" />
            <input
              type="checkbox"
              name="apply_gateway_fee"
              value="on"
              checked={applyFee}
              onChange={(e) => setApplyFee(e.target.checked)}
              className="h-4 w-4 accent-[color:var(--color-primary)]"
            />
            Descontar taxa do gateway
          </label>

          {/* Preview do líquido */}
          <div className="rounded-xl bg-[color:var(--color-surface-2)] p-3 text-sm">
            <div className="flex justify-between text-muted">
              <span>Taxas gateway</span>
              <span className="font-mono">-{formatCurrency(preview.fee, project.currency)}</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>Imposto ({project.tax_pct}%)</span>
              <span className="font-mono">-{formatCurrency(preview.tax, project.currency)}</span>
            </div>
            <div className="mt-1 flex justify-between border-t border-[color:var(--color-border)] pt-1 font-medium">
              <span>Líquido no caixa</span>
              <span className="font-mono text-positive">
                {formatCurrency(preview.net, project.currency)}
              </span>
            </div>
          </div>

          {error ? <p className="text-sm text-negative">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : "Registrar"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
