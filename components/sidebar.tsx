"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import type { Profile } from "@/lib/types"
import { useSidebar } from "@/components/app-shell"
import { ApprovalsButton } from "@/components/approvals-button"
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
} from "lucide-react"

type Item = { href: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }

// Seções: visão geral + área global (caixa/recebíveis) + configurações
const overview: Item[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/projetos", label: "Projetos", icon: FolderKanban },
  { href: "/amigos", label: "Amigos", icon: Users },
]
const global: Item[] = [
  { href: "/caixa", label: "Caixa", icon: Wallet },
  { href: "/recebiveis", label: "Recebíveis", icon: CalendarClock },
]

export function Sidebar({
  profile,
  pending = [],
}: {
  profile: Profile | null
  pending?: Profile[]
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

      <div className="border-t border-[color:var(--color-border)] p-3">
        {isAdmin && (
          <div className="mb-2">
            <ApprovalsButton pending={pending} collapsed={collapsed} />
          </div>
        )}
        <button
          onClick={toggle}
          aria-label={collapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
          className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm text-muted transition-colors hover:bg-white/5 hover:text-foreground"
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          {!collapsed && "Recolher"}
        </button>
        <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary/15 font-mono text-sm font-semibold text-secondary">
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
        </div>
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
