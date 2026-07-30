"use server"

import { createClient, createAdminClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

const DOMAIN = "@dash.local"

function usernameToEmail(username: string) {
  return `${username.trim().toLowerCase()}${DOMAIN}`
}

export async function signIn(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const username = String(formData.get("username") ?? "").trim()
  const password = String(formData.get("password") ?? "")

  if (!username || !password) {
    return { error: "Preencha usuário e senha." }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  })

  if (error || !data.user) {
    return { error: "Usuário ou senha inválidos." }
  }

  // Bloqueia acesso até um admin aprovar a conta.
  const { data: profile } = await supabase
    .from("profiles")
    .select("approved")
    .eq("id", data.user.id)
    .maybeSingle()
  if (profile && profile.approved === false) {
    await supabase.auth.signOut()
    return { error: "Conta aguardando aprovação de um administrador." }
  }

  redirect("/")
}

export async function signUp(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase()
  const password = String(formData.get("password") ?? "")
  const confirm = String(formData.get("confirm") ?? "")

  if (!username || !password) return { error: "Preencha usuário e senha." }
  if (!/^[a-z0-9._-]{3,}$/.test(username))
    return { error: "Usuário inválido (mín. 3 caracteres, sem espaços)." }
  if (password.length < 6) return { error: "A senha precisa de ao menos 6 caracteres." }
  if (password !== confirm) return { error: "As senhas não conferem." }

  // Cria o usuário já com email confirmado, porém pendente de aprovação.
  // Não cria sessão: só entra após um admin aprovar.
  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.createUser({
    email: usernameToEmail(username),
    password,
    email_confirm: true,
    user_metadata: { username },
  })

  if (error) {
    const msg = /already|exists|registered/i.test(error.message)
      ? "Este usuário já existe."
      : "Não foi possível criar a conta."
    return { error: msg }
  }

  if (data.user) {
    await admin
      .from("profiles")
      .upsert({ id: data.user.id, username, role: "member", approved: false }, { onConflict: "id" })
  }
  return { ok: true }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}
