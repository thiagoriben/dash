"use client"

import { useActionState, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useFormStatus } from "react-dom"
import { updateMyProfile, updateAccentColor, updateRankingPrefs } from "@/app/actions/profile"
import { changePassword } from "@/app/actions/auth"
import { ActivityHeatmap } from "@/components/activity-heatmap"
import type { DayCount } from "@/lib/activity"
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Field,
  Input,
  Badge,
} from "@/components/ui"
import type { Profile } from "@/lib/types"
import {
  Copy,
  Check,
  FolderKanban,
  Users,
  Handshake,
  CalendarDays,
  Clock,
  Save,
  KeyRound,
  Palette,
  Globe,
  Lock,
  Activity,
  Trophy,
} from "lucide-react"

type Stats = {
  owned: number
  collaborations: number
  partners: number
  createdAt: string
  lastSignIn: string | null
}

const PRESET_COLORS = [
  { name: "Verde neon", hex: "#29f57e" },
  { name: "Azul", hex: "#3b82f6" },
  { name: "Ciano", hex: "#22d3ee" },
  { name: "Âmbar", hex: "#ff9838" },
  { name: "Rosa", hex: "#ec4899" },
  { name: "Vermelho", hex: "#ff4d4d" },
  { name: "Índigo", hex: "#6366f1" },
  { name: "Lima", hex: "#a3e635" },
]

function SaveButton({ label = "Salvar" }: { label?: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      <Save size={16} />
      {pending ? "Salvando..." : label}
    </Button>
  )
}

function fmtDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
}

