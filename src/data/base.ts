import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Traduz o erro cru do banco para algo que dá para ler na tela.
 * Mensagem diz o que aconteceu e, quando dá, o que fazer.
 */
export function traduzErro(erro: PostgrestError | Error | null, acao: string): Error {
  if (!erro) return new Error(`Falha ao ${acao}.`);

  const codigo = (erro as PostgrestError).code;

  if (codigo === "23505") {
    return new Error(`Já existe um registro igual. Verifique antes de ${acao}.`);
  }
  if (codigo === "23503") {
    return new Error(
      "Este cliente ainda tem jobs ligados a ele. Remova ou arquive os jobs primeiro."
    );
  }
  if (codigo === "23514") {
    return new Error("Algum campo veio com valor inválido. Confira o formulário.");
  }
  if (codigo === "42501" || erro.message?.includes("row-level security")) {
    return new Error("Sua sessão expirou. Entre de novo.");
  }
  if (erro.message?.includes("Failed to fetch")) {
    return new Error("Sem conexão com o servidor. Verifique a internet e tente de novo.");
  }

  return new Error(`Falha ao ${acao}: ${erro.message}`);
}

/** Descarta chaves com undefined para não sobrescrever coluna sem querer. */
export function limpo<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const saida: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) saida[k] = v === "" ? null : v;
  }
  return saida as Partial<T>;
}
