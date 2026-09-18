/** Tipos e vocabulário do domínio. Espelha supabase/schema.sql. */

export type TipoJob = "video" | "foto" | "ambos";
export type FormaCobranca = "avulso" | "incluso" | "extra";
export type TipoLink = "bruto" | "backup" | "entrega" | "referencia" | "contrato";
export type TipoComentario = "nota" | "historico";

export type Status =
  | "orcamento"
  | "aprovado"
  | "captacao"
  | "backup"
  | "edicao"
  | "com_cliente"
  | "ajustes"
  | "entregue"
  | "concluido"
  | "perdido"
  | "cancelado";

/** As colunas do quadro, na ordem. */
export const STATUS_QUADRO: Status[] = [
  "orcamento",
  "aprovado",
  "captacao",
  "backup",
  "edicao",
  "com_cliente",
  "ajustes",
  "entregue",
  "concluido",
];

/**
 * Saídas do quadro. Perdido e cancelado significam coisas diferentes (regra R3):
 * perdido nunca virou trabalho e mede conversão de propostas; cancelado era
 * aprovado e caiu, e mede furo de agenda. Os dois somem do quadro na hora.
 */
export const STATUS_FORA: Status[] = ["perdido", "cancelado"];

export const ROTULO_STATUS: Record<Status, string> = {
  orcamento: "Orçamento",
  aprovado: "Aprovado",
  captacao: "Captação",
  backup: "Backup",
  edicao: "Edição",
  com_cliente: "Com cliente",
  ajustes: "Ajustes",
  entregue: "Entregue",
  concluido: "Concluído",
  perdido: "Perdido",
  cancelado: "Cancelado",
};

/** Explicação curta mostrada no topo de cada coluna. */
export const AJUDA_STATUS: Partial<Record<Status, string>> = {
  backup: "Material ainda em um lugar só. Não sai daqui sem estar em dois.",
  com_cliente: "Aguardando aprovação — é aqui que job some sem ninguém notar.",
};

export const ROTULO_TIPO: Record<TipoJob, string> = {
  video: "Vídeo",
  foto: "Foto",
  ambos: "Vídeo e foto",
};

export const ROTULO_COBRANCA: Record<FormaCobranca, string> = {
  avulso: "Avulso",
  incluso: "Incluso no contrato",
  extra: "Extra do contrato",
};

export const ROTULO_LINK: Record<TipoLink, string> = {
  bruto: "Bruto",
  backup: "Backup",
  entrega: "Entrega",
  referencia: "Referência",
  contrato: "Contrato",
};

export interface Cliente {
  id: string;
  nome: string;
  empresa: string | null;
  tipo: "pf" | "pj" | null;
  cpf_cnpj: string | null;
  endereco: string | null;
  whatsapp: string | null;
  email: string | null;
  instagram: string | null;
  prazo_pagamento_dias: number | null;
  observacoes: string | null;
  arquivado: boolean;
  created_at: string;
  updated_at: string;
}

export interface Contato {
  id: string;
  cliente_id: string;
  nome: string;
  papel: string | null;
  telefone: string | null;
  email: string | null;
  created_at: string;
}

export interface JobData {
  id: string;
  job_id: string;
  data: string;
  hora_chamada: string | null;
  duracao_horas: number | null;
  observacao: string | null;
  created_at: string;
}

export interface Job {
  id: string;
  cliente_id: string;
  titulo: string;
  tipo: TipoJob;
  escopo_captacao: boolean;
  escopo_edicao: boolean;
  escopo_tratamento: boolean;
  local: string | null;
  local_url: string | null;
  prazo_entrega: string | null;
  status: Status;
  forma_cobranca: FormaCobranca;
  contrato_id: string | null;
  valor_fechado: number | null;
  equipe: string | null;
  briefing: string | null;
  motivo_saida: string | null;
  saiu_em: string | null;
  created_at: string;
  updated_at: string;
}

/** Job já com o cliente e as datas juntos — o que o quadro precisa por cartão. */
export interface JobCompleto extends Job {
  cliente: Pick<Cliente, "id" | "nome"> | null;
  datas: JobData[];
  parcelas: ParcelaNoCartao[];
}

export interface Comentario {
  id: string;
  job_id: string;
  tipo: TipoComentario;
  texto: string;
  created_at: string;
}

export interface Link {
  id: string;
  job_id: string;
  rotulo: string;
  url: string;
  tipo: TipoLink;
  validade: string | null;
  created_at: string;
}

/** Campos que o formulário de cliente envia. Só nome é exigido (regra R4). */
export type ClienteEntrada = Partial<Omit<Cliente, "id" | "created_at" | "updated_at">> & {
  nome: string;
};

export type JobEntrada = Partial<Omit<Job, "id" | "created_at" | "updated_at">> & {
  titulo: string;
  cliente_id: string;
};

// ============================================================================
// AGENDA (fase 2)
// ============================================================================

export type TipoCompromisso = "edicao" | "tratamento" | "pessoal" | "outro";
export type PeriodoDia = "dia" | "manha" | "tarde" | "horario";

export const ROTULO_COMPROMISSO: Record<TipoCompromisso, string> = {
  edicao: "Edição",
  tratamento: "Tratamento de foto",
  pessoal: "Pessoal / folga",
  outro: "Outro",
};

/** Edição e tratamento existem para um job; folga é só sua. */
export const COMPROMISSO_PRECISA_JOB: TipoCompromisso[] = ["edicao", "tratamento"];

export const ROTULO_PERIODO: Record<PeriodoDia, string> = {
  dia: "Dia inteiro",
  manha: "Manhã",
  tarde: "Tarde",
  horario: "Horário exato",
};

