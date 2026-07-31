-- Bloco 3 — Vendas multi-produto + vínculo com conta de anúncio.
-- Idempotente: pode rodar mais de uma vez sem erro.

-- Vínculo da venda com a conta de anúncio usada.
alter table public.sales
  add column if not exists ad_account_id uuid references public.ad_accounts(id) on delete set null;

-- Itens de uma venda: cada venda pode ter vários produtos, cada um com um rótulo
-- (front, order bump, upsell, downsell) e um valor bruto próprio.
create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  -- Rótulo do produto dentro da venda.
  role text not null default 'front' check (role in ('front', 'order_bump', 'upsell', 'downsell')),
  gross_amount numeric not null default 0,
  quantity integer not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists sale_items_sale_id_idx on public.sale_items (sale_id);
create index if not exists sale_items_product_id_idx on public.sale_items (product_id);

-- RLS: itens seguem o acesso da venda-mãe, usando o mesmo helper das demais tabelas.
alter table public.sale_items enable row level security;

drop policy if exists "sale_items_all" on public.sale_items;
create policy "sale_items_all" on public.sale_items
  for all using (
    exists (
      select 1 from public.sales s
      where s.id = sale_items.sale_id
        and (public.has_project_access(s.project_id, auth.uid()) or public.is_admin(auth.uid()))
    )
  ) with check (
    exists (
      select 1 from public.sales s
      where s.id = sale_items.sale_id
        and (public.has_project_access(s.project_id, auth.uid()) or public.is_admin(auth.uid()))
    )
  );
