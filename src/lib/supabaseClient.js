import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase não configurado. Copie .env.example para .env e preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// O salon_id fica fixo por enquanto (um salão só) — quando o app for multiempresa
// de verdade, isso vem do login, não de uma variável de ambiente.
export const SALON_ID = import.meta.env.VITE_SALON_ID;
