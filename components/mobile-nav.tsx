"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import type { Profile } from "@/lib/types"
import { LogoutButton } from "@/components/logout-button"
import { InstallCard } from "@/components/install-card"
import {
  LayoutDashboard,
  FolderKanban,
  Wallet,
  CalendarClock,
  Menu,
  X,
  Users,
  MessageSquare,
  Trophy,
  StickyNote,
  ListTodo,
  Settings,
  ShieldCheck,
  Megaphone,
  MessagesSquare,
} from "lucide-react"

type Item = { href: string; label: string; icon: typeof LayoutDashboard; exact?: boolean; badge?: number }

// Itens fixos na barra inferior (os 4 mais usados) + botão "Menu".
const primary: Item[] = [
  { href: "/", label: "Início", icon: LayoutDashboard, exact: true },
  { href: "/projetos", label: "Projetos", icon: FolderKanban },
  { href: "/caixa", label: "Caixa", icon: Wallet },
  { href: "/recebiveis", label: "Recebíveis", icon: CalendarClock },
]

export function MobileNav({
  profile,
  pending = 0,
  unreadChat = 0,
}: {
  profile: Profile | null
  pending?: number
  unreadChat?: number
}) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const isAdmin = profile?.role === "admin"

  // Fecha o menu ao trocar de rota.
  useEffect(() => setMenuOpen(false), [pathname])

  // Trava o scroll do body enquanto o drawer estiver aberto.
  useEffect(() => {
    if (menuOpen) {
      const prev = document.body.style.overflow
      document.body.style.overflow = "hidden"
      return () => {
        document.body.style.overflow = prev
      }
    }
  }, [menuOpen])

  const social: Item[] = [
    { href: "/socios", label: "Amigos", icon: Users },
    { href: "/chat", label: "Chat", icon: MessageSquare, badge: unreadChat },
    { href: "/ranking", label: "Ranking", icon: Trophy },
  ]
  const organizacao: Item[] = [
    { href: "/organizacao/notas", label: "Notas", icon: StickyNote },
    { href: "/organizacao/tarefas", label: "Tarefas", icon: ListTodo },
  ]
  const conta: Item[] = [{ href: "/perfil", label: "Perfil e ajustes", icon: Settings }]
  const admin: Item[] = [
    { href: "/admin/projetos", label: "Projetos (admin)", icon: ShieldCheck },
    { href: "/admin/avisos", label: "Avisos", icon: Megaphone },
    { href: "/admin/feedback", label: "Feedback", icon: MessagesSquare },
  ]

  const isActive = (item: Item) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/")

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-[color:var(--color-border)] bg-[color:var(--color-surface)]/95 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl md:hidden">
        {primary.map((item) => {
          const active = isActive(item)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 rounded-lg py-1 text-[11px] font-medium",
                active ? "text-primary" : "text-muted",
              )}
            >
              <Icon size={20} />
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          )
        })}
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Abrir menu"
          className="relative flex flex-1 flex-col items-center gap-1 rounded-lg py-1 text-[11px] font-medium text-muted"
        >
          <span className="relative">
            <Menu size={20} />
            {unreadChat + pending > 0 && (
              <span className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-semibold text-[color:var(--brand-fg)]">
                {unreadChat + pending > 9 ? "9+" : unreadChat + pending}
              </span>
            )}
          </span>
          Menu
        </button>
      </nav>

      {/* Drawer com todas as rotas do app */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <button
            aria-label="Fechar menu"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="sticky top-0 flex items-center justify-between border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 font-mono text-sm font-semibold text-primary">
                  {(profile?.username ?? "?").slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {profile?.full_name ?? profile?.username ?? "—"}
                  </p>
                  <p className="text-xs capitalize text-muted">{profile?.role ?? "member"}</p>
                </div>
              </div>
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="Fechar"
                className="rounded-lg p-2 text-muted hover:bg-white/5 hover:text-foreground"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-col gap-4 p-4">
              <InstallCard />
              <MenuSection title="Social" items={social} isActive={isActive} />
              <MenuSection title="Organização" items={organizacao} isActive={isActive} />
              <MenuSection title="Conta" items={conta} isActive={isActive} />
              {isAdmin && <MenuSection title="Admin" items={admin} isActive={isActive} />}
              <LogoutButton collapsed={false} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function MenuSection({
  title,
  items,
  isActive,
}: {
  title: string
  items: Item[]
  isActive: (item: Item) => boolean
}) {
  return (
    <div>
      <p className="px-1 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">{title}</p>
      <div className="grid grid-cols-3 gap-2">
        {items.map((item) => {
          const active = isActive(item)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center text-xs font-medium transition-colors",
                active
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-[color:var(--color-border)] text-muted hover:bg-white/5 hover:text-foreground",
              )}
            >
              <span className="relative">
                <Icon size={20} />
                {(item.badge ?? 0) > 0 && (
                  <span className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-semibold text-[color:var(--brand-fg)]">
                    {item.badge! > 9 ? "9+" : item.badge}
                  </span>
                )}
              </span>
              <span className="leading-tight">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
