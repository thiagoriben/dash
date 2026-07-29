import { notFound, redirect } from "next/navigation"
import {
  getCurrentProfile,
  getProject,
  getExpenses,
  getDailyMetrics,
  getCreatives,
  getProducts,
  getSales,
  getPaymentGateways,
  getProfitSplits,
  getProfiles,
  getProjectMembers,
  periodStartDate,
  type Period,
} from "@/lib/data"
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
  const start = periodStartDate(period)
  const usdBrl = await getUsdBrlRate()

  const [expenses, metrics, creatives, products, sales, gateways, splits, profiles, members] =
    await Promise.all([
      getExpenses([id], start),
      getDailyMetrics([id], start),
      getCreatives(id),
      getProducts(id),
      getSales([id], start),
      getPaymentGateways(profile.id),
      getProfitSplits(id),
      getProfiles(),
      getProjectMembers(id),
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
      gateways={gateways}
      splits={splits}
      profiles={profiles}
      members={members}
      owner={owner}
      isOwner={isOwner}
      prefs={profile.prefs}
      usdBrl={usdBrl}
    />
  )
}
