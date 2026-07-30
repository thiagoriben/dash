import { redirect } from "next/navigation"
import { getCurrentProfile, getVisibleProjects, getReceivables } from "@/lib/data"
import { getUsdBrlRate } from "@/lib/currency-server"
import { ReceivablesClient } from "@/components/receivables-client"

export const metadata = { title: "Recebíveis | TrafficDash" }

export default async function RecebiveisPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect("/login")

  const [projects, usdBrl] = await Promise.all([getVisibleProjects(profile), getUsdBrlRate()])
  const receivables = await getReceivables(projects.map((p) => p.id))
  const byId = new Map(projects.map((p) => [p.id, p]))

  const rows = receivables.map((s) => {
    const p = byId.get(s.project_id)
    return { ...s, projectName: p?.name ?? "—", currency: p?.currency ?? "BRL" }
  })

  return <ReceivablesClient rows={rows} projects={projects} usdBrl={usdBrl} />
}