export interface Compromisso {
  id: string;
  tipo: TipoCompromisso;
  job_id: string | null;
  data_inicio: string;
  data_fim: string | null;
  periodo: PeriodoDia;
  hora_inicio: string | null;
  hora_fim: string | null;
  titulo: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompromissoCompleto extends Compromisso {
  job: { id: string; titulo: string } | null;
}

/**
 * As quatro camadas do calendário. Pagamento só ganha eventos na fase 3 —
 * até lá aparece na legenda, vazia, para o calendário não mentir sobre o que
 * ainda não sabe.
 */
export type CamadaAgenda = "captacao" | "entrega" | "edicao" | "pagamento";

/**
 * Regra R2. Compromisso DURO tem cliente do outro lado e não remarca sozinho:
 * dois deles no mesmo dia é alerta forte. Compromisso MACIO é um acordo seu com
 * você mesmo — se uma captação cair em cima, o sistema avisa de leve e segue.
 */
export type Firmeza = "dura" | "macia";

export const ROTULO_CAMADA: Record<CamadaAgenda, string> = {
  captacao: "Captação",
  entrega: "Entrega",
  edicao: "Edição e folgas",
  pagamento: "Pagamento",
};

export const FIRMEZA_DA_CAMADA: Record<CamadaAgenda, Firmeza> = {
  captacao: "dura",
  entrega: "dura",
  edicao: "macia",
  // Pagamento nao ocupa o seu tempo: e informacao, nao compromisso.
  pagamento: "macia",
};

/**
 * As camadas que disputam a sua agenda. Pagamento fica de fora: dinheiro caindo
 * no mesmo dia de uma captacao nao e conflito de nada.
 */
export const CAMADAS_DE_TEMPO: CamadaAgenda[] = ["captacao", "entrega", "edicao"];

/** Um item desenhado no calendário, venha ele de onde vier. */
export interface EventoAgenda {
  chave: string;
  camada: CamadaAgenda;
  firmeza: Firmeza;
  data: string;
  titulo: string;
  detalhe: string | null;
  hora: string | null;
  jobId: string | null;
  compromissoId: string | null;
}

// ============================================================================
// FINANCEIRO (fase 3)
// ============================================================================

export type StatusContrato = "ativo" | "pausado" | "encerrado";
export type Confianca = "estimada" | "confirmada" | "paga";
export type FormaPagamento = "pix" | "boleto" | "transferencia" | "dinheiro" | "outro";

export const ROTULO_CONTRATO: Record<StatusContrato, string> = {
  ativo: "Ativo",
  pausado: "Pausado",
  encerrado: "Encerrado",
};

export const ROTULO_CONFIANCA: Record<Confianca, string> = {
  estimada: "Estimada",
  confirmada: "Confirmada",
  paga: "Paga",
};

/** O que cada estágio quer dizer, para a interface não precisar explicar. */
export const AJUDA_CONFIANCA: Record<Confianca, string> = {
  estimada: "Data calculada pelo prazo padrão do cliente. Ainda é palpite.",
  confirmada: "O financeiro do cliente avisou a data. Dinheiro quase certo.",
  paga: "Caiu na conta.",
};

export const ROTULO_FORMA: Record<FormaPagamento, string> = {
  pix: "PIX",
  boleto: "Boleto",
  transferencia: "Transferência",
  dinheiro: "Dinheiro",
  outro: "Outro",
};

export interface Contrato {
  id: string;
  cliente_id: string;
  descricao: string;
  valor_mensal: number;
  dia_vencimento: number;
  data_inicio: string;
  data_fim: string | null;
  escopo_incluso: string | null;
  status: StatusContrato;
  created_at: string;
  updated_at: string;
}

export interface ContratoCompleto extends Contrato {
  cliente: Pick<Cliente, "id" | "nome"> | null;
}

export interface Parcela {
  id: string;
  job_id: string | null;
  contrato_id: string | null;
  competencia: string | null;
  descricao: string | null;
  valor: number;
  data_prevista: string;
  confianca: Confianca;
  data_efetiva: string | null;
  forma: FormaPagamento | null;
  nota: string | null;
  nf_emitida: boolean;
  nf_numero: string | null;
  /**
   * Quando a nota foi emitida. Muita empresa só começa a contar o prazo a partir
   * daqui — emitiu dia 20 com prazo de 30, o dinheiro cai dia 20 do mês seguinte.
   */
  data_nf: string | null;
  created_at: string;
  updated_at: string;
}

/** O prazo padrão do cliente vem junto: é ele que recalcula o vencimento. */
interface ClienteNaParcela {
  nome: string;
  prazo_pagamento_dias: number | null;
}

export interface ParcelaCompleta extends Parcela {
  job: { id: string; titulo: string; cliente: ClienteNaParcela | null } | null;
  contrato: { id: string; descricao: string; cliente: ClienteNaParcela | null } | null;
}

/**
 * As contas do mês. São quatro números porque "faturamento" significa quatro
 * coisas diferentes, e confundi-las é a fonte mais comum de decisão errada.
 */
export interface ResumoDoMes {
  recebido: number;
  aReceberConfirmado: number;
  aReceberEstimado: number;
  atrasado: number;
  garantido: number;
}

export interface MesPrevisto {
  competencia: string;
  confirmado: number;
  estimado: number;
}

/** O mínimo de financeiro que o cartão do quadro precisa mostrar. */
export interface ParcelaNoCartao {
  id: string;
  valor: number;
  confianca: Confianca;
  data_prevista: string;
  nf_emitida: boolean;
}
