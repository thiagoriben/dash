-- Schema da dashboard de tráfego pago. Já aplicado no Supabase via migration.
-- Mantido aqui para referência / execução manual.

-- PERFIS
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique not null,
  full_name text,
  phone text,
  role text not null default 'member', -- 'admin' | 'member'
  created_at timestamptz default now()
);

-- PROJETOS
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  offer_type text,
  region text default 'BR',
  currency text default 'BRL',
  status text default 'ativo',
  visibility text default 'privado',
  owner_id uuid references profiles(id),
  created_at timestamptz default now()
);

-- MEMBROS DO PROJETO
create table if not exists project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role text default 'editor',
  unique (project_id, user_id)
);

-- GASTOS
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  type text not null,
  category text,
  amount numeric not null,
  currency text default 'BRL',
  description text,
  spent_at date not null default current_date,
  recurring boolean default false,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- CRIATIVOS
create table if not exists creatives (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  name text not null,
  status text default 'testando',
  activated_at date,
  spend numeric default 0,
  sales int default 0,
  revenue numeric default 0,
  notes text,
  created_at timestamptz default now()
);

-- METRICAS DIARIAS
create table if not exists daily_metrics (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  date date not null default current_date,
  spend numeric default 0,
  impressions int default 0,
  clicks int default 0,
  checkouts_initiated int default 0,
  sales int default 0,
  revenue numeric default 0,
  unique (project_id, date)
);

-- PRODUTOS DO FUNIL
create table if not exists funnel_products (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  name text not null,
  kind text default 'front',
  price numeric not null,
  product_cost numeric default 0,
  created_at timestamptz default now()
);

-- REPARTICAO DE LUCRO
create table if not exists profit_splits (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  percentage numeric not null,
  unique (project_id, user_id)
);

alter table profiles enable row level security;
alter table projects enable row level security;
alter table project_members enable row level security;
alter table expenses enable row level security;
alter table creatives enable row level security;
alter table daily_metrics enable row level security;
alter table funnel_products enable row level security;
alter table profit_splits enable row level security;

create policy "auth full access" on profiles for all to authenticated using (true) with check (true);
create policy "auth full access" on projects for all to authenticated using (true) with check (true);
create policy "auth full access" on project_members for all to authenticated using (true) with check (true);
create policy "auth full access" on expenses for all to authenticated using (true) with check (true);
create policy "auth full access" on creatives for all to authenticated using (true) with check (true);
create policy "auth full access" on daily_metrics for all to authenticated using (true) with check (true);
create policy "auth full access" on funnel_products for all to authenticated using (true) with check (true);
create policy "auth full access" on profit_splits for all to authenticated using (true) with check (true);
