"use client"

import { useActionState, useState } from "react"
import { useFormStatus } from "react-dom"
import { signIn, signUp } from "@/app/actions/auth"
import { Button, Field, Input } from "@/components/ui"
import { AlertCircle, LogIn, UserPlus, CheckCircle2 } from "lucide-react"

function SubmitButton({ mode }: { mode: "login" | "signup" }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {mode === "login" ? <LogIn size={16} /> : <UserPlus size={16} />}
      {pending ? "Enviando..." : mode === "login" ? "Entrar" : "Criar conta"}
    </Button>
  )
}

export function LoginForm() {
  const [mode, setMode] = useState<"login" | "signup">("login")
  const [loginState, loginAction] = useActionState(signIn, {})
  const [signupState, signupAction] = useActionState(signUp, {})

  const state = mode === "login" ? loginState : signupState

  if (mode === "signup" && signupState?.ok) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface p-6 text-center">
        <CheckCircle2 className="text-positive" size={32} />
        <h2 className="font-display text-lg font-semibold">Conta criada!</h2>
        <p className="text-sm text-muted text-pretty">
          Sua conta está aguardando aprovação de um administrador. Você poderá entrar assim que for
          aprovada.
        </p>
        <Button variant="outline" className="mt-1 w-full" onClick={() => setMode("login")}>
          Voltar para o login
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-surface p-1">
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            mode === "login" ? "bg-accent text-accent-fg" : "text-muted hover:text-foreground"
          }`}
        >
          Entrar
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            mode === "signup" ? "bg-accent text-accent-fg" : "text-muted hover:text-foreground"
          }`}
        >
          Criar conta
        </button>
      </div>

      <form
        key={mode}
        action={mode === "login" ? loginAction : signupAction}
        className="flex flex-col gap-4"
      >
        <Field label="Usuário">
          <Input
            name="username"
            autoComplete="username"
            placeholder="seu.usuario"
            autoFocus
            required
          />
        </Field>
        <Field label="Senha">
          <Input
            name="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            placeholder="••••••••"
            required
          />
        </Field>
        {mode === "signup" ? (
          <Field label="Confirmar senha">
            <Input
              name="confirm"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              required
            />
          </Field>
        ) : null}

        {state?.error ? (
          <div className="flex items-center gap-2 rounded-xl border border-negative/30 bg-negative/10 px-3 py-2 text-sm text-negative">
            <AlertCircle size={16} />
            {state.error}
          </div>
        ) : null}

        <SubmitButton mode={mode} />
      </form>
    </div>
  )
}
