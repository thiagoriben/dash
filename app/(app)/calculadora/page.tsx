import { redirect } from "next/navigation"
import { getCurrentProfile, getVisibleProjects, getProducts } from "@/lib/data"
import { CalculadoraClient } from "@/components/calculadora-client"
import type { Product } from "@/lib/types"

export const metadata = { title: "Calculadora | TrafficDash" }

export default async function CalculadoraPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect("/login")
  const projects = await getVisibleProjects(profile)

  // Todos os produtos cadastrados nos projetos visíveis (para seleção na calculadora).
  const productLists = await Promise.all(projects.map((p) => getProducts(p.id)))
  const products: (Product & { projectName: string })[] = productLists.flatMap((list, i) =>
    list.map((prod) => ({ ...prod, projectName: projects[i].name })),
  )

  return <CalculadoraClient projects={projects} products={products} />
}
