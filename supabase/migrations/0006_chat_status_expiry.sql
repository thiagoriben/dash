-- Bloco 6: status de mensagem (entregue/visto), horário e mensagens temporárias.

alter table public.direct_messages add column if not exists delivered_at timestamptz;
alter table public.direct_messages add column if not exists read_at timestamptz;
alter table public.direct_messages add column if not exists expires_at timestamptz;

-- Backfill do status antigo (coluna booleana "read").
update public.direct_messages set read_at = created_at
  where read = true and read_at is null;

-- Mensagens antigas sem expiração viram temporárias padrão de 15 dias a partir de agora
-- só não expira o que já passou; mantém histórico existente visível.
-- (novas mensagens definem expires_at no insert)

create index if not exists idx_dm_recipient_unread
  on public.direct_messages (recipient_id) where read_at is null;
create index if not exists idx_dm_expires
  on public.direct_messages (expires_at);

-- Garante realtime para updates (status) — já adicionada no schema, idempotente.
do $$
begin
  begin execute 'alter publication supabase_realtime add table public.direct_messages'; exception when duplicate_object then null; end;
end $$;
