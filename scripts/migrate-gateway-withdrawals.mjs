// Migração ADITIVA e segura. Nenhum DROP. Idempotente (IF NOT EXISTS).
// Adiciona taxa de saque ao gateway e cria a tabela de saques.
import pg from "pg"

const { Client } = pg
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const SQL = `
-- Taxa de saque por gateway (percentual sobre o valor bruto sacado).
alter table public.payment_gateways
  add column if not exists withdraw_fee_pct numeric not null default 0;

-- Saques do saldo de um gateway para um caixa de destino.
create table if not exists public.gateway_withdrawals (
  id uuid primary key default gen_random_uuid(),
  gateway_id uuid not null references public.payment_gateways(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  -- Destino do saque: conta bancária/carteira (bank_accounts) OU projeto (cash_entries).
  destination_kind text not null default 'conta',       -- 'conta' | 'projeto' | 'socio'
  bank_account_id uuid references public.bank_accounts(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  to_user_id uuid references public.profiles(id) on delete set null,
  gross_amount numeric not null default 0,              -- valor bruto sacado
  fee_amount numeric not null default 0,                -- taxa aplicada
  net_amount numeric not null default 0,                -- líquido creditado no destino
  currency text not null default 'brl',
  note text,
  occurred_at date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists gateway_withdrawals_gateway_idx on public.gateway_withdrawals(gateway_id);
create index if not exists gateway_withdrawals_owner_idx on public.gateway_withdrawals(owner_id);

-- RLS: dono acessa seus próprios saques.
alter table public.gateway_withdrawals enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gateway_withdrawals' and policyname = 'own_withdrawals_select'
  ) then
    create policy own_withdrawals_select on public.gateway_withdrawals
      for select using (owner_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gateway_withdrawals' and policyname = 'own_withdrawals_write'
  ) then
    create policy own_withdrawals_write on public.gateway_withdrawals
      for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
  end if;
end $$;
`

try {
  await client.connect()
  await client.query(SQL)
  console.log("[migrate] gateway withdrawals: OK")
} catch (err) {
  console.error("[migrate] FAILED:", err.message)
  process.exitCode = 1
} finally {
  await client.end()
}
