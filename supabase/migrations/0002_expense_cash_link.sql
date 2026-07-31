-- Bloco 4: sincroniza gastos com o caixa do projeto (a "carteira" do projeto).
-- Cada gasto com anúncio espelha uma saída no caixa; o vínculo permite manter
-- os dois em sincronia em edições/exclusões (cascade apaga o espelho).

alter table public.cash_entries
  add column if not exists expense_id uuid references public.expenses(id) on delete cascade;

create index if not exists cash_entries_expense_id_idx on public.cash_entries (expense_id);
