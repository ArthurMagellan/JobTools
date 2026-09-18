import { supabase } from "../lib/supabase";
import type { Session } from "@supabase/supabase-js";

const DOMINIO = import.meta.env.VITE_LOGIN_DOMINIO || "controle.local";

/**
 * O Supabase Auth é construído em cima de e-mail, mas o login do JobTools é por
 * usuário. Você digita "magellanarthur"; aqui, e só aqui, isso vira o endereço
 * interno que o Supabase espera. Esse endereço nunca aparece na interface.
 *
 * Consequência aceita: como o endereço é fictício, não existe recuperação de
 * senha por e-mail — ela se redefine direto no painel do banco.
 */
export function usuarioParaEndereco(usuario: string): string {
  const limpo = usuario.trim().toLowerCase();
  return limpo.includes("@") ? limpo : `${limpo}@${DOMINIO}`;
}

export async function entrar(usuario: string, senha: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email: usuarioParaEndereco(usuario),
    password: senha,
  });

  if (error) {
    if (error.message.includes("Invalid login credentials")) {
      throw new Error("Usuário ou senha incorretos.");
    }
    if (error.message.includes("Email not confirmed")) {
      throw new Error(
        "O usuário existe mas não está confirmado. No painel do Supabase, confirme-o em Authentication → Users."
      );
    }
    throw new Error(`Não foi possível entrar: ${error.message}`);
  }
}

export async function sair(): Promise<void> {
  await supabase.auth.signOut();
}

export async function sessaoAtual(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** Avisa a aplicação quando a sessão nasce, morre ou é renovada. */
export function aoMudarSessao(callback: (sessao: Session | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_evento, sessao) => callback(sessao));
  return () => data.subscription.unsubscribe();
}

/** Nome mostrado no menu: o pedaço antes do @, que é o que você digitou. */
export function nomeDeUsuario(sessao: Session | null): string {
  const email = sessao?.user?.email ?? "";
  return email.split("@")[0] || "usuário";
}
