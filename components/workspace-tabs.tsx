"use client"

import * as React from "react"
import { User, Folder } from "lucide-react"
import { cn } from "@/lib/utils"

export type WorkspaceTab = {
  /** Identificador único da aba. */
  key: string
  /** Rótulo exibido no seletor. */
  label: string
  /** Ícone: "pessoal" ou "projeto". */
  kind?: "pessoal" | "projeto"
  /** Contador opcional (ex.: nº de itens). */
  count?: number
  /** Conteúdo renderizado quando a aba está ativa. */
  content: React.ReactNode
}

/**
 * Seletor de área de trabalho: alterna entre "Pessoal" e cada projeto,
 * mostrando só o conteúdo ativo para dar mais espaço à ferramenta.
 */
export function WorkspaceTabs({ tabs }: { tabs: WorkspaceTab[] }) {
  const [active, setActive] = React.useState(tabs[0]?.key ?? "")

  // Garante uma aba válida caso a lista mude (projeto removido, etc.).
  React.useEffect(() => {
    if (!tabs.some((t) => t.key === active)) setActive(tabs[0]?.key ?? "")
  }, [tabs, active])

  const current = tabs.find((t) => t.key === active) ?? tabs[0]

  return (
    <div className="flex flex-col gap-5">
      <div
        role="tablist"
        aria-label="Área de trabalho"
        className="flex flex-wrap gap-1.5 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-1.5"
      >
        {tabs.map((t) => {
          const selected = t.key === active
          const Icon = t.kind === "projeto" ? Folder : User
          return (
            <button
              key={t.key}
              role="tab"
              type="button"
              aria-selected={selected}
              onClick={() => setActive(t.key)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                selected
                  ? "bg-primary text-[color:var(--brand-fg)]"
                  : "text-muted hover:bg-[color:var(--color-border)]/40 hover:text-foreground",
              )}
            >
              <Icon size={15} />
              <span className="max-w-40 truncate">{t.label}</span>
              {typeof t.count === "number" && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-xs tabular-nums",
                    selected ? "bg-black/15" : "bg-[color:var(--color-border)]/60",
                  )}
                >
                  {t.count}
                </span>
              )}
            </button>
          )
        })}
      </div>
      <div role="tabpanel">{current?.content}</div>
    </div>
  )
}
