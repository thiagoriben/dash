"use server"

import { createClient, createAdminClient } from "@/lib/supabase/server"
import { getCurrentProfile } from "@/lib/data"
import { revalidatePath } from "next/cache"

const DOMAIN = "@dash.local"

async function requireAdmin() {
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== "admin") {
    throw new Error("Acesso restrito a administradores.")
  }
  return profile
}

export async function createUser(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  try {
    await requireAdmin()
  } catch {
    return { error: "Acesso restrito a administradores." }
  }

  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase()
  const fullName = String(formData.get("full_name") ?? "").trim()
  const phone = String(formData.get("phone") ?? "").trim()
  const password = String(formData.get("password") ?? "")
  const role = String(formData.get("role") ?? "member")

  if (!username || !password) return { error: "Usuário e senha são obrigatórios." }
  if (password.length < 6) return { error: "A senha precisa ter ao menos 6 caracteres." }
  if (!/^[a-z0-9_.]+$/.test(username))
    return { error: "Usuário só pode conter letras minúsculas, números, ponto e underline." }

  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.createUser({
    email: `${username}${DOMAIN}`,
    password,
    email_confirm: true,
    user_metadata: { username, full_name: fullName },
  })
  if (error) {
    if (error.message.includes("already")) return { error: "Esse usuário já existe." }
    return { error: "Não foi possível criar o usuário." }
  }

  const { error: pErr } = await admin.from("profiles").upsert({
    id: data.user.id,
    username,
    full_name: fullName || null,
    phone: phone || null,
    role,
    approved: true,
  })
  if (pErr) return { error: "Usuário criado, mas falhou ao salvar o perfil." }

  revalidatePath("/usuarios")
  return { ok: true }
}

export async function updateUserRole(userId: string, role: string) {
  await requireAdmin()
  const supabase = await createClient()
  await supabase.from("profiles").update({ role }).eq("id", userId)
  revalidatePath("/usuarios")
}

export async function deleteUser(userId: string) {
  const me = await requireAdmin()
  if (me.id === userId) throw new Error("Você não pode remover a si mesmo.")
  const admin = createAdminClient()
  await admin.auth.admin.deleteUser(userId)
  revalidatePath("/usuarios")
}

/* ---------- Aprovação de contas ---------- */
export async function approveUser(userId: string) {
  await requireAdmin()
  const supabase = await createClient()
  await supabase.from("profiles").update({ approved: true }).eq("id", userId)
  revalidatePath("/usuarios")
  revalidatePath("/", "layout")
  return { ok: true }
}

export async function rejectUser(userId: string) {
  const me = await requireAdmin()
  if (me.id === userId) return { error: "Você não pode rejeitar a si mesmo." }
  const admin = createAdminClient()
  await admin.auth.admin.deleteUser(userId)
  revalidatePath("/usuarios")
  revalidatePath("/", "layout")
  return { ok: true }
}
