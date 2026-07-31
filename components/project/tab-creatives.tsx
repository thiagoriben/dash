"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { Creative, Product, Project, Sale } from "@/lib/types"
import { formatCurrency, formatNumber, safeDiv } from "@/lib/utils"
import { creativeSemaphore } from "@/lib/finance"
import { Card, CardContent, Button, Field, Input, Select } from "@/components/ui"
import { SemaphoreBadge } from "@/components/semaphore"
import { Modal } from "@/components/modal"
import { RowActions } from "@/components/row-actions"
import {
  createCreative,
  updateCreative,
  updateCreativeStatus,
  duplicateCreative,
  deleteCreative,
} from "@/app/actions/projects"
import { Plus } from "lucide-react"

const today = () => new Date().toISOString().slice(0, 10)
const fmtDate = (v: string | null) =>
  v ? new Date(v).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—"

const STATUS: { value: Creative["status"]; label: string }[] = [
  { value: "testando", label: "Testando" },
  { value: "escalando", label: "Escalando" },
  { value: "pausado", label: "Pausado" },
  { value: "morto", label: "Morto" },
]

export function TabCreatives({
  project,
  creatives,
  products,
  sales = [],
}: {
  project: Project
  creatives: Creative[]
  products: Product[]
  /** Vendas do projeto — usadas para atualizar vendas/faturamento reais de cada criativo. */
  sales?: Sale[]
}) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Creative | null>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string>()
  const router = useRouter()

  // Agrega as vendas reais por criativo (quantidade e faturamento bruto).
  const salesByCreative = new Map<string, { count: number; revenue: number }>()
  for (const s of sales) {
    if (!s.creative_id) continue
    const cur = salesByCreative.get(s.creative_id) ?? { count: 0, revenue: 0 }
    cur.count += 1
    cur.revenue += s.gross_amount || 0
    salesByCreative.set(s.creative_id, cur)
  }

  // orçamento de teste sugerido = margem do front-end * 1.75
  const front = products.find((f) => f.kind === "front")
  const testBudget = front ? (front.price - front.product_cost) * 1.75 : 0
  const cpaTarget = front ? (front.price - front.product_cost) * 0.7 : 0

  function openNew() {
    setEditing(null)
    setError(undefined)
    setOpen(true)
  }
  function openEdit(c: Creative) {
    setEditing(c)
    setError(undefined)
    setOpen(true)
  }

  function onSubmit(formData: FormData) {
    setError(undefined)
    startTransition(async () => {
      const res = editing
        ? await updateCreative(project.id, editing.id, formData)
        : await createCreative(project.id, formData)
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
          <h2 className="font-display text-lg font-semibold">Criativos</h2>
          <p className="text-sm text-muted">
            {creatives.length} criativos · orçamento de teste sugerido {formatCurrency(testBudget)}
          </p>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus size={16} /> Novo criativo
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {creatives.length === 0 ? (
          <Card className="sm:col-span-2 xl:col-span-3">
            <CardContent className="py-12 text-center text-sm text-muted">
              Nenhum criativo cadastrado.
            </CardContent>
          </Card>
        ) : (
          creatives.map((c) => {
            // Vendas/faturamento reais (das vendas vinculadas) têm prioridade sobre os valores manuais.
            const real = salesByCreative.get(c.id)
            const salesCount = real ? real.count : c.sales
            const revenue = real ? real.revenue : c.revenue
            const roasVal = safeDiv(revenue, c.spend)
            const light = creativeSemaphore(c.spend, salesCount, cpaTarget, testBudget)
            return (
              <Card key={c.id}>
                <CardContent className="flex flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{c.name}</p>
                      <SemaphoreBadge color={light} />
                      <p className="mt-1 text-[11px] text-muted">
                        Criado em {fmtDate(c.created_at)}
                        {c.activated_at ? ` · ativo desde ${fmtDate(c.activated_at)}` : ""}
                      </p>
                    </div>
                    <RowActions
                      onEdit={() => openEdit(c)}
                      onDuplicate={() => duplicateCreative(project.id, c.id)}
                      onDelete={() => deleteCreative(project.id, c.id)}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <Stat label="Gasto" value={formatCurrency(c.spend, project.currency)} />
                    <Stat label="Vendas" value={formatNumber(salesCount)} hint={real ? "auto" : undefined} />
                    <Stat label="ROAS" value={`${formatNumber(roasVal, 2)}x`} />
                  </div>
                  <div className="flex items-center justify-between border-t border-[color:var(--color-border)] pt-2">
                    <Select
                      className="h-8 w-auto text-xs"
                      value={c.status}
                      onChange={(e) =>
                        startTransition(async () => {
                          await updateCreativeStatus(project.id, c.id, e.target.value)
                          router.refresh()
                        })
                      }
                    >
                      {STATUS.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </Select>
                    <span className="font-mono text-sm">{formatCurrency(revenue, project.currency)}</span>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Editar criativo" : "Novo criativo"}
      >
        <form action={onSubmit} className="flex flex-col gap-4">
          <Field label="Nome">
            <Input name="name" placeholder="Ex: VSL headline azul" defaultValue={editing?.name} required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <Select name="status" defaultValue={editing?.status ?? "testando"}>
                {STATUS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Ativado em">
              <Input
                name="activated_at"
                type="date"
                defaultValue={editing?.activated_at ?? today()}
              />
            </Field>
            <Field label="Gasto">
              <Input name="spend" inputMode="decimal" placeholder="0,00" defaultValue={editing?.spend} />
            </Field>
            <Field label="Vendas">
              <Input name="sales" inputMode="numeric" placeholder="0" defaultValue={editing?.sales} />
            </Field>
          </div>
          <Field label="Faturamento">
            <Input name="revenue" inputMode="decimal" placeholder="0,00" defaultValue={editing?.revenue} />
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

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-[color:var(--color-border)] bg-white/[0.02] p-2">
      <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-muted">
        {label}
        {hint ? <span className="rounded bg-primary/15 px-1 text-[8px] text-primary">{hint}</span> : null}
      </div>
      <div className="font-mono text-sm">{value}</div>
    </div>
  )
}
