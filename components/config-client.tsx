"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { PaymentGateway } from "@/lib/types"
import { formatCurrency, formatPercent } from "@/lib/utils"
import { Card, CardContent, Button, Field, Input, Table, Th, Td } from "@/components/ui"
import { Modal } from "@/components/modal"
import { RowActions } from "@/components/row-actions"
import { saveGateway, deleteGateway } from "@/app/actions/projects"
import { Plus, CreditCard } from "lucide-react"

export function ConfigClient({ gateways }: { gateways: PaymentGateway[] }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<PaymentGateway | null>(null)
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()
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

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold">Configurações</h1>
        <p className="text-sm text-muted">
          Gateways de pagamento e suas taxas. As taxas configuradas aqui são deduzidas
          automaticamente do valor bruto ao registrar uma venda.
        </p>
      </header>

      <Card>
        <div className="flex items-center justify-between border-b border-[color:var(--color-border)] px-5 py-4">
          <div className="flex items-center gap-2">
            <CreditCard size={18} className="text-primary" />
            <h2 className="font-medium">Gateways de pagamento</h2>
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
                  <Th>Taxa %</Th>
                  <Th>Taxa fixa</Th>
                  <Th className="text-right">Ações</Th>
                </tr>
              </thead>
              <tbody>
                {gateways.map((g) => (
                  <tr key={g.id}>
                    <Td className="font-medium">{g.name}</Td>
                    <Td>{formatPercent(g.fee_pct)}</Td>
                    <Td>{formatCurrency(g.fee_fixed)}</Td>
                    <Td className="text-right">
                      <RowActions
                        onEdit={() => openEdit(g)}
                        onDelete={() => deleteGateway(g.id)}
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Editar gateway" : "Novo gateway"}
      >
        <form action={onSubmit} className="flex flex-col gap-4">
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <Field label="Nome">
            <Input name="name" placeholder="Ex: Hotmart" defaultValue={editing?.name} required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Taxa (%)">
              <Input name="fee_pct" inputMode="decimal" placeholder="0,00" defaultValue={editing?.fee_pct} />
            </Field>
            <Field label="Taxa fixa (R$)">
              <Input name="fee_fixed" inputMode="decimal" placeholder="0,00" defaultValue={editing?.fee_fixed} />
            </Field>
          </div>
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
    </div>
  )
}
