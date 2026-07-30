import { LoginForm } from "@/components/login-form"
import { Zap } from "lucide-react"

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-[0_0_24px_rgba(45,226,230,0.25)]">
            <Zap size={24} />
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            <span className="neon-text">Dash</span>
          </h1>
          <p className="mt-1 text-sm text-muted">Gestão de tráfego pago e ofertas</p>
        </div>
        <div className="glass rounded-2xl p-6">
          <LoginForm />
        </div>
        <p className="mt-6 text-center text-xs text-muted">
          Sistema interno · acesso restrito à equipe
        </p>
      </div>
    </main>
  )
}
