-- Bloco 8: taxa de saque também pode ser um valor fixo (R$), além da percentual.
alter table public.payment_gateways
  add column if not exists withdraw_fee_fixed numeric not null default 0;
