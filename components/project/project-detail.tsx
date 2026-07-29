"use client"

import { useState } from "react"
import Link from "next/link"
import type {
  Creative,
  DailyMetric,
  Expense,
  FunnelProduct,
  Profile,
  Project,
  ProfitSplit,
} from "@/lib/types"
import { Badge } from "@/components/ui"
import { ChevronLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { TabOverview } from "./tab-overview"
import { TabExpenses } from "./tab-expenses"
import { TabCreatives } from "./tab-creatives"
import { TabCalculator } from "./tab-calculator"
import { TabFunnel } from "./tab-funnel"
import { TabDre } from "./tab-dre"
import { TabSplits } from "./tab-splits"

const TABS = [
  "Visão geral",
  "Gastos",
  "Criativos",
  "Calculadora",
  "Funil",
  "DRE",
  "Repartição",
] as const
type Tab = (typeof TABS)[number]

export function ProjectDetail(props: {
  project: Project
  expenses: Expense[]
  metrics: DailyMetric[]
  creatives: Creative[]
  funnel: FunnelProduct[]
  splits: ProfitSplit[]
  profiles: Profile[]
  usdBrl: number
}) {
  const { project } = props
  const [tab, setTab] = useState<Tab>("Visão geral")

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          href="/projetos"
          className="flex w-fit items-center gap-1 text-sm text-muted hover:text-foreground"
        >
          <ChevronLeft size={16} />
          Projetos
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-balance">
            {project.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={project.status === "ativo" ? "positive" : "warning"}>
              {project.status}
            </Badge>
            <Badge tone="primary">{project.region}</Badge>
            <Badge tone="secondary">{project.currency}</Badge>
            {project.offer_type ? <Badge tone="default">{project.offer_type}</Badge> : null}
          </div>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-[color:var(--color-border)] pb-px">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "relative whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors",
              tab === t ? "text-primary" : "text-muted hover:text-foreground",
            )}
          >
            {t}
            {tab === t ? (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary shadow-[0_0_8px_rgba(45,226,230,0.6)]" />
            ) : null}
          </button>
        ))}
      </div>

      <div>
        {tab === "Visão geral" && (
          <TabOverview
            project={project}
            metrics={props.metrics}
            expenses={props.expenses}
            usdBrl={props.usdBrl}
          />
        )}
        {tab === "Gastos" && (
          <TabExpenses project={project} expenses={props.expenses} usdBrl={props.usdBrl} />
        )}
        {tab === "Criativos" && (
          <TabCreatives project={project} creatives={props.creatives} funnel={props.funnel} />
        )}
        {tab === "Calculadora" && (
          <TabCalculator
            project={project}
            metrics={props.metrics}
            expenses={props.expenses}
            funnel={props.funnel}
          />
        )}
        {tab === "Funil" && (
          <TabFunnel project={project} funnel={props.funnel} metrics={props.metrics} />
        )}
        {tab === "DRE" && (
          <TabDre
            project={project}
            metrics={props.metrics}
            expenses={props.expenses}
            funnel={props.funnel}
            usdBrl={props.usdBrl}
          />
        )}
        {tab === "Repartição" && (
          <TabSplits
            project={project}
            splits={props.splits}
            profiles={props.profiles}
            metrics={props.metrics}
            expenses={props.expenses}
            funnel={props.funnel}
            usdBrl={props.usdBrl}
          />
        )}
      </div>
    </div>
  )
}
