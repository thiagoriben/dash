"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import type { Profile } from "@/lib/types"
import { LayoutDashboard, FolderKanban, Wallet, CalendarClock, Settings } from "lucide-react"

export function MobileNav({ profile: _profile }: { profile: Profile | null }) {
  const pathname = usePathname()
  const items = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { href: "/projetos", label: "Projetos", icon: FolderKanban, exact: false },
    { href: "/caixa", label: "Caixa", icon: Wallet, exact: false },
    { href: "/recebiveis", label: "Recebíveis", icon: CalendarClock, exact: false },
    { href: "/config", label: "Config", icon: Settings, exact: false },
  ]

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-[color:var(--color-border)] bg-[color:var(--color-surface)]/90 px-2 py-2 backdrop-blur-xl md:hidden">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 rounded-lg py-1.5 text-xs font-medium",
              active ? "text-primary" : "text-muted",
            )}
          >
            <Icon size={20} />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
