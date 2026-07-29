"use server"

import { createClient } from "@/lib/supabase/server"
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
  const { error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  })

  if (error) {
    return { error: "Usuário ou senha inválidos." }
  }

  redirect("/")
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}
