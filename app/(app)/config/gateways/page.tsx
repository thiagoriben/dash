import { redirect } from "next/navigation"
import { getCurrentProfile, getPaymentGateways } from "@/lib/data"
import { GatewaysClient } from "@/components/gateways-client"

export const metadata = { title: "Gateways | TrafficDash" }

export default async function GatewaysPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect("/login")
  const gateways = await getPaymentGateways(profile.id)
  return <GatewaysClient gateways={gateways} />
}
