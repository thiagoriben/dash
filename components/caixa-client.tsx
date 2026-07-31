"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { BankAccount, CashEntry, Profile, Project } from "@/lib/types"
import { formatCurrency } from "@/lib/utils"
import { toBRL, fromBRL, convertCurrency, normalizeCurrency, currencySymbol } from "@/lib/currency"
import { Card, CardContent, Button, Field, Input, Select, Badge, Table, Th, Td } from "@/components/ui"
import { Modal } from "@/components/modal"
import { RowActions } from "@/components/row-actions"
import {
  createCashEntry,
  deleteCashEntry,
  transferCash,
  saveBankAccount,
  deleteBankAccount,
} from "@/app/actions/projects"
import {
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  ArrowLeftRight,
  Landmark,
  Building2,
} from "lucide-react"

const today = () => new Date().toISOString().slice(0, 10)
const num = (v: string) => Number.parseFloat(String(v ?? "0").replace(",", ".")) || 0
type Scope = "pessoal" | "projeto"
type PeriodKey = "hoje" | "7d" | "30d" | "90d" | "mesatual" | "tudo"

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "90d", label: "90 dias" },
  { key: "mesatual", label: "Este mês" },
  { key: "tudo", label: "Tudo" },
]

function periodStart(key: PeriodKey): Date | null {
  if (key === "tudo") return null
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  if (key === "hoje") return d
  if (key === "mesatual") {
    d.setDate(1)
    return d
  }
  const days = key === "7d" ? 7 : key === "30d" ? 30 : 90
  d.setDate(d.getDate() - days)
  return d
}

