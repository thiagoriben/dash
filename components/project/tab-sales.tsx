"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type {
  AdAccount,
  Creative,
  PaymentGateway,
  Prefs,
  Product,
  Project,
  Sale,
  SaleItem,
  SaleItemRole,
} from "@/lib/types"
import { SALE_ITEM_ROLE_LABELS } from "@/lib/types"
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
import { RankingBarChart, type RankingDatum } from "@/components/ranking-bar-chart"
import { SelectOrOther } from "@/components/select-or-other"
import { createSale, updateSale, deleteSale } from "@/app/actions/projects"
import { Plus, Trash2 } from "lucide-react"

const PAYMENT_METHODS = ["Pix", "Cartão", "Boleto", "PayPal"]
const SOURCES = ["Facebook Ads", "Google Ads", "Orgânico", "Instagram", "Afiliado", "Direto"]
const ROLES: SaleItemRole[] = ["front", "order_bump", "upsell", "downsell"]

/** Linha do editor de itens (multi-produto). */
type ItemDraft = {
  key: string
  product_id: string
  role: SaleItemRole
  gross_amount: number
  quantity: number
}

let draftSeq = 0
const newDraft = (patch: Partial<ItemDraft> = {}): ItemDraft => ({
  key: `d${draftSeq++}`,
  product_id: "",
  role: "front",
  gross_amount: 0,
  quantity: 1,
  ...patch,
})

