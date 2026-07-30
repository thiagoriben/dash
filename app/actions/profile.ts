"use server"

import { createClient } from "@/lib/supabase/server"
import { getCurrentProfile } from "@/lib/data"
import { revalidatePath } from "next/cache"
import type { Prefs } from "@/lib/types"

/** Atualiza dados básicos do próprio perfil. */
export async function updateMyProfile(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const me = await getCurrentProfile()
  if (!me) return { error: "Sessão expirada." }

  const fullName = String(formData.get("full_name") ?? "").trim()
  const phone = String(formData.get("phone") ?? "").trim()
  const recoveryEmail = String(formData.get("recovery_email") ?? "").trim().toLowerCase()
  const isPublic = formData.get("is_public") === "on"

  if (recoveryEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recoveryEmail))
    return { error: "Email inválido." }

  const prefs: Prefs = { ...(me.prefs ?? {}), recovery_email: recoveryEmail || undefined }

  const supabase = await createClient()
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName || null,
      phone: phone || null,
      is_public: isPublic,
      prefs,
    })
    .eq("id", me.id)

  if (error) return { error: "Não foi possível salvar." }
  revalidatePath("/perfil")
  revalidatePath("/", "layout")
  return { ok: true }
}

/** Salva a cor de destaque do app. */
export async function updateAccentColor(color: string) {
  const me = await getCurrentProfile()
  if (!me) return { error: "Sessão expirada." }

  const hex = /^#[0-9a-fA-F]{6}$/.test(color) ? color : undefined
  const prefs: Prefs = { ...(me.prefs ?? {}), accent_color: hex }

  const supabase = await createClient()
  const { error } = await supabase.from("profiles").update({ prefs }).eq("id", me.id)
  if (error) return { error: "Não foi possível salvar a cor." }
  revalidatePath("/", "layout")
  return { ok: true }
}
