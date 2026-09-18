/** Datas em português, sem biblioteca. O banco guarda ISO (aaaa-mm-dd). */

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function paraDate(iso: string): Date {
  // Sem fuso: "2026-03-10" precisa virar 10/03 em qualquer lugar do mundo.
  return new Date(`${iso.slice(0, 10)}T00:00:00`);
}

export function dataCurta(iso: string | null): string {
  if (!iso) return "—";
  const d = paraDate(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function dataCompleta(iso: string | null): string {
  if (!iso) return "—";
  const d = paraDate(iso);
  return `${DIAS[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}/${String(
    d.getMonth() + 1
  ).padStart(2, "0")}/${d.getFullYear()}`;
}

export function horaCurta(hora: string | null): string {
  if (!hora) return "";
  return hora.slice(0, 5);
}

export function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/** Negativo = já passou. */
export function diasAte(iso: string | null): number | null {
  if (!iso) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((paraDate(iso).getTime() - hoje.getTime()) / 86_400_000);
}

export function prazoEmPalavras(iso: string | null): string {
  const dias = diasAte(iso);
  if (dias === null) return "sem prazo";
  if (dias < 0) return `atrasado ${Math.abs(dias)}d`;
  if (dias === 0) return "entrega hoje";
  if (dias === 1) return "entrega amanhã";
  return `faltam ${dias}d`;
}

export function quandoRelativo(isoComHora: string): string {
  const dias = diasAte(isoComHora.slice(0, 10));
  if (dias === null) return "";
  if (dias === 0) return "hoje";
  if (dias === -1) return "ontem";
  if (dias < 0) return `há ${Math.abs(dias)} dias`;
  return dataCurta(isoComHora);
}

/** Cachê em reais. Nulo vira travessão — job sem valor não é job de valor zero. */
export function moeda(valor: number | null): string {
  if (valor === null || valor === undefined) return "—";
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

/** Versão curta para o cartão do quadro: R$ 3,5 mil em vez de R$ 3.000,00. */
export function moedaCurta(valor: number | null): string {
  if (valor === null || valor === undefined) return "";
  if (valor >= 1000) {
    const mil = valor / 1000;
    const texto = Number.isInteger(mil) ? String(mil) : mil.toFixed(1).replace(".", ",");
    return `R$ ${texto} mil`;
  }
  return `R$ ${valor.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}
