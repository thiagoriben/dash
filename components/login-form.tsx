"use client"

import { useActionState, useState } from "react"
import { useFormStatus } from "react-dom"
import { signIn, signUp, resetPasswordByEmail } from "@/app/actions/auth"
import { Button, Field, Input } from "@/components/ui"
import { AlertCircle, LogIn, UserPlus, CheckCircle2, KeyRound } from "lucide-react"

type Mode = "login" | "signup" | "forgot"

function SubmitButton({ mode }: { mode: Mode }) {
  const { pending } = useFormStatus()
  const label = mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Redefinir senha"
  const Icon = mode === "login" ? LogIn : mode === "signup" ? UserPlus : KeyRound
  return (
    <Button type="submit" disabled={pending} className="w-full">
      <Icon size={16} />
      {pending ? "Enviando..." : label}
    </Button>
  )
}

export function LoginForm() {
  const [mode, setMode] = useState<Mode>("login")
  const [loginState, loginAction] = useActionState(signIn, {})
  const [signupState, signupAction] = useActionState(signUp, {})
  const [forgotState, forgotAction] = useActionState(resetPasswordByEmail, {})

  const state = mode === "login" ? loginState : mode === "signup" ? signupState : forgotState

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

  if (mode === "forgot" && forgotState?.ok) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface p-6 text-center">
        <CheckCircle2 className="text-positive" size={32} />
        <h2 className="font-display text-lg font-semibold">Senha redefinida!</h2>
        <p className="text-sm text-muted text-pretty">
          Sua senha foi alterada. Agora é só entrar com a nova senha.
        </p>
        <Button variant="outline" className="mt-1 w-full" onClick={() => setMode("login")}>
          Ir para o login
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {mode !== "forgot" ? (
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
      ) : (
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-lg font-semibold">Recuperar senha</h2>
          <p className="text-sm text-muted text-pretty">
            Informe seu usuário e o email de recuperação cadastrado para definir uma nova senha.
          </p>
        </div>
      )}

      <form
        key={mode}
        action={mode === "login" ? loginAction : mode === "signup" ? signupAction : forgotAction}
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

        {mode === "forgot" ? (
          <Field label="Email de recuperação">
            <Input name="email" type="email" placeholder="voce@email.com" required />
          </Field>
        ) : null}

        <Field label={mode === "forgot" ? "Nova senha" : "Senha"}>
          <Input
            name="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            placeholder="••••••••"
            required
          />
        </Field>

        {mode !== "login" ? (
          <Field label={mode === "forgot" ? "Confirmar nova senha" : "Confirmar senha"}>
            <Input
              name="confirm"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              required
            />
          </Field>
        ) : null}

        {mode === "signup" ? (
          <Field label="Email">
            <Input name="email" type="email" placeholder="voce@email.com" required />
            <p className="mt-1 text-xs text-muted text-pretty">
              Obrigatório. Usado para recuperar a senha e receber avisos importantes.
            </p>
          </Field>
        ) : null}

        {mode === "login" ? (
          <label className="flex select-none items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              name="remember"
              defaultChecked
              className="h-4 w-4 rounded border-border accent-[var(--brand)]"
            />
            Lembrar de mim neste dispositivo
          </label>
        ) : null}

        {state?.error ? (
          <div className="flex items-center gap-2 rounded-xl border border-negative/30 bg-negative/10 px-3 py-2 text-sm text-negative">
            <AlertCircle size={16} />
            {state.error}
          </div>
        ) : null}

        <SubmitButton mode={mode} />
      </form>

      <div className="flex items-center justify-center text-sm">
        {mode === "forgot" ? (
          <button type="button" onClick={() => setMode("login")} className="text-muted hover:text-foreground">
            Voltar para o login
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setMode("forgot")}
            className="text-muted transition-colors hover:text-accent"
          >
            Esqueci minha senha
          </button>
        )}
      </div>
    </div>
  )
}
