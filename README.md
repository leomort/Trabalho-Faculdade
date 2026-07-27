# NailFlow — projeto local conectado ao Supabase

Este é o um app do protótipo — rodando no seu computador
e falando de verdade com o Supabase.

## 1. Instalar

Precisa ter o [Node.js](https://nodejs.org) instalado (versão 18 ou mais recente).

```
npm install
```

## 2. Configurar o Supabase

1. No painel do Supabase, rode nesta ordem, no **SQL Editor**:
   - `schema_lgpd.sql`
   - `schema_updates.sql`
   - `schema_step3_public_access.sql` (o último comando desse arquivo é um `insert`
     que já cria o primeiro salão — **copie o `id` que ele retorna**)
   - `schema_step4_temp_access.sql`
2. Copie `.env.example` para `.env`:
   ```
   cp .env.example .env
   ```
3. Preencha o `.env`:
   - `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` — em **Project Settings → API**
   - `VITE_SALON_ID` — o `id` que o `insert` no passo 1 retornou

## 3. Rodar

```
npm run dev
```

Abre em `http://localhost:5173`.

## O que já está ligado ao Supabase de verdade

- **Profissionais** — cadastro, edição, foto, férias: tudo grava no banco.
- **Serviços** — idem.
- **Agendamentos** — criar e cancelar grava no banco. A trava contra dois
  agendamentos no mesmo horário (exclusion constraint) é real: se dois clientes
  confirmarem o mesmo horário quase ao mesmo tempo, o segundo recebe um erro
  amigável em vez de sobrescrever o primeiro.

## O que ainda é só local (próximos passos)

- **Login** — nome/senha ainda são comparados no próprio app, não no Supabase
  Auth. Funciona para teste, mas a senha fica visível no banco em texto puro.
- **Notas de cliente, dados do salão, horários, feriados, galeria, registro de
  consentimento** — continuam salvos no `localStorage` do navegador, não no
  Supabase ainda.
- **Fotos da galeria e das profissionais** — ainda são strings base64 guardadas
  direto na coluna (funciona, mas o ideal é usar o Supabase Storage).
- **Políticas de escrita temporárias** — o `schema_step4` deixou
  profissionais/serviços/férias/feriados graváveis por qualquer um com a anon
  key, só para funcionar sem login. Isso precisa ser apertado assim que o
  Supabase Auth entrar.

## Ordem sugerida para os próximos passos

1. Supabase Auth (login real do admin e das profissionais)
2. Apertar as políticas temporárias do `schema_step4`
3. Migrar notas/salão/horários/feriados/galeria/consentimento para tabelas
4. Supabase Storage para fotos e galeria
