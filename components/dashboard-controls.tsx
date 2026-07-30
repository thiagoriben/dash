"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import type { Project, SpendView, ProfitBase } from "@/lib/types"
import { Select, Button } from "@/components/ui"
import { WIDGET_LABELS, type WidgetKey } from "@/lib/dashboard-widgets"
import { saveViewPrefs } from "@/app/actions/projects"
import { cn } from "@/lib/utils"
import { SlidersHorizontal, ChevronUp, ChevronDown, X } from "lucide-react"

const PRESETS = [
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "90d", label: "90 dias" },
  { key: "ano", label: "1 ano" },
  { key: "tudo", label: "Tudo" },
] as const

const SPEND_VIEWS: { value: SpendView; label: string }[] = [
  { value: "ads", label: "Só gasto com anúncios" },
  { value: "card", label: "Total cobrado no cartão" },
  { value: "combined", label: "Gasto total (com imposto)" },
  { value: "ads_tax", label: "Anúncios + imposto discreto" },
  { value: "card_tax", label: "Cartão + imposto discreto" },
]

export function DashboardControls({
  projects,
  offerTypes,
  regions,
  currencies,
  spendView,
  profitBase,
  metaTaxPct,
  widgets,
  allWidgets,
  scope = "dash",
}: {
  projects: Project[]
  offerTypes: string[]
  regions: string[]
  currencies: string[]
  spendView: SpendView
  profitBase: ProfitBase
  metaTaxPct: number
  widgets: WidgetKey[]
  allWidgets: WidgetKey[]
  scope?: "dash" | "project"
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<"filtros" | "kpis">("filtros")
  const ref = useRef<HTMLDivElement>(null)

  // Estado local de widgets para edição (ordem + seleção).
  const [localWidgets, setLocalWidgets] = useState<WidgetKey[]>(widgets)
  useEffect(() => setLocalWidgets(widgets), [widgets])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [open])

  const from = searchParams.get("from") ?? ""
  const to = searchParams.get("to") ?? ""
  const custom = Boolean(from || to)
  const period = searchParams.get("period") ?? "30d"
  const val = (k: string) => searchParams.get(k) ?? ""

  function setParam(patch: Record<string, string | null>, clearDates = false) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") params.delete(k)
      else params.set(k, v)
    }
    if (clearDates) {
      params.delete("from")
      params.delete("to")
    }
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }

  const activeFilters = ["project", "region", "currency", "offer", "spend"].filter((k) => val(k)).length

  function toggleWidget(k: WidgetKey) {
    setLocalWidgets((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]))
  }
  function moveWidget(k: WidgetKey, dir: -1 | 1) {
    setLocalWidgets((prev) => {
      const i = prev.indexOf(k)
      const j = i + dir
      if (i < 0 || j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }
  function saveWidgets() {
    startTransition(async () => {
      await saveViewPrefs(scope === "dash" ? { dash_widgets: localWidgets } : { project_widgets: localWidgets })
      router.refresh()
    })
  }

  const inactiveWidgets = allWidgets.filter((k) => !localWidgets.includes(k))

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-xl border border-[color:var(--color-border)] px-3 py-2 text-sm text-muted transition-colors hover:bg-white/5 hover:text-foreground"
      >
        <SlidersHorizontal size={16} className="text-primary" />
        Filtros e visão
        {(activeFilters > 0 || custom) && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-[#04121a]">
            {activeFilters + (custom ? 1 : 0)}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-[340px] rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <div className="inline-flex rounded-lg border border-[color:var(--color-border)] p-0.5">
              <TabBtn active={tab === "filtros"} onClick={() => setTab("filtros")}>Filtros</TabBtn>
              <TabBtn active={tab === "kpis"} onClick={() => setTab("kpis")}>KPIs</TabBtn>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Fechar" className="text-muted hover:text-foreground">
              <X size={16} />
            </button>
          </div>

          {tab === "filtros" ? (
            <div className="flex flex-col gap-4">
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted">Período</p>
                <div className="flex flex-wrap gap-1">
                  {PRESETS.map((p) => (
                    <button
                      key={p.key}
                      onClick={() => setParam({ period: p.key }, true)}
                      className={cn(
                        "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                        !custom && period === p.key
                          ? "bg-primary text-[#04121a]"
                          : "text-muted hover:bg-white/5 hover:text-foreground",
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="date"
                    aria-label="Data inicial"
                    value={from}
                    onChange={(e) => setParam({ from: e.target.value, period: null })}
                    className="h-9 flex-1 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-2 text-sm"
                  />
                  <span className="text-xs text-muted">até</span>
                  <input
                    type="date"
                    aria-label="Data final"
                    value={to}
                    onChange={(e) => setParam({ to: e.target.value, period: null })}
                    className="h-9 flex-1 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-2 text-sm"
                  />
                </div>
              </div>

              <Row label="Projeto">
                <Select value={val("project")} onChange={(e) => setParam({ project: e.target.value })} className="h-9">
                  <option value="">Todos</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </Select>
              </Row>
              <div className="grid grid-cols-2 gap-2">
                <Row label="Região">
                  <Select value={val("region")} onChange={(e) => setParam({ region: e.target.value })} className="h-9">
                    <option value="">Todas</option>
                    {regions.map((r) => <option key={r} value={r}>{r}</option>)}
                  </Select>
                </Row>
                <Row label="Moeda">
                  <Select value={val("currency")} onChange={(e) => setParam({ currency: e.target.value })} className="h-9">
                    <option value="">Todas</option>
                    {currencies.map((c) => <option key={c} value={c.toUpperCase()}>{c.toUpperCase()}</option>)}
                  </Select>
                </Row>
              </div>
              {offerTypes.length > 0 && (
                <Row label="Tipo de oferta">
                  <Select value={val("offer")} onChange={(e) => setParam({ offer: e.target.value })} className="h-9">
                    <option value="">Todas</option>
                    {offerTypes.map((o) => <option key={o} value={o}>{o}</option>)}
                  </Select>
                </Row>
              )}

              <div className="border-t border-[color:var(--color-border)] pt-3">
                <Row label="Como exibir o gasto">
                  <Select value={spendView} onChange={(e) => setParam({ sv: e.target.value })} className="h-9">
                    {SPEND_VIEWS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </Select>
                </Row>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Row label="Base do lucro">
                    <Select value={profitBase} onChange={(e) => setParam({ pb: e.target.value })} className="h-9">
                      <option value="ads">Gasto com anúncios</option>
                      <option value="card">Total cobrado (imposto)</option>
                    </Select>
                  </Row>
                  <Row label="% imposto Meta">
                    <input
                      type="number"
                      step="0.1"
                      defaultValue={metaTaxPct || ""}
                      placeholder="0"
                      onBlur={(e) =>
                        startTransition(async () => {
                          await saveViewPrefs({ meta_tax_pct: Number(e.target.value) || 0 })
                          router.refresh()
                        })
                      }
                      className="h-9 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-2 text-sm"
                    />
                  </Row>
                </div>
                <p className="mt-1.5 text-[11px] text-muted">
                  A % é somada ao gasto de anúncios para estimar o total com impostos da Meta quando não há cobrança lançada.
                </p>
              </div>
              {pending && <p className="text-xs text-muted">Atualizando…</p>}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-muted">Ative, desative e reordene os cartões da dashboard.</p>
              <div className="flex flex-col gap-1.5">
                {localWidgets.map((k, i) => (
                  <div
                    key={k}
                    className="flex items-center justify-between rounded-lg border border-[color:var(--color-border)] px-2.5 py-1.5 text-sm"
                  >
                    <span>{WIDGET_LABELS[k]}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => moveWidget(k, -1)}
                        disabled={i === 0}
                        aria-label="Mover para cima"
                        className="text-muted hover:text-foreground disabled:opacity-30"
                      >
                        <ChevronUp size={15} />
                      </button>
                      <button
                        onClick={() => moveWidget(k, 1)}
                        disabled={i === localWidgets.length - 1}
                        aria-label="Mover para baixo"
                        className="text-muted hover:text-foreground disabled:opacity-30"
                      >
                        <ChevronDown size={15} />
                      </button>
                      <button
                        onClick={() => toggleWidget(k)}
                        aria-label="Remover"
                        className="ml-1 text-negative hover:opacity-80"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {inactiveWidgets.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted">Adicionar</p>
                  <div className="flex flex-wrap gap-1.5">
                    {inactiveWidgets.map((k) => (
                      <button
                        key={k}
                        onClick={() => toggleWidget(k)}
                        className="rounded-lg border border-dashed border-[color:var(--color-border)] px-2.5 py-1 text-xs text-muted hover:border-primary hover:text-foreground"
                      >
                        + {WIDGET_LABELS[k]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <Button size="sm" onClick={saveWidgets} disabled={pending}>
                {pending ? "Salvando…" : "Salvar layout"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-md px-3 py-1 text-xs font-medium transition-colors",
        active ? "bg-accent text-accent-fg" : "text-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  )
}
