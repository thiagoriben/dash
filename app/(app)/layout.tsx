import { Suspense } from "react"
import { redirect } from "next/navigation"
import { Sidebar } from "@/components/sidebar"
import { Topbar } from "@/components/topbar"
import { MobileNav } from "@/components/mobile-nav"
import { AppShell } from "@/components/app-shell"
import { BugDetector } from "@/components/bug-detector"
import { getCurrentProfile, getPendingProfiles, getNotifications, getUnreadTotal } from "@/lib/data"
import { markDailyAccess } from "@/lib/activity"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile()

  // Gate de aprovação: conta pendente não acessa o app.
  if (profile && !profile.approved) redirect("/aguardando")

  // Marca acesso do dia (no máx. 1x/dia) para alimentar o heatmap do perfil.
  if (profile?.approved) void markDailyAccess(profile)

  const collapsed = profile?.prefs?.sidebar_collapsed ?? false
  const [pending, notifications, unreadChat] = await Promise.all([
    profile?.role === "admin" ? getPendingProfiles() : Promise.resolve([]),
    profile ? getNotifications(profile.id) : Promise.resolve([]),
    profile ? getUnreadTotal(profile.id) : Promise.resolve(0),
  ])

  // Cor de destaque personalizada: injeta como override de --brand.
  const accent = profile?.prefs?.accent_color
  const accentStyle =
    accent && /^#[0-9a-fA-F]{6}$/.test(accent)
      ? `:root{--brand:${accent};--brand-fg:${accentForeground(accent)};}`
      : null

  return (
    <>
      {accentStyle ? <style dangerouslySetInnerHTML={{ __html: accentStyle }} /> : null}
      {profile ? <BugDetector /> : null}
    <AppShell
      initialCollapsed={collapsed}
      sidebar={
        <Sidebar profile={profile} pending={pending} meId={profile?.id ?? null} unreadChat={unreadChat} />
      }
      topbar={
        <Suspense fallback={<div className="h-16 border-b border-[color:var(--color-border)]" />}>
          <Topbar meId={profile?.id ?? null} notifications={notifications} currentPath="" />
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
