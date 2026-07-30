"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getCurrentProfile } from "@/lib/data"

/* ============================ AMIZADES ============================ */

// Envia pedido de amizade por username.
export async function sendFriendRequest(formData: FormData) {
  const supabase = await createClient()
  const me = await getCurrentProfile()
  if (!me) return { error: "Sessão expirada." }

  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase()
  if (!username) return { error: "Informe o usuário." }
  if (username === me.username?.toLowerCase()) return { error: "Você não pode se adicionar." }

  const { data: target } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle()
  if (!target) return { error: "Usuário não encontrado." }

  // Se já existe amizade nos dois sentidos, evita duplicar.
  const { data: existing } = await supabase
    .from("friendships")
    .select("id, status, requester_id, addressee_id")
    .or(
      `and(requester_id.eq.${me.id},addressee_id.eq.${target.id}),and(requester_id.eq.${target.id},addressee_id.eq.${me.id})`,
    )
    .maybeSingle()

  if (existing) {
    if (existing.status === "accepted") return { error: "Vocês já são amigos." }
    // O outro já tinha te enviado: aceita direto.
    if (existing.addressee_id === me.id) {
      await supabase.from("friendships").update({ status: "accepted", updated_at: new Date().toISOString() }).eq("id", existing.id)
      revalidatePath("/socios")
      return { ok: true, accepted: true }
    }
    return { error: "Pedido já enviado." }
  }

  const { error } = await supabase
    .from("friendships")
    .insert({ requester_id: me.id, addressee_id: target.id, status: "pending" })
  if (error) return { error: error.message }
  revalidatePath("/socios")
  return { ok: true }
}

export async function respondFriendRequest(id: string, accept: boolean) {
  const supabase = await createClient()
  if (accept) {
    const { error } = await supabase
      .from("friendships")
      .update({ status: "accepted", updated_at: new Date().toISOString() })
      .eq("id", id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase.from("friendships").delete().eq("id", id)
    if (error) return { error: error.message }
  }
  revalidatePath("/socios")
  return { ok: true }
}

export async function removeFriend(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("friendships").delete().eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/socios")
  return { ok: true }
}

/* =================== PEDIDOS DE ENTRADA EM PROJETO =================== */

// Usuário digita o ID do projeto e pede para entrar.
export async function requestJoinProject(formData: FormData) {
  const supabase = await createClient()
  const me = await getCurrentProfile()
  if (!me) return { error: "Sessão expirada." }

  const projectId = String(formData.get("project_id") ?? "").trim()
  if (!projectId) return { error: "Informe o ID do projeto." }

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, owner_id")
    .eq("id", projectId)
    .maybeSingle()
  if (!project) return { error: "Projeto não encontrado. Confira o ID." }
  if (project.owner_id === me.id) return { error: "Você já é o dono deste projeto." }

  // Já é membro?
  const { data: member } = await supabase
    .from("project_members")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", me.id)
    .maybeSingle()
  if (member) return { error: "Você já participa deste projeto." }

  const { error } = await supabase.from("project_join_requests").insert({
    project_id: projectId,
    user_id: me.id,
    message: String(formData.get("message") ?? "") || null,
    status: "pending",
  })
  if (error) {
    return { error: error.code === "23505" ? "Você já pediu para entrar." : error.message }
  }
  revalidatePath("/socios")
  return { ok: true, projectName: project.name }
}

// Dono aprova/rejeita. Ao aprovar, vira colaborador (sociedade).
export async function respondJoinRequest(id: string, accept: boolean) {
  const supabase = await createClient()

  const { data: req } = await supabase
    .from("project_join_requests")
    .select("id, project_id, user_id, status")
    .eq("id", id)
    .maybeSingle()
  if (!req) return { error: "Pedido não encontrado." }

  if (!accept) {
    await supabase.from("project_join_requests").update({ status: "rejected" }).eq("id", id)
    revalidatePath(`/projetos/${req.project_id}`)
    return { ok: true }
  }

  const { error: memberErr } = await supabase.from("project_members").insert({
    project_id: req.project_id,
    user_id: req.user_id,
    role: "editor",
  })
  if (memberErr && memberErr.code !== "23505") return { error: memberErr.message }

  await supabase.from("project_join_requests").update({ status: "accepted" }).eq("id", id)
  revalidatePath(`/projetos/${req.project_id}`)
  return { ok: true }
}

/* ============================ CHAT ============================ */

export async function sendChatMessage(projectId: string, body: string) {
  const supabase = await createClient()
  const me = await getCurrentProfile()
  if (!me) return { error: "Sessão expirada." }
  const text = body.trim()
  if (!text) return { error: "Mensagem vazia." }

  const { error } = await supabase
    .from("chat_messages")
    .insert({ project_id: projectId, sender_id: me.id, body: text })
  if (error) return { error: error.message }
  return { ok: true }
}

/** Mensagem direta (usuário a usuário). Só entre sócios (amizade aceita). */
export async function sendDirectMessage(recipientId: string, body: string) {
  const supabase = await createClient()
  const me = await getCurrentProfile()
  if (!me) return { error: "Sessão expirada." }
  const text = body.trim()
  if (!text) return { error: "Mensagem vazia." }
  if (recipientId === me.id) return { error: "Não dá pra conversar consigo mesmo." }

  // Confirma que são sócios (amizade aceita).
  const { data: friendship } = await supabase
    .from("friendships")
    .select("id")
    .eq("status", "accepted")
    .or(
      `and(requester_id.eq.${me.id},addressee_id.eq.${recipientId}),and(requester_id.eq.${recipientId},addressee_id.eq.${me.id})`,
    )
    .maybeSingle()
  if (!friendship) return { error: "Vocês precisam ser sócios para conversar." }

  const { error } = await supabase
    .from("direct_messages")
    .insert({ sender_id: me.id, recipient_id: recipientId, body: text })
  if (error) return { error: error.message }
  return { ok: true }
}

