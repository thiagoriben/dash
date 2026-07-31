-- =========================================================
-- DASH — schema completo (gestão de tráfego pago + financeira)
-- Já aplicado no Supabase via migrations. Mantido aqui para
-- referência / recriação manual do banco.
--
-- Migrations aplicadas:
--   1. dash_core_tables          (tabelas + índices)
--   2. dash_rls_and_triggers     (funções, trigger, RLS, policies)
--   3. dash_revoke_definer_execute / dash_grant_definer_execute
--      (ajuste de EXECUTE das funções security definer)
-- =========================================================

-- ---------- TABELAS ----------

-- PERFIS
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  full_name text,
  phone text,
  role text not null default 'member',   -- 'admin' | 'member'
  approved boolean not null default false, -- admin precisa aprovar novos cadastros
  is_public boolean not null default false, -- perfil visível para outros usuários
  prefs jsonb not null default '{}'::jsonb, -- cores/preferências (accent_color, badge_colors, etc.)
  created_at timestamptz not null default now()
);
-- garante a coluna em bancos já existentes
alter table public.profiles add column if not exists is_public boolean not null default false;

-- PROJETOS
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  offer_type text,
  region text default 'br',
  currency text default 'BRL',
  status text default 'ativo',
  visibility text default 'privado',      -- 'privado' | 'publico' | 'restrito'
  owner_id uuid references public.profiles(id) on delete set null,
  tax_pct numeric not null default 0,     -- imposto % aplicado nas vendas
  card_color text,                        -- cor de destaque do card (hex, opcional)
  created_at timestamptz not null default now()
);
alter table public.projects add column if not exists card_color text;

-- MEMBROS DO PROJETO (colaboradores)
create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  role text default 'editor',
  unique (project_id, user_id)
);

-- GATEWAYS DE PAGAMENTO (globais do usuário)
create table if not exists public.payment_gateways (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  fee_pct numeric not null default 0,
  fee_fixed numeric not null default 0,
  term_days_pix int not null default 0,
  term_days_card int not null default 0,
  created_at timestamptz not null default now(),
  unique (owner_id, name)
);

-- CONTAS BANCÁRIAS / CARTEIRAS (gestor financeiro pessoal)
create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  kind text default 'banco',
  balance numeric not null default 0,
  currency text default 'BRL',
  created_at timestamptz not null default now()
);

-- CONTAS DE ANÚNCIO (BM + conta)
create table if not exists public.ad_accounts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  bm_name text,
  account_name text not null,
  created_at timestamptz not null default now()
);

-- PRODUTOS
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  kind text not null default 'front',
  price numeric not null default 0,
  product_cost numeric not null default 0,
  gateway_id uuid references public.payment_gateways(id) on delete set null,
  in_funnel boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);

-- CRIATIVOS
create table if not exists public.creatives (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  status text default 'testando',
  activated_at date,
  spend numeric default 0,
  sales int default 0,
  revenue numeric default 0,
  notes text,
  created_at timestamptz not null default now()
);

