"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import { signIn } from "@/app/actions/auth"
import { Button, Field, Input } from "@/components/ui"
import { AlertCircle, LogIn } from "lucide-react"

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full">
      <LogIn size={16} />
      {pending ? "Entrando..." : "Entrar"}
    </Button>
  )
}

export function LoginForm() {
  const [state, formAction] = useActionState(signIn, {})

  return (
    <form action={formAction} className="flex flex-col gap-4">
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
          autoComplete="current-password"
          placeholder="••••••••"
          required
        />
      </Field>
      {state?.error ? (
        <div className="flex items-center gap-2 rounded-xl border border-negative/30 bg-negative/10 px-3 py-2 text-sm text-negative">
          <AlertCircle size={16} />
          {state.error}
        </div>
      ) : null}
      <SubmitButton />
    </form>
  )
}
