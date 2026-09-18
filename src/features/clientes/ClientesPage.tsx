import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { dadosFiscaisFaltando, listarClientes } from "../../data/clientes";
import type { Cliente } from "../../data/types";
import { Aviso, Botao, Campo, Carregando, Etiqueta } from "../../components/ui";
import { ModalCliente } from "./ClienteForm";
import "./clientes.css";

export function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [modalAberto, setModalAberto] = useState(false);

  useEffect(() => {
    void carregar();
  }, []);

  async function carregar() {
    setCarregando(true);
    try {
      setClientes(await listarClientes());
      setErro(null);
    } catch (falha) {
      setErro((falha as Error).message);
    } finally {
      setCarregando(false);
    }
  }

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return clientes;
    return clientes.filter((c) =>
      [c.nome, c.empresa, c.instagram].filter(Boolean).join(" ").toLowerCase().includes(termo)
    );
  }, [clientes, busca]);

  return (
    <>
      <header className="pagina__topo">
        <div className="pagina__titulo">
          <h1>Clientes</h1>
          <span className="pagina__sub">
            {clientes.length === 0
              ? "Nenhum cliente ainda"
              : `${clientes.length} ${clientes.length === 1 ? "cliente" : "clientes"}`}
          </span>
        </div>
        <div className="pagina__acoes">
          <Botao variante="principal" onClick={() => setModalAberto(true)}>
            Novo cliente
          </Botao>
        </div>
      </header>

      {erro && <Aviso tom="erro">{erro}</Aviso>}

      {clientes.length > 0 && (
        <div className="clientes__busca">
          <Campo
            rotulo="Buscar"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nome, empresa ou @"
          />
        </div>
      )}

      {carregando ? (
        <Carregando texto="Carregando clientes" />
      ) : filtrados.length === 0 ? (
        <p className="vazio">
          {clientes.length === 0
            ? "Cadastre o primeiro cliente. Só o nome é obrigatório — o resto entra depois."
            : "Nenhum cliente com esse termo."}
        </p>
      ) : (
        <ul className="clientes__lista">
          {filtrados.map((c) => {
            const faltando = dadosFiscaisFaltando(c);
            return (
              <li key={c.id}>
                <Link to={`/clientes/${c.id}`} className="cliente">
                  <div className="cliente__identidade">
                    <span className="cliente__nome">{c.nome}</span>
                    {c.empresa && <span className="cliente__empresa">{c.empresa}</span>}
                  </div>

                  <div className="cliente__marcas">
                    {c.prazo_pagamento_dias !== null && (
                      <Etiqueta title="Prazo de pagamento padrão">
                        {c.prazo_pagamento_dias === 0
                          ? "à vista"
                          : `${c.prazo_pagamento_dias} dias`}
                      </Etiqueta>
                    )}
                    {faltando.length > 0 && (
                      <Etiqueta
                        tom="atencao"
                        title={`Falta ${faltando.join(" e ")} para emitir nota. Não impede nada.`}
                      >
                        falta {faltando[0]}
                      </Etiqueta>
                    )}
                  </div>

                  <span className="cliente__contato mono">{c.whatsapp || c.email || ""}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <ModalCliente
        aberto={modalAberto}
        aoFechar={() => setModalAberto(false)}
        aoSalvar={(novo) => setClientes((atual) => [...atual, novo].sort((a, b) => a.nome.localeCompare(b.nome)))}
      />
    </>
  );
}
