import { useEffect, useState } from "react";
import { atualizarParcela, removerParcela } from "../../data/financeiro";
import { hojeISO } from "../../lib/formato";
import {
  AJUDA_CONFIANCA,
  ROTULO_CONFIANCA,
  ROTULO_FORMA,
  type Confianca,
  type FormaPagamento,
  type ParcelaCompleta,
} from "../../data/types";
import { Area, Aviso, Botao, Campo, Modal, Marcacao, Selecao } from "../../components/ui";

type Rascunho = {
  valor: string;
  data_prevista: string;
  confianca: Confianca;
  data_efetiva: string;
  forma: FormaPagamento | "";
  nota: string;
  nf_emitida: boolean;
  nf_numero: string;
};

/**
 * Editar uma parcela é, quase sempre, reagir ao e-mail do financeiro do cliente:
 * "será pago dia X". A data muda e a confiança sobe de estimada para confirmada
 * (regra R5) — e o histórico guarda a data anterior.
 */
export function ModalParcela({
  aberto,
  parcela,
  aoFechar,
  aoSalvar,
}: {
  aberto: boolean;
  parcela?: ParcelaCompleta | null;
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const [r, setR] = useState<Rascunho>({
    valor: "",
    data_prevista: "",
    confianca: "estimada",
    data_efetiva: "",
    forma: "",
    nota: "",
    nf_emitida: false,
    nf_numero: "",
  });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto || !parcela) return;
    setErro(null);
    setR({
      valor: String(parcela.valor),
      data_prevista: parcela.data_prevista,
      confianca: parcela.confianca,
      data_efetiva: parcela.data_efetiva ?? "",
      forma: parcela.forma ?? "",
      nota: parcela.nota ?? "",
      nf_emitida: parcela.nf_emitida,
      nf_numero: parcela.nf_numero ?? "",
    });
  }, [aberto, parcela]);

  function mudar<K extends keyof Rascunho>(campo: K, valor: Rascunho[K]) {
    setR((atual) => ({ ...atual, [campo]: valor }));
  }

  async function salvar() {
    if (!parcela) return;
    if (r.confianca === "paga" && !r.data_efetiva) {
      return setErro("Parcela paga precisa da data em que o dinheiro caiu.");
    }

    setSalvando(true);
    setErro(null);

    try {
      await atualizarParcela(parcela.id, {
        valor: Number(r.valor),
        data_prevista: r.data_prevista,
        confianca: r.confianca,
        data_efetiva: r.confianca === "paga" ? r.data_efetiva : null,
        forma: r.forma || null,
        nota: r.nota || null,
        nf_emitida: r.nf_emitida,
        nf_numero: r.nf_numero || null,
      });
      aoSalvar();
      aoFechar();
    } catch (falha) {
      setErro((falha as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto={aberto}
      titulo="Parcela"
      aoFechar={aoFechar}
      largo
      rodape={
        <>
          <Botao
            variante="perigo"
            onClick={() => {
              if (!parcela) return;
              void removerParcela(parcela.id).then(() => {
                aoSalvar();
                aoFechar();
              });
            }}
            disabled={salvando}
          >
            Excluir
          </Botao>
          <Botao onClick={aoFechar} disabled={salvando}>
            Cancelar
          </Botao>
          <Botao variante="principal" onClick={() => void salvar()} disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar"}
          </Botao>
        </>
      }
    >
      <div className="grade grade--2">
        {erro && (
          <div className="grade__largo">
            <Aviso tom="erro">{erro}</Aviso>
          </div>
        )}

        <Campo
          rotulo="Valor"
          type="number"
          min={0}
          step="0.01"
          value={r.valor}
          onChange={(e) => mudar("valor", e.target.value)}
        />

        <Campo
          rotulo="Vencimento previsto"
          type="date"
          value={r.data_prevista}
          onChange={(e) => mudar("data_prevista", e.target.value)}
        />

        <Selecao
          rotulo="Confiança"
          value={r.confianca}
          onChange={(e) => {
            const c = e.target.value as Confianca;
            mudar("confianca", c);
            if (c === "paga" && !r.data_efetiva) mudar("data_efetiva", hojeISO());
          }}
          dica={AJUDA_CONFIANCA[r.confianca]}
        >
          {(Object.keys(ROTULO_CONFIANCA) as Confianca[]).map((c) => (
            <option key={c} value={c}>
              {ROTULO_CONFIANCA[c]}
            </option>
          ))}
        </Selecao>

        {r.confianca === "paga" && (
          <Campo
            rotulo="Caiu em"
            type="date"
            value={r.data_efetiva}
            onChange={(e) => mudar("data_efetiva", e.target.value)}
          />
        )}

        <Selecao
          rotulo="Forma"
          opcional
          value={r.forma}
          onChange={(e) => mudar("forma", e.target.value as FormaPagamento | "")}
        >
          <option value="">Não definida</option>
          {(Object.keys(ROTULO_FORMA) as FormaPagamento[]).map((f) => (
            <option key={f} value={f}>
              {ROTULO_FORMA[f]}
            </option>
          ))}
        </Selecao>

        <Campo
          rotulo="Número da NF"
          opcional
          value={r.nf_numero}
          onChange={(e) => mudar("nf_numero", e.target.value)}
        />

        <div className="grade__largo">
          <Marcacao
            rotulo="Nota fiscal emitida"
            checked={r.nf_emitida}
            onChange={(e) => mudar("nf_emitida", e.target.checked)}
          />
        </div>

        <Area
          rotulo="Nota"
          opcional
          largo
          value={r.nota}
          onChange={(e) => mudar("nota", e.target.value)}
          placeholder="Financeiro confirmou por e-mail em 12/03"
        />
      </div>
    </Modal>
  );
}