-- GASTOS
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  type text not null,
  category text,
  amount numeric not null,
  currency text default 'BRL',
  description text,
  spent_at date not null default current_date,
  recurring boolean default false,
  ad_account_id uuid references public.ad_accounts(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- MÉTRICAS DIÁRIAS
create table if not exists public.daily_metrics (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  date date not null default current_date,
  spend numeric default 0,
  impressions int default 0,
  clicks int default 0,
  page_views int default 0,
  checkouts_initiated int default 0,
  sales int default 0,
  revenue numeric default 0,
  ad_account_id uuid references public.ad_accounts(id) on delete set null,
  unique (project_id, date)
);

-- COBRANÇAS NO CARTÃO (imposto = cobrança - gasto)
create table if not exists public.card_charges (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  ad_account_id uuid references public.ad_accounts(id) on delete set null,
  amount numeric not null,
  charged_at date not null default current_date,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- VENDAS
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  creative_id uuid references public.creatives(id) on delete set null,
  gateway_id uuid references public.payment_gateways(id) on delete set null,
  gross_amount numeric not null default 0,
  apply_gateway_fee boolean not null default true,
  fee_amount numeric not null default 0,
  tax_amount numeric not null default 0,
  net_amount numeric not null default 0,
  payment_method text not null default 'pix',
  source text,
  sold_at date not null default current_date,
  has_term boolean not null default false,
  receivable_date date,
  received boolean not null default false,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- PRODUTOS DO FUNIL (legado)
create table if not exists public.funnel_products (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  name text not null,
  kind text default 'front',
  price numeric not null,
  product_cost numeric default 0,
  created_at timestamptz not null default now()
);

-- REPARTIÇÃO DE LUCRO
create table if not exists public.profit_splits (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  percentage numeric not null,
  unique (project_id, user_id)
);

-- CAIXA (entradas/saídas/transferências pessoais)
create table if not exists public.cash_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  direction text not null,                 -- 'in' | 'out'
  amount numeric not null,
  currency text default 'BRL',
  category text,
  description text,
  occurred_at date not null default current_date,
  sale_id uuid references public.sales(id) on delete set null,
  bank_account_id uuid references public.bank_accounts(id) on delete set null,
  transfer_group uuid,                     -- agrupa os 2 lados de uma transferência
  counterparty_id uuid references public.profiles(id) on delete set null,
  to_dashboard boolean not null default false,
  dashboard_kind text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- LOG DE ATIVIDADE
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete set null,
  owner_id uuid references public.profiles(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_name text,
  action text not null,
  entity text,
  entity_id uuid,
  summary text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------- ÍNDICES ----------
create index if not exists idx_projects_owner on public.projects(owner_id);
create index if not exists idx_project_members_user on public.project_members(user_id);
create index if not exists idx_project_members_project on public.project_members(project_id);
create index if not exists idx_expenses_project on public.expenses(project_id);
create index if not exists idx_daily_metrics_project on public.daily_metrics(project_id);
create index if not exists idx_sales_project on public.sales(project_id);
create index if not exists idx_card_charges_project on public.card_charges(project_id);
create index if not exists idx_cash_entries_owner on public.cash_entries(owner_id);
create index if not exists idx_cash_entries_project on public.cash_entries(project_id);
create index if not exists idx_activity_project on public.activity_log(project_id);

-- ---------- FUNÇÕES HELPER (security definer, sem recursão de RLS) ----------

create or replace function public.is_admin(uid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = uid and p.role = 'admin');
$$;

create or replace function public.has_project_access(pid uuid, uid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.projects pr where pr.id = pid and pr.owner_id = uid)
      or exists (select 1 from public.project_members pm where pm.project_id = pid and pm.user_id = uid);
$$;

create or replace function public.is_project_owner(pid uuid, uid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.projects pr where pr.id = pid and pr.owner_id = uid);
$$;

-- Só authenticated pode executar (necessário para as policies). anon fica de fora.
revoke all on function public.is_admin(uuid) from anon, public;
revoke all on function public.has_project_access(uuid, uuid) from anon, public;
revoke all on function public.is_project_owner(uuid, uuid) from anon, public;
grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.has_project_access(uuid, uuid) to authenticated;
grant execute on function public.is_project_owner(uuid, uuid) to authenticated;

-- ---------- TRIGGER: cria profile no signup ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  is_first boolean;
begin
  -- O primeiro usuário do sistema vira admin aprovado automaticamente.
  select not exists (select 1 from public.profiles) into is_first;

  insert into public.profiles (id, username, full_name, phone, role, approved)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'full_name', null),
    coalesce(new.raw_user_meta_data ->> 'phone', null),
    case when is_first then 'admin'
         else coalesce(new.raw_user_meta_data ->> 'role', 'member') end,
    case when is_first then true
         else coalesce((new.raw_user_meta_data ->> 'approved')::boolean, false) end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from anon, authenticated, public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- HABILITAR RLS ----------
alter table public.profiles          enable row level security;
alter table public.projects          enable row level security;
alter table public.project_members   enable row level security;
alter table public.payment_gateways  enable row level security;
alter table public.bank_accounts     enable row level security;
alter table public.ad_accounts       enable row level security;
alter table public.products          enable row level security;
alter table public.creatives         enable row level security;
alter table public.expenses          enable row level security;
alter table public.daily_metrics     enable row level security;
alter table public.card_charges      enable row level security;
alter table public.sales             enable row level security;
alter table public.funnel_products   enable row level security;
alter table public.profit_splits     enable row level security;
alter table public.cash_entries      enable row level security;
alter table public.activity_log      enable row level security;

-- ---------- POLICIES ----------
-- Remove todas as policies existentes no schema public para permitir
-- rodar este arquivo novamente sem erro de "policy already exists".
do $$
declare r record;
begin
  for r in (select policyname, tablename from pg_policies where schemaname = 'public') loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- PROFILES
create policy profiles_select on public.profiles for select
  to authenticated using (true);
create policy profiles_update_own on public.profiles for update
  to authenticated using (auth.uid() = id or public.is_admin(auth.uid()))
  with check (auth.uid() = id or public.is_admin(auth.uid()));
create policy profiles_insert_self on public.profiles for insert
  to authenticated with check (auth.uid() = id or public.is_admin(auth.uid()));

-- ---------- POLICIES: PROJECTS ----------
create policy projects_select on public.projects for select
  to authenticated using (
    owner_id = auth.uid()
    or public.has_project_access(id, auth.uid())
    or visibility = 'publico'
    or public.is_admin(auth.uid())
  );
create policy projects_insert on public.projects for insert
  to authenticated with check (owner_id = auth.uid());
create policy projects_update on public.projects for update
  to authenticated using (owner_id = auth.uid() or public.is_admin(auth.uid()))
  with check (owner_id = auth.uid() or public.is_admin(auth.uid()));
create policy projects_delete on public.projects for delete
  to authenticated using (owner_id = auth.uid() or public.is_admin(auth.uid()));

-- ---------- POLICIES: PROJECT_MEMBERS ----------
create policy project_members_select on public.project_members for select
  to authenticated using (
    user_id = auth.uid() or public.is_project_owner(project_id, auth.uid()) or public.is_admin(auth.uid())
  );
create policy project_members_insert on public.project_members for insert
  to authenticated with check (public.is_project_owner(project_id, auth.uid()) or public.is_admin(auth.uid()));
create policy project_members_delete on public.project_members for delete
  to authenticated using (public.is_project_owner(project_id, auth.uid()) or public.is_admin(auth.uid()));

-- ---------- POLICIES: tabelas pessoais (owner_id) ----------
create policy payment_gateways_all on public.payment_gateways for all to authenticated
  using (owner_id = auth.uid() or public.is_admin(auth.uid()))
  with check (owner_id = auth.uid() or public.is_admin(auth.uid()));
create policy bank_accounts_all on public.bank_accounts for all to authenticated
  using (owner_id = auth.uid() or public.is_admin(auth.uid()))
  with check (owner_id = auth.uid() or public.is_admin(auth.uid()));

-- cash_entries: dono OU contraparte pode ler; escreve só dono
create policy cash_entries_select on public.cash_entries for select
  to authenticated using (owner_id = auth.uid() or counterparty_id = auth.uid() or public.is_admin(auth.uid()));
create policy cash_entries_insert on public.cash_entries for insert
  to authenticated with check (owner_id = auth.uid() or public.is_admin(auth.uid()));
create policy cash_entries_update on public.cash_entries for update
  to authenticated using (owner_id = auth.uid() or public.is_admin(auth.uid()))
  with check (owner_id = auth.uid() or public.is_admin(auth.uid()));
create policy cash_entries_delete on public.cash_entries for delete
  to authenticated using (owner_id = auth.uid() or public.is_admin(auth.uid()));

-- ---------- POLICIES: tabelas por projeto (has_project_access) ----------
-- ad_accounts, products, creatives, expenses, daily_metrics,
-- card_charges, sales, funnel_products, profit_splits
-- (uma policy FOR ALL por tabela, mesmo predicado)
create policy ad_accounts_all on public.ad_accounts for all to authenticated
  using (public.has_project_access(project_id, auth.uid()) or public.is_admin(auth.uid()))
  with check (public.has_project_access(project_id, auth.uid()) or public.is_admin(auth.uid()));
create policy products_all on public.products for all to authenticated
  using (public.has_project_access(project_id, auth.uid()) or public.is_admin(auth.uid()))
  with check (public.has_project_access(project_id, auth.uid()) or public.is_admin(auth.uid()));
create policy creatives_all on public.creatives for all to authenticated
  using (public.has_project_access(project_id, auth.uid()) or public.is_admin(auth.uid()))
  with check (public.has_project_access(project_id, auth.uid()) or public.is_admin(auth.uid()));
create policy expenses_all on public.expenses for all to authenticated
  using (public.has_project_access(project_id, auth.uid()) or public.is_admin(auth.uid()))
  with check (public.has_project_access(project_id, auth.uid()) or public.is_admin(auth.uid()));
create policy daily_metrics_all on public.daily_metrics for all to authenticated
  using (public.has_project_access(project_id, auth.uid()) or public.is_admin(auth.uid()))
  with check (public.has_project_access(project_id, auth.uid()) or public.is_admin(auth.uid()));
create policy card_charges_all on public.card_charges for all to authenticated
  using (public.has_project_access(project_id, auth.uid()) or public.is_admin(auth.uid()))
  with check (public.has_project_access(project_id, auth.uid()) or public.is_admin(auth.uid()));
create policy sales_all on public.sales for all to authenticated
  using (public.has_project_access(project_id, auth.uid()) or public.is_admin(auth.uid()))
  with check (public.has_project_access(project_id, auth.uid()) or public.is_admin(auth.uid()));
create policy funnel_products_all on public.funnel_products for all to authenticated
  using (public.has_project_access(project_id, auth.uid()) or public.is_admin(auth.uid()))
  with check (public.has_project_access(project_id, auth.uid()) or public.is_admin(auth.uid()));
create policy profit_splits_all on public.profit_splits for all to authenticated
  using (public.has_project_access(project_id, auth.uid()) or public.is_admin(auth.uid()))
  with check (public.has_project_access(project_id, auth.uid()) or public.is_admin(auth.uid()));

-- ---------- POLICIES: ACTIVITY_LOG ----------
create policy activity_select on public.activity_log for select
  to authenticated using (
    owner_id = auth.uid()
    or actor_id = auth.uid()
    or (project_id is not null and public.has_project_access(project_id, auth.uid()))
    or public.is_admin(auth.uid())
  );
create policy activity_insert on public.activity_log for insert
  to authenticated with check (actor_id = auth.uid() or public.is_admin(auth.uid()));

-- =========================================================
-- SOCIAL: amizades, pedidos de entrada em projeto, chat
-- =========================================================

-- AMIZADES (par ordenado requester/addressee, status pending/accepted)
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending',   -- 'pending' | 'accepted'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

-- PEDIDOS DE ENTRADA EM PROJETO (usuário digita ID do projeto)
create table if not exists public.project_join_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending',   -- 'pending' | 'accepted' | 'rejected'
  message text,
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);

-- CHAT DO PROJETO
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_friendships_requester on public.friendships(requester_id);
create index if not exists idx_friendships_addressee on public.friendships(addressee_id);
create index if not exists idx_join_requests_project on public.project_join_requests(project_id);
create index if not exists idx_join_requests_user on public.project_join_requests(user_id);
create index if not exists idx_chat_project on public.chat_messages(project_id);

alter table public.friendships           enable row level security;
alter table public.project_join_requests enable row level security;
alter table public.chat_messages         enable row level security;

-- FRIENDSHIPS: qualquer lado lê; requester cria; qualquer lado atualiza/deleta
create policy friendships_select on public.friendships for select
  to authenticated using (requester_id = auth.uid() or addressee_id = auth.uid() or public.is_admin(auth.uid()));
create policy friendships_insert on public.friendships for insert
  to authenticated with check (requester_id = auth.uid());
create policy friendships_update on public.friendships for update
  to authenticated using (requester_id = auth.uid() or addressee_id = auth.uid())
  with check (requester_id = auth.uid() or addressee_id = auth.uid());
create policy friendships_delete on public.friendships for delete
  to authenticated using (requester_id = auth.uid() or addressee_id = auth.uid() or public.is_admin(auth.uid()));

-- JOIN REQUESTS: o próprio user ou o dono do projeto leem; user cria; dono resolve
create policy join_requests_select on public.project_join_requests for select
  to authenticated using (
    user_id = auth.uid() or public.is_project_owner(project_id, auth.uid()) or public.is_admin(auth.uid())
  );
create policy join_requests_insert on public.project_join_requests for insert
  to authenticated with check (user_id = auth.uid());
create policy join_requests_update on public.project_join_requests for update
  to authenticated using (public.is_project_owner(project_id, auth.uid()) or public.is_admin(auth.uid()))
  with check (public.is_project_owner(project_id, auth.uid()) or public.is_admin(auth.uid()));
create policy join_requests_delete on public.project_join_requests for delete
  to authenticated using (user_id = auth.uid() or public.is_project_owner(project_id, auth.uid()) or public.is_admin(auth.uid()));

-- CHAT: quem tem acesso ao projeto lê e escreve as próprias mensagens
create policy chat_select on public.chat_messages for select
  to authenticated using (public.has_project_access(project_id, auth.uid()) or public.is_admin(auth.uid()));
create policy chat_insert on public.chat_messages for insert
  to authenticated with check (
    sender_id = auth.uid()
    and (public.has_project_access(project_id, auth.uid()) or public.is_admin(auth.uid()))
  );
create policy chat_delete on public.chat_messages for delete
  to authenticated using (sender_id = auth.uid() or public.is_project_owner(project_id, auth.uid()) or public.is_admin(auth.uid()));

-- REALTIME: publica chat_messages
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end $$;

-- =========================================================
-- PRODUTIVIDADE: métricas custom, atalhos, notas, to-do, DM
-- =========================================================

-- MÉTRICAS CUSTOMIZADAS (dashboard pessoal quando project_id null; senão do projeto)
create table if not exists public.custom_metrics (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  name text not null,
  kind text not null default 'quantidade',   -- 'quantidade' | 'valor' | 'percentual'
  value numeric not null default 0,
  icon text,
  position int not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

-- CATEGORIAS DE ATALHOS/NOTAS (global do usuário quando project_id null)
create table if not exists public.shortcut_categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  name text not null,
  color text,
  position int not null default 0,
  created_at timestamptz not null default now()
);

-- ATALHOS (links, ids, imagens, vídeos, textos salvos)
create table if not exists public.shortcuts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  category_id uuid references public.shortcut_categories(id) on delete set null,
  title text not null,
  url text,
  body text,
  kind text not null default 'link',        -- 'link' | 'imagem' | 'video' | 'nota' | 'id'
  position int not null default 0,
  created_at timestamptz not null default now()
);

