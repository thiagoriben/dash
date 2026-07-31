"use server"

import { revalidatePath } from "next/cache"
import { createClient, createAdminClient } from "@/lib/supabase/server"
import { getCurrentProfile } from "@/lib/data"

/* ============================ NOTIFICAÇÕES ============================ */

type NotificationInput = {
  userId: string
  type: string
  title: string
  body?: string | null
  link?: string | null
  data?: Record<string, unknown> | null
}

/**
 * Cria notificações para um ou mais usuários. Usa o service role porque o
 * destinatário normalmente é OUTRO usuário (a RLS de notifications só permite
 * inserção por admin). O ator já é validado nas actions que chamam isto.
 */
async function createNotifications(items: NotificationInput[]) {
  if (items.length === 0) return
  const admin = createAdminClient()
  await admin.from("notifications").insert(
    items.map((n) => ({
      user_id: n.userId,
      type: n.type,
      title: n.title,
      body: n.body ?? null,
      link: n.link ?? null,
      data: n.data ?? null,
    })),
  )
}

export async function markNotificationRead(id: string) {
  const supabase = await createClient()
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id)
  revalidatePath("/")
  return { ok: true }
}

export async function markAllNotificationsRead() {
  const supabase = await createClient()
  const me = await getCurrentProfile()
  if (!me) return { error: "Sessão expirada." }
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", me.id)
    .is("read_at", null)
  revalidatePath("/")
  return { ok: true }
}

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
      await createNotifications([
        {
          userId: existing.requester_id,
          type: "friend_accepted",
          title: "Pedido de amizade aceito",
          body: `${me.full_name || me.username} aceitou seu pedido de amizade.`,
          link: "/socios",
        },
      ])
      revalidatePath("/socios")
      return { ok: true, accepted: true }
    }
    return { error: "Pedido já enviado." }
  }

  const { error } = await supabase
    .from("friendships")
    .insert({ requester_id: me.id, addressee_id: target.id, status: "pending" })
  if (error) return { error: error.message }
  await createNotifications([
    {
      userId: target.id,
      type: "friend_request",
      title: "Novo pedido de amizade",
      body: `${me.full_name || me.username} quer te adicionar como amigo.`,
      link: "/socios",
    },
  ])
  revalidatePath("/socios")
  return { ok: true }
}

