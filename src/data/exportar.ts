import JSZip from "jszip";
import { supabase } from "../lib/supabase";
import { traduzErro } from "./base";
import { comBOM, nomeDoExport, paraCSV } from "../lib/csv";

/**
 * Export completo dos dados.
 *
 * É um RETRATO, não um fechamento de mês: cada arquivo gerado contém tudo desde
 * o primeiro cadastro. O último export sozinho já tem o ano inteiro — nunca é
 * preciso juntar doze arquivos.
 *
 * O pacote traz CSVs (para abrir no Excel e conferir número) e um JSON completo
 * (feio de ler, mas é o que permite restaurar se der ruim). Os identificadores
 * vão junto em todos: são eles que religam job a cliente, parcela a job.
 *
 * O que este arquivo NÃO protege: seus vídeos. O sistema guarda apenas os links,
 * nunca teve os arquivos. Seus brutos seguem dependendo do backup de HD e nuvem.
 */

const TABELAS = [
  "clientes",
  "contatos",
  "jobs",
  "job_datas",
  "comentarios",
  "links",
  "compromissos",
  "contratos",
  "parcelas",
] as const;

export interface ResultadoExport {
  arquivo: string;
  tabelas: { nome: string; registros: number; erro?: string }[];
  total: number;
}

async function lerTudo(tabela: string): Promise<Record<string, unknown>[]> {
  // Página de 1000 em 1000: o PostgREST limita a resposta, e um export
  // silenciosamente truncado é pior que nenhum export.
  const paginas: Record<string, unknown>[] = [];
  const tamanho = 1000;
  let inicio = 0;

  for (;;) {
    const { data, error } = await supabase
      .from(tabela)
      .select("*")
      .range(inicio, inicio + tamanho - 1);

    if (error) throw traduzErro(error, `exportar a tabela ${tabela}`);

    const lote = data ?? [];
    paginas.push(...lote);
    if (lote.length < tamanho) break;
    inicio += tamanho;
  }

  return paginas;
}

export async function exportarTudo(): Promise<ResultadoExport> {
  const zip = new JSZip();
  const resumo: ResultadoExport["tabelas"] = [];
  const completo: Record<string, unknown[]> = {};
  let total = 0;

  for (const tabela of TABELAS) {
    try {
      const registros = await lerTudo(tabela);
      completo[tabela] = registros;
      total += registros.length;
      resumo.push({ nome: tabela, registros: registros.length });

      if (registros.length > 0) {
        zip.file(`csv/${tabela}.csv`, comBOM(paraCSV(registros)));
      }
    } catch (falha) {
      // Uma tabela que falha não pode derrubar o export inteiro: é melhor
      // levar oito tabelas e saber qual faltou do que não levar nada.
      completo[tabela] = [];
      resumo.push({ nome: tabela, registros: 0, erro: (falha as Error).message });
    }
  }

  const base = nomeDoExport();

  zip.file(
    `${base}.json`,
    JSON.stringify({ exportado_em: new Date().toISOString(), dados: completo }, null, 2)
  );

  zip.file(
    "LEIA-ME.txt",
    [
      "JobTools — export completo dos dados",
      `Gerado em ${new Date().toLocaleString("pt-BR")}`,
      "",
      "O que tem aqui:",
      "  csv/        uma planilha por tabela, com acentos corretos no Excel",
      `  ${base}.json   tudo junto, para restaurar o sistema se precisar`,
      "",
      "Este arquivo é um retrato completo: contém tudo desde o primeiro",
      "cadastro, não apenas o mês corrente. O export mais recente basta.",
      "",
      "ATENÇÃO: isto NÃO é backup dos seus vídeos. O JobTools guarda apenas",
      "os links, nunca teve os arquivos. Seus brutos continuam dependendo do",
      "seu backup de HD e nuvem.",
      "",
      "Tabelas:",
      ...resumo.map((t) => `  ${t.nome.padEnd(14)} ${t.registros} registros${t.erro ? `  (FALHOU: ${t.erro})` : ""}`),
    ].join("\r\n")
  );

  const blob = await zip.generateAsync({ type: "blob" });
  baixar(blob, `${base}.zip`);

  return { arquivo: `${base}.zip`, tabelas: resumo, total };
}

function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Quando foi o último export, para o sistema poder cobrar. */
export function ultimoExport(): string | null {
  try {
    return localStorage.getItem("jobtools-ultimo-export");
  } catch {
    return null;
  }
}

export function registrarExport(): void {
  try {
    localStorage.setItem("jobtools-ultimo-export", new Date().toISOString());
  } catch {
    /* navegador sem armazenamento: só não lembra a data */
  }
}

/** Passou de 30 dias sem exportar? O blueprint combinou export mensal. */
export function exportVencido(): boolean {
  const ultimo = ultimoExport();
  if (!ultimo) return true;
  const dias = (Date.now() - new Date(ultimo).getTime()) / 86_400_000;
  return dias > 30;
}