export function CaixaClient({
  entries,
  projects,
  banks,
  profiles,
  meId,
  usdBrl,
  currencies,
  lockedProjectId,
  lastCurrency,
}: {
  entries: CashEntry[]
  projects: Project[]
  banks: BankAccount[]
  profiles: Profile[]
  meId: string
  usdBrl: number
  currencies: string[]
  /** Quando definido, o caixa fica travado neste projeto (uso embutido na aba do projeto). */
  lockedProjectId?: string
  /** Última moeda usada pelo usuário (memória do formulário). */
  lastCurrency?: string
}) {
  const locked = Boolean(lockedProjectId)
  const [scopeState, setScope] = useState<Scope>(locked ? "projeto" : "pessoal")
  const scope: Scope = locked ? "projeto" : scopeState
  const [projectIdState, setProjectId] = useState<string>(projects[0]?.id ?? "")
  const projectId = locked ? (lockedProjectId as string) : projectIdState
  const [period, setPeriod] = useState<PeriodKey>("30d")
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")
  // Moeda de exibição: modo global (uma moeda para tudo) ou individual (por card).
  const DISPLAY_CURRENCIES = ["BRL", "USD"] as const
  const [displayMode, setDisplayMode] = useState<"global" | "individual">("global")
  const [globalCur, setGlobalCur] = useState<string>("BRL")
  const [cardCur, setCardCur] = useState<Record<string, string>>({
    saldo: "BRL",
    entradas: "BRL",
    saidas: "BRL",
  })
  // Moeda efetiva de um card: no modo global todos seguem globalCur.
  const curOf = (key: string) => (displayMode === "global" ? globalCur : cardCur[key] ?? "BRL")
  const setCardCurrency = (key: string, cur: string) => setCardCur((p) => ({ ...p, [key]: cur }))
  const [entryOpen, setEntryOpen] = useState(false)
  const [direction, setDirection] = useState<"entrada" | "saida">("entrada")
  // Tipo da saída e vínculo (gasto de anúncio <-> cobrança no cartão) para o imposto Meta.
  const [entryType, setEntryType] = useState<CashEntry["entry_type"]>("comum")
  const [linkedId, setLinkedId] = useState<string>("")
  const [entryCurrency, setEntryCurrency] = useState<string>(lastCurrency ?? currencies[0] ?? "BRL")
  const [prefill, setPrefill] = useState<{
    amount?: string
    description?: string
    category?: string
    currency?: string
  }>({})
  const [formKey, setFormKey] = useState(0)
  const [transferOpen, setTransferOpen] = useState(false)
  // Origem/destino da transferência: "pessoal" (carteira), "projeto" ou "socio".
  const [fromKind, setFromKind] = useState<"pessoal" | "projeto">("pessoal")
  const [fromProj, setFromProj] = useState("")
  const [toKind, setToKind] = useState<"pessoal" | "projeto" | "socio">("projeto")
  const [toProj, setToProj] = useState("")
  const [toSocio, setToSocio] = useState("")
  const [bankOpen, setBankOpen] = useState(false)
  const [editingBank, setEditingBank] = useState<BankAccount | null>(null)
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const custom = Boolean(customFrom || customTo)
  const start = custom
    ? customFrom
      ? new Date(customFrom + "T00:00:00")
      : null
    : periodStart(period)
  const end = custom && customTo ? new Date(customTo + "T23:59:59") : null
  const inPeriod = (iso: string) => {
    const d = new Date(iso + "T00:00:00")
    if (start && d < start) return false
    if (end && d > end) return false
    return true
  }

  // Filtra as movimentações do escopo atual.
  const scoped = useMemo(() => {
    return entries.filter((c) => {
      if (!inPeriod(c.occurred_at)) return false
      if (scope === "pessoal") return c.project_id === null && c.owner_id === meId
      return c.project_id === projectId
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, scope, projectId, meId, period, customFrom, customTo])

  const { saldo, entradas, saidas } = useMemo(() => {
    let e = 0
    let s = 0
    for (const c of scoped) {
      const v = toBRL(c.amount, c.currency ?? "BRL", usdBrl)
      if (c.direction === "entrada") e += v
      else s += v
    }
    return { saldo: e - s, entradas: e, saidas: s }
  }, [scoped, usdBrl])

  const banksTotal = useMemo(
    () => banks.reduce((a, b) => a + toBRL(b.balance, b.currency, usdBrl), 0),
    [banks, usdBrl],
  )

  function openNew(dir: "entrada" | "saida") {
    setDirection(dir)
    setError(undefined)
    setPrefill({})
    setEntryType("comum")
    setLinkedId("")
    setEntryCurrency(lastCurrency ?? currencies[0] ?? "BRL")
    setFormKey((k) => k + 1)
    setEntryOpen(true)
  }

  // Candidatos a vínculo: lançamentos do MESMO projeto, do TIPO OPOSTO e ainda sem par.
  // gasto_anuncio combina com cobranca_cartao (e vice-versa) para calcular o imposto Meta.
  const linkTargets = useMemo(() => {
    if (scope !== "projeto") return []
    const want = entryType === "gasto_anuncio" ? "cobranca_cartao" : entryType === "cobranca_cartao" ? "gasto_anuncio" : null
    if (!want) return []
    return entries
      .filter((c) => c.project_id === projectId && c.entry_type === want && !c.linked_entry_id)
      .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
  }, [entries, entryType, scope, projectId])

  // Imposto Meta estimado = |cobrança − gasto| do par selecionado.
  const linkedTarget = linkTargets.find((c) => c.id === linkedId) ?? null
  const linkAmountBRL = linkedTarget ? toBRL(linkedTarget.amount, linkedTarget.currency, usdBrl) : 0

  // Lançamentos recentes do mesmo escopo/direção — clique preenche o formulário.
  const recent = useMemo(() => {
    const seen = new Set<string>()
    const list: { description: string; amount: number; currency: string; category: string | null }[] = []
    const pool = entries
      .filter((c) =>
        c.direction === direction &&
        (scope === "pessoal" ? c.project_id === null && c.owner_id === meId : c.project_id === projectId),
      )
      .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
    for (const c of pool) {
      const key = `${c.description ?? ""}|${c.amount}|${c.category ?? ""}`
      if (seen.has(key)) continue
      seen.add(key)
      list.push({
        description: c.description ?? "",
        amount: c.amount,
        currency: c.currency ?? "BRL",
        category: c.category ?? null,
      })
      if (list.length >= 6) break
    }
    return list
  }, [entries, direction, scope, projectId, meId])

  function applyRecent(r: { description: string; amount: number; currency: string; category: string | null }) {
    setPrefill({
      amount: String(r.amount),
      description: r.description,
      category: r.category ?? "",
      currency: r.currency,
    })
    setFormKey((k) => k + 1)
  }
  function openBank(b: BankAccount | null) {
    setEditingBank(b)
    setError(undefined)
    setBankOpen(true)
  }

  function openTransfer() {
    setError(undefined)
    if (scope === "projeto" && projectId) {
      setFromKind("projeto")
      setFromProj(projectId)
      setToKind("pessoal")
    } else {
      setFromKind("pessoal")
      setToKind("projeto")
      setToProj(projects[0]?.id ?? "")
    }
    setToSocio("")
    setTransferOpen(true)
  }

  function submit(fn: (fd: FormData) => Promise<{ error?: string; ok?: boolean }>, close: () => void) {
    return (formData: FormData) => {
      setError(undefined)
      startTransition(async () => {
        const res = await fn(formData)
        if (res?.error) setError(res.error)
        else {
          close()
          router.refresh()
        }
      })
    }
  }

  const projectName = (id: string | null) => projects.find((p) => p.id === id)?.name ?? "Geral"
  const memberName = (id: string | null) => profiles.find((p) => p.id === id)?.username ?? "—"

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {!locked && <h1 className="font-display text-2xl font-semibold">Caixa</h1>}
          <p className="text-sm text-muted">
            {scope === "pessoal"
              ? "Seu caixa e contas pessoais. Privado, só você vê."
              : "Caixa do projeto, compartilhado com os membros."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" onClick={openTransfer}>
            <ArrowLeftRight size={16} /> Transferir
          </Button>
          <Button size="sm" variant="ghost" onClick={() => openNew("saida")}>
            <ArrowDownRight size={16} /> Saída
          </Button>
          <Button size="sm" onClick={() => openNew("entrada")}>
            <Plus size={16} /> Entrada
          </Button>
        </div>
      </header>

      {/* Seletor de escopo + filtros */}
      <div className="flex flex-wrap items-center gap-3">
        {!locked && (
          <div className="inline-flex rounded-xl border border-[color:var(--color-border)] p-1">
            <ScopeTab active={scope === "pessoal"} onClick={() => setScope("pessoal")} icon={<Wallet size={15} />}>
              Pessoal
            </ScopeTab>
            <ScopeTab active={scope === "projeto"} onClick={() => setScope("projeto")} icon={<Building2 size={15} />}>
              Projeto
            </ScopeTab>
          </div>
        )}
        {!locked && scope === "projeto" && (
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="max-w-[220px]">
            {projects.length === 0 && <option value="">Nenhum projeto</option>}
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        )}
        <div className="inline-flex flex-wrap rounded-xl border border-[color:var(--color-border)] p-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => {
                setPeriod(p.key)
                setCustomFrom("")
                setCustomTo("")
              }}
              className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                !custom && period === p.key
                  ? "bg-accent text-accent-fg"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            aria-label="Data inicial"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="h-9 w-auto"
          />
          <span className="text-xs text-muted">até</span>
          <Input
            type="date"
            aria-label="Data final"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="h-9 w-auto"
          />
          {custom && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setCustomFrom("")
                setCustomTo("")
              }}
            >
              Limpar
            </Button>
          )}
        </div>

        {/* Moeda de exibição: global (uma moeda) ou individual (por card) */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted">Exibir em</span>
          <div className="inline-flex rounded-xl border border-[color:var(--color-border)] p-1">
            {DISPLAY_CURRENCIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setDisplayMode("global")
                  setGlobalCur(c)
                }}
                className={`rounded-lg px-2.5 py-1 text-sm transition-colors ${
                  displayMode === "global" && globalCur === c
                    ? "bg-accent text-accent-fg"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {currencySymbol(c)}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setDisplayMode("individual")}
              className={`rounded-lg px-2.5 py-1 text-sm transition-colors ${
                displayMode === "individual" ? "bg-accent text-accent-fg" : "text-muted hover:text-foreground"
              }`}
            >
              Individual
            </button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          icon={<Wallet size={18} />}
          tone="primary"
          label="Saldo do período"
          valueBRL={saldo}
          currency={curOf("saldo")}
          usdBrl={usdBrl}
          currencies={DISPLAY_CURRENCIES}
          onCurrency={displayMode === "individual" ? (c) => setCardCurrency("saldo", c) : undefined}
        />
        <KpiCard
          icon={<ArrowUpRight size={18} />}
          tone="positive"
          label="Entradas"
          valueBRL={entradas}
          currency={curOf("entradas")}
          usdBrl={usdBrl}
          currencies={DISPLAY_CURRENCIES}
          onCurrency={displayMode === "individual" ? (c) => setCardCurrency("entradas", c) : undefined}
        />
        <KpiCard
          icon={<ArrowDownRight size={18} />}
          tone="negative"
          label="Saídas"
          valueBRL={saidas}
          currency={curOf("saidas")}
          usdBrl={usdBrl}
          currencies={DISPLAY_CURRENCIES}
          onCurrency={displayMode === "individual" ? (c) => setCardCurrency("saidas", c) : undefined}
        />
      </div>

      {/* Contas bancárias (só no pessoal) */}
      {scope === "pessoal" && (
        <Card>
          <CardContent className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Landmark size={16} className="text-muted" />
                <h2 className="font-medium">Minhas contas</h2>
                <Badge>{formatCurrency(banksTotal)}</Badge>
              </div>
              <Button size="sm" variant="ghost" onClick={() => openBank(null)}>
                <Plus size={15} /> Conta
              </Button>
            </div>
            {banks.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted">
                Cadastre suas contas (banco, carteira digital, dinheiro) para acompanhar seus saldos.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {banks.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between rounded-xl border border-[color:var(--color-border)] p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{b.name}</p>
                      <p className="text-xs text-muted">{b.kind}</p>
                      <p className="money mt-1 font-mono text-sm" data-money>
                        {currencySymbol(b.currency)} {b.balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <RowActions onEdit={() => openBank(b)} onDelete={() => deleteBankAccount(b.id)} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Movimentações */}
      <Card>
        <CardContent className="p-0">
          {scoped.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted">
              Nenhuma movimentação no período. Registre uma entrada, saída ou transferência.
            </p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Data</Th>
                  <Th>Descrição</Th>
                  {scope === "projeto" && <Th>Autor</Th>}
                  <Th>Categoria</Th>
                  <Th className="text-right">Valor</Th>
                  <Th className="text-right">Ações</Th>
                </tr>
              </thead>
              <tbody>
                {scoped.map((c) => (
                  <tr key={c.id}>
                    <Td className="whitespace-nowrap text-muted">
                      {new Date(c.occurred_at + "T00:00:00").toLocaleDateString("pt-BR")}
                    </Td>
                    <Td className="font-medium">
                      {c.description ?? "—"}
                      {c.transfer_group && (
                        <span className="ml-2 text-xs text-muted">
                          {c.direction === "saida" ? `→ ${memberName(c.counterparty_id)}` : `← ${memberName(c.counterparty_id)}`}
                        </span>
                      )}
                      {c.to_dashboard && (
                        <Badge className="ml-2" tone={c.dashboard_kind === "faturamento" ? "positive" : "negative"}>
                          {c.dashboard_kind === "faturamento" ? "faturamento" : "gasto"}
                        </Badge>
                      )}
                    </Td>
                    {scope === "projeto" && <Td className="text-muted">{memberName(c.owner_id)}</Td>}
                    <Td>
                      <Badge>{c.category ?? "—"}</Badge>
                    </Td>
                    <Td
                      className={`money text-right font-mono font-medium ${
                        c.direction === "entrada" ? "text-positive" : "text-negative"
                      }`}
                      data-money
                    >
                      {(() => {
                        // No modo global, converte para a moeda escolhida; no individual, mostra a moeda original.
                        const rowCur = displayMode === "global" ? globalCur : c.currency ?? "BRL"
                        const val = convertCurrency(c.amount, c.currency ?? "BRL", rowCur, usdBrl)
                        return `${c.direction === "entrada" ? "+" : "−"}${currencySymbol(rowCur)} ${val.toLocaleString(
                          "pt-BR",
                          { minimumFractionDigits: 2, maximumFractionDigits: 2 },
                        )}`
                      })()}
                    </Td>
                    <Td className="text-right">
                      <RowActions onDelete={() => deleteCashEntry(c.id)} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal entrada/saída */}
      <Modal
        open={entryOpen}
        onClose={() => setEntryOpen(false)}
        title={direction === "entrada" ? "Nova entrada" : "Nova saída"}
      >
        {recent.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 text-xs font-medium text-muted">Repetir lançamento recente</p>
            <div className="flex flex-wrap gap-2">
              {recent.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => applyRecent(r)}
                  className="flex items-center gap-2 rounded-lg border border-[color:var(--color-border)] px-2.5 py-1.5 text-xs transition-colors hover:border-[color:var(--color-border-strong)] hover:bg-surface-2"
                >
                  <span className="max-w-[140px] truncate font-medium">{r.description || "Sem descrição"}</span>
                  <span className={direction === "entrada" ? "text-positive" : "text-negative"}>
                    {currencySymbol(r.currency)} {r.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
        <form
          key={formKey}
          action={submit(createCashEntry, () => setEntryOpen(false))}
          className="flex flex-col gap-4"
        >
          <input type="hidden" name="direction" value={direction} />
          <input type="hidden" name="project_id" value={scope === "projeto" ? projectId : ""} />
          <input type="hidden" name="entry_type" value={entryType} />
          <input type="hidden" name="linked_entry_id" value={entryType === "gasto_anuncio" || entryType === "cobranca_cartao" ? linkedId : ""} />

          {/* Tipo do lançamento — só em saída de projeto (fundos/pix, gasto de anúncio, cobrança no cartão). */}
          {direction === "saida" && scope === "projeto" && (
            <Field
              label="Tipo da saída"
              hint="Fundos/pix é aporte de verba. Gasto com anúncio entra na dashboard. Cobrança no cartão pode ser vinculada ao gasto para calcular o imposto da Meta."
            >
              <Select
                value={entryType}
                onChange={(e) => {
                  setEntryType(e.target.value as CashEntry["entry_type"])
                  setLinkedId("")
                }}
              >
                <option value="comum">Comum</option>
                <option value="aporte_pix">Aporte de fundos (pix)</option>
                <option value="gasto_anuncio">Gasto com anúncio</option>
                <option value="cobranca_cartao">Cobrança no cartão</option>
              </Select>
            </Field>
          )}

          <div className="grid grid-cols-3 gap-3">
            <Field label="Valor">
              <Input name="amount" inputMode="decimal" placeholder="0,00" defaultValue={prefill.amount ?? ""} required />
            </Field>
            <Field label="Moeda">
              <Select name="currency" value={entryCurrency} onChange={(e) => setEntryCurrency(e.target.value)}>
                {currencies.map((c) => (
                  <option key={c} value={c}>{normalizeCurrency(c)}</option>
                ))}
              </Select>
            </Field>
            <Field label="Data">
              <Input name="occurred_at" type="date" defaultValue={today()} />
            </Field>
          </div>
          <Field label="Descrição">
            <Input name="description" placeholder="Ex: Pagamento gestor" defaultValue={prefill.description ?? ""} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoria">
              <Input name="category" placeholder="Ex: pró-labore, ferramentas" defaultValue={prefill.category ?? ""} />
            </Field>
            <Field label="Carteira (opcional)">
              <Select name="bank_account_id" defaultValue="">
                <option value="">Não vincular</option>
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </Select>
            </Field>
          </div>

          {/* Vínculo gasto <-> cobrança + imposto Meta pela diferença */}
          {(entryType === "gasto_anuncio" || entryType === "cobranca_cartao") && (
            <Field
              label={entryType === "gasto_anuncio" ? "Vincular à cobrança no cartão (opcional)" : "Vincular ao gasto com anúncio (opcional)"}
              hint="Ao vincular, o imposto da Meta é calculado pela diferença entre a cobrança no cartão e o gasto com anúncio."
            >
              <Select value={linkedId} onChange={(e) => setLinkedId(e.target.value)}>
                <option value="">Não vincular agora</option>
                {linkTargets.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.occurred_at} · {currencySymbol(c.currency)} {c.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    {c.description ? ` · ${c.description}` : ""}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {linkedTarget && (
            <p className="rounded-lg border border-[color:var(--color-border)] bg-surface-2 px-3 py-2 text-xs text-muted">
              Imposto Meta estimado (diferença):{" "}
              <span className="font-semibold text-foreground">
                {formatCurrency(Math.abs(linkAmountBRL - toBRL(num(prefill.amount ?? "0"), entryCurrency, usdBrl)), "BRL")}
              </span>{" "}
              — refina automaticamente conforme os valores de gasto e cobrança.
            </p>
          )}

          {/* Opt-in para dashboard — gasto de anúncio já entra sozinho. */}
          {entryType === "gasto_anuncio" ? (
            <p className="text-xs text-muted">Gasto com anúncio entra na dashboard automaticamente como gasto.</p>
          ) : (
            <>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="to_dashboard" className="mt-0.5 h-4 w-4 rounded border-[color:var(--color-border)]" />
                <span>
                  Refletir na dashboard
                  <span className="block text-xs text-muted">
                    Marque para este lançamento aparecer nos números da dashboard (como {direction === "saida" ? "gasto ou faturamento" : "faturamento"}). Sem marcar, fica só no caixa.
                  </span>
                </span>
              </label>
              {direction === "saida" && (
                <Field label="Como refletir (se marcado acima)">
                  <Select name="dashboard_kind" defaultValue="gasto">
                    <option value="gasto">Gasto</option>
                    <option value="faturamento">Faturamento</option>
                  </Select>
                </Field>
              )}
            </>
          )}
          {error && <p className="text-sm text-negative">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setEntryOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={pending}>{pending ? "Salvando…" : "Salvar"}</Button>
          </div>
        </form>
      </Modal>

      {/* Modal transferência */}
      <Modal open={transferOpen} onClose={() => setTransferOpen(false)} title="Transferir saldo">
        <form action={submit(transferCash, () => setTransferOpen(false))} className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            Escolha de onde o dinheiro sai e para onde vai. Carteira é o seu caixa pessoal; caixa é o de um projeto.
          </p>

          {/* Campos derivados que o backend espera */}
          <input type="hidden" name="from_project_id" value={fromKind === "projeto" ? fromProj : ""} />
          <input type="hidden" name="to_project_id" value={toKind === "projeto" ? toProj : ""} />
          <input type="hidden" name="to_user_id" value={toKind === "socio" ? toSocio : ""} />

          {/* ORIGEM */}
          <div className="rounded-xl border border-[color:var(--color-border)] p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
              <ArrowUpRight size={14} className="text-negative" /> De onde sai
            </div>
            <div className="mb-2 inline-flex rounded-lg border border-[color:var(--color-border)] p-1">
              <TransferTab active={fromKind === "pessoal"} onClick={() => setFromKind("pessoal")}>
                Minha carteira
              </TransferTab>
              <TransferTab active={fromKind === "projeto"} onClick={() => setFromKind("projeto")}>
                Caixa de projeto
              </TransferTab>
            </div>
            {fromKind === "projeto" ? (
              <Select value={fromProj} onChange={(e) => setFromProj(e.target.value)}>
                <option value="">Selecione o projeto</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            ) : (
              <Field label="Conta/carteira (opcional)">
                <Select name="bank_account_id" defaultValue="">
                  <option value="">Não vincular a uma conta</option>
                  {banks.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </Select>
              </Field>
            )}
          </div>

          {/* DESTINO */}
          <div className="rounded-xl border border-[color:var(--color-border)] p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
              <ArrowDownRight size={14} className="text-positive" /> Para onde vai
            </div>
            <div className="mb-2 inline-flex rounded-lg border border-[color:var(--color-border)] p-1">
              <TransferTab active={toKind === "pessoal"} onClick={() => setToKind("pessoal")}>
                Minha carteira
              </TransferTab>
              <TransferTab active={toKind === "projeto"} onClick={() => setToKind("projeto")}>
                Caixa de projeto
              </TransferTab>
              <TransferTab active={toKind === "socio"} onClick={() => setToKind("socio")}>
                Sócio
              </TransferTab>
            </div>
            {toKind === "projeto" && (
              <Select value={toProj} onChange={(e) => setToProj(e.target.value)}>
                <option value="">Selecione o projeto</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            )}
            {toKind === "socio" && (
              <Select value={toSocio} onChange={(e) => setToSocio(e.target.value)}>
                <option value="">Selecione o sócio</option>
                {profiles.filter((p) => p.id !== meId).map((p) => (
                  <option key={p.id} value={p.id}>{p.full_name || p.username}</option>
                ))}
              </Select>
            )}
            {toKind === "pessoal" && (
              <p className="text-xs text-muted">Entra na sua carteira pessoal.</p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Valor">
              <Input name="amount" inputMode="decimal" placeholder="0,00" required />
            </Field>
            <Field label="Moeda">
              <Select name="currency" defaultValue={currencies[0] ?? "brl"}>
                {currencies.map((c) => (
                  <option key={c} value={c}>{normalizeCurrency(c)}</option>
                ))}
              </Select>
            </Field>
            <Field label="Data">
              <Input name="occurred_at" type="date" defaultValue={today()} />
            </Field>
          </div>
          <Field label="Descrição">
            <Input name="description" placeholder="Ex: Aporte no projeto" />
          </Field>
          {error && <p className="text-sm text-negative">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setTransferOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={pending}>{pending ? "Transferindo…" : "Transferir"}</Button>
          </div>
        </form>
      </Modal>

      {/* Modal conta bancária */}
      <Modal open={bankOpen} onClose={() => setBankOpen(false)} title={editingBank ? "Editar conta" : "Nova conta"}>
        <form action={submit(saveBankAccount, () => setBankOpen(false))} className="flex flex-col gap-4">
          {editingBank && <input type="hidden" name="id" value={editingBank.id} />}
          <Field label="Nome">
            <Input name="name" defaultValue={editingBank?.name ?? ""} placeholder="Ex: Nubank, Carteira" required />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Tipo">
              <Select name="kind" defaultValue={editingBank?.kind ?? "banco"}>
                <option value="banco">Banco</option>
                <option value="carteira">Carteira digital</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="investimento">Investimento</option>
              </Select>
            </Field>
            <Field label="Saldo">
              <Input name="balance" inputMode="decimal" defaultValue={editingBank?.balance ?? ""} placeholder="0,00" />
            </Field>
            <Field label="Moeda">
              <Select name="currency" defaultValue={editingBank?.currency ?? currencies[0] ?? "brl"}>
                {currencies.map((c) => (
                  <option key={c} value={c}>{normalizeCurrency(c)}</option>
                ))}
              </Select>
            </Field>
          </div>
          {error && <p className="text-sm text-negative">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setBankOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={pending}>{pending ? "Salvando…" : "Salvar"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

function ScopeTab({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
        active ? "bg-accent text-accent-fg" : "text-muted hover:text-foreground"
      }`}
    >
      {icon}
      {children}
    </button>
  )
}

function TransferTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
        active ? "bg-accent text-accent-fg" : "text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  )
}

function KpiCard({
  icon,
  tone,
  label,
  valueBRL,
  currency,
  usdBrl,
  currencies,
  onCurrency,
}: {
  icon: React.ReactNode
  tone: "primary" | "positive" | "negative"
  label: string
  /** Valor já somado em BRL; convertido para a moeda de exibição na renderização. */
  valueBRL: number
  currency: string
  usdBrl: number
  currencies: readonly string[]
  /** Quando definido, mostra o seletor de moeda individual do card. */
  onCurrency?: (c: string) => void
}) {
  const toneClass =
    tone === "positive"
      ? "bg-positive/10 text-positive"
      : tone === "negative"
        ? "bg-negative/10 text-negative"
        : "bg-primary/10 text-primary"
  const shown = fromBRL(valueBRL, currency, usdBrl)
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-5">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${toneClass}`}>{icon}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted">{label}</p>
            {onCurrency && (
              <div className="inline-flex rounded-lg border border-[color:var(--color-border)] p-0.5">
                {currencies.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onCurrency(c)}
                    className={`rounded px-1.5 py-0.5 text-[11px] transition-colors ${
                      currency === c ? "bg-accent text-accent-fg" : "text-muted hover:text-foreground"
                    }`}
                  >
                    {currencySymbol(c)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="money font-mono text-xl font-semibold" data-money>
            {formatCurrency(shown, currency)}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
