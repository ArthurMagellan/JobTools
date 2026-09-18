import { useEffect, useState } from "react";
import { atualizarContrato, criarContrato } from "../../data/financeiro";
import { listarClientes } from "../../data/clientes";
import { hojeISO } from "../../lib/formato";
import {
  ROTULO_CONTRATO,
  type Cliente,
  type ContratoCompleto,
  type StatusContrato,
} from "../../data/types";
import { Area, Aviso, Botao, Campo, Modal, Selecao } from "../../components/ui";

type Rascunho = {
  cliente_id: string;
  descricao: string;
  valor_mensal: string;
  dia_vencimento: string;
  data_inicio: string;
  data_fim: string;
  escopo_incluso: string;
  status: StatusContrato;
};

export function ModalContrato({
  aberto,
  contrato,
  aoFechar,
  aoSalvar,
}: {
  aberto: boolean;
  contrato?: ContratoCompleto | null;
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [r, setR] = useState<Rascunho>({
    cliente_id: "",
    descricao: "",
    valor_mensal: "",
    dia_vencimento: "10",
    data_inicio: hojeISO(),
    data_fim: "",
    escopo_incluso: "",
    status: "ativo",
  });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setErro(null);
    void listarClientes().then(setClientes).catch(() => undefined);

    if (contrato) {
      setR({
        cliente_id: contrato.cliente_id,
        descricao: contrato.descricao,
        valor_mensal: String(contrato.valor_mensal),
        dia_vencimento: String(contrato.dia_vencimento),
        data_inicio: contrato.data_inicio,
        data_fim: contrato.data_fim ?? "",
        escopo_incluso: contrato.escopo_incluso ?? "",
        status: contrato.status,
      });
    }
  }, [aberto, contrato]);

  function mudar<K extends keyof Rascunho>(campo: K, valor: Rascunho[K]) {
    setR((atual) => ({ ...atual, [campo]: valor }));
  }

  async function salvar() {
    if (!r.cliente_id) return setErro("Escolha o cliente do contrato.");
    if (!r.descricao.trim()) return setErro("Descreva o contrato.");
    if (!r.valor_mensal) return setErro("Informe o valor mensal.");

    setSalvando(true);
    setErro(null);

    const dados = {
      cliente_id: r.cliente_id,
      descricao: r.descricao.trim(),
      valor_mensal: Number(r.valor_mensal),
      dia_vencimento: Number(r.dia_vencimento),
      data_inicio: r.data_inicio,
      data_fim: r.data_fim || null,
      escopo_incluso: r.escopo_incluso || null,
      status: r.status,
    };

    try {
      if (contrato) await atualizarContrato(contrato.id, dados);
      else await criarContrato(dados);
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
      titulo={contrato ? "Editar contrato" : "Novo contrato"}
      aoFechar={aoFechar}
      largo
      rodape={
        <>
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

        <Selecao
          rotulo="Cliente"
          value={r.cliente_id}
          onChange={(e) => mudar("cliente_id", e.target.value)}
        >
          <option value="">Escolha</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
              {c.empresa ? ` · ${c.empresa}` : ""}
            </option>
          ))}
        </Selecao>

        <Campo
          rotulo="Descrição"
          value={r.descricao}
          onChange={(e) => mudar("descricao", e.target.value)}
          placeholder="Social media — Padaria do Léo"
        />

        <Campo
          rotulo="Valor mensal"
          type="number"
          min={0}
          step="0.01"
          value={r.valor_mensal}
          onChange={(e) => mudar("valor_mensal", e.target.value)}
          placeholder="1500"
        />

        <Campo
          rotulo="Dia de vencimento"
          type="number"
          min={1}
          max={28}
          value={r.dia_vencimento}
          onChange={(e) => mudar("dia_vencimento", e.target.value)}
          dica="Até 28, para existir em todo mês."
        />

        <Campo
          rotulo="Início"
          type="date"
          value={r.data_inicio}
          onChange={(e) => mudar("data_inicio", e.target.value)}
        />

        <Campo
          rotulo="Fim"
          opcional
          type="date"
          value={r.data_fim}
          min={r.data_inicio}
          onChange={(e) => mudar("data_fim", e.target.value)}
          dica="Vazio = indeterminado."
        />

        <Selecao
          rotulo="Situação"
          largo
          value={r.status}
          onChange={(e) => mudar("status", e.target.value as StatusContrato)}
          dica="Só contrato ativo gera mensalidade e entra na receita garantida."
        >
          {(Object.keys(ROTULO_CONTRATO) as StatusContrato[]).map((s) => (
            <option key={s} value={s}>
              {ROTULO_CONTRATO[s]}
            </option>
          ))}
        </Selecao>

        <Area
          rotulo="O que está incluso"
          opcional
          largo
          value={r.escopo_incluso}
          onChange={(e) => mudar("escopo_incluso", e.target.value)}
          placeholder="4 reels + 1 sessão de fotos por mês"
        />

        <p className="campo__dica grade__largo">
          Job marcado como <strong>incluso no contrato</strong> não tem valor próprio: o dinheiro
          dele já está nesta mensalidade. Somar os dois contaria duas vezes.
        </p>
      </div>
    </Modal>
  );
}
