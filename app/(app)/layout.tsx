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

  // Cor de destaque personalizada: injeta como override de --brand.
  const accent = profile?.prefs?.accent_color
  const accentStyle =
    accent && /^#[0-9a-fA-F]{6}$/.test(accent)
      ? `:root{--brand:${accent};--brand-fg:${accentForeground(accent)};}`
      : null

  return (
    <>
      {accentStyle ? <style dangerouslySetInnerHTML={{ __html: accentStyle }} /> : null}
    <AppShell
      initialCollapsed={collapsed}
      sidebar={<Sidebar profile={profile} pending={pending} usdBrl={usdBrl} />}
      topbar={
        <Suspense fallback={<div className="h-16 border-b border-[color:var(--color-border)]" />}>
          <Topbar />
        </Suspense>
      }
      mobileNav={<MobileNav profile={profile} />}
    >
      {children}
    </AppShell>
    </>
  )
}

/** Escolhe texto claro/escuro conforme a luminância da cor de destaque. */
function accentForeground(hex: string): string {
  const r = Number.parseInt(hex.slice(1, 3), 16)
  const g = Number.parseInt(hex.slice(3, 5), 16)
  const b = Number.parseInt(hex.slice(5, 7), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? "#04140b" : "#ffffff"
}
