/**
 * Geração de CSV. Cálculo puro, sem banco — e por isso testável.
 *
 * Escapar parece trivial até o primeiro cliente chamado "Silva, Souza & Cia" ou
 * um comentário com quebra de linha: sem aspas no lugar certo, a planilha abre
 * com as colunas desalinhadas e o arquivo vira lixo silencioso.
 */

/** Separador. O Excel em português espera ponto e vírgula, não vírgula. */
const SEP = ";";

function celula(valor: unknown): string {
  if (valor === null || valor === undefined) return "";

  if (typeof valor === "boolean") return valor ? "sim" : "não";

  if (typeof valor === "object") {
    // Objetos aninhados viram JSON na célula em vez de "[object Object]".
    return celula(JSON.stringify(valor));
  }

  const texto = String(valor);

  // Aspas, separador ou quebra de linha obrigam a envolver em aspas, e as
  // aspas internas dobram. É a regra do RFC 4180.
  if (texto.includes('"') || texto.includes(SEP) || texto.includes("\n") || texto.includes("\r")) {
    return `"${texto.replace(/"/g, '""')}"`;
  }

  return texto;
}

/**
 * Monta o CSV a partir de uma lista de registros.
 * As colunas saem na ordem em que aparecem no primeiro registro, e qualquer
 * campo que só exista em registros posteriores entra no fim.
 */
export function paraCSV(registros: Record<string, unknown>[]): string {
  if (registros.length === 0) return "";

  const colunas: string[] = [];
  for (const r of registros) {
    for (const chave of Object.keys(r)) {
      if (!colunas.includes(chave)) colunas.push(chave);
    }
  }

  const linhas = [
    colunas.join(SEP),
    ...registros.map((r) => colunas.map((c) => celula(r[c])).join(SEP)),
  ];

  return linhas.join("\r\n");
}

/**
 * O BOM é o que faz o Excel abrir acentos corretamente. Sem ele, "Captação"
 * vira "CaptaÃ§Ã£o" — e o arquivo parece corrompido sem estar.
 */
export function comBOM(csv: string): string {
  return `﻿${csv}`;
}

/** Nome de arquivo com a data, para os exports não se sobrescreverem. */
export function nomeDoExport(agora = new Date()): string {
  const d = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(
    agora.getDate()
  ).padStart(2, "0")}`;
  return `jobtools-${d}`;
}
