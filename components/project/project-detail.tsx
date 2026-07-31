"use client"

import { useState } from "react"
import Link from "next/link"
import type {
  ActivityLog,
  AdAccount,
  BankAccount,
  CardCharge,
  CashEntry,
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
  CustomMetric,
} from "@/lib/types"
import { Badge, Button } from "@/components/ui"
import {
  ChevronLeft,
  Pencil,
  LayoutDashboard,
  Wallet,
  ShoppingCart,
  CalendarClock,
  Package,
  Receipt,
  ImageIcon,
  Megaphone,
  Calculator,
  Filter,
  FileText,
  PieChart,
  Users,
  MessageSquare,
  History,
  type LucideIcon,
} from "lucide-react"
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
import { CaixaClient } from "@/components/caixa-client"
import { TabChat } from "./tab-chat"
import type { ProjectMemberWithProfile, JoinRequestView } from "@/lib/data"

const BASE_TABS = [
  "Visão geral",
  "Caixa",
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
  "Chat",
  "Histórico",
] as const
type Tab = (typeof BASE_TABS)[number]

const TAB_ICONS: Record<Tab, LucideIcon> = {
  "Visão geral": LayoutDashboard,
  Caixa: Wallet,
  Vendas: ShoppingCart,
  Recebíveis: CalendarClock,
  Produtos: Package,
  Gastos: Receipt,
  Criativos: ImageIcon,
  "Contas de anúncio": Megaphone,
  Calculadora: Calculator,
  Funil: Filter,
  DRE: FileText,
  Repartição: PieChart,
  Colaboradores: Users,
  Chat: MessageSquare,
  Histórico: History,
}

/** Abas organizadas por área — evita a fileira única de pílulas soltas. */
const TAB_GROUPS: { label: string; tabs: Tab[] }[] = [
  { label: "Análise", tabs: ["Visão geral", "Funil", "DRE", "Histórico"] },
  { label: "Financeiro", tabs: ["Caixa", "Vendas", "Recebíveis", "Gastos", "Repartição"] },
  { label: "Operação", tabs: ["Produtos", "Criativos", "Contas de anúncio", "Calculadora"] },
  { label: "Time", tabs: ["Colaboradores", "Chat"] },
]

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
  cashEntries: CashEntry[]
  activity: ActivityLog[]
  owner: Profile | null
  isOwner: boolean
  isAdmin?: boolean
  prefs: Prefs | null
  usdBrl: number
  banks: BankAccount[]
  currencies: string[]
  meId: string
  joinRequests: JoinRequestView[]
  customMetrics: CustomMetric[]
}) {
  const { project } = props
  const canManage = props.isOwner || props.isAdmin
  const isMember = props.members.some((m) => m.user_id === props.meId)
  const isPartner = props.isOwner || props.isAdmin || isMember
  const TABS = BASE_TABS.filter((t) => (t === "Chat" ? isPartner : true))
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
            {canManage && (
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                <Pencil size={14} /> Editar
              </Button>
            )}
          </div>
        </div>
      </div>

      <nav
        aria-label="Seções do projeto"
        className="flex flex-col gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]/40 p-3 sm:flex-row sm:flex-wrap sm:items-stretch sm:gap-4"
      >
        {TAB_GROUPS.map((group, gi) => {
          const groupTabs = group.tabs.filter((t) => TABS.includes(t))
          if (groupTabs.length === 0) return null
          return (
            <div
              key={group.label}
              className={cn(
                "flex flex-col gap-1.5",
                gi > 0 && "sm:border-l sm:border-[color:var(--color-border)] sm:pl-4",
              )}
            >
              <span className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted/70">
                {group.label}
              </span>
              <div className="flex flex-wrap gap-1">
                {groupTabs.map((t) => {
                  const Icon = TAB_ICONS[t]
                  const active = tab === t
                  return (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary/15 text-primary shadow-[0_0_0_1px_rgba(41,245,126,0.3)]"
                          : "text-muted hover:bg-white/5 hover:text-foreground",
                      )}
                    >
                      <Icon size={15} className={active ? "text-primary" : ""} />
                      {t}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      <div>
        {tab === "Visão geral" && (
          <TabOverview
            project={project}
            metrics={props.metrics}
            expenses={props.expenses}
            sales={props.sales}
            cardCharges={props.cardCharges}
            cashEntries={props.cashEntries}
            usdBrl={props.usdBrl}
            spendView={props.prefs?.spend_view ?? "ads"}
            profitBase={props.prefs?.profit_base ?? "ads"}
              metaTaxPct={props.prefs?.meta_tax_pct ?? 0}
              widgets={props.prefs?.project_widgets}
              customMetrics={props.customMetrics}
              metricPresets={props.prefs?.metric_presets ?? []}
            />
          )}
        {tab === "Caixa" && (
          <CaixaClient
            entries={props.cashEntries}
            projects={[project]}
            banks={props.banks}
            profiles={props.profiles}
            meId={props.meId}
            usdBrl={props.usdBrl}
            currencies={props.currencies}
            lockedProjectId={project.id}
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
            joinRequests={props.joinRequests}
          />
        )}
        {tab === "Chat" && isPartner && (
          <TabChat projectId={project.id} meId={props.meId} profiles={props.profiles} />
        )}
        {tab === "Histórico" && <TabHistory activity={props.activity} />}
      </div>

      {editing && (
        <EditProjectModal
          project={project}
          prefs={props.prefs}
          canDelete={canManage}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  )
}
