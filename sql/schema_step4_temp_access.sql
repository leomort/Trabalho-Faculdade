-- ============================================================
-- PASSO 4 — simplifica appointments para o formato que o app já usa,
-- e libera escrita temporária para profissionais/serviços/férias/feriados
-- enquanto o login ainda não passa pelo Supabase Auth.
-- ============================================================

-- --- Simplifica appointments -------------------------------------------------
-- O app trabalha com data + minutos + nome/telefone direto (sem cadastro prévio
-- de cliente). Guardamos isso em colunas simples, e um gatilho continua
-- calculando o time_range por trás — é ele que a trava de conflito de horário
-- (exclusion constraint) usa, então a proteção contra dupla marcação continua
-- valendo mesmo com essas colunas mais simples.

alter table appointments
  add column if not exists date date,
  add column if not exists start_minutes int,
  add column if not exists duration_minutes int,
  add column if not exists client_name text,
  add column if not exists client_phone text;

alter table appointments alter column client_id drop not null;

create or replace function set_time_range() returns trigger as $$
begin
  new.time_range := tstzrange(
    (new.date::timestamp + (new.start_minutes || ' minutes')::interval),
    (new.date::timestamp + ((new.start_minutes + new.duration_minutes) || ' minutes')::interval)
  );
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_set_time_range on appointments;
create trigger trg_set_time_range
before insert or update on appointments
for each row execute function set_time_range();

-- --- Acesso de escrita TEMPORÁRIO para o admin --------------------------------
-- Sem o Supabase Auth ligado ainda, ninguém está "logado" de verdade do ponto
-- de vista do banco — então as políticas que exigem salon_id in (my_salon_ids())
-- bloqueiam até a própria administração de escrever. Isto aqui libera escrita
-- geral nessas tabelas SÓ para você testar sozinho agora.
--
-- ATENÇÃO: isso deixa essas tabelas gravável por qualquer pessoa que tenha a
-- anon key (que é pública). Serve para o momento atual, com um salão só e você
-- testando. REMOVA estas 4 políticas ("temp_write_*") assim que o Supabase Auth
-- estiver funcionando — nesse momento as políticas antigas (que já existem no
-- schema_lgpd.sql) passam a valer de verdade.

create policy "temp_write_professionals" on professionals
  for all using (true) with check (true);

create policy "temp_write_services" on services
  for all using (true) with check (true);

create policy "temp_write_vacations" on professional_vacations
  for all using (true) with check (true);

create policy "temp_write_holidays" on holidays
  for all using (true) with check (true);
