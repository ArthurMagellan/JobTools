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
