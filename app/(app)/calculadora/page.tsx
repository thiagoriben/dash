import { redirect } from "next/navigation"
import { getCurrentProfile, getVisibleProjects } from "@/lib/data"
import { CalculadoraClient } from "@/components/calculadora-client"

export const metadata = { title: "Calculadora | TrafficDash" }

export default async function CalculadoraPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect("/login")
  const projects = await getVisibleProjects(profile)
  return <CalculadoraClient projects={projects} />
}
