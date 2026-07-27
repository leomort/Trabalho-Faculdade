-- ============================================================
-- COMPLEMENTO AO schema_lgpd.sql — cobre os recursos construídos depois:
-- feriados, férias por profissional, e a galeria de fotos/vídeos.
-- Rode isto DEPOIS do schema_lgpd.sql, no mesmo projeto.
-- ============================================================

-- Horário semanal já mora em salons.business_hours (jsonb) — nenhuma tabela nova precisa disso.

create table holidays (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  date date not null,
  label text,
  is_open boolean not null default false,
  close_time int, -- minutos a partir da meia-noite; null = usa o horário normal do dia da semana
  created_at timestamptz not null default now(),
  unique (salon_id, date)
);

create table professional_vacations (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references professionals(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  check (end_date >= start_date)
);

create table gallery_items (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  professional_id uuid references professionals(id),
  type text not null check (type in ('photo', 'video')),
  media_url text,  -- foto: caminho no Supabase Storage
  video_url text,  -- vídeo: link externo (Instagram, YouTube etc.)
  label text,
  created_at timestamptz not null default now()
);

-- RLS
alter table holidays enable row level security;
alter table professional_vacations enable row level security;
alter table gallery_items enable row level security;

create policy "isola por salão" on holidays
  for all using (salon_id in (select my_salon_ids()));

create policy "isola por salão via profissional" on professional_vacations
  for all using (professional_id in (
    select id from professionals where salon_id in (select my_salon_ids())
  ));

create policy "isola por salão" on gallery_items
  for all using (salon_id in (select my_salon_ids()));

-- Leitura pública da galeria e feriados para o app do cliente (sem exigir login),
-- mas só leitura — nenhuma escrita sem estar em salon_users.
create policy "leitura pública da galeria" on gallery_items
  for select using (true);

create policy "leitura pública de feriados" on holidays
  for select using (true);
