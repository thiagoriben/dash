import { notFound, redirect } from "next/navigation"
import { cookies } from "next/headers"
import {
  getCurrentProfile,
  getProject,
  getExpenses,
  getDailyMetrics,
  getCreatives,
  getProducts,
  getSales,
  getReceivables,
  getAdAccounts,
  getCardCharges,
  getCashEntriesForProjects,
  getProjectWalletEntries,
  getPaymentGateways,
  getProfitSplits,
  getProfiles,
  getProjectMembers,
  getBankAccounts,
  getProjectJoinRequests,
  getFriends,
  getCustomMetrics,
  getShortcutCategories,
  getShortcuts,
  getNotes,
  getTodos,
  resolveRange,
  type Period,
} from "@/lib/data"
import { getActivity } from "@/lib/activity"
import { getUsdBrlRate } from "@/lib/currency-server"
import { DEFAULT_CURRENCIES } from "@/lib/currency"
import { ProjectDetail } from "@/components/project/project-detail"

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const { id } = await params
  const sp = await searchParams
  const profile = await getCurrentProfile()
  if (!profile) redirect("/login")

  const project = await getProject(id)
  if (!project) notFound()

  const period = (sp.period as Period) ?? "30d"
  const { from, to } = resolveRange(period, { from: sp.from ?? null, to: sp.to ?? null })
  const usdBrl = await getUsdBrlRate()

  const [
    expenses,
    metrics,
    creatives,
    products,
    sales,
    receivables,
    adAccounts,
    cardCharges,
    cashEntries,
    walletEntries,
    gateways,
    splits,
    profiles,
    members,
    activity,
    banks,
    joinRequests,
    friendsData,
    customMetrics,
    orgCategories,
    orgShortcuts,
    orgNotes,
    orgTodos,
  ] = await Promise.all([
    getExpenses([id], from, to),
    getDailyMetrics([id], from, to),
    getCreatives(id),
    getProducts(id),
    getSales([id], from, to),
    getReceivables([id]),
    getAdAccounts(id),
    getCardCharges([id], from, to),
    getCashEntriesForProjects([id], from, to),
    getProjectWalletEntries(id),
    getPaymentGateways(profile.id),
    getProfitSplits(id),
    getProfiles(),
    getProjectMembers(id),
    getActivity({ projectId: id, limit: 60 }),
    getBankAccounts(profile),
    getProjectJoinRequests(id),
    getFriends(profile.id),
    getCustomMetrics(profile.id, id),
    getShortcutCategories(profile.id, id),
    getShortcuts(profile.id, id),
    getNotes(profile.id, id),
    getTodos(profile.id, id),
  ])
  const currencies = profile.prefs?.currencies ?? DEFAULT_CURRENCIES

  const owner = profiles.find((p) => p.id === project.owner_id) ?? null
  const isOwner = project.owner_id === profile.id
  const isAdmin = profile.role === "admin"
  const lastCurrency = (await cookies()).get("last_cash_currency")?.value

  return (
    <ProjectDetail
      project={project}
      expenses={expenses}
      metrics={metrics}
      creatives={creatives}
      products={products}
      sales={sales}
      receivables={receivables}
      adAccounts={adAccounts}
      cardCharges={cardCharges}
      cashEntries={cashEntries}
      walletEntries={walletEntries}
      gateways={gateways}
      splits={splits}
      profiles={profiles}
      members={members}
      activity={activity}
      owner={owner}
      isOwner={isOwner}
      isAdmin={isAdmin}
      prefs={profile.prefs}
      usdBrl={usdBrl}
      banks={banks}
      currencies={currencies}
      meId={profile.id}
      joinRequests={joinRequests}
      friends={friendsData.friends}
      customMetrics={customMetrics}
      orgCategories={orgCategories}
      orgShortcuts={orgShortcuts}
      orgNotes={orgNotes}
      orgTodos={orgTodos}
      lastCurrency={lastCurrency}
    />
  )
}
