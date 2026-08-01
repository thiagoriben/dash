"use client"

import * as React from "react"
import { User, Folder, ChevronDown, Check } from "lucide-react"
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
 * Seletor de área de trabalho: um botão "Pessoal" em destaque e um dropdown
 * compacto para os projetos. Mantém a tela limpa mesmo com muitos projetos,
 * em vez de listar todas as abas lado a lado.
 */
export function WorkspaceTabs({ tabs }: { tabs: WorkspaceTab[] }) {
  const personal = tabs.find((t) => t.kind !== "projeto") ?? tabs[0]
  const projects = tabs.filter((t) => t.key !== personal?.key)

  const [active, setActive] = React.useState(personal?.key ?? "")
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  // Garante uma aba válida caso a lista mude (projeto removido, etc.).
  React.useEffect(() => {
    if (!tabs.some((t) => t.key === active)) setActive(personal?.key ?? "")
  }, [tabs, active, personal?.key])

  // Fecha o dropdown ao clicar fora.
  React.useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [open])

  const current = tabs.find((t) => t.key === active) ?? personal
  const activeProject = projects.find((p) => p.key === active) ?? null
  const personalActive = current?.key === personal?.key

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        {/* Pessoal: sempre visível em destaque */}
        {personal && (
          <button
            type="button"
            onClick={() => setActive(personal.key)}
            aria-pressed={personalActive}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors",
              personalActive
                ? "border-transparent bg-primary text-[color:var(--brand-fg)]"
                : "border-[color:var(--color-border)] text-muted hover:bg-white/5 hover:text-foreground",
            )}
          >
            <User size={15} />
            {personal.label}
            {typeof personal.count === "number" && personal.count > 0 && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-xs tabular-nums",
                  personalActive ? "bg-black/15" : "bg-[color:var(--color-border)]/60",
                )}
              >
                {personal.count}
              </span>
            )}
          </button>
        )}

        {/* Projetos: escondidos num dropdown para não poluir a tela */}
        {projects.length > 0 && (
          <div ref={ref} className="relative">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-haspopup="listbox"
              aria-expanded={open}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors",
                activeProject
                  ? "border-transparent bg-primary text-[color:var(--brand-fg)]"
                  : "border-[color:var(--color-border)] text-muted hover:bg-white/5 hover:text-foreground",
              )}
            >
              <Folder size={15} />
              <span className="max-w-40 truncate">{activeProject ? activeProject.label : "Projetos"}</span>
              {activeProject && typeof activeProject.count === "number" && activeProject.count > 0 && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-xs tabular-nums",
                    "bg-black/15",
                  )}
                >
                  {activeProject.count}
                </span>
              )}
              <ChevronDown size={15} className={cn("transition-transform", open && "rotate-180")} />
            </button>

            {open && (
              <div
                role="listbox"
                className="absolute left-0 top-full z-50 mt-1.5 max-h-72 w-64 overflow-y-auto rounded-2xl border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-2)] p-1.5 shadow-2xl"
              >
                {projects.map((p) => {
                  const selected = p.key === active
                  return (
                    <button
                      key={p.key}
                      role="option"
                      aria-selected={selected}
                      type="button"
                      onClick={() => {
                        setActive(p.key)
                        setOpen(false)
                      }}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors",
                        selected ? "bg-primary/10 text-primary" : "text-muted hover:bg-white/5 hover:text-foreground",
                      )}
                    >
                      <Folder size={15} className="shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{p.label}</span>
                      {typeof p.count === "number" && (
                        <span className="rounded-full bg-[color:var(--color-border)]/60 px-1.5 py-0.5 text-xs tabular-nums">
                          {p.count}
                        </span>
                      )}
                      {selected && <Check size={15} className="shrink-0 text-primary" />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div role="tabpanel">{current?.content}</div>
    </div>
  )
}