-- BLOCO DE NOTAS
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  category_id uuid references public.shortcut_categories(id) on delete set null,
  title text not null,
  body text,
  visibility text not null default 'privado', -- 'privado' | 'compartilhado'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- TO-DO (pessoal quando project_id null; assignee só faz sentido em projeto)
create table if not exists public.todo_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  assignee_id uuid references public.profiles(id) on delete set null,
  category text,
  title text not null,
  done boolean not null default false,
  due_kind text not null default 'sem_prazo', -- 'hoje' | 'amanha' | 'sem_prazo'
  position int not null default 0,
  created_at timestamptz not null default now()
);

-- MENSAGENS DIRETAS (chat usuário a usuário)
create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- GATEWAY: taxa de saque + saques (saldo = vendas líquidas − saques)
alter table public.payment_gateways add column if not exists withdraw_fee_pct numeric not null default 0;

create table if not exists public.gateway_withdrawals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  gateway_id uuid not null references public.payment_gateways(id) on delete cascade,
  gross_amount numeric not null default 0,
  fee_amount numeric not null default 0,
  net_amount numeric not null default 0,
  currency text not null default 'BRL',
  dest_kind text not null default 'carteira',           -- 'carteira' | 'projeto'
  dest_account_id uuid references public.bank_accounts(id) on delete set null,
  dest_project_id uuid references public.projects(id) on delete set null,
  note text,
  withdrawn_at date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists idx_gw_withdrawals_owner on public.gateway_withdrawals(owner_id);
