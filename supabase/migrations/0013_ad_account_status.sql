-- =========================================================
-- 0013 — Status da conta de anúncio (BM/CA)
-- Permite marcar cada conta como ativa / pausada / restrita.
-- Seguro rodar novamente (idempotente).
-- =========================================================

alter table public.ad_accounts
  add column if not exists status text not null default 'ativa';
