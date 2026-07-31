import { redirect } from "next/navigation"

// Organização virou uma seção com ferramentas próprias no menu lateral.
// A entrada antiga redireciona para Notas (primeira ferramenta).
export default function OrganizacaoPage() {
  redirect("/organizacao/notas")
}
