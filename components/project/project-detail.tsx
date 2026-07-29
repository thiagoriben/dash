"use client"

import { useState } from "react"
import Link from "next/link"
import type {
  ActivityLog,
  AdAccount,
  CardCharge,
  Creative,
  DailyMetric,
  Expense,
  PaymentGateway,
  Prefs,
  Product,
  Profile,
  Project,
  ProfitSplit,
  Sale,
} from "@/lib/types"
import { Badge, Button } from "@/components/ui"
import { ChevronLeft, Pencil } from "lucide-react"
import { cn } from "@/lib/utils"
import { TabOverview } from "./tab-overview"
import { TabExpenses } from "./tab-expenses"
import { TabCreatives } from "./tab-creatives"
import { TabCalculator } from "./tab-calculator"
import { TabFunnel } from "./tab-funnel"
import { TabDre } from "./tab-dre"
import { TabSplits } from "./tab-splits"
import { TabMembers } from "./tab-members"
import { TabProducts } from "./tab-products"
import { TabSales } from "./tab-sales"
import { TabReceivables } from "./tab-receivables"
import { TabAdAccounts } from "./tab-ad-accounts"
import { TabHistory } from "./tab-history"
import { EditProjectModal } from "./edit-project-modal"
import type { ProjectMemberWithProfile } from "@/lib/data"

const TABS = [
  "Visão geral",
  "Vendas",
  "Recebíveis",
  "Produtos",
  "Gastos",
  "Criativos",
  "Contas de anúncio",
  "Calculadora",
  "Funil",
  "DRE",
  "Repartição",
  "Colaboradores",
  "Histórico",
] as const
type Tab = (typeof TABS)[number]

export function ProjectDetail(props: {
  project: Project
  expenses: Expense[]
  metrics: DailyMetric[]
  creatives: Creative[]
  products: Product[]
  sales: Sale[]
  receivables: Sale[]
  gateways: PaymentGateway[]
  splits: ProfitSplit[]
  profiles: Profile[]
  members: ProjectMemberWithProfile[]
  adAccounts: AdAccount[]
  cardCharges: CardCharge[]
  activity: ActivityLog[]
  owner: Profile | null
  isOwner: boolean
  prefs: Prefs | null
  usdBrl: number
}) {
  const { project } = props
  const [tab, setTab] = useState<Tab>("Visão geral")
  const [editing, setEditing] = useState(false)

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
            {props.isOwner && (
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                <Pencil size={14} /> Editar
              </Button>
            )}
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
            sales={props.sales}
            cardCharges={props.cardCharges}
            usdBrl={props.usdBrl}
          />
        )}
        {tab === "Vendas" && (
          <TabSales
            project={project}
            sales={props.sales}
            products={props.products}
            creatives={props.creatives}
            gateways={props.gateways}
            prefs={props.prefs}
          />
        )}
        {tab === "Recebíveis" && (
          <TabReceivables project={project} receivables={props.receivables} usdBrl={props.usdBrl} />
        )}
        {tab === "Produtos" && (
          <TabProducts project={project} products={props.products} gateways={props.gateways} />
        )}
        {tab === "Gastos" && (
          <TabExpenses project={project} expenses={props.expenses} usdBrl={props.usdBrl} />
        )}
        {tab === "Criativos" && (
          <TabCreatives project={project} creatives={props.creatives} products={props.products} />
        )}
        {tab === "Contas de anúncio" && (
          <TabAdAccounts
            project={project}
            adAccounts={props.adAccounts}
            cardCharges={props.cardCharges}
            metrics={props.metrics}
            usdBrl={props.usdBrl}
          />
        )}
        {tab === "Calculadora" && (
          <TabCalculator
            project={project}
            metrics={props.metrics}
            expenses={props.expenses}
            sales={props.sales}
            products={props.products}
          />
        )}
        {tab === "Funil" && (
          <TabFunnel project={project} products={props.products} metrics={props.metrics} />
        )}
        {tab === "DRE" && (
          <TabDre
            project={project}
            metrics={props.metrics}
            expenses={props.expenses}
            sales={props.sales}
            usdBrl={props.usdBrl}
            isOwner={props.isOwner}
          />
        )}
        {tab === "Repartição" && (
          <TabSplits
            project={project}
            splits={props.splits}
            profiles={props.profiles}
            metrics={props.metrics}
            expenses={props.expenses}
            sales={props.sales}
            usdBrl={props.usdBrl}
          />
        )}
        {tab === "Colaboradores" && (
          <TabMembers
            project={project}
            members={props.members}
            owner={props.owner}
            isOwner={props.isOwner}
          />
        )}
        {tab === "Histórico" && <TabHistory activity={props.activity} />}
      </div>

      {editing && (
        <EditProjectModal
          project={project}
          prefs={props.prefs}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  )
}
