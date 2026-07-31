-- Mídia de criativo via link na nuvem (imagem ou vídeo).
alter table public.creatives add column if not exists media_url text;
alter table public.creatives add column if not exists media_type text; -- 'image' | 'video' | null
