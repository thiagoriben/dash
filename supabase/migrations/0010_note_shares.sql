-- Compartilhamento de notas pessoais com amigos específicos.
create table if not exists public.note_shares (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes(id) on delete cascade,
  shared_with uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (note_id, shared_with)
);

create index if not exists idx_note_shares_note on public.note_shares(note_id);
create index if not exists idx_note_shares_with on public.note_shares(shared_with);

alter table public.note_shares enable row level security;

drop policy if exists note_shares_select on public.note_shares;
drop policy if exists note_shares_write on public.note_shares;
drop policy if exists notes_shared_select on public.notes;

-- Quem enxerga um compartilhamento: o destinatário ou o dono da nota.
create policy note_shares_select on public.note_shares for select
  to authenticated using (
    shared_with = auth.uid()
    or exists (select 1 from public.notes n where n.id = note_id and n.owner_id = auth.uid())
    or public.is_admin(auth.uid())
  );

-- Só o dono da nota cria/remove compartilhamentos dela.
create policy note_shares_write on public.note_shares for all
  to authenticated
  using (exists (select 1 from public.notes n where n.id = note_id and n.owner_id = auth.uid()) or public.is_admin(auth.uid()))
  with check (exists (select 1 from public.notes n where n.id = note_id and n.owner_id = auth.uid()) or public.is_admin(auth.uid()));

-- Destinatário pode LER a nota compartilhada (policy adicional, OR com notes_all).
create policy notes_shared_select on public.notes for select
  to authenticated using (
    exists (select 1 from public.note_shares s where s.note_id = notes.id and s.shared_with = auth.uid())
  );
