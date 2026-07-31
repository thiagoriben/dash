import { redirect } from "next/navigation"

// Configurações gerais foram embutidas no perfil. Mantemos a rota como atalho.
export default function ConfigPage() {
  redirect("/perfil")
}
