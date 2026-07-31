"use server"

import { createClient, createAdminClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
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
  const remember = formData.get("remember") != null

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

  // "Lembrar de mim": quando desmarcado, marca a sessão como somente-navegador
  // (cookie sem expiração, descartado ao fechar o navegador). O proxy usa isso
  // para não renovar a sessão em novos processos do navegador.
  const store = await cookies()
  if (remember) {
    store.delete("session_only")
  } else {
    store.set("session_only", "1", { path: "/", httpOnly: true, sameSite: "lax" })
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
  _prev: { error?: string; ok?: boolean; firstAdmin?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean; firstAdmin?: boolean }> {
  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase()
  const password = String(formData.get("password") ?? "")
  const confirm = String(formData.get("confirm") ?? "")
  const recoveryEmail = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase()

  if (!username || !password) return { error: "Preencha usuário e senha." }
  if (!/^[a-z0-9._-]{3,}$/.test(username))
    return { error: "Usuário inválido (mín. 3 caracteres, sem espaços)." }
  if (password.length < 6) return { error: "A senha precisa de ao menos 6 caracteres." }
  if (password !== confirm) return { error: "As senhas não conferem." }
  if (recoveryEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recoveryEmail))
    return { error: "Email de recuperação inválido." }

  const admin = createAdminClient()

  // Bloqueia email de recuperação já usado por outra conta.
  if (recoveryEmail) {
    const { data: dupe } = await admin
      .from("profiles")
      .select("id")
      .filter("prefs->>recovery_email", "eq", recoveryEmail)
      .maybeSingle()
    if (dupe) return { error: "Este email já está em uso por outra conta." }
  }

  // Cria o usuário já com email confirmado, porém pendente de aprovação.
  // Não cria sessão: só entra após um admin aprovar.
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
    // O primeiro usuário do sistema vira admin aprovado automaticamente.
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
    const isFirst = (count ?? 0) === 0

    await admin.from("profiles").upsert(
      {
        id: data.user.id,
        username,
        role: isFirst ? "admin" : "member",
        approved: isFirst,
        prefs: recoveryEmail ? { recovery_email: recoveryEmail } : {},
      },
      { onConflict: "id" },
    )
    return { ok: true, firstAdmin: isFirst }
  }
  return { ok: true }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}

/**
 * "Esqueci a senha": sem SMTP, validamos o email de recuperação salvo no
 * perfil. Se o usuário informar username + email que batem, redefinimos a senha.
 */
export async function resetPasswordByEmail(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const username = String(formData.get("username") ?? "").trim().toLowerCase()
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const password = String(formData.get("password") ?? "")
  const confirm = String(formData.get("confirm") ?? "")

  if (!username || !email || !password) return { error: "Preencha todos os campos." }
  if (password.length < 6) return { error: "A senha precisa de ao menos 6 caracteres." }
  if (password !== confirm) return { error: "As senhas não conferem." }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from("profiles")
    .select("id, prefs")
    .eq("username", username)
    .maybeSingle()

  const savedEmail = String((profile?.prefs as Record<string, unknown> | null)?.recovery_email ?? "")
    .trim()
    .toLowerCase()

  if (!profile || !savedEmail) {
    return { error: "Esta conta não tem email de recuperação cadastrado." }
  }
  if (savedEmail !== email) {
    return { error: "Email não confere com o cadastrado nesta conta." }
  }

  const { error } = await admin.auth.admin.updateUserById(profile.id, { password })
  if (error) return { error: "Não foi possível redefinir a senha." }
  return { ok: true }
}

/** Troca de senha do usuário logado (valida a senha atual). */
export async function changePassword(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const current = String(formData.get("current") ?? "")
  const password = String(formData.get("password") ?? "")
  const confirm = String(formData.get("confirm") ?? "")

  if (!current || !password) return { error: "Preencha todos os campos." }
  if (password.length < 6) return { error: "A nova senha precisa de ao menos 6 caracteres." }
  if (password !== confirm) return { error: "As senhas não conferem." }

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user?.email) return { error: "Sessão expirada." }

  // Revalida a senha atual antes de trocar.
  const check = await supabase.auth.signInWithPassword({
    email: userData.user.email,
    password: current,
  })
  if (check.error) return { error: "Senha atual incorreta." }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: "Não foi possível trocar a senha." }
  return { ok: true }
}
