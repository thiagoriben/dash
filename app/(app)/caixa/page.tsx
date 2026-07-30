import { redirect } from "next/navigation"
import {
  getCurrentProfile,
  getVisibleProjects,
  getCashEntries,
  getBankAccounts,
  getProfiles,
} from "@/lib/data"
import { getUsdBrlRate } from "@/lib/currency-server"
import { DEFAULT_CURRENCIES } from "@/lib/currency"
import { CaixaClient } from "@/components/caixa-client"

export const metadata = { title: "Caixa | TrafficDash" }

export default async function CaixaPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect("/login")
  const [projects, entries, banks, profiles, usdBrl] = await Promise.all([
    getVisibleProjects(profile),
    getCashEntries(profile),
    getBankAccounts(profile),
    getProfiles(),
    getUsdBrlRate(),
  ])
  const currencies = profile.prefs?.currencies ?? DEFAULT_CURRENCIES
  return (
    <CaixaClient
      entries={entries}
      projects={projects}
      banks={banks}
      profiles={profiles}
      meId={profile.id}
      usdBrl={usdBrl}
      currencies={currencies}
    />
  )
}
