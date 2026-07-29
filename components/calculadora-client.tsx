"use client"

import { useMemo, useState } from "react"
import { Card, Button, Input, Select } from "@/components/ui"
import { Semaphore } from "@/components/semaphore"
import { fmtMoney, fmtPct, computeReal, computePlan, type RealInputs, type PlanInputs } from "@/lib/finance"
import type { Product, Project } from "@/lib/types"
import { Calculator, Target } from "lucide-react"

type ProductOption = Product & { projectName: string }

type Mode = "real" | "plan"

function Field({
  label,
  value,
  onChange,
  suffix,
  step = "0.01",
}: {
  label: string
  value: number
  onChange: (n: number) => void
  suffix?: string
  step?: string
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-muted">{label}</span>
      <div className="relative">
        <Input
          type="number"
          step={step}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(Number.parseFloat(e.target.value) || 0)}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">
            {suffix}
          </span>
        )}
      </div>
    </label>
  )
}

function ResultRow({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 py-2 text-sm last:border-0">
      <span className="text-muted">{label}</span>
      <span className={mono ? "font-mono font-medium" : "font-medium"}>{value}</span>
    </div>
  )
}

export function CalculadoraClient({
  projects,
  products = [],
}: {
  projects: Project[]
  products?: ProductOption[]
}) {
  const [mode, setMode] = useState<Mode>("real")

  // Modo real
  const [real, setReal] = useState<RealInputs>({
    revenue: 10000,
    sales: 100,
    spend: 4000,
    productCost: 15,
    gatewayPct: 5,
    taxPct: 6,
    targetMarginPct: 30,
  })
  const realRes = useMemo(() => computeReal(real), [real])
  const setR = (k: keyof RealInputs) => (n: number) => setReal((s) => ({ ...s, [k]: n }))

  // Selecionar um produto cadastrado preenche custo e ticket automaticamente.
  function pickProduct(id: string) {
    const p = products.find((x) => x.id === id)
    if (!p) return
    setReal((s) => ({
      ...s,
      productCost: p.product_cost,
      revenue: p.price * (s.sales || 1),
    }))
  }

  // Modo plano
  const [plan, setPlan] = useState<PlanInputs>({
    frontPrice: 97,
    extras: 40,
    productCost: 15,
    gatewayPct: 5,
    taxPct: 6,
    targetMarginPct: 30,
    expectedConversionPct: 2,
    budget: 3000,
  })
  const planRes = useMemo(() => computePlan(plan), [plan])
  const setP = (k: keyof PlanInputs) => (n: number) => setPlan((s) => ({ ...s, [k]: n }))

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold">Calculadora</h1>
        <p className="text-sm text-muted">
          Descubra o CPA de breakeven, o CPA alvo e o ROAS mínimo para cada oferta.
        </p>
      </header>

      <div className="inline-flex rounded-xl border border-border bg-surface p-1">
        <button
          onClick={() => setMode("real")}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            mode === "real" ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "text-muted hover:text-fg"
          }`}
        >
          <Calculator className="size-4" /> Modo Real
        </button>
        <button
          onClick={() => setMode("plan")}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            mode === "plan" ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "text-muted hover:text-fg"
          }`}
        >
          <Target className="size-4" /> Planejamento
        </button>
      </div>

      {mode === "real" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="space-y-4 p-5">
            <h2 className="font-medium">Dados atuais</h2>
            {products.length > 0 && (
              <label className="block text-sm">
                <span className="mb-1 block text-muted">Produto cadastrado</span>
                <Select defaultValue="" onChange={(e) => pickProduct(e.target.value)}>
                  <option value="">Selecionar produto…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.projectName} — {p.name} ({fmtMoney(p.price)})
                    </option>
                  ))}
                </Select>
              </label>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Faturamento" value={real.revenue} onChange={setR("revenue")} suffix="R$" />
              <Field label="Vendas" value={real.sales} onChange={setR("sales")} step="1" />
              <Field label="Gasto em ads" value={real.spend} onChange={setR("spend")} suffix="R$" />
              <Field label="Custo do produto" value={real.productCost} onChange={setR("productCost")} suffix="R$" />
              <Field label="Gateway" value={real.gatewayPct} onChange={setR("gatewayPct")} suffix="%" />
              <Field label="Imposto" value={real.taxPct} onChange={setR("taxPct")} suffix="%" />
              <Field label="Margem desejada" value={real.targetMarginPct} onChange={setR("targetMarginPct")} suffix="%" />
            </div>
          </Card>

          <Card className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-medium">Resultado</h2>
              <Semaphore color={realRes.semaphore} showLabel />
            </div>
            <div>
              <ResultRow label="Ticket médio" value={fmtMoney(realRes.ticketMedio)} />
              <ResultRow label="Margem de contribuição" value={fmtMoney(realRes.margemContribuicao)} />
              <ResultRow label="CPA breakeven" value={fmtMoney(realRes.cpaBreakeven)} />
              <ResultRow label="CPA alvo" value={fmtMoney(realRes.cpaAlvo)} />
              <ResultRow label="CPA atual" value={fmtMoney(realRes.cpaAtual)} />
              <ResultRow label="ROAS atual" value={realRes.roas.toFixed(2)} />
              <ResultRow label="ROAS mínimo" value={realRes.roasMin.toFixed(2)} />
            </div>
            <p className="rounded-lg bg-surface-2 p-3 text-xs text-muted">
              {realRes.semaphore === "green"
                ? "Escala liberada: seu CPA está abaixo do alvo."
                : realRes.semaphore === "yellow"
                  ? "Zona de atenção: lucrativo, mas acima do CPA alvo. Otimize antes de escalar."
                  : "Prejuízo: CPA acima do breakeven. Pause ou ajuste a oferta."}
            </p>
          </Card>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="space-y-4 p-5">
            <h2 className="font-medium">Simulação da oferta</h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Preço front-end" value={plan.frontPrice} onChange={setP("frontPrice")} suffix="R$" />
              <Field label="Extras (upsell/bump)" value={plan.extras} onChange={setP("extras")} suffix="R$" />
              <Field label="Custo do produto" value={plan.productCost} onChange={setP("productCost")} suffix="R$" />
              <Field label="Gateway" value={plan.gatewayPct} onChange={setP("gatewayPct")} suffix="%" />
              <Field label="Imposto" value={plan.taxPct} onChange={setP("taxPct")} suffix="%" />
              <Field label="Margem desejada" value={plan.targetMarginPct} onChange={setP("targetMarginPct")} suffix="%" />
              <Field label="Conversão esperada" value={plan.expectedConversionPct} onChange={setP("expectedConversionPct")} suffix="%" />
              <Field label="Orçamento diário" value={plan.budget} onChange={setP("budget")} suffix="R$" />
            </div>
          </Card>

          <div className="space-y-6">
            <Card className="space-y-4 p-5">
              <h2 className="font-medium">Metas</h2>
              <div>
                <ResultRow label="Ticket médio" value={fmtMoney(planRes.ticket)} />
                <ResultRow label="Margem de contribuição" value={fmtMoney(planRes.margemContribuicao)} />
                <ResultRow label="CPA breakeven" value={fmtMoney(planRes.cpaBreakeven)} />
                <ResultRow label="CPA alvo" value={fmtMoney(planRes.cpaAlvo)} />
                <ResultRow label="ROAS mínimo" value={planRes.roasMin.toFixed(2)} />
                <ResultRow label="ROAS alvo" value={planRes.roasAlvo.toFixed(2)} />
                <ResultRow label="Budget de teste sugerido (por criativo)" value={fmtMoney(planRes.suggestedTestBudget)} />
              </div>
            </Card>

            <Card className="space-y-3 p-5">
              <h2 className="font-medium">Cenários</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-muted">
                      <th className="py-2 font-medium">Cenário</th>
                      <th className="py-2 text-right font-medium">Vendas</th>
                      <th className="py-2 text-right font-medium">Fatur.</th>
                      <th className="py-2 text-right font-medium">Lucro</th>
                      <th className="py-2 text-right font-medium">ROAS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {planRes.scenarios.map((s) => (
                      <tr key={s.name} className="border-t border-border/60">
                        <td className="py-2">{s.name}</td>
                        <td className="py-2 text-right font-mono">{s.sales.toFixed(0)}</td>
                        <td className="py-2 text-right font-mono">{fmtMoney(s.revenue)}</td>
                        <td className={`py-2 text-right font-mono ${s.profit >= 0 ? "text-success" : "text-danger"}`}>
                          {fmtMoney(s.profit)}
                        </td>
                        <td className="py-2 text-right font-mono">{s.roas.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="rounded-lg bg-surface-2 p-3 text-xs text-muted">
                Com {fmtMoney(plan.budget)}/dia, você precisa de ~{planRes.salesToTarget.toFixed(0)} vendas para bater a
                margem alvo e ~{planRes.salesToBreakeven.toFixed(0)} para o breakeven.
              </p>
            </Card>
          </div>
        </div>
      )}

      {projects.length > 0 && (
        <p className="text-xs text-muted">
          Dica: os valores de gateway/imposto padrão seguem o mercado BR. Ajuste conforme sua operação.
        </p>
      )}
    </div>
  )
}
