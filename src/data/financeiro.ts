import { supabase } from "../lib/supabase";
import { limpo, traduzErro } from "./base";
import type { Contrato, ContratoCompleto, Parcela, ParcelaCompleta } from "./types";

const SELECT_PARCELA =
  "*, job:jobs(id, titulo, cliente:clientes(nome)), contrato:contratos(id, descricao, cliente:clientes(nome))";

// --- contratos ------------------------------------------------------------

export async function listarContratos(incluirEncerrados = false): Promise<ContratoCompleto[]> {
  let consulta = supabase
    .from("contratos")
    .select("*, cliente:clientes(id, nome)")
    .order("status")
    .order("descricao");

  if (!incluirEncerrados) consulta = consulta.neq("status", "encerrado");

  const { data, error } = await consulta;
  if (error) throw traduzErro(error, "carregar os contratos");
  return data ?? [];
}

export async function criarContrato(
  entrada: Pick<Contrato, "cliente_id" | "descricao" | "valor_mensal" | "data_inicio"> &
    Partial<Contrato>
): Promise<Contrato> {
  const { data, error } = await supabase
    .from("contratos")
    .insert(limpo({ ...entrada }))
    .select()
    .single();

  if (error) throw traduzErro(error, "salvar o contrato");
  return data;
}

export async function atualizarContrato(
  id: string,
  mudancas: Partial<Contrato>
): Promise<Contrato> {
  const { data, error } = await supabase
    .from("contratos")
    .update(limpo({ ...mudancas }))
    .eq("id", id)
    .select()
    .single();

  if (error) throw traduzErro(error, "salvar o contrato");
  return data;
}

export async function removerContrato(id: string): Promise<void> {
  const { error } = await supabase.from("contratos").delete().eq("id", id);
  if (error) throw traduzErro(error, "remover o contrato");
}

// --- parcelas -------------------------------------------------------------

export async function listarParcelas(de: string, ate: string): Promise<ParcelaCompleta[]> {
  const { data, error } = await supabase
    .from("parcelas")
    .select(SELECT_PARCELA)
    .gte("data_prevista", de)
    .lte("data_prevista", ate)
    .order("data_prevista");

  if (error) throw traduzErro(error, "carregar as parcelas");
  return data ?? [];
}

export async function listarParcelasDoJob(jobId: string): Promise<Parcela[]> {
  const { data, error } = await supabase
    .from("parcelas")
    .select("*")
    .eq("job_id", jobId)
    .order("data_prevista");

  if (error) throw traduzErro(error, "carregar as parcelas do job");
  return data ?? [];
}

/** Tudo que ainda não foi pago, sem limite de data — alimenta atrasados e previsão. */
export async function listarParcelasEmAberto(): Promise<ParcelaCompleta[]> {
  const { data, error } = await supabase
    .from("parcelas")
    .select(SELECT_PARCELA)
    .neq("confianca", "paga")
    .order("data_prevista");

  if (error) throw traduzErro(error, "carregar o que está em aberto");
  return data ?? [];
}

export async function criarParcela(
  entrada: Pick<Parcela, "valor" | "data_prevista"> & Partial<Parcela>
): Promise<Parcela> {
  const { data, error } = await supabase
    .from("parcelas")
    .insert(limpo({ ...entrada }))
    .select()
    .single();

  if (error) throw traduzErro(error, "salvar a parcela");
  return data;
}

export async function atualizarParcela(id: string, mudancas: Partial<Parcela>): Promise<Parcela> {
  const { data, error } = await supabase
    .from("parcelas")
    .update(limpo({ ...mudancas }))
    .eq("id", id)
    .select()
    .single();

  if (error) throw traduzErro(error, "salvar a parcela");
  return data;
}

export async function removerParcela(id: string): Promise<void> {
  const { error } = await supabase.from("parcelas").delete().eq("id", id);
  if (error) throw traduzErro(error, "remover a parcela");
}

/** Marcar como paga exige a data em que caiu — o banco recusa sem ela. */
export async function marcarPaga(id: string, dataEfetiva: string): Promise<Parcela> {
  return atualizarParcela(id, { confianca: "paga", data_efetiva: dataEfetiva });
}

/**
 * O financeiro do cliente mandou o e-mail do "será pago dia X".
 * A data muda e a parcela sobe de estimada para confirmada (regra R5).
 */
export async function confirmarData(id: string, data: string, nota?: string): Promise<Parcela> {
  return atualizarParcela(id, {
    data_prevista: data,
    confianca: "confirmada",
    nota: nota || null,
  });
}

// --- geração das mensalidades ---------------------------------------------

function primeiroDoMes(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/**
 * A única automação da v1.
 *
 * Sem ela você redigitaria a mesma mensalidade todo mês e abandonaria o sistema
 * em dois. Roda ao abrir o financeiro e garante que cada contrato ativo tenha
 * parcela para o mês corrente e os cinco seguintes — o bastante para a previsão.
 *
 * Repetir é inofensivo: o índice único (contrato, competência) descarta o que
 * já existe em vez de duplicar.
 */
export async function gerarMensalidades(mesesAFrente = 5): Promise<number> {
  const contratos = await listarContratos();
  const ativos = contratos.filter((c) => c.status === "ativo");
  if (ativos.length === 0) return 0;

  const hoje = new Date();
  const novas: Record<string, unknown>[] = [];

  for (const c of ativos) {
    for (let i = 0; i <= mesesAFrente; i++) {
      const mes = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
      const competencia = primeiroDoMes(mes);

      // Não gera antes do início nem depois do fim do contrato.
      if (competencia < c.data_inicio.slice(0, 7) + "-01") continue;
      if (c.data_fim && competencia > c.data_fim) continue;

      const vencimento = `${competencia.slice(0, 8)}${String(c.dia_vencimento).padStart(2, "0")}`;

      novas.push({
        contrato_id: c.id,
        competencia,
        valor: c.valor_mensal,
        data_prevista: vencimento,
        // Mensalidade de contrato ativo é o dinheiro mais previsível que existe.
        confianca: "confirmada",
        descricao: c.descricao,
      });
    }
  }

  if (novas.length === 0) return 0;

  const { error, count } = await supabase
    .from("parcelas")
    .upsert(novas, { onConflict: "contrato_id,competencia", ignoreDuplicates: true, count: "exact" });

  if (error) throw traduzErro(error, "gerar as mensalidades");
  return count ?? 0;
}

// As contas do mes moram em lib/contas.ts: sao calculo puro, nao acesso a dados,
// e assim podem ser testadas sem banco.
export {
  estaAtrasada,
  resumoDoMes,
  previsaoMeses,
  previsaoPeloPrazo,
} from "../lib/contas";
