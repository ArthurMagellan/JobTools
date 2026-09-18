import { supabase } from "../lib/supabase";
import { limpo, traduzErro } from "./base";
import type { Link } from "./types";

export async function listarLinks(jobId: string): Promise<Link[]> {
  const { data, error } = await supabase
    .from("links")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at");

  if (error) throw traduzErro(error, "carregar os links");
  return data ?? [];
}

export async function criarLink(
  jobId: string,
  entrada: Pick<Link, "rotulo" | "url"> & Partial<Link>
): Promise<Link> {
  const { data, error } = await supabase
    .from("links")
    .insert(limpo({ ...entrada, job_id: jobId }))
    .select()
    .single();

  if (error) throw traduzErro(error, "salvar o link");
  return data;
}

export async function removerLink(id: string): Promise<void> {
  const { error } = await supabase.from("links").delete().eq("id", id);
  if (error) throw traduzErro(error, "remover o link");
}

/**
 * Serviço de transferência expira. Saber a validade permite avisar antes de o
 * link morrer — o alerta em si é fase 4, mas o dado já é guardado agora.
 */
export function diasParaExpirar(link: Link): number | null {
  if (!link.validade) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const validade = new Date(`${link.validade}T00:00:00`);
  return Math.round((validade.getTime() - hoje.getTime()) / 86_400_000);
}
