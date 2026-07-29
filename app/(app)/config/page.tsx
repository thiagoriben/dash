import Link from "next/link"
import { redirect } from "next/navigation"
import { getCurrentProfile } from "@/lib/data"
import { ListEditor } from "@/components/list-editor"
import { Card } from "@/components/ui"
import { DEFAULT_CURRENCIES, DEFAULT_OFFER_TYPES, DEFAULT_REGIONS, DEFAULT_SOURCES } from "@/lib/currency"
import { CreditCard, ChevronRight } from "lucide-react"

export const metadata = { title: "Configurações | TrafficDash" }

export default async function ConfigPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect("/login")
  const prefs = profile.prefs ?? {}

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold">Configurações gerais</h1>
        <p className="text-sm text-muted">
          Listas usadas em todos os projetos. Tudo em minúsculo — adicione as regiões, moedas,
          tipos de oferta e origens que você usa.
        </p>
      </header>

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
