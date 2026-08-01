-- Web Push: assinaturas dos dispositivos e log de lembretes enviados.
-- Rode este script uma vez no SQL editor do Supabase.

-- Assinaturas push por dispositivo/navegador.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- Log de lembretes já enviados (evita duplicar no mesmo minuto/execução).
create table if not exists public.reminder_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  todo_id uuid not null,
  fire_at timestamptz not null,
  sent_at timestamptz not null default now(),
  unique (todo_id, fire_at)
);

create index if not exists reminder_log_sent_idx on public.reminder_log (sent_at);

-- RLS: cada usuário gerencia só as próprias assinaturas.
alter table public.push_subscriptions enable row level security;
alter table public.reminder_log enable row level security;

drop policy if exists "own push subs select" on public.push_subscriptions;
create policy "own push subs select" on public.push_subscriptions
  for select using (auth.uid () = user_id);

drop policy if exists "own push subs insert" on public.push_subscriptions;
create policy "own push subs insert" on public.push_subscriptions
  for insert with check (auth.uid () = user_id);

drop policy if exists "own push subs delete" on public.push_subscriptions;
create policy "own push subs delete" on public.push_subscriptions
  for delete using (auth.uid () = user_id);

-- reminder_log é gravado só pelo cron (service role, que ignora RLS).
-- Nenhuma policy pública: usuários não precisam ler/escrever direto.
