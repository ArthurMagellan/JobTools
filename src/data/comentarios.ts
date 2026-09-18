import { supabase } from "../lib/supabase";
import { traduzErro } from "./base";
import type { Comentario } from "./types";

/** Notas suas e eventos de histórico no mesmo fio, em ordem cronológica. */
export async function listarComentarios(jobId: string): Promise<Comentario[]> {
  const { data, error } = await supabase
    .from("comentarios")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });

  if (error) throw traduzErro(error, "carregar os comentários");
  return data ?? [];
}

export async function criarComentario(jobId: string, texto: string): Promise<Comentario> {
  const { data, error } = await supabase
    .from("comentarios")
    .insert({ job_id: jobId, texto: texto.trim(), tipo: "nota" })
    .select()
    .single();

  if (error) throw traduzErro(error, "salvar o comentário");
  return data;
}

export async function removerComentario(id: string): Promise<void> {
  const { error } = await supabase.from("comentarios").delete().eq("id", id);
  if (error) throw traduzErro(error, "remover o comentário");
}
