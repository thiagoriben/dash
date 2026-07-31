"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getCurrentProfile } from "@/lib/data"
import type { MetricKind, Prefs, MetricPreset } from "@/lib/types"

const KINDS: MetricKind[] = ["quantidade", "valor", "percentual"]

function parseKind(v: string): MetricKind {
  return (KINDS as string[]).includes(v) ? (v as MetricKind) : "quantidade"
}

/** Cria uma métrica personalizada (projeto quando projectId, senão pessoal). */
export async function createCustomMetric(projectId: string | null, formData: FormData) {
  const supabase = await createClient()
  const me = await getCurrentProfile()
  if (!me) return { error: "Sessão expirada." }

  const name = String(formData.get("name") ?? "").trim()
  if (!name) return { error: "Dê um nome para a métrica." }
  const kind = parseKind(String(formData.get("kind") ?? "quantidade"))
  const value = Number(String(formData.get("value") ?? "0").replace(",", ".")) || 0

  const { error } = await supabase.from("custom_metrics").insert({
    owner_id: me.id,
    project_id: projectId,
    name,
    kind,
    value,
  })
  if (error) return { error: error.message }
  revalidatePath(projectId ? `/projetos/${projectId}` : "/")
  return { ok: true }
}

/** Atualiza nome/tipo/valor/visibilidade de uma métrica. */
export async function updateCustomMetric(id: string, formData: FormData) {
  const supabase = await createClient()
  const me = await getCurrentProfile()
  if (!me) return { error: "Sessão expirada." }

  const patch: Record<string, unknown> = {}
  const name = formData.get("name")
  const kind = formData.get("kind")
  const value = formData.get("value")
  const hidden = formData.get("hidden")
  if (name != null) patch.name = String(name).trim()
  if (kind != null) patch.kind = parseKind(String(kind))
  if (value != null) patch.value = Number(String(value).replace(",", ".")) || 0
  if (hidden != null) patch.hidden = hidden === "true" || hidden === "on"

  const { data, error } = await supabase
    .from("custom_metrics")
    .update(patch)
    .eq("id", id)
    .select("project_id")
    .maybeSingle()
  if (error) return { error: error.message }
  revalidatePath(data?.project_id ? `/projetos/${data.project_id}` : "/")
  return { ok: true }
}

/** Alterna a visibilidade (mostrar/ocultar) de uma métrica no dashboard. */
export async function toggleCustomMetric(id: string, hidden: boolean) {
  const supabase = await createClient()
  const me = await getCurrentProfile()
  if (!me) return { error: "Sessão expirada." }
  const { data, error } = await supabase
    .from("custom_metrics")
    .update({ hidden })
    .eq("id", id)
    .select("project_id")
    .maybeSingle()
  if (error) return { error: error.message }
  revalidatePath(data?.project_id ? `/projetos/${data.project_id}` : "/")
  return { ok: true }
}

/** Remove uma métrica. */
export async function deleteCustomMetric(id: string) {
  const supabase = await createClient()
  const me = await getCurrentProfile()
  if (!me) return { error: "Sessão expirada." }
  const { data } = await supabase.from("custom_metrics").select("project_id").eq("id", id).maybeSingle()
  const { error } = await supabase.from("custom_metrics").delete().eq("id", id)
  if (error) return { error: error.message }
  revalidatePath(data?.project_id ? `/projetos/${data.project_id}` : "/")
  return { ok: true }
}

/** Preset X1 (projetos de mensagens): cria o conjunto base de métricas. */
const X1_PRESET: { name: string; kind: MetricKind }[] = [
  { name: "Conversas iniciadas", kind: "quantidade" },
  { name: "Custo por conversa", kind: "valor" },
  { name: "Mensagens enviadas", kind: "quantidade" },
  { name: "Conversa → Venda", kind: "percentual" },
  { name: "Tempo médio de resposta", kind: "quantidade" },
]

export async function applyX1Preset(projectId: string | null) {
  return insertMetricSet(projectId, X1_PRESET)
}

/** Insere um conjunto de métricas no escopo, sem duplicar por nome. */
async function insertMetricSet(projectId: string | null, set: { name: string; kind: MetricKind }[]) {
  const supabase = await createClient()
  const me = await getCurrentProfile()
  if (!me) return { error: "Sessão expirada." }

  let existingQ = supabase.from("custom_metrics").select("name")
  existingQ = projectId ? existingQ.eq("project_id", projectId) : existingQ.is("project_id", null).eq("owner_id", me.id)
  const { data: existing } = await existingQ
  const have = new Set((existing ?? []).map((m: { name: string }) => m.name.toLowerCase()))

  const toInsert = set
    .filter((p) => !have.has(p.name.toLowerCase()))
    .map((p, i) => ({ owner_id: me.id, project_id: projectId, name: p.name, kind: p.kind, value: 0, position: i }))
  if (toInsert.length > 0) {
    const { error } = await supabase.from("custom_metrics").insert(toInsert)
    if (error) return { error: error.message }
  }
  revalidatePath(projectId ? `/projetos/${projectId}` : "/")
  return { ok: true }
}

/** Salva as métricas atuais do escopo como um preset reutilizável (em prefs). */
export async function saveMetricPreset(projectId: string | null, name: string) {
  const supabase = await createClient()
  const me = await getCurrentProfile()
  if (!me) return { error: "Sessão expirada." }
  const presetName = name.trim()
  if (!presetName) return { error: "Dê um nome ao preset." }

  let q = supabase.from("custom_metrics").select("name, kind")
  q = projectId ? q.eq("project_id", projectId) : q.is("project_id", null).eq("owner_id", me.id)
  const { data: rows } = await q
  const metrics = (rows ?? []).map((r: { name: string; kind: MetricKind }) => ({ name: r.name, kind: r.kind }))
  if (metrics.length === 0) return { error: "Não há métricas para salvar." }

  const prefs = (me.prefs ?? {}) as Prefs
  const presets = [...(prefs.metric_presets ?? [])]
  const preset: MetricPreset = { id: crypto.randomUUID(), name: presetName, metrics }
  const idx = presets.findIndex((p) => p.name.toLowerCase() === presetName.toLowerCase())
  if (idx >= 0) presets[idx] = preset
  else presets.push(preset)

  const { error } = await supabase.from("profiles").update({ prefs: { ...prefs, metric_presets: presets } }).eq("id", me.id)
  if (error) return { error: error.message }
  revalidatePath(projectId ? `/projetos/${projectId}` : "/")
  return { ok: true }
}

/** Aplica um preset salvo (por id) no escopo atual. */
export async function applyMetricPreset(projectId: string | null, presetId: string) {
  const me = await getCurrentProfile()
  if (!me) return { error: "Sessão expirada." }
  const prefs = (me.prefs ?? {}) as Prefs
  const preset = (prefs.metric_presets ?? []).find((p) => p.id === presetId)
  if (!preset) return { error: "Preset não encontrado." }
  return insertMetricSet(projectId, preset.metrics)
}

/** Remove um preset salvo. */
export async function deleteMetricPreset(presetId: string) {
  const supabase = await createClient()
  const me = await getCurrentProfile()
  if (!me) return { error: "Sessão expirada." }
  const prefs = (me.prefs ?? {}) as Prefs
  const presets = (prefs.metric_presets ?? []).filter((p) => p.id !== presetId)
  const { error } = await supabase.from("profiles").update({ prefs: { ...prefs, metric_presets: presets } }).eq("id", me.id)
  if (error) return { error: error.message }
  revalidatePath("/")
  return { ok: true }
}
