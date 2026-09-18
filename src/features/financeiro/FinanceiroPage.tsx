import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  estaAtrasada,
  gerarMensalidades,
  listarContratos,
  listarParcelas,
  listarParcelasEmAberto,
  listarJobsSemParcela,
  garantirParcelaDoJob,
  marcarPaga,
  previsaoMeses,
  removerContrato,
  resumoDoMes,
} from "../../data/financeiro";
import {
  ROTULO_CONFIANCA,
  ROTULO_CONTRATO,
  type ContratoCompleto,
  type ParcelaCompleta,
} from "../../data/types";
import { dataCurta, hojeISO, moeda } from "../../lib/formato";
import { fimDoMes, inicioDoMes } from "../../lib/calendario";
import { Aviso, Botao, Carregando, Etiqueta, Indicador, Painel } from "../../components/ui";
import { ModalContrato } from "./ModalContrato";
import { ModalParcela } from "./ModalParcela";
import "./financeiro.css";

type JobSemParcela = Awaited<ReturnType<typeof listarJobsSemParcela>>[number];

function mesDe(iso: string) {
  return iso.slice(0, 7);
}

function rotuloMes(competencia: string) {
  const [ano, mes] = competencia.split("-");
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${nomes[Number(mes) - 1]}/${ano.slice(2)}`;
}

export function FinanceiroPage() {
  const hoje = hojeISO();
  const [mes, setMes] = useState(mesDe(hoje));

  const [doMes, setDoMes] = useState<ParcelaCompleta[]>([]);
  const [emAberto, setEmAberto] = useState<ParcelaCompleta[]>([]);
  const [contratos, setContratos] = useState<ContratoCompleto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [geradas, setGeradas] = useState(0);

  const [semParcela, setSemParcela] = useState<JobSemParcela[]>([]);
  const [editandoContrato, setEditandoContrato] = useState<ContratoCompleto | null>(null);
  const [novoContrato, setNovoContrato] = useState(false);
  const [editandoParcela, setEditandoParcela] = useState<ParcelaCompleta | null>(null);

  const carregar = useCallback(async () => {
    try {
      // A única automação da v1: garante a mensalidade dos contratos ativos
      // antes de somar qualquer coisa.
      const criadas = await gerarMensalidades();
      setGeradas(criadas);

      const [ps, abertas, cs, sp] = await Promise.all([
        listarParcelas(inicioDoMes(mes), fimDoMes(mes)),
        listarParcelasEmAberto(),
        listarContratos(),
        listarJobsSemParcela(),
      ]);
      setDoMes(ps);
      setEmAberto(abertas);
      setContratos(cs);
      setSemParcela(sp);
      setErro(null);
    } catch (falha) {
      setErro((falha as Error).message);
    } finally {
      setCarregando(false);
    }
  }, [mes]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const ativos = useMemo(() => contratos.filter((c) => c.status === "ativo"), [contratos]);

  // Parcelas pagas dentro do mês podem ter vencido antes — busca-las pela data
  // efetiva exige olhar também o que está fora da janela de previsão.
  const resumo = useMemo(
    () => resumoDoMes(doMes, emAberto, ativos, mes, hoje),
    [doMes, emAberto, ativos, mes, hoje]
  );

  const previsao = useMemo(() => previsaoMeses(emAberto, hoje, 6), [emAberto, hoje]);
  const atrasadas = useMemo(() => emAberto.filter((p) => estaAtrasada(p, hoje)), [emAberto, hoje]);
  const tetoPrevisao = Math.max(...previsao.map((m) => m.confirmado + m.estimado), 1);

  /** Cria a parcela de cada job fechado que ainda não tinha nenhuma. */
  async function gerarTodasAsParcelas() {
    try {
      for (const j of semParcela) {
        await garantirParcelaDoJob(j.id, j.valor_fechado, j.cliente?.prazo_pagamento_dias ?? null);
      }
      await carregar();
    } catch (falha) {
      setErro((falha as Error).message);
    }
  }

  function andarMes(passo: number) {
    const d = new Date(`${mes}-01T00:00:00`);
    d.setMonth(d.getMonth() + passo);
    setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  if (carregando) return <Carregando texto="Fechando as contas" />;

  return (
    <>
      <header className="pagina__topo">
        <div className="pagina__titulo">
          <h1>Financeiro</h1>
          <span className="pagina__sub">{rotuloMes(mes)}</span>
        </div>
        <div className="pagina__acoes">
          <div className="fin__navegacao">
            <Botao pequeno onClick={() => andarMes(-1)} aria-label="Mês anterior">
              ‹
            </Botao>
            <Botao pequeno onClick={() => setMes(mesDe(hoje))}>
              Este mês
            </Botao>
            <Botao pequeno onClick={() => andarMes(1)} aria-label="Próximo mês">
              ›
            </Botao>
          </div>
          <Botao variante="principal" onClick={() => setNovoContrato(true)}>
            Novo contrato
          </Botao>
        </div>
      </header>

      {erro && <Aviso tom="erro">{erro}</Aviso>}
      {geradas > 0 && (
        <div style={{ marginBottom: "var(--esp-4)" }}>
          <Aviso>
            {geradas === 1
              ? "1 mensalidade gerada automaticamente a partir dos contratos ativos."
              : `${geradas} mensalidades geradas automaticamente a partir dos contratos ativos.`}
          </Aviso>
        </div>
      )}

      <div className="indicadores">
        <Indicador
          icone="✓"
          tom="ok"
          rotulo="Recebido no mês"
          valor={moeda(resumo.recebido)}
          apoio="dinheiro que entrou de verdade"
        />
        <Indicador
          icone="◷"
          rotulo="A receber no mês"
          valor={moeda(resumo.aReceberConfirmado + resumo.aReceberEstimado)}
          apoio={
            <>
              <strong>{moeda(resumo.aReceberConfirmado)}</strong> confirmado ·{" "}
              {moeda(resumo.aReceberEstimado)} estimado
            </>
          }
        />
        <Indicador
          icone="◈"
          tom="acento"
          rotulo="Garantido por mês"
          valor={moeda(resumo.garantido)}
          apoio={`${ativos.length} ${ativos.length === 1 ? "contrato ativo" : "contratos ativos"}`}
        />
        <Indicador
          icone="!"
          tom={resumo.atrasado > 0 ? "perigo" : "neutro"}
          rotulo="Atrasado"
          valor={moeda(resumo.atrasado)}
          apoio={
            atrasadas.length === 0
              ? "nada vencido"
              : `${atrasadas.length} ${atrasadas.length === 1 ? "parcela" : "parcelas"} venceram sem entrar`
          }
        />
      </div>

      <p className="fin__nota">
        Confirmado e estimado aparecem separados de propósito: misturá-los é como se acaba
        contando com dinheiro que não vem. <strong>Garantido</strong> é o seu piso antes de
        fechar qualquer trabalho novo — o número que diz se dá para recusar um job ruim.
      </p>

      <div className="fin">
        <Painel titulo="Previsão dos próximos seis meses">
          <div className="grafico" role="img" aria-label="Previsão mensal, confirmado e estimado">
            {previsao.map((m) => {
              const total = m.confirmado + m.estimado;
              return (
                <div className="grafico__col" key={m.competencia}>
                  <span className="grafico__valor mono">{total > 0 ? moeda(total) : ""}</span>
                  <div className="grafico__pilha">
                    <div
                      className="grafico__barra grafico__barra--estimado"
                      style={{ height: `${(m.estimado / tetoPrevisao) * 100}%` }}
                      title={`${moeda(m.estimado)} estimado`}
                    />
                    <div
                      className="grafico__barra grafico__barra--confirmado"
                      style={{ height: `${(m.confirmado / tetoPrevisao) * 100}%` }}
                      title={`${moeda(m.confirmado)} confirmado`}
                    />
                  </div>
                  <span className="grafico__mes mono">{rotuloMes(m.competencia)}</span>
                </div>
              );
            })}
          </div>
          <div className="grafico__legenda">
            <span>
              <i className="grafico__amostra grafico__amostra--confirmado" /> confirmado
            </span>
            <span>
              <i className="grafico__amostra grafico__amostra--estimado" /> estimado
            </span>
          </div>
        </Painel>

        <Painel
          titulo={`Contratos · ${ativos.length} ativos`}
          acao={
            <Botao pequeno onClick={() => setNovoContrato(true)}>
              Novo
            </Botao>
          }
        >
          {contratos.length === 0 ? (
            <p className="campo__dica">
              Nenhum mensalista ainda. Um contrato gera a parcela do mês sozinho e vira sua
              receita garantida.
            </p>
          ) : (
            contratos.map((c) => (
              <div className="linha" key={c.id}>
                <div style={{ minWidth: 0 }}>
                  <div className="fin__contrato-nome">{c.descricao}</div>
                  <div className="linha__sub">
                    {c.cliente && <Link to={`/clientes/${c.cliente.id}`}>{c.cliente.nome}</Link>}
                    <span>· vence dia {c.dia_vencimento}</span>
                    {c.status !== "ativo" && (
                      <Etiqueta tom="atencao">{ROTULO_CONTRATO[c.status]}</Etiqueta>
                    )}
                  </div>
                </div>
                <div className="fin__contrato-valor">
                  <span className="mono">{moeda(c.valor_mensal)}</span>
                  <div style={{ display: "flex", gap: 2 }}>
                    <Botao variante="discreto" pequeno onClick={() => setEditandoContrato(c)}>
                      Editar
                    </Botao>
                    <Botao
                      variante="discreto"
                      pequeno
                      onClick={() => {
                        void removerContrato(c.id).then(() => void carregar());
                      }}
                    >
                      ✕
                    </Botao>
                  </div>
                </div>
              </div>
            ))
          )}
        </Painel>
      </div>

      {semParcela.length > 0 && (
        <div style={{ marginTop: "var(--esp-4)" }}>
          <Painel
            titulo={`Fechados sem parcela · ${semParcela.length}`}
            acao={
              <Botao variante="principal" pequeno onClick={() => void gerarTodasAsParcelas()}>
                Gerar todas
              </Botao>
            }
          >
            <p className="campo__dica" style={{ marginBottom: "var(--esp-3)" }}>
              Estes jobs têm cachê fechado mas nenhuma parcela — por isso não entram em nenhum
              número desta tela. Gerar a parcela usa o prazo de pagamento do cliente para prever
              a data.
            </p>

            {semParcela.map((j) => (
              <div className="linha" key={j.id}>
                <div style={{ minWidth: 0 }}>
                  <Link to={`/jobs/${j.id}`} className="linha__link">
                    {j.titulo}
                  </Link>
                  <div className="linha__sub">
                    {j.cliente?.nome}
                    {j.cliente?.prazo_pagamento_dias !== null &&
                      j.cliente?.prazo_pagamento_dias !== undefined && (
                        <span>
                          ·{" "}
                          {j.cliente.prazo_pagamento_dias === 0
                            ? "à vista"
                            : `${j.cliente.prazo_pagamento_dias} dias`}
                        </span>
                      )}
                  </div>
                </div>
                <span className="parcela__valor mono">{moeda(j.valor_fechado)}</span>
              </div>
            ))}
          </Painel>
        </div>
      )}

      {atrasadas.length > 0 && (
        <div style={{ marginTop: "var(--esp-4)" }}>
          <Painel titulo={`Atrasado · ${atrasadas.length}`}>
            <ListaParcelas
              parcelas={atrasadas}
              hoje={hoje}
              aoEditar={setEditandoParcela}
              aoReceber={async (p) => {
                await marcarPaga(p.id, hoje);
                await carregar();
              }}
            />
          </Painel>
        </div>
      )}

      <div style={{ marginTop: "var(--esp-4)" }}>
        <Painel titulo={`Parcelas de ${rotuloMes(mes)} · ${doMes.length}`}>
          {doMes.length === 0 ? (
            <p className="campo__dica">Nenhuma parcela prevista para este mês.</p>
          ) : (
            <ListaParcelas
              parcelas={doMes}
              hoje={hoje}
              aoEditar={setEditandoParcela}
              aoReceber={async (p) => {
                await marcarPaga(p.id, hoje);
                await carregar();
              }}
            />
          )}
        </Painel>
      </div>

      <ModalContrato
        aberto={novoContrato || editandoContrato !== null}
        contrato={editandoContrato}
        aoFechar={() => {
          setNovoContrato(false);
          setEditandoContrato(null);
        }}
        aoSalvar={() => void carregar()}
      />

      <ModalParcela
        aberto={editandoParcela !== null}
        parcela={editandoParcela}
        aoFechar={() => setEditandoParcela(null)}
        aoSalvar={() => void carregar()}
      />
    </>
  );
}

function ListaParcelas({
  parcelas,
  hoje,
  aoEditar,
  aoReceber,
}: {
  parcelas: ParcelaCompleta[];
  hoje: string;
  aoEditar: (p: ParcelaCompleta) => void;
  aoReceber: (p: ParcelaCompleta) => Promise<void>;
}) {
  return (
    <ul className="parcelas">
      {parcelas.map((p) => {
        const atrasada = estaAtrasada(p, hoje);
        const origem = p.job
          ? { nome: p.job.titulo, cliente: p.job.cliente?.nome, para: `/jobs/${p.job.id}` }
          : { nome: p.contrato?.descricao ?? "—", cliente: p.contrato?.cliente?.nome, para: null };

        return (
          <li className="parcela" key={p.id}>
            <span
              className={`parcela__trilho parcela__trilho--${atrasada ? "atrasada" : p.confianca}`}
              aria-hidden="true"
            />

            <div className="parcela__corpo">
              <div className="parcela__nome">
                {origem.para ? <Link to={origem.para}>{origem.nome}</Link> : origem.nome}
                {p.contrato && <Etiqueta tom="acento">mensalidade</Etiqueta>}
              </div>
              <div className="parcela__sub">
                {origem.cliente && <span>{origem.cliente}</span>}
                <span>· vence {dataCurta(p.data_prevista)}</span>
                {p.data_efetiva && <span>· caiu {dataCurta(p.data_efetiva)}</span>}
                {p.nf_emitida && <Etiqueta>NF</Etiqueta>}
              </div>
            </div>

            <div className="parcela__direita">
              <span className="parcela__valor mono">{moeda(p.valor)}</span>
              <Etiqueta
                tom={
                  atrasada
                    ? "perigo"
                    : p.confianca === "paga"
                      ? "ok"
                      : p.confianca === "confirmada"
                        ? "acento"
                        : "atencao"
                }
              >
                {atrasada ? "atrasada" : ROTULO_CONFIANCA[p.confianca]}
              </Etiqueta>
            </div>

            <div className="parcela__acoes">
              {p.confianca !== "paga" && (
                <Botao pequeno onClick={() => void aoReceber(p)}>
                  Recebi
                </Botao>
              )}
              <Botao variante="discreto" pequeno onClick={() => aoEditar(p)}>
                Editar
              </Botao>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
