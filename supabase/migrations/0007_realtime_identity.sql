-- Bloco 7: realtime confiável para DM e notificações.

-- REPLICA IDENTITY FULL: garante que payloads de UPDATE/DELETE tragam a linha
-- completa (necessário para filtrar por recipient_id no cliente).
alter table public.direct_messages replica identity full;
alter table public.notifications replica identity full;

-- Adiciona notifications à publicação realtime (idempotente).
do $$
begin
  begin execute 'alter publication supabase_realtime add table public.notifications'; exception when duplicate_object then null; end;
end $$;
