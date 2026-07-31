"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import type { Profile } from "@/lib/types"
import { createClient } from "@/lib/supabase/client"
import { useSidebar } from "@/components/app-shell"
import { AdminMenu } from "@/components/admin-menu"
import { LogoutButton } from "@/components/logout-button"
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Wallet,
  CalendarClock,
  Settings,
  Zap,
  PanelLeftClose,
  PanelLeftOpen,
  MessageSquare,
  Trophy,
  StickyNote,
  ListTodo,
  ShieldCheck,
} from "lucide-react"

type Item = { href: string; label: string; icon: typeof LayoutDashboard; exact?: boolean; badge?: number }

// Navegação agrupada por finalidade. Sem scroll — todas as opções visíveis.
const principal: Item[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/projetos", label: "Projetos", icon: FolderKanban },
]

// Financeiro global (fora de um projeto específico).
const financeiro: Item[] = [
  { href: "/caixa", label: "Caixa", icon: Wallet },
  { href: "/recebiveis", label: "Recebíveis", icon: CalendarClock },
]
// Organização: cada ferramenta como item próprio (calculadora agora só dentro do projeto).
const organizacao: Item[] = [
  { href: "/organizacao/notas", label: "Notas", icon: StickyNote },
  { href: "/organizacao/tarefas", label: "Tarefas", icon: ListTodo },
]

export function Sidebar({
  profile,
  pending = [],
  meId = null,
  unreadChat = 0,
}: {
  profile: Profile | null
  pending?: Profile[]
  meId?: string | null
  unreadChat?: number
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { collapsed, toggle } = useSidebar()
  const isAdmin = profile?.role === "admin"
  const [unread, setUnread] = useState(unreadChat)

  useEffect(() => setUnread(unreadChat), [unreadChat])

  // Realtime: nova DM recebida enquanto fora do chat incrementa o badge.
  useEffect(() => {
    if (!meId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`sidebar-dm-${meId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages", filter: `recipient_id=eq.${meId}` },
        () => {
          if (!pathname.startsWith("/chat")) setUnread((n) => n + 1)
          router.refresh()
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [meId, pathname, router])

  // Zera badge ao entrar no chat.
  useEffect(() => {
    if (pathname.startsWith("/chat")) setUnread(0)
  }, [pathname])

  const social: Item[] = [
    { href: "/socios", label: "Amigos", icon: Users },
    { href: "/chat", label: "Chat", icon: MessageSquare, badge: unread },
    { href: "/ranking", label: "Ranking", icon: Trophy },
  ]

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

      <nav className="flex flex-1 flex-col gap-0.5 px-3 py-2">
        <NavGroup items={principal} pathname={pathname} collapsed={collapsed} />
        <NavLabel collapsed={collapsed}>Social</NavLabel>
        <NavGroup items={social} pathname={pathname} collapsed={collapsed} />
        <NavLabel collapsed={collapsed}>Financeiro</NavLabel>
        <NavGroup items={financeiro} pathname={pathname} collapsed={collapsed} />
        <NavLabel collapsed={collapsed}>Organização</NavLabel>
        <NavGroup items={organizacao} pathname={pathname} collapsed={collapsed} />
        {isAdmin && (
          <>
            <NavLabel collapsed={collapsed}>
              <span className="inline-flex items-center gap-1">
                <ShieldCheck size={12} /> Admin
              </span>
            </NavLabel>
            <AdminMenu pending={pending} collapsed={collapsed} />
          </>
        )}
      </nav>

      <div className="flex flex-col gap-2 border-t border-[color:var(--color-border)] p-3">
        {/* Recolher + Sair lado a lado, acima do perfil */}
        <div className={cn("flex items-center gap-2", collapsed ? "flex-col" : "justify-between")}>
          <button
            onClick={toggle}
            aria-label={collapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
            title={collapsed ? "Expandir" : "Recolher"}
            className={cn(
              "flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted transition-colors hover:bg-white/5 hover:text-foreground",
              collapsed ? "w-full justify-center px-0" : "flex-1 justify-start",
            )}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            {!collapsed && "Recolher"}
          </button>
          <LogoutButton collapsed={collapsed} />
        </div>

        <Link
          href="/perfil"
          title="Abrir meu perfil e configurações"
          className={cn(
            "group/perfil mt-1 flex items-center gap-3 rounded-xl p-1 transition-colors hover:bg-white/5",
            collapsed && "justify-center",
          )}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 font-mono text-sm font-semibold text-primary">
            {(profile?.username ?? "?").slice(0, 2).toUpperCase()}
          </div>
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground">
                  {profile?.full_name ?? profile?.username ?? "—"}
                </div>
                <div className="text-xs capitalize text-muted">{profile?.role ?? "member"}</div>
              </div>
              <Settings
                size={16}
                aria-hidden="true"
                className="shrink-0 text-muted transition-colors group-hover/perfil:text-primary"
              />
            </>
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
        const badge = item.badge ?? 0
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch
            title={collapsed ? item.label : undefined}
            className={cn(
              "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              collapsed && "justify-center px-0",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted hover:bg-white/5 hover:text-foreground",
            )}
          >
            <span className="relative">
              <Icon size={18} />
              {badge > 0 && collapsed && (
                <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-semibold text-[color:var(--brand-fg)]">
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </span>
            {!collapsed && <span className="flex-1">{item.label}</span>}
            {!collapsed && badge > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-[color:var(--brand-fg)]">
                {badge > 99 ? "99+" : badge}
              </span>
            )}
          </Link>
        )
      })}
    </>
  )
}
