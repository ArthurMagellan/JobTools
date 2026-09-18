import { supabase } from "../lib/supabase";
import { limpo, traduzErro } from "./base";
import {
  CAMADAS_DE_TEMPO,
  FIRMEZA_DA_CAMADA,
  ROTULO_COMPROMISSO,
  STATUS_FORA,
  type Compromisso,
  type CompromissoCompleto,
  type EventoAgenda,
  type Firmeza,
} from "./types";

const SELECT_COMPROMISSO = "*, job:jobs(id, titulo)";

// --- compromissos ---------------------------------------------------------

export async function listarCompromissos(
  de: string,
  ate: string
): Promise<CompromissoCompleto[]> {
  // Pega também os que começam antes da janela mas se estendem para dentro dela.
  const { data, error } = await supabase
    .from("compromissos")
    .select(SELECT_COMPROMISSO)
    .lte("data_inicio", ate)
    .or(`data_fim.gte.${de},and(data_fim.is.null,data_inicio.gte.${de})`)
    .order("data_inicio");

  if (error) throw traduzErro(error, "carregar a agenda");
  return data ?? [];
}

export async function listarCompromissosDoJob(jobId: string): Promise<CompromissoCompleto[]> {
  const { data, error } = await supabase
    .from("compromissos")
    .select(SELECT_COMPROMISSO)
    .eq("job_id", jobId)
    .order("data_inicio");

  if (error) throw traduzErro(error, "carregar os blocos de edição");
  return data ?? [];
}

export async function criarCompromisso(
  entrada: Pick<Compromisso, "tipo" | "data_inicio"> & Partial<Compromisso>
): Promise<Compromisso> {
  const { data, error } = await supabase
    .from("compromissos")
    .insert(limpo({ ...entrada }))
    .select()
    .single();

  if (error) throw traduzErro(error, "reservar o compromisso");
  return data;
}

export async function atualizarCompromisso(
  id: string,
  mudancas: Partial<Compromisso>
): Promise<Compromisso> {
  const { data, error } = await supabase
    .from("compromissos")
    .update(limpo({ ...mudancas }))
    .eq("id", id)
    .select()
    .single();

  if (error) throw traduzErro(error, "salvar o compromisso");
  return data;
}

export async function removerCompromisso(id: string): Promise<void> {
  const { error } = await supabase.from("compromissos").delete().eq("id", id);
  if (error) throw traduzErro(error, "remover o compromisso");
}

// --- montagem do calendário -----------------------------------------------

/** Todos os dias de data_inicio até data_fim, inclusive. */
function diasDaFaixa(inicio: string, fim: string | null): string[] {
  const dias: string[] = [inicio];
  if (!fim || fim === inicio) return dias;

  const corrente = new Date(`${inicio}T00:00:00`);
  const limite = new Date(`${fim}T00:00:00`);
  while (corrente < limite) {
    corrente.setDate(corrente.getDate() + 1);
    dias.push(corrente.toISOString().slice(0, 10));
  }
  return dias;
}

function horaDoCompromisso(c: Compromisso): string | null {
  if (c.periodo === "dia") return null;
  if (c.periodo === "manha") return "manhã";
  if (c.periodo === "tarde") return "tarde";
  const inicio = c.hora_inicio?.slice(0, 5);
  const fim = c.hora_fim?.slice(0, 5);
  if (!inicio) return null;
  return fim ? `${inicio}–${fim}` : inicio;
}

export interface AgendaDoPeriodo {
  eventos: EventoAgenda[];
  /** A camada de pagamento não pôde ser lida — o resto do calendário continua válido. */
  vencimentosIndisponiveis: boolean;
}

/**
 * Junta as quatro camadas do calendário numa lista só de eventos, já expandida
 * por dia: captações, prazos de entrega, reservas de tempo e vencimentos.
 */
