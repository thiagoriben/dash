"use client"

import { createContext, useContext, useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import { setSidebarCollapsed } from "@/app/actions/projects"
import { PrivacyProvider } from "@/components/privacy"

type Ctx = { collapsed: boolean; toggle: () => void }
const SidebarCtx = createContext<Ctx>({ collapsed: false, toggle: () => {} })

export function useSidebar() {
  return useContext(SidebarCtx)
}

export function AppShell({
  initialCollapsed,
  sidebar,
  topbar,
  mobileNav,
  banner,
  children,
}: {
  initialCollapsed: boolean
  sidebar: React.ReactNode
  topbar: React.ReactNode
  mobileNav: React.ReactNode
  /** Faixa opcional exibida no topo do conteúdo (ex.: aviso de email). */
  banner?: React.ReactNode
  children: React.ReactNode
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed)

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      const next = !c
      // persiste sem bloquear a UI
      void setSidebarCollapsed(next)
      return next
    })
  }, [])

  return (
    <SidebarCtx.Provider value={{ collapsed, toggle }}>
      <PrivacyProvider>
        <div className="min-h-dvh">
          {sidebar}
          <div className={cn("transition-[padding] duration-200", collapsed ? "md:pl-16" : "md:pl-60")}>
            {topbar}
            {mobileNav}
            <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">{children}</main>
          </div>
        </div>
      </PrivacyProvider>
    </SidebarCtx.Provider>
  )
}
