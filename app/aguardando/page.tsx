import { Clock } from "lucide-react"
import { signOut } from "@/app/actions/auth"
import { Button } from "@/components/ui"

export default function AguardandoPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="glass flex flex-col items-center rounded-2xl p-8 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-warning/10 text-warning">
            <Clock size={24} />
          </div>
          <h1 className="font-display text-xl font-semibold tracking-tight">Aguardando aprovação</h1>
          <p className="mt-2 text-sm text-muted text-pretty">
            Sua conta foi criada e está aguardando a aprovação de um administrador. Você receberá
            acesso assim que for liberada.
          </p>
          <form action={signOut} className="mt-6 w-full">
            <Button type="submit" variant="outline" className="w-full">
              Sair
            </Button>
          </form>
        </div>
      </div>
    </main>
  )
}
