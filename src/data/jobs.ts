import { supabase } from "../lib/supabase";
import { limpo, traduzErro } from "./base";
import { STATUS_FORA, type Job, type JobCompleto, type JobData, type JobEntrada, type Status } from "./types";

const SELECT_COMPLETO =
  "*, cliente:clientes(id, nome), datas:job_datas(*), parcelas(id, valor, confianca, data_prevista, nf_emitida)";

function ordenaDatas(job: JobCompleto): JobCompleto {
  return { ...job, datas: [...(job.datas ?? [])].sort((a, b) => a.data.localeCompare(b.data)) };
}

/**
 * Todos os jobs que aparecem no quadro. Perdidos e cancelados ficam de fora:
 * eles saem da vista na hora e vivem só nos relatórios (regra R3).
 */
export async function listarJobsDoQuadro(): Promise<JobCompleto[]> {
  const { data, error } = await supabase
    .from("jobs")
    .select(SELECT_COMPLETO)
    .not("status", "in", `(${STATUS_FORA.join(",")})`)
    .order("prazo_entrega", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) throw traduzErro(error, "carregar o quadro");
  return (data ?? []).map(ordenaDatas);
}

/** Jobs fora do quadro — perdidos e cancelados, preservados para métrica. */
export async function listarJobsFora(): Promise<JobCompleto[]> {
  const { data, error } = await supabase
    .from("jobs")
    .select(SELECT_COMPLETO)
    .in("status", STATUS_FORA)
    .order("saiu_em", { ascending: false });

  if (error) throw traduzErro(error, "carregar os jobs encerrados");
  return (data ?? []).map(ordenaDatas);
}

export async function listarJobsDoCliente(clienteId: string): Promise<JobCompleto[]> {
  const { data, error } = await supabase
    .from("jobs")
    .select(SELECT_COMPLETO)
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: false });

  if (error) throw traduzErro(error, "carregar os jobs do cliente");
  return (data ?? []).map(ordenaDatas);
}

export async function obterJob(id: string): Promise<JobCompleto | null> {
  const { data, error } = await supabase
    .from("jobs")
    .select(SELECT_COMPLETO)
    .eq("id", id)
    .maybeSingle();

  if (error) throw traduzErro(error, "carregar o job");
  return data ? ordenaDatas(data) : null;
}

export async function criarJob(entrada: JobEntrada): Promise<Job> {
  const { data, error } = await supabase.from("jobs").insert(limpo({ ...entrada })).select().single();
  if (error) throw traduzErro(error, "salvar o job");
  return data;
}

export async function atualizarJob(id: string, mudancas: Partial<JobEntrada>): Promise<Job> {
  const { data, error } = await supabase
    .from("jobs")
    .update(limpo({ ...mudancas }))
    .eq("id", id)
    .select()
    .single();

  if (error) throw traduzErro(error, "salvar o job");
  return data;
}

/** Mover de coluna no quadro. */
export async function mudarStatus(id: string, status: Status): Promise<void> {
  const { error } = await supabase
    .from("jobs")
    .update({ status, motivo_saida: null, saiu_em: null })
    .eq("id", id);

  if (error) throw traduzErro(error, "mover o job");
}

/**
 * Tirar o job do quadro. Perdido = orçamento que nunca virou trabalho;
 * cancelado = era aprovado e caiu no meio do caminho (regra R3).
 */
export async function tirarDoQuadro(
  id: string,
  status: Extract<Status, "perdido" | "cancelado">,
  motivo: string
): Promise<void> {
  const { error } = await supabase
    .from("jobs")
    .update({ status, motivo_saida: motivo || null, saiu_em: new Date().toISOString() })
    .eq("id", id);

  if (error) throw traduzErro(error, "encerrar o job");
}

export async function excluirJob(id: string): Promise<void> {
  const { error } = await supabase.from("jobs").delete().eq("id", id);
  if (error) throw traduzErro(error, "excluir o job");
}

// --- datas de captação ----------------------------------------------------
// Uma lista, nunca um campo só: evento de dois dias, regravação, diária extra.

export async function adicionarData(
  jobId: string,
  entrada: Pick<JobData, "data"> & Partial<JobData>
): Promise<JobData> {
  const { data, error } = await supabase
    .from("job_datas")
    .insert(limpo({ ...entrada, job_id: jobId }))
    .select()
    .single();

  if (error) throw traduzErro(error, "salvar a data de captação");
  return data;
}

export async function removerData(id: string): Promise<void> {
  const { error } = await supabase.from("job_datas").delete().eq("id", id);
  if (error) throw traduzErro(error, "remover a data");
}

/**
 * Captação é data dura: tem cliente do outro lado e não remarca sozinha (regra R2).
 * Duas no mesmo dia merecem alerta forte — a fase 2 usa isto no calendário.
 */
export async function conflitosNaData(data: string, ignorarJobId?: string): Promise<JobCompleto[]> {
  const { data: linhas, error } = await supabase
    .from("job_datas")
    .select("job_id, jobs!inner(" + SELECT_COMPLETO + ")")
    .eq("data", data);

  if (error) throw traduzErro(error, "verificar conflitos de agenda");

  const jobs = (linhas ?? [])
    .map((l) => (l as unknown as { jobs: JobCompleto }).jobs)
    .filter((j) => j && j.id !== ignorarJobId && !STATUS_FORA.includes(j.status));

  return jobs.map(ordenaDatas);
}
