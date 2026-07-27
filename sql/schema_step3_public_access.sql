-- ============================================================
-- PASSO 3 — acesso público mínimo necessário para o app do CLIENTE funcionar
-- sem exigir login (cliente final nunca tem conta), e ajustes para o
-- momento atual (login ainda local, antes do Supabase Auth entrar em cena).
-- Rode depois do schema_lgpd.sql e do schema_updates.sql.
-- ============================================================

-- Cliente precisa listar profissionais e serviços sem estar logado.
create policy "leitura pública de profissionais" on professionals
  for select using (true);

create policy "leitura pública de serviços" on services
  for select using (true);

-- Cliente precisa CRIAR um agendamento sem estar logado.
-- Atenção: isto ainda não restringe leitura por telefone (a tela "Meus agendamentos"
-- do alpha) — isso deve virar uma Edge Function no próximo passo, para não expor
-- a agenda de todo mundo a qualquer pessoa com a anon key. Por ora, leitura de
-- appointments continua restrita a quem estiver em salon_users.
create policy "cliente pode criar agendamento" on appointments
  for insert with check (true);

-- Coluna de senha para o login atual (nome + senha). Isto é um passo intermediário:
-- quando o Supabase Auth entrar, esta coluna deixa de ser necessária e a senha
-- passa a viver de forma seguras no Auth, não numa coluna de tabela.
alter table professionals add column if not exists password text;

-- Cria o primeiro salão, para você ter um salon_id real para usar no app.
-- Rode isto UMA vez e guarde o id retornado — vai para o .env do projeto (VITE_SALON_ID).
insert into salons (name, business_hours)
values (
  'Bella Studio',
  '{
    "0": {"open": false},
    "1": {"open": true, "start": 480, "end": 1020},
    "2": {"open": true, "start": 480, "end": 1020},
    "3": {"open": true, "start": 480, "end": 1020},
    "4": {"open": true, "start": 480, "end": 1020},
    "5": {"open": true, "start": 480, "end": 1020},
    "6": {"open": true, "start": 480, "end": 780}
  }'::jsonb
)
returning id;
