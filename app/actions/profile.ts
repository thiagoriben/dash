"use server"

import { createClient, createAdminClient } from "@/lib/supabase/server"
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

  // Registra o email real no usuário do Supabase (metadata), sem trocar o email
  // de login (username@dash.local) para não quebrar a autenticação por usuário.
  if (recoveryEmail) {
    try {
      const admin = createAdminClient()
      await admin.auth.admin.updateUserById(me.id, {
        user_metadata: { recovery_email: recoveryEmail },
      })
    } catch {
      // metadata é complementar — falha aqui não bloqueia o salvamento do perfil
    }
  }

  revalidatePath("/perfil")
  revalidatePath("/", "layout")
  return { ok: true }
}

/** Dispensa o aviso de cadastro de email real — some para sempre depois disso. */
export async function dismissEmailNotice() {
  const me = await getCurrentProfile()
  if (!me) return { error: "Sessão expirada." }
  const prefs: Prefs = { ...(me.prefs ?? {}), email_notice_dismissed: true }
  const supabase = await createClient()
  const { error } = await supabase.from("profiles").update({ prefs }).eq("id", me.id)
  if (error) return { error: "Não foi possível salvar." }
  revalidatePath("/", "layout")
  return { ok: true }
}

/** Salva as preferências de participação no ranking de faturamento. */
export async function updateRankingPrefs(formData: FormData) {
  const me = await getCurrentProfile()
  if (!me) return { error: "Sessão expirada." }
  const prefs: Prefs = {
    ...(me.prefs ?? {}),
    ranking_opt_in: formData.get("ranking_opt_in") === "on",
    ranking_show_name: formData.get("ranking_show_name") === "on",
    ranking_show_revenue: formData.get("ranking_show_revenue") === "on",
  }
  const supabase = await createClient()
  const { error } = await supabase.from("profiles").update({ prefs }).eq("id", me.id)
  if (error) return { error: "Não foi possível salvar." }
  revalidatePath("/perfil")
  revalidatePath("/ranking")
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
