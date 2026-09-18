import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  adicionarData,
  mudarStatus,
  obterJob,
  removerData,
  tirarDoQuadro,
} from "../../data/jobs";
import { listarClientes } from "../../data/clientes";
import { criarComentario, listarComentarios, removerComentario } from "../../data/comentarios";
import { criarLink, diasParaExpirar, listarLinks, removerLink } from "../../data/links";
import {
  ROTULO_COBRANCA,
  ROTULO_LINK,
  ROTULO_STATUS,
  ROTULO_TIPO,
  STATUS_FORA,
  STATUS_QUADRO,
  type Cliente,
  type Comentario,
  type JobCompleto,
  type Link as LinkArquivo,
  type Status,
  type TipoLink,
} from "../../data/types";
import { dataCompleta, horaCurta, moeda, quandoRelativo } from "../../lib/formato";
import { Area, Aviso, Botao, Campo, Carregando, Etiqueta, Modal, Painel, Selecao } from "../../components/ui";
import { ModalJob } from "./JobForm";
import "./job.css";

export function JobPage() {
  const { id = "" } = useParams();
  const navegar = useNavigate();

  const [job, setJob] = useState<JobCompleto | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [links, setLinks] = useState<LinkArquivo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [encerrando, setEncerrando] = useState<null | "perdido" | "cancelado">(null);
  const [motivo, setMotivo] = useState("");

  const [novaData, setNovaData] = useState({ data: "", hora_chamada: "", observacao: "" });
  const [novoLink, setNovoLink] = useState({ rotulo: "", url: "", tipo: "entrega" as TipoLink, validade: "" });
  const [novoComentario, setNovoComentario] = useState("");

  useEffect(() => {
    void recarregar();
    void listarClientes().then(setClientes).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function recarregar() {
    setCarregando(true);
    try {
      const [j, cs, ls] = await Promise.all([
        obterJob(id),
        listarComentarios(id),
        listarLinks(id),
      ]);
      setJob(j);
      setComentarios(cs);
      setLinks(ls);
      setErro(null);
    } catch (falha) {
      setErro((falha as Error).message);
    } finally {
      setCarregando(false);
    }
  }

  async function trocarStatus(status: Status) {
    if (!job) return;
    try {
      await mudarStatus(job.id, status);
      setJob({ ...job, status });
    } catch (falha) {
      setErro((falha as Error).message);
    }
  }

  async function encerrar() {
    if (!job || !encerrando) return;
    try {
      await tirarDoQuadro(job.id, encerrando, motivo);
      navegar("/quadro");
    } catch (falha) {
      setErro((falha as Error).message);
    }
  }

  if (carregando) return <Carregando texto="Carregando job" />;
  if (!job) {
    return (
      <>
        <Aviso tom="erro">Job não encontrado.</Aviso>
        <p style={{ marginTop: "var(--esp-3)" }}>
          <Link to="/quadro">Voltar ao quadro</Link>
        </p>
      </>
    );
  }

  const foraDoQuadro = STATUS_FORA.includes(job.status);

  return (
    <>
      <header className="pagina__topo">
        <div className="pagina__titulo">
          <Link to="/quadro" className="mono" style={{ fontSize: "var(--texto-sm)" }}>
            ← Quadro
          </Link>
          <h1>{job.titulo}</h1>
          <span className="pagina__sub">
            {job.cliente ? (
              <Link to={`/clientes/${job.cliente.id}`}>{job.cliente.nome}</Link>
            ) : (
              "sem cliente"
            )}
          </span>
        </div>
        <div className="pagina__acoes">
          <Botao onClick={() => setEditando(true)}>Editar</Botao>
          {!foraDoQuadro && (
            <>
              <Botao variante="perigo" onClick={() => setEncerrando("perdido")}>
                Perdido
              </Botao>
              <Botao variante="perigo" onClick={() => setEncerrando("cancelado")}>
                Cancelado
              </Botao>
            </>
          )}
        </div>
      </header>

      {erro && <Aviso tom="erro">{erro}</Aviso>}

      {foraDoQuadro && (
        <div style={{ marginBottom: "var(--esp-4)" }}>
          <Aviso tom="atencao">
            Job {ROTULO_STATUS[job.status].toLowerCase()} — fora do quadro, preservado para
            relatório. {job.motivo_saida && <strong>Motivo: {job.motivo_saida}</strong>}
          </Aviso>
        </div>
      )}

      <div className="job">
        <div className="job__coluna">
          <Painel titulo="Situação">
            <Selecao
              rotulo="Status de produção"
              value={job.status}
              onChange={(e) => void trocarStatus(e.target.value as Status)}
              dica="Produção e dinheiro correm em trilhas separadas — o financeiro entra na fase 3."
            >
              {STATUS_QUADRO.map((s) => (
                <option key={s} value={s}>
                  {ROTULO_STATUS[s]}
                </option>
              ))}
              {foraDoQuadro && <option value={job.status}>{ROTULO_STATUS[job.status]}</option>}
            </Selecao>

            <dl className="dados" style={{ marginTop: "var(--esp-3)" }}>
              <div>
                <dt>Tipo</dt>
                <dd>{ROTULO_TIPO[job.tipo]}</dd>
              </div>
              <div>
                <dt>Escopo</dt>
                <dd className="job__escopo">
                  {job.escopo_captacao && <Etiqueta tom="acento">Captação</Etiqueta>}
                  {job.escopo_edicao && <Etiqueta tom="acento">Edição</Etiqueta>}
                  {job.escopo_tratamento && <Etiqueta tom="acento">Tratamento</Etiqueta>}
                  {!job.escopo_captacao && !job.escopo_edicao && !job.escopo_tratamento && "—"}
                </dd>
              </div>
              <div>
                <dt>Entrega</dt>
                <dd>{dataCompleta(job.prazo_entrega)}</dd>
              </div>
              <div>
                <dt>Local</dt>
                <dd>{job.local || "—"}</dd>
              </div>
              <div>
                <dt>Cachê</dt>
                <dd className="job__cache">{moeda(job.valor_fechado)}</dd>
              </div>
              <div>
                <dt>Cobrança</dt>
                <dd>{ROTULO_COBRANCA[job.forma_cobranca]}</dd>
              </div>
            </dl>

            {job.briefing && (
              <>
                <p className="rotulo" style={{ marginTop: "var(--esp-4)" }}>
                  Briefing
                </p>
                <p style={{ fontSize: "var(--texto-md)", whiteSpace: "pre-wrap" }}>{job.briefing}</p>
              </>
            )}
          </Painel>

          <Painel titulo={`Datas de captação · ${job.datas.length}`}>
            {job.datas.length === 0 && (
              <p className="campo__dica">
                Nenhuma diária marcada. Um job pode ter várias — evento de dois dias, regravação.
              </p>
            )}

            {job.datas.map((d) => (
              <div className="linha" key={d.id}>
                <div>
                  <div className="mono">{dataCompleta(d.data)}</div>
                  {(d.hora_chamada || d.observacao) && (
                    <div className="linha__sub">
                      {[horaCurta(d.hora_chamada), d.observacao].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </div>
                <Botao
                  variante="discreto"
                  pequeno
                  onClick={() => {
                    void removerData(d.id).then(() =>
                      setJob({ ...job, datas: job.datas.filter((x) => x.id !== d.id) })
                    );
                  }}
                >
                  Remover
                </Botao>
              </div>
            ))}

            <div className="grade grade--2" style={{ marginTop: "var(--esp-3)" }}>
              <Campo
                rotulo="Data"
                type="date"
                value={novaData.data}
                onChange={(e) => setNovaData({ ...novaData, data: e.target.value })}
              />
              <Campo
                rotulo="Chamada"
                opcional
                type="time"
                value={novaData.hora_chamada}
                onChange={(e) => setNovaData({ ...novaData, hora_chamada: e.target.value })}
              />
              <Campo
                rotulo="Observação"
                opcional
                largo
                value={novaData.observacao}
                onChange={(e) => setNovaData({ ...novaData, observacao: e.target.value })}
                placeholder="segundo dia, making of…"
              />
              <div className="grade__largo">
                <Botao
                  disabled={!novaData.data}
                  onClick={() => {
                    void adicionarData(job.id, novaData)
                      .then((nova) => {
                        setJob({ ...job, datas: [...job.datas, nova].sort((a, b) => a.data.localeCompare(b.data)) });
                        setNovaData({ data: "", hora_chamada: "", observacao: "" });
                      })
                      .catch((f) => setErro((f as Error).message));
                  }}
                >
                  Adicionar diária
                </Botao>
              </div>
            </div>
          </Painel>
        </div>

        <div className="job__coluna">
          <Painel titulo={`Links · ${links.length}`}>
            {links.length === 0 && (
              <p className="campo__dica">
                Backup, bruto, entrega. Ficam aqui em vez de sumir no meio dos comentários.
              </p>
            )}

            {links.map((l) => {
              const dias = diasParaExpirar(l);
              return (
                <div className="linha" key={l.id}>
                  <div style={{ minWidth: 0 }}>
                    <a href={l.url} target="_blank" rel="noreferrer noopener" className="linha__link">
                      {l.rotulo}
                    </a>
                    <div className="linha__sub">
                      <Etiqueta>{ROTULO_LINK[l.tipo]}</Etiqueta>{" "}
                      {dias !== null && (
                        <Etiqueta tom={dias < 0 ? "perigo" : dias <= 7 ? "atencao" : "neutro"}>
                          {dias < 0 ? "expirou" : `expira em ${dias}d`}
                        </Etiqueta>
                      )}
                    </div>
                  </div>
                  <Botao
                    variante="discreto"
                    pequeno
                    onClick={() => {
                      void removerLink(l.id).then(() =>
                        setLinks((atual) => atual.filter((x) => x.id !== l.id))
                      );
                    }}
                  >
                    Remover
                  </Botao>
                </div>
              );
            })}

            <div className="grade grade--2" style={{ marginTop: "var(--esp-3)" }}>
              <Campo
                rotulo="Rótulo"
                value={novoLink.rotulo}
                onChange={(e) => setNovoLink({ ...novoLink, rotulo: e.target.value })}
                placeholder="Backup HD externo"
              />
              <Selecao
                rotulo="Tipo"
                value={novoLink.tipo}
                onChange={(e) => setNovoLink({ ...novoLink, tipo: e.target.value as TipoLink })}
              >
                {(Object.keys(ROTULO_LINK) as TipoLink[]).map((t) => (
                  <option key={t} value={t}>
                    {ROTULO_LINK[t]}
                  </option>
                ))}
              </Selecao>
              <Campo
                rotulo="URL"
                largo
                value={novoLink.url}
                onChange={(e) => setNovoLink({ ...novoLink, url: e.target.value })}
                placeholder="https://"
                inputMode="url"
              />
              <Campo
                rotulo="Validade"
                opcional
                type="date"
                value={novoLink.validade}
                onChange={(e) => setNovoLink({ ...novoLink, validade: e.target.value })}
                dica="Serviço de transferência expira."
              />
              <div className="grade__largo">
                <Botao
                  disabled={!novoLink.rotulo.trim() || !novoLink.url.trim()}
                  onClick={() => {
                    void criarLink(job.id, { ...novoLink, validade: novoLink.validade || null })
                      .then((novo) => {
                        setLinks((atual) => [...atual, novo]);
                        setNovoLink({ rotulo: "", url: "", tipo: "entrega", validade: "" });
                      })
                      .catch((f) => setErro((f as Error).message));
                  }}
                >
                  Adicionar link
                </Botao>
              </div>
            </div>
          </Painel>

          <Painel titulo={`Comentários · ${comentarios.length}`}>
            <Area
              rotulo="Nova nota"
              value={novoComentario}
              onChange={(e) => setNovoComentario(e.target.value)}
              placeholder="Cliente pediu mais dois reels. Cartões copiados no HD 2."
            />
            <div style={{ marginTop: "var(--esp-2)", marginBottom: "var(--esp-4)" }}>
              <Botao
                disabled={!novoComentario.trim()}
                onClick={() => {
                  void criarComentario(job.id, novoComentario)
                    .then((novo) => {
                      setComentarios((atual) => [novo, ...atual]);
                      setNovoComentario("");
                    })
                    .catch((f) => setErro((f as Error).message));
                }}
              >
                Comentar
              </Botao>
            </div>

            {comentarios.length === 0 && <p className="campo__dica">Nenhum comentário ainda.</p>}

            {comentarios.map((c) => (
              <article className="comentario" key={c.id}>
                <div className="comentario__topo">
                  <span className="mono comentario__quando">{quandoRelativo(c.created_at)}</span>
                  {c.tipo === "historico" && <Etiqueta tom="macio">histórico</Etiqueta>}
                  <Botao
                    variante="discreto"
                    pequeno
                    onClick={() => {
                      void removerComentario(c.id).then(() =>
                        setComentarios((atual) => atual.filter((x) => x.id !== c.id))
                      );
                    }}
                  >
                    ✕
                  </Botao>
                </div>
                <p className="comentario__texto">{c.texto}</p>
              </article>
            ))}
          </Painel>
        </div>
      </div>

      <ModalJob
        aberto={editando}
        job={job}
        clientes={clientes}
        aoFechar={() => setEditando(false)}
        aoCriarCliente={(c) => setClientes((atual) => [...atual, c])}
        aoSalvar={() => void recarregar()}
      />

      <Modal
        aberto={encerrando !== null}
        titulo={encerrando === "perdido" ? "Marcar como perdido" : "Marcar como cancelado"}
        aoFechar={() => setEncerrando(null)}
        rodape={
          <>
            <Botao onClick={() => setEncerrando(null)}>Voltar</Botao>
            <Botao variante="perigo" onClick={() => void encerrar()}>
              Confirmar
            </Botao>
          </>
        }
      >
        <p style={{ fontSize: "var(--texto-md)", marginBottom: "var(--esp-3)" }}>
          {encerrando === "perdido"
            ? "Perdido é o orçamento que nunca virou trabalho — conta na sua taxa de conversão de propostas."
            : "Cancelado era um job aprovado que caiu no meio do caminho — conta como furo de agenda."}{" "}
          Ele sai do quadro agora e continua inteiro nos relatórios.
        </p>
        <Campo
          rotulo="Motivo"
          opcional
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder={encerrando === "perdido" ? "preço, data indisponível…" : "cliente adiou sem data"}
        />
      </Modal>
    </>
  );
}
