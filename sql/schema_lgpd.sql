-- ============================================================
-- SCHEMA: SaaS de Agendamento para Salões (Supabase / Postgres)
-- Inclui: multiempresa com RLS, prevenção de conflito de horário,
-- e estrutura de conformidade com a LGPD.
-- ============================================================

create extension if not exists "pgcrypto";
create extension if not exists "btree_gist";

-- ============================================================
-- 1. USUÁRIOS E VÍNCULO COM SALÕES
-- auth.users é gerenciado pelo Supabase Auth automaticamente.
-- Esta tabela liga um usuário autenticado a um ou mais salões e define seu papel.
-- ============================================================
create table salon_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  salon_id uuid not null,
  role text not null check (role in ('owner', 'admin', 'professional')),
  created_at timestamptz not null default now(),
  unique (user_id, salon_id)
);

-- ============================================================
-- 2. NÚCLEO DO NEGÓCIO
-- ============================================================
create table salons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  address text,
  instagram text,
  whatsapp text,
  cnpj text,
  business_hours jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table professionals (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  name text not null,
  photo_url text,
  specialty text,
  phone text,
  calendar_color text not null default '#8C3B4E',
  commission_pct numeric(5,2) not null default 0 check (commission_pct >= 0 and commission_pct <= 100),
  work_days int[] not null default '{1,2,3,4,5,6}', -- 0=domingo .. 6=sábado
  work_start time not null default '08:00',
  work_end time not null default '18:00',
  lunch_start time,
  lunch_end time,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table services (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  name text not null,
  category text,
  price numeric(10,2) not null,
  duration_minutes int not null check (duration_minutes > 0),
  color text not null default '#8C3B4E',
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Dados de clientes: PESSOAIS por definição da LGPD. Tratar com cuidado extra.
create table clients (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  name text not null,
  phone text,
  whatsapp text,
  birthdate date,
  notes text,
  created_at timestamptz not null default now()
);

create table appointments (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  professional_id uuid not null references professionals(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  service_id uuid not null references services(id),
  time_range tstzrange not null, -- calculado a partir de start_time + duração do serviço
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled', 'completed', 'no_show')),
  created_at timestamptz not null default now(),

  -- Impede que o MESMO profissional tenha dois agendamentos que se sobrepõem.
  -- É isso que garante, no banco, a regra de "Pé + Mão ocupa 2 horários".
  exclude using gist (professional_id with =, time_range with &&) where (status = 'confirmed')
);

create table blocks (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references professionals(id) on delete cascade,
  time_range tstzrange not null,
  reason text,
  exclude using gist (professional_id with =, time_range with &&)
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  appointment_id uuid references appointments(id),
  amount numeric(10,2) not null,
  payment_method text check (payment_method in ('pix', 'card', 'cash')),
  created_at timestamptz not null default now()
);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 3. CONFORMIDADE COM A LGPD
-- ============================================================

-- Registro de consentimento: base legal para uso dos dados de cada cliente.
-- Toda vez que um cliente aceita termos/marketing, isso é gravado aqui — nunca sobrescrito, só adicionado.
create table consent_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  consent_type text not null check (consent_type in ('terms_of_use', 'marketing_whatsapp', 'marketing_email')),
  granted boolean not null,
  recorded_at timestamptz not null default now()
);

-- Direito de acesso/eliminação (Art. 18 da LGPD): registra e rastreia o pedido do titular.
create table data_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  requested_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'completed', 'rejected')),
  completed_at timestamptz,
  notes text
);

-- Trilha de auditoria: quem acessou/alterou dados sensíveis e quando.
-- Essencial para conseguir responder "quem viu os dados desse cliente" em caso de incidente.
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id),
  action text not null,           -- ex: 'client.view', 'client.export', 'client.delete'
  target_table text not null,
  target_id uuid,
  created_at timestamptz not null default now()
);

-- Função utilitária: anonimiza um cliente em vez de apagar,
-- preservando o histórico financeiro/agenda (necessário para obrigações contábeis),
-- mas removendo os dados pessoais identificáveis. Chamada quando uma deletion_request é aprovada.
create or replace function anonymize_client(p_client_id uuid)
returns void as $$
begin
  update clients
  set name = 'Cliente removido',
      phone = null,
      whatsapp = null,
      birthdate = null,
      notes = null
  where id = p_client_id;

  update data_deletion_requests
  set status = 'completed', completed_at = now()
  where client_id = p_client_id and status = 'pending';
end;
$$ language plpgsql security definer;

-- ============================================================
-- 4. ROW LEVEL SECURITY (RLS) — isolamento entre salões
-- ============================================================

alter table salons enable row level security;
alter table professionals enable row level security;
alter table services enable row level security;
alter table clients enable row level security;
alter table appointments enable row level security;
alter table blocks enable row level security;
alter table transactions enable row level security;
alter table reviews enable row level security;
alter table consent_logs enable row level security;
alter table data_deletion_requests enable row level security;
alter table salon_users enable row level security;

-- Helper: retorna os salon_ids que o usuário autenticado pode acessar.
create or replace function my_salon_ids()
returns setof uuid as $$
  select salon_id from salon_users where user_id = auth.uid();
$$ language sql security definer stable;

-- Política padrão repetida por tabela: só acessa dados do(s) próprio(s) salão(ões).
create policy "isola por salão" on salons
  for all using (id in (select my_salon_ids()));

create policy "isola por salão" on professionals
  for all using (salon_id in (select my_salon_ids()));

create policy "isola por salão" on services
  for all using (salon_id in (select my_salon_ids()));

create policy "isola por salão" on clients
  for all using (salon_id in (select my_salon_ids()));

create policy "isola por salão" on appointments
  for all using (salon_id in (select my_salon_ids()));

create policy "isola por salão via profissional" on blocks
  for all using (professional_id in (
    select id from professionals where salon_id in (select my_salon_ids())
  ));

create policy "isola por salão" on transactions
  for all using (salon_id in (select my_salon_ids()));

create policy "isola por salão via agendamento" on reviews
  for all using (appointment_id in (
    select id from appointments where salon_id in (select my_salon_ids())
  ));

create policy "isola por salão via cliente" on consent_logs
  for all using (client_id in (
    select id from clients where salon_id in (select my_salon_ids())
  ));

create policy "isola por salão via cliente" on data_deletion_requests
  for all using (client_id in (
    select id from clients where salon_id in (select my_salon_ids())
  ));

create policy "usuário só vê seus próprios vínculos" on salon_users
  for select using (user_id = auth.uid());

-- OBSERVAÇÃO: o cliente final (quem agenda pelo app) NÃO tem linha em salon_users,
-- então as políticas acima automaticamente já bloqueiam acesso dele às tabelas administrativas.
-- Para o app do cliente, crie políticas separadas e mais restritivas (ex: só ver
-- os PRÓPRIOS agendamentos, e só ver profissionais/serviços do salão que ele está visualizando,
-- nunca dados de outros clientes).
