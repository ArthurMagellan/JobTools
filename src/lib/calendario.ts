/** Montagem das grades do calendário. Tudo em ISO (aaaa-mm-dd), sem fuso. */

export const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function deIso(s: string): Date {
  return new Date(`${s.slice(0, 10)}T00:00:00`);
}

export function somaDias(s: string, n: number): string {
  const d = deIso(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}

export function nomeDoMes(ano: number, mes: number): string {
  return `${MESES[mes]} de ${ano}`;
}

export function diaDoMes(s: string): number {
  return deIso(s).getDate();
}

export function ehDeOutroMes(s: string, mes: number): boolean {
  return deIso(s).getMonth() !== mes;
}

export function ehFimDeSemana(s: string): boolean {
  const dia = deIso(s).getDay();
  return dia === 0 || dia === 6;
}

/**
 * Grade do mês: sempre começa no domingo e termina no sábado, para as colunas
 * baterem. Traz 35 ou 42 dias, conforme o mês precise de cinco ou seis linhas.
 */
export function gradeDoMes(ano: number, mes: number): string[] {
  const primeiro = new Date(ano, mes, 1);
  const inicio = new Date(primeiro);
  inicio.setDate(1 - primeiro.getDay());

  const ultimo = new Date(ano, mes + 1, 0);
  const total = primeiro.getDay() + ultimo.getDate();
  const linhas = Math.ceil(total / 7);

  const dias: string[] = [];
  for (let i = 0; i < linhas * 7; i++) {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    dias.push(iso(d));
  }
  return dias;
}

/** Semana de domingo a sábado que contém a data. */
export function gradeDaSemana(dataISO: string): string[] {
  const d = deIso(dataISO);
  const domingo = new Date(d);
  domingo.setDate(d.getDate() - d.getDay());

  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(domingo);
    x.setDate(domingo.getDate() + i);
    return iso(x);
  });
}

export function proximosDias(dataISO: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => somaDias(dataISO, i));
}

export function primeiroEUltimo(dias: string[]): [string, string] {
  return [dias[0], dias[dias.length - 1]];
}

/**
 * Primeiro e último dia de uma competência ("2026-09").
 *
 * Existe porque montar o fim do mês como "-31" quebra em setembro, abril, junho,
 * novembro e fevereiro — o Postgres recusa a data e a tela inteira cai.
 */
export function inicioDoMes(competencia: string): string {
  return `${competencia}-01`;
}

export function fimDoMes(competencia: string): string {
  const [ano, mes] = competencia.split("-").map(Number);
  const ultimo = new Date(ano, mes, 0).getDate(); // dia 0 do mês seguinte = último deste
  return `${competencia}-${String(ultimo).padStart(2, "0")}`;
}
