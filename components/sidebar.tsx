"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import type { Profile } from "@/lib/types"
import { LayoutDashboard, FolderKanban, Users, Zap } from "lucide-react"

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/projetos", label: "Projetos", icon: FolderKanban },
]

export function Sidebar({ profile }: { profile: Profile | null }) {
  const pathname = usePathname()
  const items = [...nav]
  if (profile?.role === "admin") {
    items.push({ href: "/usuarios", label: "Usuários", icon: Users })
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-[color:var(--color-border)] bg-[color:var(--color-surface)]/60 backdrop-blur-xl md:flex">
      <div className="flex h-16 items-center gap-2 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Zap size={18} />
        </div>
        <span className="font-display text-lg font-semibold neon-text">Dash</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
        {items.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted hover:bg-white/5 hover:text-foreground",
              )}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="border-t border-[color:var(--color-border)] p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary/15 font-mono text-sm font-semibold text-secondary">
            {(profile?.username ?? "?").slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-foreground">
              {profile?.full_name ?? profile?.username ?? "—"}
            </div>
            <div className="text-xs capitalize text-muted">{profile?.role ?? "member"}</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
