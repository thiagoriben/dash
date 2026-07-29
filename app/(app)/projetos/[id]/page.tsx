import { notFound, redirect } from "next/navigation"
import {
  getCurrentProfile,
  getProject,
  getExpenses,
  getDailyMetrics,
  getCreatives,
  getFunnelProducts,
  getProfitSplits,
  getProfiles,
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

  const [expenses, metrics, creatives, funnel, splits, profiles] = await Promise.all([
    getExpenses([id], start),
    getDailyMetrics([id], start),
    getCreatives(id),
    getFunnelProducts(id),
    getProfitSplits(id),
    getProfiles(),
  ])

  return (
    <ProjectDetail
      project={project}
      expenses={expenses}
      metrics={metrics}
      creatives={creatives}
      funnel={funnel}
      splits={splits}
      profiles={profiles}
      usdBrl={usdBrl}
    />
  )
}
