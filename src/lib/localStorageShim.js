// Substitui window.storage (que só existe dentro de artifacts do Claude.ai) por
// localStorage de verdade, agora que o app roda num navegador comum.
// Usado só pelo que ainda não foi migrado para o Supabase: notas de cliente,
// dados do salão, horários, feriados, galeria e registro de consentimento.
export const storage = {
  async get(key) {
    const value = localStorage.getItem(key);
    if (value === null) throw new Error("not found");
    return { key, value };
  },
  async set(key, value) {
    localStorage.setItem(key, value);
    return { key, value };
  },
};
