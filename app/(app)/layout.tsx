import { Suspense } from "react"
import { Sidebar } from "@/components/sidebar"
import { Topbar } from "@/components/topbar"
import { MobileNav } from "@/components/mobile-nav"
import { getCurrentProfile } from "@/lib/data"
import { getUsdBrlRate } from "@/lib/currency"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [profile, usdBrl] = await Promise.all([getCurrentProfile(), getUsdBrlRate()])

  return (
    <div className="min-h-dvh">
      <Sidebar profile={profile} />
      <div className="md:pl-60">
        <Suspense fallback={<div className="h-16 border-b border-[color:var(--color-border)]" />}>
          <Topbar usdBrl={usdBrl} />
        </Suspense>
        <MobileNav profile={profile} />
        <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">{children}</main>
      </div>
    </div>
  )
}
