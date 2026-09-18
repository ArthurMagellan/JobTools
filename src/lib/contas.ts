/**
 * As contas do mes. Calculo puro, sem banco — e por isso testavel.
 *
 * Quatro numeros porque "faturamento" significa quatro coisas diferentes, e
 * confundi-las e a fonte mais comum de decisao errada.
 */
import { hojeISO } from "./formato";
import type { Contrato, MesPrevisto, Parcela, ResumoDoMes } from "../data/types";

// --- as contas ------------------------------------------------------------

export function estaAtrasada(p: Parcela, hoje = hojeISO()): boolean {
  return p.confianca !== "paga" && p.data_prevista < hoje;
}

const soma = (ns: number[]) => ns.reduce((t, n) => t + Number(n), 0);

/**
 * As quatro contas do mês. Estimado e confirmado voltam separados de propósito:
 * misturá-los é como se acaba contando com dinheiro que não vem (regra R5).
 */
export function resumoDoMes(
  parcelas: Parcela[],
  emAberto: Parcela[],
  contratosAtivos: Contrato[],
  mes: string,
  hoje = hojeISO()
): ResumoDoMes {
  const doMes = (iso: string | null) => !!iso && iso.slice(0, 7) === mes;

  return {
    recebido: soma(
      parcelas.filter((p) => p.confianca === "paga" && doMes(p.data_efetiva)).map((p) => p.valor)
    ),
    aReceberConfirmado: soma(
      parcelas
        .filter((p) => p.confianca === "confirmada" && doMes(p.data_prevista) && !estaAtrasada(p, hoje))
        .map((p) => p.valor)
    ),
    aReceberEstimado: soma(
      parcelas
        .filter((p) => p.confianca === "estimada" && doMes(p.data_prevista) && !estaAtrasada(p, hoje))
        .map((p) => p.valor)
    ),
    // Atrasado ignora o mês: o que venceu e não entrou continua pendurado.
    atrasado: soma(emAberto.filter((p) => estaAtrasada(p, hoje)).map((p) => p.valor)),
    garantido: soma(contratosAtivos.map((c) => c.valor_mensal)),
  };
}

/** Previsão dos próximos meses, em duas barras: o certo e o provável. */
export function previsaoMeses(
  emAberto: Parcela[],
  aPartirDe: string,
  quantos = 6
): MesPrevisto[] {
  const base = new Date(`${aPartirDe.slice(0, 7)}-01T00:00:00`);

  return Array.from({ length: quantos }, (_, i) => {
    const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
    const competencia = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const doMes = emAberto.filter((p) => p.data_prevista.slice(0, 7) === competencia);

    return {
      competencia,
      confirmado: soma(doMes.filter((p) => p.confianca === "confirmada").map((p) => p.valor)),
      estimado: soma(doMes.filter((p) => p.confianca === "estimada").map((p) => p.valor)),
    };
  });
}

/**
 * Sugere a data da primeira parcela a partir do prazo padrão do cliente —
 * é o que faz a parcela nascer já com a data certa em vez de você calcular.
 */
export function previsaoPeloPrazo(prazoDias: number | null, base = hojeISO()): string {
  const d = new Date(`${base}T00:00:00`);
  d.setDate(d.getDate() + (prazoDias ?? 30));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

// --- resumo por job (o que o cartão do quadro mostra) ---------------------

export type EstadoFinanceiro = "sem_valor" | "sem_parcela" | "a_receber" | "atrasado" | "pago";

export interface ResumoDoJob {
  estado: EstadoFinanceiro;
  total: number;
  /** Nenhuma nota emitida, algumas, ou todas. */
  nf: "nenhuma" | "parcial" | "todas";
}

/**
 * Traduz as parcelas de um job em duas informações que cabem num cartão:
 * como está o dinheiro e como está a nota fiscal.
 *
 * "sem_parcela" é o estado que mais importa: job fechado com valor mas sem
 * parcela nenhuma nunca aparece no financeiro — é dinheiro invisível.
 */
export function resumoDoJob(
  parcelas: { valor: number; confianca: string; data_prevista: string; nf_emitida: boolean }[],
  valorFechado: number | null,
  hoje = hojeISO()
): ResumoDoJob {
  const total = parcelas.reduce((t, p) => t + Number(p.valor), 0);

  if (parcelas.length === 0) {
    return {
      estado: valorFechado && valorFechado > 0 ? "sem_parcela" : "sem_valor",
      total: Number(valorFechado ?? 0),
      nf: "nenhuma",
    };
  }

  const comNF = parcelas.filter((p) => p.nf_emitida).length;
  const nf = comNF === 0 ? "nenhuma" : comNF === parcelas.length ? "todas" : "parcial";

  const naoPagas = parcelas.filter((p) => p.confianca !== "paga");
  if (naoPagas.length === 0) return { estado: "pago", total, nf };
  if (naoPagas.some((p) => p.data_prevista < hoje)) return { estado: "atrasado", total, nf };
  return { estado: "a_receber", total, nf };
}

export const ROTULO_ESTADO_FINANCEIRO: Record<EstadoFinanceiro, string> = {
  sem_valor: "sem cachê",
  sem_parcela: "sem parcela",
  a_receber: "a receber",
  atrasado: "atrasado",
  pago: "pago",
};
