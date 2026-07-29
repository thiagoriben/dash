import { createClient } from "@/lib/supabase/server"
import type {
  Creative,
  DailyMetric,
  Expense,
  FunnelProduct,
  Profile,
  Project,
  ProfitSplit,
} from "./types"

export type Period = "7d" | "30d" | "90d" | "ano" | "tudo"

export function periodStartDate(period: Period): string | null {
  if (period === "tudo") return null
  const days = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : 365
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single()
  return data as Profile | null
}

export async function getProfiles(): Promise<Profile[]> {
  const supabase = await createClient()
  const { data } = await supabase.from("profiles").select("*").order("created_at")
  return (data ?? []) as Profile[]
}

/** Projetos visíveis para o usuário (organização visual). */
export async function getVisibleProjects(profile: Profile | null): Promise<Project[]> {
  const supabase = await createClient()
  const { data: projects } = await supabase.from("projects").select("*").order("created_at", {
    ascending: false,
  })
  const all = (projects ?? []) as Project[]
  if (!profile) return []

  const { data: memberships } = await supabase
    .from("project_members")
    .select("project_id")
    .eq("user_id", profile.id)
  const memberIds = new Set((memberships ?? []).map((m) => m.project_id))

  return all.filter((p) => {
    if (p.visibility === "publico") return true
    if (p.visibility === "privado") return p.owner_id === profile.id
    if (p.visibility === "restrito") return p.owner_id === profile.id || memberIds.has(p.id)
    return true
  })
}

export async function getProject(id: string): Promise<Project | null> {
  const supabase = await createClient()
  const { data } = await supabase.from("projects").select("*").eq("id", id).single()
  return data as Project | null
}

export async function getExpenses(projectIds: string[], start: string | null): Promise<Expense[]> {
  if (projectIds.length === 0) return []
  const supabase = await createClient()
  let q = supabase.from("expenses").select("*").in("project_id", projectIds)
  if (start) q = q.gte("spent_at", start)
  const { data } = await q.order("spent_at", { ascending: false })
  return (data ?? []) as Expense[]
}

export async function getDailyMetrics(
  projectIds: string[],
  start: string | null,
): Promise<DailyMetric[]> {
  if (projectIds.length === 0) return []
  const supabase = await createClient()
  let q = supabase.from("daily_metrics").select("*").in("project_id", projectIds)
  if (start) q = q.gte("date", start)
  const { data } = await q.order("date")
  return (data ?? []) as DailyMetric[]
}

export async function getCreatives(projectId: string): Promise<Creative[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("creatives")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
  return (data ?? []) as Creative[]
}

export async function getFunnelProducts(projectId: string): Promise<FunnelProduct[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("funnel_products")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at")
  return (data ?? []) as FunnelProduct[]
}

export async function getProfitSplits(projectId: string): Promise<ProfitSplit[]> {
  const supabase = await createClient()
  const { data } = await supabase.from("profit_splits").select("*").eq("project_id", projectId)
  return (data ?? []) as ProfitSplit[]
}
