import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCurrentProfile } from "@/lib/data"
import { getActivityByDay } from "@/lib/activity"
import { getUsdBrlRate } from "@/lib/currency-server"
import { getCurrencyOverrides, getTrackedCurrencies } from "@/app/actions/currency"
import { PerfilClient } from "@/components/perfil-client"
import { ListEditor } from "@/components/list-editor"
import { CurrencyPopover } from "@/components/currency-popover"
import { NotifSettings } from "@/components/notif-settings"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui"
import { DEFAULT_CURRENCIES, DEFAULT_OFFER_TYPES, DEFAULT_REGIONS, DEFAULT_SOURCES } from "@/lib/currency"
import { CreditCard, ChevronRight, Coins, SlidersHorizontal, Bell } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function PerfilPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect("/login")

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [activity, usdBrl, fxOverrides, fxCurrencies] = await Promise.all([
    getActivityByDay(profile.id, 133),
    getUsdBrlRate(),
    getCurrencyOverrides(),
    getTrackedCurrencies(),
  ])

  const [ownedRes, collabRes, friendsRes] = await Promise.all([
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("owner_id", profile.id),
    supabase
      .from("project_members")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id),
    supabase
      .from("friendships")
      .select("id", { count: "exact", head: true })
      .eq("status", "accepted")
      .or(`requester_id.eq.${profile.id},addressee_id.eq.${profile.id}`),
  ])

  const stats = {
    owned: ownedRes.count ?? 0,
    collaborations: collabRes.count ?? 0,
    partners: friendsRes.count ?? 0,
    createdAt: profile.created_at,
    lastSignIn: user?.last_sign_in_at ?? null,
  }

  const prefs = profile.prefs ?? {}

  return (
    <div className="flex flex-col gap-6">
      <PerfilClient profile={profile} stats={stats} activity={activity} />

      {/* Configurações gerais — antes em Ajustes, agora embutidas no perfil */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SlidersHorizontal size={18} className="text-accent" />
            Configurações gerais
          </CardTitle>
          <CardDescription>
            Listas usadas em todos os projetos. Tudo em minúsculo — adicione as regiões, moedas,
            tipos de oferta e origens que você usa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <ListEditor
              listKey="regions"
              title="Regiões"
              description="Ex: br, us, es"
              initial={prefs.regions ?? DEFAULT_REGIONS}
              placeholder="ex: br"
            />
            <ListEditor
              listKey="currencies"
              title="Moedas"
              description="Códigos em minúsculo (exibidos em maiúsculo)"
              initial={prefs.currencies ?? DEFAULT_CURRENCIES}
              placeholder="ex: brl"
              uppercaseDisplay
            />
            <ListEditor
              listKey="offer_types"
              title="Tipos de oferta"
              initial={prefs.offer_types ?? DEFAULT_OFFER_TYPES}
              placeholder="ex: x1"
            />
            <ListEditor
              listKey="sources"
              title="Origens de venda"
              initial={prefs.sources ?? DEFAULT_SOURCES}
              placeholder="ex: tráfego pago"
            />
          </div>
        </CardContent>
      </Card>

      {/* Notificações e lembretes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell size={18} className="text-accent" />
            Notificações
          </CardTitle>
          <CardDescription>
            Ative os alertas do navegador e configure os lembretes de tarefas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NotifSettings initial={prefs.notif_settings ?? {}} />
        </CardContent>
      </Card>

      {/* Câmbio — antes na sidebar, agora nas configurações */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins size={18} className="text-accent" />
            Câmbio de moedas
          </CardTitle>
          <CardDescription>
            Cotações usadas nas conversões do app. USD define a conversão base.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CurrencyPopover
            usdBrl={usdBrl}
            currencies={fxCurrencies}
            overrides={fxOverrides}
            collapsed={false}
            inline
          />
        </CardContent>
      </Card>

      {/* Gateways de pagamento */}
      <Card>
        <Link
          href="/config/gateways"
          className="flex items-center justify-between p-5 transition-colors hover:bg-white/5"
        >
          <div className="flex items-center gap-3">
            <CreditCard size={20} className="text-primary" />
            <div>
              <p className="font-medium text-foreground">Gateways de pagamento</p>
              <p className="text-sm text-muted">Taxas e prazos de recebimento por gateway.</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-muted" />
        </Link>
      </Card>
    </div>
  )
}
