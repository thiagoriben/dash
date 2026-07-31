-- Bloco 5: notificações, convites de projeto e feedback.

/* ============================ NOTIFICATIONS ============================ */
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,                 -- friend_request | friend_accepted | project_invite | join_request | join_response | feedback
  title text not null,
  body text,
  link text,
  data jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select using (user_id = auth.uid() or is_admin(auth.uid()));

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete on public.notifications
  for delete using (user_id = auth.uid() or is_admin(auth.uid()));

-- Inserção é feita pelo servidor (service role) ao disparar eventos; usuários
-- comuns não inserem notificações diretamente.
drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications
  for insert with check (is_admin(auth.uid()));

/* ========================= PROJECT INVITATIONS ========================= */
create table if not exists public.project_invitations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  invitee_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'editor',
  status text not null default 'pending',   -- pending | accepted | rejected
  created_at timestamptz not null default now(),
  unique (project_id, invitee_id)
);
create index if not exists project_invitations_invitee_idx on public.project_invitations (invitee_id, status);

alter table public.project_invitations enable row level security;

drop policy if exists project_invitations_select on public.project_invitations;
create policy project_invitations_select on public.project_invitations
  for select using (invitee_id = auth.uid() or inviter_id = auth.uid() or is_admin(auth.uid()));

drop policy if exists project_invitations_insert on public.project_invitations;
create policy project_invitations_insert on public.project_invitations
  for insert with check (inviter_id = auth.uid());

drop policy if exists project_invitations_update on public.project_invitations;
create policy project_invitations_update on public.project_invitations
  for update using (invitee_id = auth.uid() or inviter_id = auth.uid())
  with check (invitee_id = auth.uid() or inviter_id = auth.uid());

drop policy if exists project_invitations_delete on public.project_invitations;
create policy project_invitations_delete on public.project_invitations
  for delete using (inviter_id = auth.uid() or is_admin(auth.uid()));

/* ============================== FEEDBACK ============================== */
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  kind text not null default 'bug',    -- bug | suggestion
  message text not null,
  page text,
  status text not null default 'open', -- open | resolved
  created_at timestamptz not null default now()
);
create index if not exists feedback_status_idx on public.feedback (status, created_at desc);

alter table public.feedback enable row level security;

drop policy if exists feedback_insert on public.feedback;
create policy feedback_insert on public.feedback
  for insert with check (user_id = auth.uid());

drop policy if exists feedback_select on public.feedback;
create policy feedback_select on public.feedback
  for select using (user_id = auth.uid() or is_admin(auth.uid()));

drop policy if exists feedback_update on public.feedback;
create policy feedback_update on public.feedback
  for update using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

/* ============================== REALTIME ============================== */
-- Adiciona as tabelas relevantes à publicação de realtime (ignora se já estão).
do $$
begin
  begin execute 'alter publication supabase_realtime add table public.notifications'; exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.project_invitations'; exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.project_join_requests'; exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.feedback'; exception when duplicate_object then null; end;
end $$;
