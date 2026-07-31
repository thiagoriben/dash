"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import type { Profile } from "@/lib/types"
import { useSidebar } from "@/components/app-shell"
import { ApprovalsButton } from "@/components/approvals-button"
import { CurrencyPopover } from "@/components/currency-popover"
import { signOut } from "@/app/actions/auth"
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Wallet,
  CalendarClock,
  Settings,
  CreditCard,
  Zap,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  MessageSquare,
  LayoutGrid,
  Trophy,
} from "lucide-react"

type Item = { href: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }

// Seções: visão geral + área global (caixa/recebíveis) + configurações
const overview: Item[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/projetos", label: "Projetos", icon: FolderKanban },
  { href: "/socios", label: "Sócios", icon: Users },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/ranking", label: "Ranking", icon: Trophy },
]
const global: Item[] = [
  { href: "/caixa", label: "Caixa", icon: Wallet },
  { href: "/recebiveis", label: "Recebíveis", icon: CalendarClock },
  { href: "/organizacao", label: "Organização", icon: LayoutGrid },
]

export function Sidebar({
  profile,
  pending = [],
  usdBrl = 5,
  fxOverrides = {},
  fxCurrencies = ["USD", "EUR"],
}: {
  profile: Profile | null
  pending?: Profile[]
  usdBrl?: number
  fxOverrides?: Record<string, number>
  fxCurrencies?: string[]
}) {
  const pathname = usePathname()
  const { collapsed, toggle } = useSidebar()
  const isAdmin = profile?.role === "admin"

  const config: Item[] = [
    { href: "/config", label: "Configurações", icon: Settings, exact: true },
    { href: "/config/gateways", label: "Gateways", icon: CreditCard },
  ]
  const admin: Item[] = profile?.role === "admin" ? [{ href: "/usuarios", label: "Usuários", icon: Users }] : []

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-[color:var(--color-border)] bg-[color:var(--color-surface)]/60 backdrop-blur-xl transition-[width] duration-200 md:flex",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div className={cn("flex h-16 items-center gap-2", collapsed ? "justify-center px-0" : "px-5")}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Zap size={18} />
        </div>
        {!collapsed && <span className="font-display text-lg font-semibold neon-text">Dash</span>}
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
        <NavGroup items={overview} pathname={pathname} collapsed={collapsed} />
        <NavLabel collapsed={collapsed}>Global</NavLabel>
        <NavGroup items={global} pathname={pathname} collapsed={collapsed} />
        <NavLabel collapsed={collapsed}>Ajustes</NavLabel>
        <NavGroup items={[...admin, ...config]} pathname={pathname} collapsed={collapsed} />
      </nav>

      <div className="flex flex-col gap-2 border-t border-[color:var(--color-border)] p-3">
        {isAdmin && <ApprovalsButton pending={pending} collapsed={collapsed} />}

        <CurrencyPopover
          usdBrl={usdBrl}
          currencies={fxCurrencies}
          overrides={fxOverrides}
          collapsed={collapsed}
        />

        <button
          onClick={toggle}
          aria-label={collapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
          title={collapsed ? "Expandir" : "Recolher"}
          className={cn(
            "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted transition-colors hover:bg-white/5 hover:text-foreground",
            collapsed ? "justify-center px-0" : "justify-start",
          )}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          {!collapsed && "Recolher"}
        </button>

        <form action={signOut}>
          <button
            type="submit"
            aria-label="Sair"
            title="Sair"
            className={cn(
              "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted transition-colors hover:bg-danger/10 hover:text-danger",
              collapsed ? "justify-center px-0" : "justify-start",
            )}
          >
            <LogOut size={18} />
            {!collapsed && "Sair"}
          </button>
        </form>

        <Link
          href="/perfil"
          title="Meu perfil"
          className={cn(
            "mt-1 flex items-center gap-3 rounded-xl p-1 transition-colors hover:bg-white/5",
            collapsed && "justify-center",
          )}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 font-mono text-sm font-semibold text-primary">
            {(profile?.username ?? "?").slice(0, 2).toUpperCase()}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-foreground">
                {profile?.full_name ?? profile?.username ?? "—"}
              </div>
              <div className="text-xs capitalize text-muted">{profile?.role ?? "member"}</div>
            </div>
          )}
        </Link>
      </div>
    </aside>
  )
}

function NavLabel({ collapsed, children }: { collapsed: boolean; children: React.ReactNode }) {
  if (collapsed) return <div className="my-1 border-t border-[color:var(--color-border)]" />
  return (
    <div className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted">
      {children}
    </div>
  )
}

function NavGroup({
  items,
  pathname,
  collapsed,
}: {
  items: Item[]
  pathname: string
  collapsed: boolean
}) {
  return (
    <>
      {items.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(item.href + "/")
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch
            title={collapsed ? item.label : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              collapsed && "justify-center px-0",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted hover:bg-white/5 hover:text-foreground",
            )}
          >
            <Icon size={18} />
            {!collapsed && item.label}
          </Link>
        )
      })}
    </>
  )
}
