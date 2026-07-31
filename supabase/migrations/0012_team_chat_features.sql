-- Recursos do chat de time equiparados ao chat global:
-- mensagens temporárias (expires_at) e status de leitura por membro (chat_reads).

-- 1) Expiração opcional das mensagens do chat de time.
alter table public.chat_messages
  add column if not exists expires_at timestamptz;

create index if not exists idx_chat_messages_expires on public.chat_messages(expires_at);

-- 2) Leitura por membro (para "lida por N").
create table if not exists public.chat_reads (
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  read_at    timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index if not exists idx_chat_reads_user on public.chat_reads(user_id);

alter table public.chat_reads enable row level security;

-- Função auxiliar (SECURITY DEFINER) para checar participação no projeto
-- sem recorrer a subconsultas que disparem recursão de RLS.
create or replace function public.is_project_participant(p_project uuid, p_user uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.projects pr where pr.id = p_project and pr.owner_id = p_user
  ) or exists (
    select 1 from public.project_members pm where pm.project_id = p_project and pm.user_id = p_user
  );
$$;

-- Políticas de chat_reads: um membro só marca/vê leituras de mensagens
-- de projetos dos quais participa, e só cria a própria marcação.
drop policy if exists chat_reads_select on public.chat_reads;
create policy chat_reads_select on public.chat_reads
  for select using (
    exists (
      select 1 from public.chat_messages cm
      where cm.id = chat_reads.message_id
        and public.is_project_participant(cm.project_id, auth.uid())
    )
  );

drop policy if exists chat_reads_insert on public.chat_reads;
create policy chat_reads_insert on public.chat_reads
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.chat_messages cm
      where cm.id = chat_reads.message_id
        and public.is_project_participant(cm.project_id, auth.uid())
    )
  );
