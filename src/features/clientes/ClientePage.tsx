import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  arquivarCliente,
  criarContato,
  dadosFiscaisFaltando,
  listarContatos,
  obterCliente,
  removerContato,
} from "../../data/clientes";
import { listarJobsDoCliente } from "../../data/jobs";
import { ROTULO_STATUS, type Cliente, type Contato, type JobCompleto } from "../../data/types";
import { dataCurta } from "../../lib/formato";
import { Aviso, Botao, Campo, Carregando, Etiqueta, Painel } from "../../components/ui";
import { ModalCliente } from "./ClienteForm";
import "./clientes.css";

export function ClientePage() {
  const { id = "" } = useParams();
  const navegar = useNavigate();

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [jobs, setJobs] = useState<JobCompleto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);

  const [novoContato, setNovoContato] = useState({ nome: "", papel: "", telefone: "" });

  useEffect(() => {
    void (async () => {
      setCarregando(true);
      try {
        const [c, ct, js] = await Promise.all([
          obterCliente(id),
          listarContatos(id),
          listarJobsDoCliente(id),
        ]);
        setCliente(c);
        setContatos(ct);
        setJobs(js);
        setErro(null);
      } catch (falha) {
        setErro((falha as Error).message);
      } finally {
        setCarregando(false);
      }
    })();
  }, [id]);

  async function adicionarContato() {
    if (!novoContato.nome.trim()) return;
    try {
      const salvo = await criarContato(id, novoContato);
      setContatos((atual) => [...atual, salvo]);
      setNovoContato({ nome: "", papel: "", telefone: "" });
    } catch (falha) {
      setErro((falha as Error).message);
    }
  }

  async function alternarArquivo() {
    if (!cliente) return;
    try {
      await arquivarCliente(cliente.id, !cliente.arquivado);
      setCliente({ ...cliente, arquivado: !cliente.arquivado });
    } catch (falha) {
      setErro((falha as Error).message);
    }
  }

  if (carregando) return <Carregando texto="Carregando cliente" />;
  if (!cliente) {
    return (
      <>
        <Aviso tom="erro">Cliente não encontrado.</Aviso>
        <p style={{ marginTop: "var(--esp-3)" }}>
          <Link to="/clientes">Voltar para clientes</Link>
        </p>
      </>
    );
  }

  const faltando = dadosFiscaisFaltando(cliente);

  return (
    <>
      <header className="pagina__topo">
        <div className="pagina__titulo">
          <Link to="/clientes" className="mono" style={{ fontSize: "var(--texto-sm)" }}>
            ← Clientes
          </Link>
          <h1>{cliente.nome}</h1>
          {cliente.empresa && <span className="pagina__sub">{cliente.empresa}</span>}
        </div>
        <div className="pagina__acoes">
          <Botao onClick={alternarArquivo}>{cliente.arquivado ? "Reativar" : "Arquivar"}</Botao>
          <Botao variante="principal" onClick={() => setEditando(true)}>
            Editar
          </Botao>
        </div>
      </header>

      {erro && <Aviso tom="erro">{erro}</Aviso>}
      {faltando.length > 0 && (
        <div style={{ marginBottom: "var(--esp-4)" }}>
          <Aviso tom="atencao">
            Falta {faltando.join(" e ")} para emitir nota para este cliente. Não impede nada —
            preencha quando precisar.
          </Aviso>
        </div>
      )}

      <div className="ficha">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--esp-4)" }}>
          <Painel titulo="Dados">
            <dl className="dados">
              <div>
                <dt>Tipo</dt>
                <dd>{cliente.tipo === "pf" ? "Pessoa física" : cliente.tipo === "pj" ? "Pessoa jurídica" : "—"}</dd>
              </div>
              <div>
                <dt>CPF/CNPJ</dt>
                <dd>{cliente.cpf_cnpj || "—"}</dd>
              </div>
              <div>
                <dt>WhatsApp</dt>
                <dd>{cliente.whatsapp || "—"}</dd>
              </div>
              <div>
                <dt>E-mail</dt>
                <dd>{cliente.email || "—"}</dd>
              </div>
              <div>
                <dt>Instagram</dt>
                <dd>{cliente.instagram || "—"}</dd>
              </div>
              <div>
                <dt>Endereço</dt>
                <dd>{cliente.endereco || "—"}</dd>
              </div>
              <div>
                <dt>Pagamento</dt>
                <dd>
                  {cliente.prazo_pagamento_dias === null
                    ? "—"
                    : cliente.prazo_pagamento_dias === 0
                      ? "à vista"
                      : `${cliente.prazo_pagamento_dias} dias`}
                </dd>
              </div>
              {cliente.observacoes && (
                <div>
                  <dt>Observações</dt>
                  <dd>{cliente.observacoes}</dd>
                </div>
              )}
            </dl>
          </Painel>

          <Painel titulo="Contatos">
            {contatos.length === 0 && (
              <p className="campo__dica" style={{ marginBottom: "var(--esp-3)" }}>
                Agências costumam ter um produtor e um financeiro. Cadastre os dois.
              </p>
            )}

            {contatos.map((c) => (
              <div className="contato" key={c.id}>
                <div>
                  <div>{c.nome}</div>
                  {(c.papel || c.telefone) && (
                    <div className="contato__papel">
                      {[c.papel, c.telefone].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </div>
                <Botao
                  variante="discreto"
                  pequeno
                  onClick={() => {
                    void removerContato(c.id).then(() =>
                      setContatos((atual) => atual.filter((x) => x.id !== c.id))
                    );
                  }}
                >
                  Remover
                </Botao>
              </div>
            ))}

            <div className="grade" style={{ marginTop: "var(--esp-3)" }}>
              <Campo
                rotulo="Nome"
                value={novoContato.nome}
                onChange={(e) => setNovoContato({ ...novoContato, nome: e.target.value })}
                placeholder="Quem você fala"
              />
              <Campo
                rotulo="Papel"
                opcional
                value={novoContato.papel}
                onChange={(e) => setNovoContato({ ...novoContato, papel: e.target.value })}
                placeholder="produtor, financeiro…"
              />
              <Campo
                rotulo="Telefone"
                opcional
                value={novoContato.telefone}
                onChange={(e) => setNovoContato({ ...novoContato, telefone: e.target.value })}
              />
              <Botao onClick={() => void adicionarContato()} disabled={!novoContato.nome.trim()}>
                Adicionar contato
              </Botao>
            </div>
          </Painel>
        </div>

        <Painel
          titulo={`Jobs · ${jobs.length}`}
          acao={
            <Botao pequeno onClick={() => navegar("/quadro")}>
              Ir ao quadro
            </Botao>
          }
        >
          {jobs.length === 0 ? (
            <p className="vazio">Nenhum job para este cliente ainda.</p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {jobs.map((j) => (
                <li key={j.id}>
                  <Link
                    to={`/jobs/${j.id}`}
                    className="contato"
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <div>
                      <div>{j.titulo}</div>
                      <div className="contato__papel">
                        {j.prazo_entrega ? `entrega ${dataCurta(j.prazo_entrega)}` : "sem prazo"}
                      </div>
                    </div>
                    <Etiqueta
                      tom={
                        j.status === "perdido" || j.status === "cancelado"
                          ? "perigo"
                          : j.status === "concluido"
                            ? "ok"
                            : "neutro"
                      }
                    >
                      {ROTULO_STATUS[j.status]}
                    </Etiqueta>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Painel>
      </div>

      <ModalCliente
        aberto={editando}
        cliente={cliente}
        aoFechar={() => setEditando(false)}
        aoSalvar={setCliente}
      />
    </>
  );
}