export async function eventosDoPeriodo(de: string, ate: string): Promise<AgendaDoPeriodo> {
  const fora = `(${STATUS_FORA.join(",")})`;

  const [captacoes, entregas, compromissos, parcelas] = await Promise.all([
    supabase
      .from("job_datas")
      .select("id, data, hora_chamada, observacao, job:jobs!inner(id, titulo, status, cliente:clientes(nome))")
      .gte("data", de)
      .lte("data", ate)
      .not("job.status", "in", fora),

    supabase
      .from("jobs")
      .select("id, titulo, prazo_entrega, cliente:clientes(nome)")
      .gte("prazo_entrega", de)
      .lte("prazo_entrega", ate)
      .not("status", "in", fora),

    listarCompromissos(de, ate),

    supabase
      .from("parcelas")
      .select(
        "id, valor, data_prevista, confianca, job:jobs(id, titulo), contrato:contratos(descricao)"
      )
      .gte("data_prevista", de)
      .lte("data_prevista", ate),
  ]);

  if (captacoes.error) throw traduzErro(captacoes.error, "carregar as captações");
  if (entregas.error) throw traduzErro(entregas.error, "carregar os prazos");

  // A camada de pagamento é a única opcional: se ela falhar, o calendário ainda
  // vale por inteiro para a agenda de trabalho. Derrubar as outras três porque
  // o financeiro tropeçou seria trocar uma tela incompleta por nenhuma tela.
  const vencimentosIndisponiveis = Boolean(parcelas.error);

  const eventos: EventoAgenda[] = [];

  for (const d of captacoes.data ?? []) {
    const job = d.job as unknown as { id: string; titulo: string; cliente: { nome: string } | null };
    eventos.push({
      chave: `cap-${d.id}`,
      camada: "captacao",
      firmeza: "dura",
      data: d.data,
      titulo: job.titulo,
      detalhe: job.cliente?.nome ?? null,
      hora: d.hora_chamada ? d.hora_chamada.slice(0, 5) : null,
      jobId: job.id,
      compromissoId: null,
    });
  }

  for (const j of entregas.data ?? []) {
    const cliente = j.cliente as unknown as { nome: string } | null;
    eventos.push({
      chave: `ent-${j.id}`,
      camada: "entrega",
      firmeza: "dura",
      data: j.prazo_entrega as string,
      titulo: j.titulo,
      detalhe: cliente?.nome ?? null,
      hora: null,
      jobId: j.id,
      compromissoId: null,
    });
  }

  for (const c of compromissos) {
    for (const dia of diasDaFaixa(c.data_inicio, c.data_fim)) {
      if (dia < de || dia > ate) continue;
      eventos.push({
        chave: `cmp-${c.id}-${dia}`,
        camada: "edicao",
        firmeza: "macia",
        data: dia,
        titulo: c.titulo || c.job?.titulo || ROTULO_COMPROMISSO[c.tipo],
        detalhe: ROTULO_COMPROMISSO[c.tipo],
        hora: horaDoCompromisso(c),
        jobId: c.job_id,
        compromissoId: c.id,
      });
    }
  }

  for (const p of vencimentosIndisponiveis ? [] : (parcelas.data ?? [])) {
    const job = p.job as unknown as { id: string; titulo: string } | null;
    const contrato = p.contrato as unknown as { descricao: string } | null;
    eventos.push({
      chave: `pag-${p.id}`,
      camada: "pagamento",
      firmeza: "macia",
      data: p.data_prevista as string,
      titulo: job?.titulo ?? contrato?.descricao ?? "Parcela",
      detalhe: Number(p.valor).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0,
      }),
      hora: null,
      jobId: job?.id ?? null,
      compromissoId: null,
    });
  }

  eventos.sort((a, b) => a.data.localeCompare(b.data) || a.camada.localeCompare(b.camada));
  return { eventos, vencimentosIndisponiveis };
}

// --- conflitos (regra R2) -------------------------------------------------

export interface Conflito {
  nivel: "forte" | "leve";
  mensagem: string;
  eventos: EventoAgenda[];
}

/**
 * Regra R2 em código.
 *
 * Dois compromissos DUROS no mesmo dia — duas captações, ou captação em cima de
 * prazo de entrega — são alerta forte: têm cliente do outro lado e não remarcam
 * sozinhos. Um duro caindo sobre um MACIO é aviso leve: bloco de edição é acordo
 * seu com você mesmo e pode ser movido.
 *
 * Tratar os dois igual é o caminho para você ignorar todo alerta, ou para o
 * sistema te impedir de trabalhar.
 */
export function conflitosDoDia(
  eventosDoDia: EventoAgenda[],
  firmezaDoNovo: Firmeza = "dura"
): Conflito | null {
  // Pagamento nao disputa agenda: vencimento no mesmo dia de captacao nao e conflito.
  const doTempo = eventosDoDia.filter((e) => CAMADAS_DE_TEMPO.includes(e.camada));
  const duros = doTempo.filter((e) => e.firmeza === "dura");
  const macios = doTempo.filter((e) => e.firmeza === "macia");

  if (firmezaDoNovo === "dura" && duros.length > 0) {
    return {
      nivel: "forte",
      mensagem:
        duros.length === 1
          ? `Já existe compromisso firme neste dia: ${duros[0].titulo}. Os dois têm cliente do outro lado.`
          : `Já existem ${duros.length} compromissos firmes neste dia.`,
      eventos: duros,
    };
  }

  if (firmezaDoNovo === "macia" && duros.length > 0) {
    return {
      nivel: "leve",
      mensagem: `Neste dia você já tem ${duros[0].titulo}. Dá para reservar edição mesmo assim — só saiba que o dia não está livre.`,
      eventos: duros,
    };
  }

  if (firmezaDoNovo === "dura" && macios.length > 0) {
    return {
      nivel: "leve",
      mensagem: `Você tinha edição reservada neste dia (${macios[0].titulo}). Quer remarcar depois?`,
      eventos: macios,
    };
  }

  return null;
}

/** Dias com mais de um compromisso duro — o que o calendário marca em vermelho. */
export function diasEmConflito(eventos: EventoAgenda[]): Set<string> {
  const conta = new Map<string, number>();
  for (const e of eventos) {
    if (!CAMADAS_DE_TEMPO.includes(e.camada)) continue;
    if (FIRMEZA_DA_CAMADA[e.camada] !== "dura") continue;
    conta.set(e.data, (conta.get(e.data) ?? 0) + 1);
  }
  return new Set([...conta.entries()].filter(([, n]) => n > 1).map(([dia]) => dia));
}
