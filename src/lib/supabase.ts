import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const chave = import.meta.env.VITE_SUPABASE_KEY;

if (!url || !chave) {
  throw new Error(
    "Faltam VITE_SUPABASE_URL e VITE_SUPABASE_KEY. Copie .env.example para .env.local e preencha."
  );
}

/**
 * Cliente do Supabase.
 *
 * Nenhuma tela importa este arquivo: quem fala com o banco é sempre a camada
 * em src/data. Assim, trocar de backend um dia é mexer numa pasta, não em
 * quarenta telas.
 */
export const supabase = createClient(url, chave, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: "jobtools-sessao",
  },
});
