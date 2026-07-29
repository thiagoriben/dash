import { redirect } from "next/navigation"
import { getCurrentProfile, getVisibleProjects, getCashEntries } from "@/lib/data"
import { CaixaClient } from "@/components/caixa-client"

export const metadata = { title: "Caixa | TrafficDash" }

export default async function CaixaPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect("/login")
  const [projects, entries] = await Promise.all([
    getVisibleProjects(profile),
    getCashEntries(profile),
  ])
  return <CaixaClient entries={entries} projects={projects} />
}