export function TabSales({
  project,
  sales,
  products,
  creatives,
  gateways,
  adAccounts,
  prefs,
}: {
  project: Project
  sales: Sale[]
  products: Product[]
  creatives: Creative[]
  gateways: PaymentGateway[]
  adAccounts: AdAccount[]
  prefs: Prefs | null
}) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Sale | null>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string>()
  const router = useRouter()

  // Estado do formulário (compartilhado entre criar e editar).
  const [gatewayId, setGatewayId] = useState(prefs?.gateway_id ?? "")
  const [applyFee, setApplyFee] = useState(true)
  const [items, setItems] = useState<ItemDraft[]>([newDraft()])
  // Valor manual usado apenas quando não há itens com produto (venda avulsa).
  const [manualGross, setManualGross] = useState(0)

  // Soma dos itens preenchidos; se ninguém preencheu produto/valor, usa o valor manual.
  const itemsTotal = items.reduce((a, it) => a + (it.gross_amount || 0) * (it.quantity || 1), 0)
  const hasItems = items.some((it) => it.product_id || it.gross_amount > 0)
  const gross = hasItems ? itemsTotal : manualGross

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

  // Rankings por faturamento bruto — usados nos gráficos de barras.
  const rankings = useMemo(() => {
    const byCreative = new Map<string, number>()
    const byProduct = new Map<string, number>()
    const bySource = new Map<string, number>()
    for (const s of sales) {
      if (s.creative_id) {
        const name = creatives.find((c) => c.id === s.creative_id)?.name ?? "—"
        byCreative.set(name, (byCreative.get(name) ?? 0) + s.gross_amount)
      }
      // Cada item da venda soma no seu produto; vendas antigas usam o product_id direto.
      const items = (s.items ?? []) as SaleItem[]
      if (items.length > 0) {
        for (const it of items) {
          const name = products.find((p) => p.id === it.product_id)?.name ?? "Avulso"
          byProduct.set(name, (byProduct.get(name) ?? 0) + (it.gross_amount || 0) * (it.quantity || 1))
        }
      } else if (s.product_id) {
        const name = products.find((p) => p.id === s.product_id)?.name ?? "Avulso"
        byProduct.set(name, (byProduct.get(name) ?? 0) + s.gross_amount)
      }
      const src = s.source || "Não informada"
      bySource.set(src, (bySource.get(src) ?? 0) + s.gross_amount)
    }
    const toArr = (m: Map<string, number>): RankingDatum[] =>
      [...m.entries()].map(([name, value]) => ({ name, value }))
    return { creatives: toArr(byCreative), products: toArr(byProduct), sources: toArr(bySource) }
  }, [sales, creatives, products])

  function resetForm() {
    setError(undefined)
    setGatewayId(prefs?.gateway_id ?? "")
    setApplyFee(true)
    setItems([newDraft()])
    setManualGross(0)
  }

  function openNew() {
    setEditing(null)
    resetForm()
    setOpen(true)
  }

  function openEdit(sale: Sale) {
    setEditing(sale)
    setError(undefined)
    setGatewayId(sale.gateway_id ?? "")
    setApplyFee(sale.apply_gateway_fee)
    setManualGross(sale.gross_amount)
    const existing = (sale.items ?? []) as SaleItem[]
    if (existing.length > 0) {
      setItems(
        existing.map((it) =>
          newDraft({
            product_id: it.product_id ?? "",
            role: it.role,
            gross_amount: it.gross_amount,
            quantity: it.quantity,
          }),
        ),
      )
    } else if (sale.product_id) {
      // Vendas antigas (1 produto) viram 1 item front para edição.
      setItems([newDraft({ product_id: sale.product_id, gross_amount: sale.gross_amount })])
    } else {
      setItems([newDraft()])
    }
    setOpen(true)
  }

  function updateItem(key: string, patch: Partial<ItemDraft>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)))
  }
  function addItem() {
    setItems((prev) => [...prev, newDraft({ role: prev.length === 0 ? "front" : "order_bump" })])
  }
  function removeItem(key: string) {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((it) => it.key !== key)))
  }

  function onSubmit(formData: FormData) {
    setError(undefined)
    // Serializa os itens com produto/valor preenchido.
    const payloadItems = items
      .filter((it) => it.product_id || it.gross_amount > 0)
      .map((it) => ({
        product_id: it.product_id || null,
        role: it.role,
        gross_amount: it.gross_amount,
        quantity: it.quantity,
      }))
    formData.set("items", JSON.stringify(payloadItems))
    formData.set("gross_amount", String(gross))
    // Produto principal (compatibilidade): o item "front" ou o primeiro item.
    const main = payloadItems.find((it) => it.role === "front") ?? payloadItems[0]
    formData.set("product_id", main?.product_id ?? "")

    startTransition(async () => {
      const res = editing
        ? await updateSale(project.id, editing.id, formData)
        : await createSale(project.id, formData)
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

      {sales.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardContent className="flex flex-col gap-2 p-4">
              <h3 className="text-sm font-medium text-muted">Ranking de criativos</h3>
              <RankingBarChart data={rankings.creatives} currency={project.currency} emptyLabel="Nenhuma venda com criativo." />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col gap-2 p-4">
              <h3 className="text-sm font-medium text-muted">Ranking de produtos</h3>
              <RankingBarChart data={rankings.products} currency={project.currency} emptyLabel="Nenhuma venda com produto." />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col gap-2 p-4">
              <h3 className="text-sm font-medium text-muted">Ranking de origens</h3>
              <RankingBarChart data={rankings.sources} currency={project.currency} emptyLabel="Nenhuma origem registrada." />
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardContent className="p-0">
          <Table>
            <thead>
              <tr>
                <Th>Data</Th>
                <Th>Produtos</Th>
                <Th>Criativo</Th>
                <Th>Conta</Th>
                <Th>Origem</Th>
                <Th>Pagamento</Th>
                <Th className="text-right">Bruto</Th>
                <Th className="text-right">Líquido</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {sales.length === 0 ? (
                <tr>
                  <Td colSpan={9} className="py-10 text-center text-muted">
                    Nenhuma venda registrada.
                  </Td>
                </tr>
              ) : (
                sales.map((s) => {
                  const creative = creatives.find((c) => c.id === s.creative_id)
                  const acc = adAccounts.find((a) => a.id === s.ad_account_id)
                  const saleItems = (s.items ?? []) as SaleItem[]
                  const productLabel =
                    saleItems.length > 0
                      ? saleItems
                          .map((it) => products.find((p) => p.id === it.product_id)?.name ?? "—")
                          .join(", ")
                      : (products.find((p) => p.id === s.product_id)?.name ?? "—")
                  return (
                    <tr key={s.id}>
                      <Td className="whitespace-nowrap text-muted">{fmtDate(s.sold_at)}</Td>
                      <Td>
                        <div className="flex flex-wrap items-center gap-1">
                          <span>{productLabel}</span>
                          {saleItems.length > 1 ? (
                            <Badge className="text-[10px]">{saleItems.length} itens</Badge>
                          ) : null}
                        </div>
                      </Td>
                      <Td className="text-muted">{creative?.name ?? "—"}</Td>
                      <Td className="text-muted">{acc?.account_name ?? "—"}</Td>
                      <Td>{s.source ? <Badge>{s.source}</Badge> : <span className="text-muted">—</span>}</Td>
                      <Td className="capitalize">{s.payment_method}</Td>
                      <Td className="text-right font-mono">
                        {formatCurrency(s.gross_amount, project.currency)}
                      </Td>
                      <Td className="text-right font-mono text-positive">
                        {formatCurrency(s.net_amount, project.currency)}
                      </Td>
                      <Td>
                        <RowActions
                          onEdit={() => openEdit(s)}
                          onDelete={() => deleteSale(project.id, s.id)}
                        />
                      </Td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </Table>
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Editar venda" : "Registrar venda"}>
        <form action={onSubmit} className="flex flex-col gap-4">
          {/* Editor de itens (multi-produto) */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Produtos da venda</span>
              <Button variant="outline" size="sm" type="button" onClick={addItem}>
                <Plus size={14} /> Adicionar produto
              </Button>
            </div>
            {items.map((it) => (
              <div
                key={it.key}
                className="grid grid-cols-[1fr_auto_auto_auto] items-end gap-2 rounded-xl bg-[color:var(--color-surface-2)] p-2"
              >
                <Field label="Produto">
                  <Select
                    value={it.product_id}
                    onChange={(e) => {
                      const p = products.find((x) => x.id === e.target.value)
                      updateItem(it.key, {
                        product_id: e.target.value,
                        gross_amount: p ? p.price : it.gross_amount,
                      })
                      if (p?.gateway_id) setGatewayId(p.gateway_id)
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
                <Field label="Rótulo">
                  <Select
                    value={it.role}
                    onChange={(e) => updateItem(it.key, { role: e.target.value as SaleItemRole })}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {SALE_ITEM_ROLE_LABELS[r]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Valor">
                  <Input
                    className="w-24"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={it.gross_amount || ""}
                    onChange={(e) =>
                      updateItem(it.key, {
                        gross_amount: Number.parseFloat(e.target.value.replace(",", ".")) || 0,
                      })
                    }
                  />
                </Field>
                <button
                  type="button"
                  onClick={() => removeItem(it.key)}
                  className="mb-1 rounded-lg p-2 text-muted hover:text-negative"
                  aria-label="Remover produto"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {!hasItems ? (
              <Field label={`Valor bruto avulso (${project.currency})`} hint="Use quando a venda não tiver produto cadastrado.">
                <Input
                  inputMode="decimal"
                  placeholder="0,00"
                  value={manualGross || ""}
                  onChange={(e) => setManualGross(Number.parseFloat(e.target.value.replace(",", ".")) || 0)}
                />
              </Field>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Criativo que vendeu (opcional)">
              <Select name="creative_id" defaultValue={editing?.creative_id ?? ""}>
                <option value="">Sem criativo</option>
                {creatives.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Conta de anúncio (opcional)">
              <Select name="ad_account_id" defaultValue={editing?.ad_account_id ?? ""}>
                <option value="">Sem conta</option>
                {adAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.account_name}
                    {a.bm_name ? ` · ${a.bm_name}` : ""}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Data">
              <Input name="sold_at" type="date" defaultValue={editing?.sold_at ?? new Date().toISOString().slice(0, 10)} />
            </Field>
            <Field label="Onde vendeu (gateway)">
              <Select name="gateway_id" value={gatewayId} onChange={(e) => setGatewayId(e.target.value)}>
                <option value="">Nenhum</option>
                {gateways.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.fee_pct}%{g.fee_fixed ? ` + ${g.fee_fixed}` : ""})
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Forma de pagamento">
              <SelectOrOther
                name="payment_method"
                options={PAYMENT_METHODS}
                defaultValue={editing?.payment_method ?? prefs?.payment_method ?? "Pix"}
              />
            </Field>
            <Field label="Origem do tráfego">
              <SelectOrOther
                name="source"
                options={SOURCES}
                defaultValue={editing?.source ?? prefs?.source ?? undefined}
                allowEmpty
                emptyLabel="Não informar"
              />
            </Field>
          </div>

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
              <span>Bruto</span>
              <span className="font-mono">{formatCurrency(gross, project.currency)}</span>
            </div>
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
              {pending ? "Salvando..." : editing ? "Salvar" : "Registrar"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