export function PerfilClient({
  profile,
  stats,
  activity = [],
}: {
  profile: Profile
  stats: Stats
  activity?: DayCount[]
}) {
  const router = useRouter()
  const [dataState, dataAction] = useActionState(updateMyProfile, {})
  const [pwState, pwAction] = useActionState(changePassword, {})
  const [copied, setCopied] = useState(false)
  const [color, setColor] = useState(profile.prefs?.accent_color ?? "#29f57e")
  const [savingColor, startColor] = useTransition()
  const [rankOptIn, setRankOptIn] = useState(profile.prefs?.ranking_opt_in ?? false)
  const [savingRank, startRank] = useTransition()

  function saveRanking(form: FormData) {
    startRank(async () => {
      await updateRankingPrefs(form)
      router.refresh()
    })
  }

  function copyId() {
    navigator.clipboard.writeText(profile.id)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function applyColor(hex: string) {
    setColor(hex)
    document.documentElement.style.setProperty("--brand", hex)
    startColor(async () => {
      await updateAccentColor(hex)
      router.refresh()
    })
  }

  const initials = (profile.username ?? "?").slice(0, 2).toUpperCase()

  const statCards = [
    { label: "Projetos", value: stats.owned, icon: FolderKanban },
    { label: "Colaborações", value: stats.collaborations, icon: Users },
    { label: "Sócios", value: stats.partners, icon: Handshake },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Meu perfil</h1>
        <p className="text-sm text-muted">Seus dados, segurança e preferências.</p>
      </div>

      {/* Cabeçalho do perfil */}
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-accent/15 font-display text-xl font-semibold text-accent">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-lg font-semibold">
                {profile.full_name ?? profile.username}
              </span>
              <Badge tone={profile.role === "admin" ? "primary" : "default"}>{profile.role}</Badge>
              <Badge tone={profile.is_public ? "primary" : "default"}>
                {profile.is_public ? (
                  <>
                    <Globe size={12} /> Público
                  </>
                ) : (
                  <>
                    <Lock size={12} /> Privado
                  </>
                )}
              </Badge>
            </div>
            <div className="mt-0.5 text-sm text-muted">@{profile.username}</div>
            <button
              onClick={copyId}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-2 py-1 font-mono text-xs text-muted transition-colors hover:text-foreground"
              title="Copiar ID"
            >
              {copied ? <Check size={12} className="text-positive" /> : <Copy size={12} />}
              {profile.id}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {statCards.map((s) => {
          const Icon = s.icon
          return (
            <Card key={s.label}>
              <CardContent className="flex flex-col gap-1 pt-6">
                <Icon size={16} className="text-muted" />
                <span className="font-display text-2xl font-semibold">{s.value}</span>
                <span className="text-xs text-muted">{s.label}</span>
              </CardContent>
            </Card>
          )
        })}
        <Card>
          <CardContent className="flex flex-col gap-1 pt-6">
            <CalendarDays size={16} className="text-muted" />
            <span className="font-display text-sm font-semibold">{fmtDate(stats.createdAt)}</span>
            <span className="text-xs text-muted">Membro desde</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 pt-6">
            <Clock size={16} className="text-muted" />
            <span className="font-display text-sm font-semibold">{fmtDate(stats.lastSignIn)}</span>
            <span className="text-xs text-muted">Último acesso</span>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Dados */}
        <Card>
          <CardHeader>
            <CardTitle>Dados</CardTitle>
            <CardDescription>Nome, contato e visibilidade do perfil.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={dataAction} className="flex flex-col gap-4">
              <Field label="Nome completo">
                <Input name="full_name" defaultValue={profile.full_name ?? ""} placeholder="Seu nome" />
              </Field>
              <Field label="Telefone">
                <Input name="phone" defaultValue={profile.phone ?? ""} placeholder="(00) 00000-0000" />
              </Field>
              <Field label="Email de recuperação">
                <Input
                  name="recovery_email"
                  type="email"
                  defaultValue={profile.prefs?.recovery_email ?? ""}
                  placeholder="voce@email.com"
                />
                <p className="mt-1 text-xs text-muted text-pretty">
                  Necessário para recuperar a senha caso esqueça.
                </p>
              </Field>
              <label className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 px-3 py-2.5">
                <input
                  type="checkbox"
                  name="is_public"
                  defaultChecked={profile.is_public}
                  className="h-4 w-4 accent-[var(--brand)]"
                />
                <span className="text-sm">
                  Perfil público
                  <span className="block text-xs text-muted">
                    Outros usuários podem ver seu perfil pelo seu ID.
                  </span>
                </span>
              </label>
              {dataState?.error ? (
                <p className="text-sm text-negative">{dataState.error}</p>
              ) : dataState?.ok ? (
                <p className="text-sm text-positive">Perfil atualizado.</p>
              ) : null}
              <div>
                <SaveButton />
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Segurança */}
        <Card>
          <CardHeader>
            <CardTitle>Segurança</CardTitle>
            <CardDescription>Troque sua senha de acesso.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={pwAction} className="flex flex-col gap-4">
              <Field label="Senha atual">
                <Input name="current" type="password" autoComplete="current-password" placeholder="••••••••" />
              </Field>
              <Field label="Nova senha">
                <Input name="password" type="password" autoComplete="new-password" placeholder="••••••••" />
              </Field>
              <Field label="Confirmar nova senha">
                <Input name="confirm" type="password" autoComplete="new-password" placeholder="••••••••" />
              </Field>
              {pwState?.error ? (
                <p className="text-sm text-negative">{pwState.error}</p>
              ) : pwState?.ok ? (
                <p className="text-sm text-positive">Senha alterada com sucesso.</p>
              ) : null}
              <div>
                <Button type="submit" variant="outline">
                  <KeyRound size={16} />
                  Trocar senha
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Aparência */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette size={18} className="text-accent" />
            Aparência
          </CardTitle>
          <CardDescription>Escolha a cor de destaque do app.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            {PRESET_COLORS.map((c) => (
              <button
                key={c.hex}
                onClick={() => applyColor(c.hex)}
                title={c.name}
                aria-label={c.name}
                className="flex h-10 w-10 items-center justify-center rounded-xl border-2 transition-transform hover:scale-105"
                style={{
                  backgroundColor: c.hex,
                  borderColor: color.toLowerCase() === c.hex.toLowerCase() ? "#fff" : "transparent",
                }}
              >
                {color.toLowerCase() === c.hex.toLowerCase() ? (
                  <Check size={18} className="text-black" />
                ) : null}
              </button>
            ))}
            <label className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 text-sm text-muted">
              Personalizada
              <input
                type="color"
                value={color}
                onChange={(e) => applyColor(e.target.value)}
                className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
              />
            </label>
            {savingColor ? <span className="text-xs text-muted">Salvando…</span> : null}
          </div>
        </CardContent>
      </Card>

      {/* Atividade */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity size={18} className="text-accent" />
            Atividade
          </CardTitle>
          <CardDescription>Seus dias de uso do app. Quanto mais ações, mais forte a cor.</CardDescription>
        </CardHeader>
        <CardContent>
          <ActivityHeatmap data={activity} />
        </CardContent>
      </Card>

      {/* Ranking */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy size={18} className="text-accent" />
            Ranking de faturamento
          </CardTitle>
          <CardDescription>
            Por padrão você fica fora do ranking. Participe e escolha o que exibir.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveRanking} className="flex flex-col gap-3">
            <label className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 px-3 py-2.5">
              <input
                type="checkbox"
                name="ranking_opt_in"
                checked={rankOptIn}
                onChange={(e) => setRankOptIn(e.target.checked)}
                className="h-4 w-4 accent-[var(--brand)]"
              />
              <span className="text-sm">
                Participar do ranking
                <span className="block text-xs text-muted">Seu faturamento entra na disputa mensal.</span>
              </span>
            </label>
            <label
              className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 px-3 py-2.5 data-[off=true]:opacity-40"
              data-off={!rankOptIn}
            >
              <input
                type="checkbox"
                name="ranking_show_name"
                defaultChecked={profile.prefs?.ranking_show_name ?? true}
                disabled={!rankOptIn}
                className="h-4 w-4 accent-[var(--brand)]"
              />
              <span className="text-sm">
                Mostrar meu nome
                <span className="block text-xs text-muted">Se desligado, apareço como anônimo.</span>
              </span>
            </label>
            <label
              className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 px-3 py-2.5 data-[off=true]:opacity-40"
              data-off={!rankOptIn}
            >
              <input
                type="checkbox"
                name="ranking_show_revenue"
                defaultChecked={profile.prefs?.ranking_show_revenue ?? true}
                disabled={!rankOptIn}
                className="h-4 w-4 accent-[var(--brand)]"
              />
              <span className="text-sm">
                Mostrar meu faturamento
                <span className="block text-xs text-muted">Se desligado, o valor fica oculto no ranking.</span>
              </span>
            </label>
            <div>
              <Button type="submit" variant="outline" disabled={savingRank}>
                <Trophy size={16} />
                {savingRank ? "Salvando…" : "Salvar preferências"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
