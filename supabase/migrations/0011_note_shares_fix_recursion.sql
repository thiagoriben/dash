-- Corrige "infinite recursion detected in policy for relation notes":
-- as policies de notes e note_shares se referenciavam mutuamente. Usamos
-- funções SECURITY DEFINER (que ignoram RLS) para quebrar o ciclo.

-- Dono de uma nota (sem passar por RLS de notes).
create or replace function public.note_owner(p_note_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select owner_id from public.notes where id = p_note_id;
$$;

-- Verdadeiro se a nota foi compartilhada com o usuário (sem RLS de note_shares).
create or replace function public.note_shared_with(p_note_id uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.note_shares
    where note_id = p_note_id and shared_with = p_user
  );
$$;

-- Recria as policies usando as funções (sem subquery cruzada nas tabelas).
drop policy if exists note_shares_select on public.note_shares;
drop policy if exists note_shares_write on public.note_shares;
drop policy if exists notes_shared_select on public.notes;

create policy note_shares_select on public.note_shares for select
  to authenticated using (
    shared_with = auth.uid()
    or public.note_owner(note_id) = auth.uid()
    or public.is_admin(auth.uid())
  );

create policy note_shares_write on public.note_shares for all
  to authenticated
  using (public.note_owner(note_id) = auth.uid() or public.is_admin(auth.uid()))
  with check (public.note_owner(note_id) = auth.uid() or public.is_admin(auth.uid()));

create policy notes_shared_select on public.notes for select
  to authenticated using (public.note_shared_with(id, auth.uid()));
