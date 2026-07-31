import { redirect } from "next/navigation"
import { getCurrentProfile, getPaymentGateways, getBankAccounts, getVisibleProjects } from "@/lib/data"
import { getGatewayBalances } from "@/lib/gateways"
import { GatewaysClient } from "@/components/gateways-client"

export const metadata = { title: "Gateways | TrafficDash" }
export const dynamic = "force-dynamic"

export default async function GatewaysPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect("/login")

  const [gateways, balances, accounts, projects] = await Promise.all([
    getPaymentGateways(profile.id),
    getGatewayBalances(),
    getBankAccounts(profile),
    getVisibleProjects(profile),
  ])

  return (
    <GatewaysClient
      gateways={gateways}
      balances={balances}
      accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
      projects={projects.map((p) => ({ id: p.id, name: p.name }))}
    />
  )
}
