import { useEffect, useState } from "react";
import { atualizarCliente, criarCliente } from "../../data/clientes";
import type { Cliente } from "../../data/types";
import { Area, Aviso, Botao, Campo, Modal, Selecao } from "../../components/ui";

type Rascunho = {
  nome: string;
  empresa: string;
  tipo: "" | "pf" | "pj";
  cpf_cnpj: string;
  endereco: string;
  whatsapp: string;
  email: string;
  instagram: string;
  prazo_pagamento_dias: string;
  observacoes: string;
};

const VAZIO: Rascunho = {
  nome: "",
  empresa: "",
  tipo: "",
  cpf_cnpj: "",
  endereco: "",
  whatsapp: "",
  email: "",
  instagram: "",
  prazo_pagamento_dias: "",
  observacoes: "",
};

function paraRascunho(c: Cliente): Rascunho {
  return {
    nome: c.nome,
    empresa: c.empresa ?? "",
    tipo: c.tipo ?? "",
    cpf_cnpj: c.cpf_cnpj ?? "",
    endereco: c.endereco ?? "",
    whatsapp: c.whatsapp ?? "",
    email: c.email ?? "",
    instagram: c.instagram ?? "",
    prazo_pagamento_dias:
      c.prazo_pagamento_dias === null ? "" : String(c.prazo_pagamento_dias),
    observacoes: c.observacoes ?? "",
  };
}

/**
 * Formulário de cliente. Só o nome é exigido (regra R4) — o resto entra depois,
 * com calma, e pode ser editado a qualquer momento.
 */
export function ModalCliente({
  aberto,
  cliente,
  aoFechar,
  aoSalvar,
}: {
  aberto: boolean;
  cliente?: Cliente | null;
  aoFechar: () => void;
  aoSalvar: (cliente: Cliente) => void;
}) {
  const [r, setR] = useState<Rascunho>(VAZIO);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (aberto) {
      setR(cliente ? paraRascunho(cliente) : VAZIO);
      setErro(null);
    }
  }, [aberto, cliente]);

  function mudar<K extends keyof Rascunho>(campo: K, valor: Rascunho[K]) {
    setR((atual) => ({ ...atual, [campo]: valor }));
  }

  async function salvar() {
    if (!r.nome.trim()) {
      setErro("O nome é o único campo obrigatório — preencha ao menos ele.");
      return;
    }
    setSalvando(true);
    setErro(null);

    const dados = {
      nome: r.nome.trim(),
      empresa: r.empresa,
      tipo: r.tipo === "" ? null : r.tipo,
      cpf_cnpj: r.cpf_cnpj,
      endereco: r.endereco,
      whatsapp: r.whatsapp,
      email: r.email,
      instagram: r.instagram,
      prazo_pagamento_dias:
        r.prazo_pagamento_dias === "" ? null : Number(r.prazo_pagamento_dias),
      observacoes: r.observacoes,
    };

    try {
      const salvo = cliente
        ? await atualizarCliente(cliente.id, dados)
        : await criarCliente(dados);
      aoSalvar(salvo);
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
      titulo={cliente ? "Editar cliente" : "Novo cliente"}
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

        <Campo
          rotulo="Nome"
          value={r.nome}
          onChange={(e) => mudar("nome", e.target.value)}
          placeholder="Ana Souza"
          required
          autoFocus
        />
        <Campo
          rotulo="Empresa"
          opcional
          value={r.empresa}
          onChange={(e) => mudar("empresa", e.target.value)}
          placeholder="Agência Meridiano"
        />

        <Selecao rotulo="Tipo" opcional value={r.tipo} onChange={(e) => mudar("tipo", e.target.value as Rascunho["tipo"])}>
          <option value="">Não definido</option>
          <option value="pf">Pessoa física</option>
          <option value="pj">Pessoa jurídica</option>
        </Selecao>
        <Campo
          rotulo="CPF / CNPJ"
          opcional
          value={r.cpf_cnpj}
          onChange={(e) => mudar("cpf_cnpj", e.target.value)}
          dica="Só importa na hora de emitir nota."
        />

        <Campo
          rotulo="WhatsApp"
          opcional
          value={r.whatsapp}
          onChange={(e) => mudar("whatsapp", e.target.value)}
          inputMode="tel"
        />
        <Campo
          rotulo="E-mail"
          opcional
          type="email"
          value={r.email}
          onChange={(e) => mudar("email", e.target.value)}
        />

        <Campo
          rotulo="Instagram"
          opcional
          value={r.instagram}
          onChange={(e) => mudar("instagram", e.target.value)}
          placeholder="@estudio"
        />
        <Campo
          rotulo="Prazo de pagamento"
          opcional
          type="number"
          min={0}
          value={r.prazo_pagamento_dias}
          onChange={(e) => mudar("prazo_pagamento_dias", e.target.value)}
          placeholder="30"
          dica="Em dias. 0 = à vista. A fase 3 usa isto para prever a data de cada parcela."
        />

        <Campo
          rotulo="Endereço"
          opcional
          largo
          value={r.endereco}
          onChange={(e) => mudar("endereco", e.target.value)}
        />

        <Area
          rotulo="Observações"
          opcional
          largo
          value={r.observacoes}
          onChange={(e) => mudar("observacoes", e.target.value)}
          placeholder="Como gosta da cor, prazos típicos, quem aprova…"
        />
      </div>
    </Modal>
  );
}
