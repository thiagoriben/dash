-- Bloco 6: detector de bugs automático + campos extras de feedback.
-- Reaproveita a tabela feedback, adicionando severidade, origem automática e
-- detalhes técnicos (stack, url, user agent) em jsonb — visíveis só para admin.

alter table public.feedback add column if not exists severity text not null default 'normal'; -- low | normal | high | critical
alter table public.feedback add column if not exists auto boolean not null default false;
alter table public.feedback add column if not exists detail jsonb;

-- kind agora pode ser: bug | suggestion | other | auto_bug
comment on column public.feedback.kind is 'bug | suggestion | other | auto_bug';
comment on column public.feedback.detail is 'Detalhes técnicos do bug automático: message, stack, url, userAgent, componentStack';
