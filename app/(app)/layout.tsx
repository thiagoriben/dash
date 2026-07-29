import { Suspense } from "react"
import { redirect } from "next/navigation"
import { Sidebar } from "@/components/sidebar"
import { Topbar } from "@/components/topbar"
import { MobileNav } from "@/components/mobile-nav"
import { AppShell } from "@/components/app-shell"
import { getCurrentProfile, getPendingProfiles } from "@/lib/data"
import { getUsdBrlRate } from "@/lib/currency-server"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [profile, usdBrl] = await Promise.all([getCurrentProfile(), getUsdBrlRate()])

  // Gate de aprovação: conta pendente não acessa o app.
  if (profile && !profile.approved) redirect("/aguardando")

  const collapsed = profile?.prefs?.sidebar_collapsed ?? false
  const pending = profile?.role === "admin" ? await getPendingProfiles() : []

  return (
    <AppShell
      initialCollapsed={collapsed}
      sidebar={<Sidebar profile={profile} pending={pending} />}
      topbar={
        <Suspense fallback={<div className="h-16 border-b border-[color:var(--color-border)]" />}>
          <Topbar usdBrl={usdBrl} />
        </Suspense>
      }
      mobileNav={<MobileNav profile={profile} />}
    >
      {children}
    </AppShell>
  )
}
