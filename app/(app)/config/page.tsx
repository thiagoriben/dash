import { redirect } from "next/navigation"
import { getCurrentProfile, getPaymentGateways } from "@/lib/data"
import { ConfigClient } from "@/components/config-client"

export const metadata = { title: "Configurações | TrafficDash" }

export default async function ConfigPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect("/login")
  const gateways = await getPaymentGateways(profile.id)
  return <ConfigClient gateways={gateways} />
}
