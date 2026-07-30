"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { BankAccount, CashEntry, Profile, Project } from "@/lib/types"
import { formatCurrency } from "@/lib/utils"
import { toBRL, normalizeCurrency, currencySymbol } from "@/lib/currency"
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
}: {
  entries: CashEntry[]
  projects: Project[]
  banks: BankAccount[]
  profiles: Profile[]
  meId: string
  usdBrl: number
  currencies: string[]
}) {
  const [scope, setScope] = useState<Scope>("pessoal")
  const [projectId, setProjectId] = useState<string>(projects[0]?.id ?? "")
  const [period, setPeriod] = useState<PeriodKey>("30d")
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")
  const [entryOpen, setEntryOpen] = useState(false)
  const [direction, setDirection] = useState<"entrada" | "saida">("entrada")
  const [transferOpen, setTransferOpen] = useState(false)
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
    setEntryOpen(true)
  }
  function openBank(b: BankAccount | null) {
    setEditingBank(b)
    setError(undefined)
    setBankOpen(true)
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
          <h1 className="font-display text-2xl font-semibold">Caixa</h1>
          <p className="text-sm text-muted">
            {scope === "pessoal"
              ? "Seu caixa e contas pessoais. Privado, só você vê."
              : "Caixa do projeto, compartilhado com os membros."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" onClick={() => setTransferOpen(true)}>
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
        <div className="inline-flex rounded-xl border border-[color:var(--color-border)] p-1">
          <ScopeTab active={scope === "pessoal"} onClick={() => setScope("pessoal")} icon={<Wallet size={15} />}>
            Pessoal
          </ScopeTab>
          <ScopeTab active={scope === "projeto"} onClick={() => setScope("projeto")} icon={<Building2 size={15} />}>
            Projeto
          </ScopeTab>
        </div>
        {scope === "projeto" && (
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
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard icon={<Wallet size={18} />} tone="primary" label="Saldo do período" value={saldo} />
        <KpiCard icon={<ArrowUpRight size={18} />} tone="positive" label="Entradas" value={entradas} />
        <KpiCard icon={<ArrowDownRight size={18} />} tone="negative" label="Saídas" value={saidas} />
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
                      <p className="mt-1 font-mono text-sm">
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
                      className={`text-right font-mono font-medium ${
                        c.direction === "entrada" ? "text-positive" : "text-negative"
                      }`}
                    >
                      {c.direction === "entrada" ? "+" : "−"}
                      {currencySymbol(c.currency ?? "BRL")} {c.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
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
        <form action={submit(createCashEntry, () => setEntryOpen(false))} className="flex flex-col gap-4">
          <input type="hidden" name="direction" value={direction} />
          <input type="hidden" name="project_id" value={scope === "projeto" ? projectId : ""} />
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
            <Input name="description" placeholder="Ex: Pagamento gestor" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoria">
              <Input name="category" placeholder="Ex: pró-labore, ferramentas" />
            </Field>
            {scope === "pessoal" && (
              <Field label="Conta (opcional)">
                <Select name="bank_account_id" defaultValue="">
                  <option value="">Não vincular</option>
                  {banks.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </Select>
              </Field>
            )}
          </div>
          {/* Opt-in para dashboard */}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="to_dashboard" className="h-4 w-4 rounded border-[color:var(--color-border)]" />
            Refletir na dashboard como {direction === "saida" ? "gasto/faturamento" : "faturamento"}
          </label>
          {direction === "saida" && (
            <Field label="Como refletir (se marcado acima)">
              <Select name="dashboard_kind" defaultValue="gasto">
                <option value="gasto">Gasto</option>
                <option value="faturamento">Faturamento</option>
              </Select>
            </Field>
          )}
          {error && <p className="text-sm text-negative">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setEntryOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={pending}>{pending ? "Salvando…" : "Salvar"}</Button>
          </div>
        </form>
      </Modal>

      {/* Modal transferência */}
      <Modal open={transferOpen} onClose={() => setTransferOpen(false)} title="Transferir entre caixas">
        <form action={submit(transferCash, () => setTransferOpen(false))} className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            Move saldo entre seu caixa pessoal, o caixa de um projeto ou outro sócio. Sai de uma origem e entra no destino.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Origem (projeto)">
              <Select name="from_project_id" defaultValue={scope === "projeto" ? projectId : ""}>
                <option value="">Meu caixa pessoal</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Destino (projeto)">
              <Select name="to_project_id" defaultValue="">
                <option value="">Caixa pessoal</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sócio destino (opcional)">
              <Select name="to_user_id" defaultValue="">
                <option value="">Eu mesmo</option>
                {profiles.filter((p) => p.id !== meId).map((p) => (
                  <option key={p.id} value={p.id}>{p.username}</option>
                ))}
              </Select>
            </Field>
            <Field label="Conta pessoal (opcional)">
              <Select name="bank_account_id" defaultValue="">
                <option value="">Não vincular</option>
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </Select>
            </Field>
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

function KpiCard({
  icon,
  tone,
  label,
  value,
}: {
  icon: React.ReactNode
  tone: "primary" | "positive" | "negative"
  label: string
  value: number
}) {
  const toneClass =
    tone === "positive"
      ? "bg-positive/10 text-positive"
      : tone === "negative"
        ? "bg-negative/10 text-negative"
        : "bg-primary/10 text-primary"
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-5">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${toneClass}`}>{icon}</div>
        <div>
          <p className="text-xs text-muted">{label}</p>
          <p className="font-mono text-xl font-semibold">{formatCurrency(value)}</p>
        </div>
      </CardContent>
    </Card>
  )
}
