import { supabase } from "../lib/supabase";
import { limpo, traduzErro } from "./base";
import type { Cliente, ClienteEntrada, Contato } from "./types";

export async function listarClientes(incluirArquivados = false): Promise<Cliente[]> {
  let consulta = supabase.from("clientes").select("*").order("nome");
  if (!incluirArquivados) consulta = consulta.eq("arquivado", false);

  const { data, error } = await consulta;
  if (error) throw traduzErro(error, "carregar os clientes");
  return data ?? [];
}

export async function obterCliente(id: string): Promise<Cliente | null> {
  const { data, error } = await supabase.from("clientes").select("*").eq("id", id).maybeSingle();
  if (error) throw traduzErro(error, "carregar o cliente");
  return data;
}

/**
 * Só o nome é obrigatório (regra R4). Tudo mais pode ficar em branco e ser
 * preenchido depois — o cadastro precisa caber em dez segundos, no set.
 */
export async function criarCliente(entrada: ClienteEntrada): Promise<Cliente> {
  const { data, error } = await supabase
    .from("clientes")
    .insert(limpo({ ...entrada }))
    .select()
    .single();

  if (error) throw traduzErro(error, "salvar o cliente");
  return data;
}

export async function atualizarCliente(
  id: string,
  mudancas: Partial<ClienteEntrada>
): Promise<Cliente> {
  const { data, error } = await supabase
    .from("clientes")
    .update(limpo({ ...mudancas }))
    .eq("id", id)
    .select()
    .single();

  if (error) throw traduzErro(error, "salvar o cliente");
  return data;
}

export async function arquivarCliente(id: string, arquivado: boolean): Promise<void> {
  const { error } = await supabase.from("clientes").update({ arquivado }).eq("id", id);
  if (error) throw traduzErro(error, arquivado ? "arquivar o cliente" : "reativar o cliente");
}

/** Quais dados fiscais faltam. Avisa, nunca trava (regra R4). */
export function dadosFiscaisFaltando(cliente: Cliente): string[] {
  const faltando: string[] = [];
  if (!cliente.cpf_cnpj) faltando.push("CPF/CNPJ");
  if (!cliente.endereco) faltando.push("endereço");
  return faltando;
}

// --- contatos -------------------------------------------------------------

export async function listarContatos(clienteId: string): Promise<Contato[]> {
  const { data, error } = await supabase
    .from("contatos")
    .select("*")
    .eq("cliente_id", clienteId)
    .order("created_at");

  if (error) throw traduzErro(error, "carregar os contatos");
  return data ?? [];
}

export async function criarContato(
  clienteId: string,
  contato: Pick<Contato, "nome"> & Partial<Contato>
): Promise<Contato> {
  const { data, error } = await supabase
    .from("contatos")
    .insert(limpo({ ...contato, cliente_id: clienteId }))
    .select()
    .single();

  if (error) throw traduzErro(error, "salvar o contato");
  return data;
}

export async function removerContato(id: string): Promise<void> {
  const { error } = await supabase.from("contatos").delete().eq("id", id);
  if (error) throw traduzErro(error, "remover o contato");
}
