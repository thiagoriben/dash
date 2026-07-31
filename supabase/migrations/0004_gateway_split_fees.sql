-- Taxas por forma de pagamento no gateway.
-- fee_pct / fee_fixed = taxa do pix (também usada para tudo quando split_fees=false).
-- fee_pct_card / fee_fixed_card = taxa do cartão (usada quando split_fees=true).
alter table public.payment_gateways
  add column if not exists fee_pct_card numeric not null default 0,
  add column if not exists fee_fixed_card numeric not null default 0,
  add column if not exists split_fees boolean not null default false;

-- Inicializa a taxa de cartão com a taxa atual (mantém comportamento existente).
update public.payment_gateways
  set fee_pct_card = fee_pct, fee_fixed_card = fee_fixed
  where fee_pct_card = 0 and fee_fixed_card = 0;
