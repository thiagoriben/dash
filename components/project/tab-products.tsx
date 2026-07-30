"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { PaymentGateway, Product, ProductKind, Project } from "@/lib/types"
import { formatCurrency } from "@/lib/utils"
import { computeSaleNet } from "@/lib/finance"
import {
  Card,
  CardContent,
  Button,
  Field,
  Input,
  Select,
  Badge,
  Table,
  Th,
  Td,
} from "@/components/ui"
import { Modal } from "@/components/modal"
import { RowActions } from "@/components/row-actions"
import { createProduct, updateProduct, duplicateProduct, deleteProduct } from "@/app/actions/projects"
import { Plus } from "lucide-react"

const KINDS: { value: ProductKind; label: string }[] = [
  { value: "front", label: "Front-end" },
  { value: "orderbump", label: "Order Bump" },
  { value: "upsell", label: "Upsell" },
  { value: "downsell", label: "Downsell" },
]
const kindLabel = (k: string) => KINDS.find((x) => x.value === k)?.label ?? k

export function TabProducts({
  project,
  products,
  gateways,
}: {
  project: Project
  products: Product[]
  gateways: PaymentGateway[]
}) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string>()
  const router = useRouter()

  function openNew() {
    setEditing(null)
    setError(undefined)
    setOpen(true)
  }
  function openEdit(p: Product) {
    setEditing(p)
    setError(undefined)
    setOpen(true)
  }

  function onSubmit(formData: FormData) {
    setError(undefined)
    startTransition(async () => {
      const res = editing
        ? await updateProduct(project.id, editing.id, formData)
        : await createProduct(project.id, formData)
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
          <h2 className="font-display text-lg font-semibold">Produtos</h2>
          <p className="text-sm text-muted">
            Cadastre uma vez; use no funil, nas vendas e na calculadora.
          </p>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus size={16} /> Produto
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <thead>
              <tr>
                <Th>Produto</Th>
                <Th>Etapa</Th>
                <Th>Gateway</Th>
                <Th className="text-right">Preço</Th>
                <Th className="text-right">Custo</Th>
                <Th className="text-right">Líquido est.</Th>
                <Th>Funil</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <Td colSpan={8} className="py-10 text-center text-muted">
                    Nenhum produto cadastrado.
                  </Td>
                </tr>
              ) : (
                products.map((p) => {
                  const gw = gateways.find((g) => g.id === p.gateway_id)
                  const { net } = computeSaleNet({
                    gross: p.price,
                    applyFee: !!gw,
                    feePct: gw?.fee_pct ?? 0,
                    feeFixed: gw?.fee_fixed ?? 0,
                    taxPct: project.tax_pct,
                  })
                  return (
                    <tr key={p.id}>
                      <Td className="font-medium">{p.name}</Td>
                      <Td>
                        <Badge>{kindLabel(p.kind)}</Badge>
                      </Td>
                      <Td className="text-muted">{gw?.name ?? "—"}</Td>
                      <Td className="text-right font-mono">
                        {formatCurrency(p.price, project.currency)}
                      </Td>
                      <Td className="text-right font-mono text-muted">
                        {formatCurrency(p.product_cost, project.currency)}
                      </Td>
                      <Td className="text-right font-mono text-positive">
                        {formatCurrency(net - p.product_cost, project.currency)}
                      </Td>
                      <Td>
                        {p.in_funnel ? (
                          <Badge tone="primary">No funil</Badge>
                        ) : (
                          <span className="text-xs text-muted">fora</span>
                        )}
                      </Td>
                      <Td>
                        <RowActions
                          onEdit={() => openEdit(p)}
                          onDuplicate={() => duplicateProduct(project.id, p.id)}
                          onDelete={() => deleteProduct(project.id, p.id)}
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

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Editar produto" : "Novo produto"}
      >
        <form action={onSubmit} className="flex flex-col gap-4">
          <Field label="Nome">
            <Input name="name" placeholder="Ex: Oferta principal" defaultValue={editing?.name} required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Etapa (o que é)">
              <Select name="kind" defaultValue={editing?.kind ?? "front"}>
                {KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Onde vende (gateway)">
              <Select name="gateway_id" defaultValue={editing?.gateway_id ?? ""}>
                <option value="">Nenhum</option>
                {gateways.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.fee_pct}%{g.fee_fixed ? ` + ${g.fee_fixed}` : ""})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={`Preço (${project.currency})`}>
              <Input
                name="price"
                inputMode="decimal"
                placeholder="0,00"
                defaultValue={editing?.price}
              />
            </Field>
            <Field label="Custo do produto">
              <Input
                name="product_cost"
                inputMode="decimal"
                placeholder="0,00"
                defaultValue={editing?.product_cost}
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="hidden" name="in_funnel" value="off" />
            <input
              type="checkbox"
              name="in_funnel"
              value="on"
              defaultChecked={editing ? editing.in_funnel : true}
              className="h-4 w-4 accent-[color:var(--color-primary)]"
            />
            Incluir no funil
          </label>
          {error ? <p className="text-sm text-negative">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>
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
