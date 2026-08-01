"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import type { Profile } from "@/lib/types"
import { LogoutButton } from "@/components/logout-button"
import { InstallCard } from "@/components/install-card"
import { approveUser, rejectUser } from "@/app/actions/users"
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
  Check,
  UserCheck,
  Pencil,
} from "lucide-react"

type Item = { href: string; label: string; icon: typeof LayoutDashboard; exact?: boolean; badge?: number }

// Catálogo de tudo que pode virar atalho na barra inferior.
const CATALOG: Item[] = [
  { href: "/", label: "Início", icon: LayoutDashboard, exact: true },
  { href: "/projetos", label: "Projetos", icon: FolderKanban },
  { href: "/caixa", label: "Caixa", icon: Wallet },
  { href: "/recebiveis", label: "Recebíveis", icon: CalendarClock },
  { href: "/socios", label: "Amigos", icon: Users },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/ranking", label: "Ranking", icon: Trophy },
  { href: "/organizacao/notas", label: "Notas", icon: StickyNote },
  { href: "/organizacao/tarefas", label: "Tarefas", icon: ListTodo },
  { href: "/perfil", label: "Perfil", icon: Settings },
]

// Atalhos padrão (os 4 mais usados) e limite da barra.
const DEFAULT_SHORTCUTS = ["/", "/projetos", "/caixa", "/recebiveis"]
const MAX_SHORTCUTS = 4
const STORAGE_KEY = "dash:mobile-shortcuts"

export function MobileNav({
  profile,
  pending = [],
  unreadChat = 0,
}: {
  profile: Profile | null
  /** Usuários aguardando aprovação (admin). */
  pending?: Profile[]
  unreadChat?: number
}) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [shortcuts, setShortcuts] = useState<string[]>(DEFAULT_SHORTCUTS)
  const isAdmin = profile?.role === "admin"
  const pendingCount = pending.length

  // Carrega os atalhos salvos neste dispositivo.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const saved = JSON.parse(raw) as string[]
        const valid = saved.filter((h) => CATALOG.some((c) => c.href === h))
        if (valid.length) setShortcuts(valid.slice(0, MAX_SHORTCUTS))
      }
    } catch {
      /* ignora preferência inválida */
    }
  }, [])

  const persist = (next: string[]) => {
    setShortcuts(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      /* storage indisponível */
    }
  }

  const toggleShortcut = (href: string) => {
    if (shortcuts.includes(href)) {
      if (shortcuts.length <= 1) return // mantém pelo menos 1
      persist(shortcuts.filter((h) => h !== href))
    } else {
      if (shortcuts.length >= MAX_SHORTCUTS) return
      persist([...shortcuts, href])
    }
  }

  const barItems = useMemo(
    () => shortcuts.map((h) => CATALOG.find((c) => c.href === h)).filter((x): x is Item => Boolean(x)),
    [shortcuts],
  )

  // Fecha o menu ao trocar de rota.
  useEffect(() => {
    setMenuOpen(false)
    setEditing(false)
  }, [pathname])

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
    { href: "/usuarios", label: "Usuários", icon: Users },
    { href: "/admin/projetos", label: "Projetos (admin)", icon: ShieldCheck },
    { href: "/admin/avisos", label: "Avisos", icon: Megaphone },
    { href: "/admin/feedback", label: "Feedback", icon: MessagesSquare },
  ]

  const isActive = (item: Item) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/")

  const badgeTotal = unreadChat + pendingCount

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-[color:var(--color-border)] bg-[color:var(--color-surface)]/95 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl md:hidden">
        {barItems.map((item) => {
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
            {badgeTotal > 0 && (
              <span className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-semibold text-[color:var(--brand-fg)]">
                {badgeTotal > 9 ? "9+" : badgeTotal}
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

              {isAdmin && <AccessRequests pending={pending} />}

              <ShortcutEditor
                editing={editing}
                onToggleEditing={() => setEditing((v) => !v)}
                shortcuts={shortcuts}
                onToggle={toggleShortcut}
              />

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

/** Aprovar/rejeitar solicitações de acesso direto do menu mobile (admin). */
function AccessRequests({ pending }: { pending: Profile[] }) {
  const [isPending, startTransition] = useTransition()
  return (
    <div className="rounded-2xl border border-[color:var(--color-border)] p-3">
      <p className="flex items-center gap-1.5 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
        <UserCheck size={13} /> Solicitações de acesso
        {pending.length > 0 && (
          <span className="ml-auto grid h-4 min-w-4 place-items-center rounded-full bg-negative px-1 text-[10px] font-bold text-white">
            {pending.length}
          </span>
        )}
      </p>
      {pending.length === 0 ? (
        <p className="py-1 text-sm text-muted">Nenhuma pendência.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {pending.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 rounded-xl bg-white/5 px-2.5 py-2">
              <span className="min-w-0 truncate text-sm font-medium">{p.username}</span>
              <span className="flex shrink-0 gap-1.5">
                <button
                  disabled={isPending}
                  onClick={() => startTransition(() => void approveUser(p.id))}
                  aria-label={`Aprovar ${p.username}`}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-positive/15 text-positive transition-colors hover:bg-positive/25 disabled:opacity-50"
                >
                  <Check size={16} />
                </button>
                <button
                  disabled={isPending}
                  onClick={() => startTransition(() => void rejectUser(p.id))}
                  aria-label={`Rejeitar ${p.username}`}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-negative/15 text-negative transition-colors hover:bg-negative/25 disabled:opacity-50"
                >
                  <X size={16} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Editor dos atalhos fixos da barra inferior (preferência por dispositivo). */
function ShortcutEditor({
  editing,
  onToggleEditing,
  shortcuts,
  onToggle,
}: {
  editing: boolean
  onToggleEditing: () => void
  shortcuts: string[]
  onToggle: (href: string) => void
}) {
  return (
    <div className="rounded-2xl border border-[color:var(--color-border)] p-3">
      <div className="flex items-center justify-between pb-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Atalhos da barra</p>
        <button
          type="button"
          onClick={onToggleEditing}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium transition-colors",
            editing ? "bg-primary text-[color:var(--brand-fg)]" : "text-muted hover:bg-white/5 hover:text-foreground",
          )}
        >
          {editing ? <Check size={13} /> : <Pencil size={13} />}
          {editing ? "Pronto" : "Editar"}
        </button>
      </div>
      {editing ? (
        <>
          <p className="pb-2 text-xs text-muted">
            Escolha até {MAX_SHORTCUTS} ferramentas para a barra de acesso rápido.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {CATALOG.map((item) => {
              const on = shortcuts.includes(item.href)
              const disabled = !on && shortcuts.length >= MAX_SHORTCUTS
              const Icon = item.icon
              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => onToggle(item.href)}
                  disabled={disabled}
                  aria-pressed={on}
                  className={cn(
                    "relative flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center text-xs font-medium transition-colors",
                    on
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-[color:var(--color-border)] text-muted hover:bg-white/5 hover:text-foreground",
                    disabled && "cursor-not-allowed opacity-40",
                  )}
                >
                  {on && (
                    <span className="absolute right-1.5 top-1.5 grid h-4 w-4 place-items-center rounded-full bg-primary text-[color:var(--brand-fg)]">
                      <Check size={11} />
                    </span>
                  )}
                  <Icon size={20} />
                  <span className="leading-tight">{item.label}</span>
                </button>
              )
            })}
          </div>
        </>
      ) : (
        <p className="text-xs text-muted">
          Toque em "Editar" para escolher as ferramentas que aparecem na barra inferior.
        </p>
      )}
    </div>
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
