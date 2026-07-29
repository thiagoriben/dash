import { getProjects } from "@/lib/data"
import { CalculadoraClient } from "@/components/calculadora-client"

export const metadata = { title: "Calculadora | TrafficDash" }

export default async function CalculadoraPage() {
  const projects = await getProjects()
  return <CalculadoraClient projects={projects} />
}