export async function respondFriendRequest(id: string, accept: boolean) {
  const supabase = await createClient()
  const me = await getCurrentProfile()
  const { data: fr } = await supabase
    .from("friendships")
    .select("id, requester_id, addressee_id")
    .eq("id", id)
    .maybeSingle()
  if (accept) {
    const { error } = await supabase
      .from("friendships")
      .update({ status: "accepted", updated_at: new Date().toISOString() })
      .eq("id", id)
    if (error) return { error: error.message }
    if (fr?.requester_id && me) {
      await createNotifications([
        {
          userId: fr.requester_id,
          type: "friend_accepted",
          title: "Pedido de amizade aceito",
          body: `${me.full_name || me.username} aceitou seu pedido de amizade.`,
          link: "/socios",
        },
      ])
    }
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
  await createNotifications([
    {
      userId: project.owner_id,
      type: "join_request",
      title: "Novo pedido para entrar no projeto",
      body: `${me.full_name || me.username} pediu para entrar em "${project.name}".`,
      link: `/projetos/${projectId}`,
    },
  ])
  revalidatePath("/socios")
  return { ok: true, projectName: project.name }
}

// Dono aprova/rejeita. Ao aprovar, vira colaborador (sociedade).
export async function respondJoinRequest(id: string, accept: boolean) {
  const supabase = await createClient()

  const { data: req } = await supabase
    .from("project_join_requests")
    .select("id, project_id, user_id, status, projects(name)")
    .eq("id", id)
    .maybeSingle()
  if (!req) return { error: "Pedido não encontrado." }
  const projectName = (req as any).projects?.name ?? "o projeto"

  if (!accept) {
    await supabase.from("project_join_requests").update({ status: "rejected" }).eq("id", id)
    await createNotifications([
      {
        userId: req.user_id,
        type: "join_response",
        title: "Pedido de entrada recusado",
        body: `Seu pedido para entrar em "${projectName}" foi recusado.`,
        link: "/socios",
      },
    ])
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
  await createNotifications([
    {
      userId: req.user_id,
      type: "join_response",
      title: "Você entrou no projeto",
      body: `Seu pedido para entrar em "${projectName}" foi aprovado. Agora você é sócio.`,
      link: `/projetos/${req.project_id}`,
    },
  ])
  revalidatePath(`/projetos/${req.project_id}`)
  return { ok: true }
}

/* =================== CONVITE DIRETO A PROJETO (entre amigos) =================== */

/**
 * O dono/sócio convida um AMIGO (amizade aceita) para um projeto.
 * Cria um convite pendente + notificação. Ao aceitar, o amigo vira sócio.
 */
export async function inviteFriendToProject(projectId: string, friendId: string) {
  const supabase = await createClient()
  const me = await getCurrentProfile()
  if (!me) return { error: "Sessão expirada." }
  if (friendId === me.id) return { error: "Você já participa deste projeto." }

  // Precisa ser amigo (amizade aceita).
  const { data: friendship } = await supabase
    .from("friendships")
    .select("id")
    .eq("status", "accepted")
    .or(
      `and(requester_id.eq.${me.id},addressee_id.eq.${friendId}),and(requester_id.eq.${friendId},addressee_id.eq.${me.id})`,
    )
    .maybeSingle()
  if (!friendship) return { error: "Você só pode convidar amigos. Adicione-o primeiro." }

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, owner_id")
    .eq("id", projectId)
    .maybeSingle()
  if (!project) return { error: "Projeto não encontrado." }

  // Já é membro?
  const { data: member } = await supabase
    .from("project_members")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", friendId)
    .maybeSingle()
  if (member) return { error: "Esse amigo já é sócio do projeto." }

  const { error } = await supabase
    .from("project_invitations")
    .upsert(
      { project_id: projectId, inviter_id: me.id, invitee_id: friendId, role: "editor", status: "pending" },
      { onConflict: "project_id,invitee_id" },
    )
  if (error) return { error: error.message }

  await createNotifications([
    {
      userId: friendId,
      type: "project_invite",
      title: "Convite para um projeto",
      body: `${me.full_name || me.username} convidou você para "${project.name}".`,
      link: "/socios",
    },
  ])
  revalidatePath(`/projetos/${projectId}`)
  revalidatePath("/socios")
  return { ok: true }
}

export async function respondProjectInvitation(id: string, accept: boolean) {
  const supabase = await createClient()
  const me = await getCurrentProfile()
  if (!me) return { error: "Sessão expirada." }

  const { data: inv } = await supabase
    .from("project_invitations")
    .select("id, project_id, inviter_id, invitee_id, role, status, projects(name)")
    .eq("id", id)
    .maybeSingle()
  if (!inv) return { error: "Convite não encontrado." }
  if (inv.invitee_id !== me.id) return { error: "Este convite não é para você." }
  const projectName = (inv as any).projects?.name ?? "o projeto"

  if (!accept) {
    await supabase.from("project_invitations").update({ status: "rejected" }).eq("id", id)
    revalidatePath("/socios")
    return { ok: true }
  }

  const { error: memberErr } = await supabase.from("project_members").insert({
    project_id: inv.project_id,
    user_id: me.id,
    role: inv.role || "editor",
  })
  if (memberErr && memberErr.code !== "23505") return { error: memberErr.message }

  await supabase.from("project_invitations").update({ status: "accepted" }).eq("id", id)
  await createNotifications([
    {
      userId: inv.inviter_id,
      type: "project_invite",
      title: "Convite aceito",
      body: `${me.full_name || me.username} aceitou seu convite para "${projectName}".`,
      link: `/projetos/${inv.project_id}`,
    },
  ])
  revalidatePath("/socios")
  revalidatePath(`/projetos/${inv.project_id}`)
  return { ok: true }
}

/* ============================== FEEDBACK ============================== */

export async function submitFeedback(formData: FormData) {
  const supabase = await createClient()
  const me = await getCurrentProfile()
  if (!me) return { error: "Sessão expirada." }

  const message = String(formData.get("message") ?? "").trim()
  if (!message) return { error: "Escreva sua mensagem." }
  const kind = String(formData.get("kind") ?? "bug")
  const page = String(formData.get("page") ?? "") || null

  const { error } = await supabase.from("feedback").insert({
    user_id: me.id,
    kind,
    message,
    page,
    status: "open",
  })
  if (error) return { error: error.message }

  // Notifica todos os admins em tempo real.
  const admin = createAdminClient()
  const { data: admins } = await admin.from("profiles").select("id").eq("role", "admin")
  await createNotifications(
    ((admins ?? []) as { id: string }[]).map((a) => ({
      userId: a.id,
      type: "feedback",
      title: kind === "bug" ? "Novo bug reportado" : "Nova sugestão",
      body: message.slice(0, 120),
      link: "/admin/feedback",
    })),
  )
  return { ok: true }
}

/**
 * Detector de bug automático: chamado pelo cliente quando um erro não tratado
 * acontece (window.onerror, unhandledrejection, error boundary). Grava um
 * feedback estruturado kind='auto_bug' com detalhes técnicos e notifica os
 * admins. Só admin enxerga esses relatos (RLS + página /admin/feedback).
 */
export async function reportAutoBug(payload: {
  message: string
  stack?: string | null
  page?: string | null
  url?: string | null
  userAgent?: string | null
  componentStack?: string | null
  source?: string | null
}) {
  const supabase = await createClient()
  const me = await getCurrentProfile()
  if (!me) return { ok: false }

  const message = (payload.message || "Erro desconhecido").slice(0, 500)
  const page = payload.page || null

  // Anti-spam: se já existe um auto_bug idêntico deste usuário nos últimos 10 min,
  // não duplica nem renotifica.
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const { data: recent } = await supabase
    .from("feedback")
    .select("id")
    .eq("user_id", me.id)
    .eq("kind", "auto_bug")
    .eq("message", message)
    .gte("created_at", since)
    .maybeSingle()
  if (recent) return { ok: true, deduped: true }

  // Heurística simples de severidade.
  const lower = message.toLowerCase()
  const severity =
    lower.includes("chunk") || lower.includes("network") || lower.includes("failed to fetch")
      ? "high"
      : "critical"

  const detail = {
    message,
    stack: payload.stack ?? null,
    url: payload.url ?? null,
    userAgent: payload.userAgent ?? null,
    componentStack: payload.componentStack ?? null,
    source: payload.source ?? "client",
    at: new Date().toISOString(),
  }

  const { error } = await supabase.from("feedback").insert({
    user_id: me.id,
    kind: "auto_bug",
    auto: true,
    severity,
    message,
    page,
    status: "open",
    detail,
  })
  if (error) return { ok: false }

  const admin = createAdminClient()
  const { data: admins } = await admin.from("profiles").select("id").eq("role", "admin")
  await createNotifications(
    ((admins ?? []) as { id: string }[]).map((a) => ({
      userId: a.id,
      type: "auto_bug",
      title: "Bug detectado automaticamente",
      body: `${me.full_name || me.username}: ${message.slice(0, 90)}`,
      link: "/admin/feedback",
    })),
  )
  return { ok: true }
}

/** Marca um feedback como resolvido/aberto (admin). */
export async function setFeedbackStatus(id: string, status: "open" | "resolved") {
  const supabase = await createClient()
  const me = await getCurrentProfile()
  if (!me || me.role !== "admin") return { error: "Apenas admins." }
  await supabase.from("feedback").update({ status }).eq("id", id)
  revalidatePath("/admin/feedback")
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

  // Confirma que são amigos (amizade aceita).
  const { data: friendship } = await supabase
    .from("friendships")
    .select("id")
    .eq("status", "accepted")
    .or(
      `and(requester_id.eq.${me.id},addressee_id.eq.${recipientId}),and(requester_id.eq.${recipientId},addressee_id.eq.${me.id})`,
    )
    .maybeSingle()
  if (!friendship) return { error: "Vocês precisam ser amigos para conversar." }

  const { error } = await supabase
    .from("direct_messages")
    .insert({ sender_id: me.id, recipient_id: recipientId, body: text })
  if (error) return { error: error.message }
  await createNotifications([
    {
      userId: recipientId,
      type: "direct_message",
      title: `Nova mensagem de ${me.full_name || me.username}`,
      body: text.slice(0, 120),
      link: "/socios",
    },
  ])
  return { ok: true }
}