create index if not exists idx_gw_withdrawals_gateway on public.gateway_withdrawals(gateway_id);

alter table public.gateway_withdrawals enable row level security;

create index if not exists idx_custom_metrics_owner on public.custom_metrics(owner_id);
create index if not exists idx_custom_metrics_project on public.custom_metrics(project_id);
create index if not exists idx_shortcut_categories_owner on public.shortcut_categories(owner_id);
create index if not exists idx_shortcuts_owner on public.shortcuts(owner_id);
create index if not exists idx_shortcuts_project on public.shortcuts(project_id);
create index if not exists idx_notes_owner on public.notes(owner_id);
create index if not exists idx_todo_owner on public.todo_items(owner_id);
create index if not exists idx_todo_project on public.todo_items(project_id);
create index if not exists idx_dm_sender on public.direct_messages(sender_id);
create index if not exists idx_dm_recipient on public.direct_messages(recipient_id);

alter table public.custom_metrics     enable row level security;
alter table public.shortcut_categories enable row level security;
alter table public.shortcuts          enable row level security;
alter table public.notes              enable row level security;
alter table public.todo_items         enable row level security;
alter table public.direct_messages    enable row level security;

-- Predicado comum: dono OU (é de projeto E tenho acesso) OU admin
-- custom_metrics
create policy custom_metrics_all on public.custom_metrics for all to authenticated
  using (owner_id = auth.uid() or (project_id is not null and public.has_project_access(project_id, auth.uid())) or public.is_admin(auth.uid()))
  with check (owner_id = auth.uid() or (project_id is not null and public.has_project_access(project_id, auth.uid())) or public.is_admin(auth.uid()));
