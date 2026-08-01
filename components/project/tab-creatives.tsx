"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { Creative, Product, Project, Sale } from "@/lib/types"
import { formatCurrency, formatNumber, safeDiv } from "@/lib/utils"
import { creativeSemaphore } from "@/lib/finance"
import { inputToProject, currencySymbol } from "@/lib/currency"
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
import { Plus, ImageIcon, Video, ExternalLink, Play } from "lucide-react"

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
  usdBrl = 1,
  currencies = ["BRL", "USD", "EUR"],
}: {
  project: Project
  creatives: Creative[]
  products: Product[]
  /** Vendas do projeto — usadas para atualizar vendas/faturamento reais de cada criativo. */
  sales?: Sale[]
  usdBrl?: number
  currencies?: string[]
}) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Creative | null>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string>()
  const [preview, setPreview] = useState<Creative | null>(null)
  const router = useRouter()

  const projectCurrency = String(project.currency).toUpperCase()
  const currencyOptions = Array.from(
    new Set([projectCurrency, "BRL", ...currencies].map((c) => c.toUpperCase())),
  )
  // Moeda em que o gasto do criativo está sendo digitado (convertido para a moeda do projeto ao salvar).
  const [spendCurrency, setSpendCurrency] = useState(projectCurrency)

  // Agrega as vendas reais por criativo (quantidade e faturamento bruto).
  const salesByCreative = new Map<string, { count: number; revenue: number }>()
  for (const s of sales) {
    if (!s.creative_id) continue
    const cur = salesByCreative.get(s.creative_id) ?? { count: 0, revenue: 0 }
    cur.count += 1
    cur.revenue += s.gross_amount || 0
    salesByCreative.set(s.creative_id, cur)
  }

  // Valores reais (vendas vinculadas) do criativo em edição — usados para sincronizar o modal com o card.
  const editingReal = editing ? salesByCreative.get(editing.id) : undefined

  // orçamento de teste sugerido = margem do front-end * 1.75
  const front = products.find((f) => f.kind === "front")
  const testBudget = front ? (front.price - front.product_cost) * 1.75 : 0
  const cpaTarget = front ? (front.price - front.product_cost) * 0.7 : 0

  function openNew() {
    setEditing(null)
    setSpendCurrency(projectCurrency)
    setError(undefined)
    setOpen(true)
  }
  function openEdit(c: Creative) {
    setEditing(c)
    setSpendCurrency(projectCurrency)
    setError(undefined)
    setOpen(true)
  }

  function onSubmit(formData: FormData) {
    setError(undefined)
    // Converte o gasto da moeda digitada para a moeda do projeto antes de salvar.
    formData.set("spend", String(inputToProject(String(formData.get("spend") ?? ""), spendCurrency, projectCurrency, usdBrl)))
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
                  {c.media_url ? (
                    <button
                      type="button"
                      onClick={() => setPreview(c)}
                      className="group relative aspect-video w-full overflow-hidden rounded-lg border border-[color:var(--color-border)] bg-black/30"
                      title="Pré-visualizar"
                    >
                      {c.media_type === "video" ? (
                        <>
                          {/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(c.media_url) ? (
                            <video src={c.media_url} className="h-full w-full object-cover" muted preload="metadata" />
                          ) : (
                            <div className="grid h-full w-full place-items-center bg-white/[0.03]">
                              <Video size={26} className="text-muted" />
                            </div>
                          )}
                          <span className="absolute inset-0 grid place-items-center">
                            <span className="grid h-10 w-10 place-items-center rounded-full bg-black/60 text-white transition-transform group-hover:scale-110">
                              <Play size={18} className="ml-0.5" />
                            </span>
                          </span>
                        </>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.media_url || "/placeholder.svg"} alt={c.name} className="h-full w-full object-cover" crossOrigin="anonymous" />
                      )}
                    </button>
                  ) : null}
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
              <div className="flex gap-2">
                <Input
                  name="spend"
                  inputMode="decimal"
                  placeholder="0,00"
                  defaultValue={editing?.spend}
                  className="flex-1"
                />
                <Select
                  aria-label="Moeda do gasto"
                  value={spendCurrency}
                  onChange={(e) => setSpendCurrency(e.target.value)}
                  className="w-24 shrink-0"
                >
                  {currencyOptions.map((c) => (
                    <option key={c} value={c}>
                      {currencySymbol(c)} {c}
                    </option>
                  ))}
                </Select>
              </div>
            </Field>
            <Field
              label="Vendas"
              hint={editingReal ? "Automático pelas vendas vinculadas" : undefined}
            >
              <Input
                name="sales"
                inputMode="numeric"
                placeholder="0"
                defaultValue={editingReal ? editingReal.count : editing?.sales}
                readOnly={!!editingReal}
              />
            </Field>
          </div>
          <Field
            label={`Faturamento (${projectCurrency})`}
            hint={editingReal ? "Somado automaticamente das vendas vinculadas" : undefined}
          >
            <Input
              name="revenue"
              inputMode="decimal"
              placeholder="0,00"
              defaultValue={editingReal ? Number(editingReal.revenue.toFixed(2)) : editing?.revenue}
              readOnly={!!editingReal}
            />
          </Field>

          <div className="grid grid-cols-[1fr_auto] gap-3">
            <Field label="Link da mídia (imagem ou vídeo)">
              <Input
                name="media_url"
                type="url"
                placeholder="https://..."
                defaultValue={editing?.media_url ?? ""}
              />
            </Field>
            <Field label="Tipo">
              <Select name="media_type" defaultValue={editing?.media_type ?? ""}>
                <option value="">Auto</option>
                <option value="image">Imagem</option>
                <option value="video">Vídeo</option>
              </Select>
            </Field>
          </div>
          <div className="rounded-lg border border-[color:var(--color-border)] bg-white/[0.02] p-3 text-xs text-muted">
            <p className="mb-1 font-medium text-foreground/80">Como subir seu criativo na nuvem:</p>
            <ol className="ml-4 list-decimal space-y-0.5">
              <li>Suba o arquivo em uma ferramenta gratuita — imagem no{" "}
                <a href="https://imgur.com/upload" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Imgur</a>{" "}
                ou{" "}
                <a href="https://postimages.org" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">PostImages</a>;
                vídeo no{" "}
                <a href="https://streamable.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Streamable</a>{" "}
                ou Google Drive (link público).
              </li>
              <li>Copie o link direto do arquivo e cole no campo acima.</li>
              <li>Salve — o criativo mostra a pré-visualização automaticamente.</li>
            </ol>
          </div>

          {error ? <p className="text-sm text-negative">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={pending}>{pending ? "Salvando..." : "Salvar"}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.name ?? "Criativo"}>
        {preview?.media_url ? (
          <div className="flex flex-col gap-3">
            <div className="overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-black/40">
              {preview.media_type === "video" ? (
                /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(preview.media_url) ? (
                  <video src={preview.media_url} className="max-h-[60vh] w-full" controls autoPlay crossOrigin="anonymous" />
                ) : (
                  <div className="flex flex-col items-center gap-3 p-8 text-center text-sm text-muted">
                    <Video size={32} />
                    <p>Este vídeo está hospedado em uma plataforma externa.</p>
                  </div>
                )
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.media_url || "/placeholder.svg"} alt={preview.name} className="max-h-[60vh] w-full object-contain" crossOrigin="anonymous" />
              )}
            </div>
            <a
              href={preview.media_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              {preview.media_type === "video" ? <Video size={14} /> : <ImageIcon size={14} />}
              Abrir mídia original
              <ExternalLink size={13} />
            </a>
          </div>
        ) : null}
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
