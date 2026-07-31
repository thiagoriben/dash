import { redirect } from "next/navigation"
import { getCurrentProfile } from "@/lib/data"
import { GlobalNoticeForm } from "@/components/global-notice-form"

export const metadata = { title: "Avisos | Dash" }

export default async function AdminAvisosPage() {
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== "admin") redirect("/")

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 md:p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Avisos globais</h1>
        <p className="text-sm text-muted">Envie um comunicado para todos os usuários da plataforma.</p>
      </header>
      <GlobalNoticeForm />
    </div>
  )
}