-- shortcut_categories
create policy shortcut_categories_all on public.shortcut_categories for all to authenticated
  using (owner_id = auth.uid() or (project_id is not null and public.has_project_access(project_id, auth.uid())) or public.is_admin(auth.uid()))
  with check (owner_id = auth.uid() or (project_id is not null and public.has_project_access(project_id, auth.uid())) or public.is_admin(auth.uid()));
-- shortcuts
create policy shortcuts_all on public.shortcuts for all to authenticated
  using (owner_id = auth.uid() or (project_id is not null and public.has_project_access(project_id, auth.uid())) or public.is_admin(auth.uid()))
  with check (owner_id = auth.uid() or (project_id is not null and public.has_project_access(project_id, auth.uid())) or public.is_admin(auth.uid()));
-- notes
create policy notes_all on public.notes for all to authenticated
  using (owner_id = auth.uid() or (project_id is not null and public.has_project_access(project_id, auth.uid())) or public.is_admin(auth.uid()))
  with check (owner_id = auth.uid() or (project_id is not null and public.has_project_access(project_id, auth.uid())) or public.is_admin(auth.uid()));
-- todo_items (dono, responsável, acesso ao projeto)
create policy todo_items_all on public.todo_items for all to authenticated
  using (owner_id = auth.uid() or assignee_id = auth.uid() or (project_id is not null and public.has_project_access(project_id, auth.uid())) or public.is_admin(auth.uid()))
  with check (owner_id = auth.uid() or (project_id is not null and public.has_project_access(project_id, auth.uid())) or public.is_admin(auth.uid()));
-- gateway_withdrawals (apenas dono ou admin)
alter table public.gateway_withdrawals enable row level security;
create policy gateway_withdrawals_all on public.gateway_withdrawals for all to authenticated
  using (owner_id = auth.uid() or public.is_admin(auth.uid()))
  with check (owner_id = auth.uid() or public.is_admin(auth.uid()));
-- direct_messages (remetente ou destinatário)
create policy dm_select on public.direct_messages for select
  to authenticated using (sender_id = auth.uid() or recipient_id = auth.uid() or public.is_admin(auth.uid()));
create policy dm_insert on public.direct_messages for insert
  to authenticated with check (sender_id = auth.uid());
create policy dm_update on public.direct_messages for update
  to authenticated using (recipient_id = auth.uid() or sender_id = auth.uid())
  with check (recipient_id = auth.uid() or sender_id = auth.uid());
create policy dm_delete on public.direct_messages for delete
  to authenticated using (sender_id = auth.uid() or public.is_admin(auth.uid()));

-- REALTIME: direct_messages
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'direct_messages'
  ) then
    alter publication supabase_realtime add table public.direct_messages;
  end if;
end $$;
