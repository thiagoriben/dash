import { Suspense } from "react"
import { Sidebar } from "@/components/sidebar"
import { Topbar } from "@/components/topbar"
import { MobileNav } from "@/components/mobile-nav"
import { AppShell } from "@/components/app-shell"
import { getCurrentProfile } from "@/lib/data"
import { getUsdBrlRate } from "@/lib/currency-server"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [profile, usdBrl] = await Promise.all([getCurrentProfile(), getUsdBrlRate()])
  const collapsed = profile?.prefs?.sidebar_collapsed ?? false

  return (
    <AppShell
      initialCollapsed={collapsed}
      sidebar={<Sidebar profile={profile} />}
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
