import { notFound, redirect } from "next/navigation"
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
  getPaymentGateways,
  getProfitSplits,
  getProfiles,
  getProjectMembers,
  resolveRange,
  type Period,
} from "@/lib/data"
import { getActivity } from "@/lib/activity"
import { getUsdBrlRate } from "@/lib/currency-server"
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
    gateways,
    splits,
    profiles,
    members,
    activity,
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
    getPaymentGateways(profile.id),
    getProfitSplits(id),
    getProfiles(),
    getProjectMembers(id),
    getActivity({ projectId: id, limit: 60 }),
  ])

  const owner = profiles.find((p) => p.id === project.owner_id) ?? null
  const isOwner = project.owner_id === profile.id

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
      gateways={gateways}
      splits={splits}
      profiles={profiles}
      members={members}
      activity={activity}
      owner={owner}
      isOwner={isOwner}
      prefs={profile.prefs}
      usdBrl={usdBrl}
    />
  )
}
