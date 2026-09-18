import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { diasEmConflito, eventosDoPeriodo, removerCompromisso } from "../../data/agenda";
import { listarJobsDoQuadro } from "../../data/jobs";
import {
  ROTULO_CAMADA,
  type CamadaAgenda,
  type EventoAgenda,
  type JobCompleto,
} from "../../data/types";
import {
  DIAS_SEMANA,
  diaDoMes,
  ehDeOutroMes,
  ehFimDeSemana,
  gradeDaSemana,
  gradeDoMes,
  nomeDoMes,
  primeiroEUltimo,
  proximosDias,
  somaDias,
} from "../../lib/calendario";
import { dataCompleta, hojeISO } from "../../lib/formato";
import { Aviso, Botao, Carregando, Etiqueta, Modal } from "../../components/ui";
import { ModalCompromisso } from "./ModalCompromisso";
import "./calendario.css";

type Visao = "mes" | "semana" | "lista";

export function CalendarioPage() {
  const navegar = useNavigate();
  const hoje = hojeISO();

  const [visao, setVisao] = useState<Visao>("mes");
  const [ancora, setAncora] = useState(hoje);
  const [eventos, setEventos] = useState<EventoAgenda[]>([]);
  const [jobs, setJobs] = useState<JobCompleto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [semVencimentos, setSemVencimentos] = useState(false);

  const [diaAberto, setDiaAberto] = useState<string | null>(null);
  const [reservando, setReservando] = useState(false);

  const dias = useMemo(() => {
    const d = new Date(`${ancora}T00:00:00`);
    if (visao === "mes") return gradeDoMes(d.getFullYear(), d.getMonth());
    if (visao === "semana") return gradeDaSemana(ancora);
    return proximosDias(ancora, 7);
  }, [visao, ancora]);

  const carregar = useCallback(async () => {
    const [de, ate] = primeiroEUltimo(dias);
    try {
      const [agenda, js] = await Promise.all([eventosDoPeriodo(de, ate), listarJobsDoQuadro()]);
      setEventos(agenda.eventos);
      setSemVencimentos(agenda.vencimentosIndisponiveis);
      setJobs(js);
      setErro(null);
    } catch (falha) {
      setErro((falha as Error).message);
    } finally {
      setCarregando(false);
    }
  }, [dias]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const porDia = useMemo(() => {
    const mapa = new Map<string, EventoAgenda[]>();
    for (const e of eventos) {
      const lista = mapa.get(e.data) ?? [];
      lista.push(e);
      mapa.set(e.data, lista);
    }
    return mapa;
  }, [eventos]);

  const conflitos = useMemo(() => diasEmConflito(eventos), [eventos]);
  const mesAtual = new Date(`${ancora}T00:00:00`).getMonth();

  function andar(passo: number) {
    if (visao === "mes") {
      const d = new Date(`${ancora}T00:00:00`);
      d.setMonth(d.getMonth() + passo);
      setAncora(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
    } else {
      setAncora(somaDias(ancora, passo * 7));
    }
  }

  const titulo = useMemo(() => {
    const d = new Date(`${ancora}T00:00:00`);
    if (visao === "mes") return nomeDoMes(d.getFullYear(), d.getMonth());
    if (visao === "semana") return `semana de ${dataCompleta(dias[0])}`;
    return "próximos 7 dias";
  }, [visao, ancora, dias]);

  if (carregando) return <Carregando texto="Carregando a agenda" />;

  return (
    <>
      <header className="pagina__topo">
        <div className="pagina__titulo">
          <h1>Calendário</h1>
          <span className="pagina__sub cal__titulo">{titulo}</span>
        </div>

        <div className="pagina__acoes">
          {visao !== "lista" && (
            <div className="cal__navegacao">
              <Botao pequeno onClick={() => andar(-1)} aria-label="Anterior">
                ‹
              </Botao>
              <Botao pequeno onClick={() => setAncora(hoje)}>
                Hoje
              </Botao>
              <Botao pequeno onClick={() => andar(1)} aria-label="Próximo">
                ›
              </Botao>
            </div>
          )}

          <div className="cal__visoes" role="group" aria-label="Modo de visualização">
            {(["mes", "semana", "lista"] as Visao[]).map((v) => (
              <button
                key={v}
                className={`cal__visao ${visao === v ? "cal__visao--ativa" : ""}`}
                onClick={() => {
                  setVisao(v);
                  if (v === "lista") setAncora(hoje);
                }}
              >
                {v === "mes" ? "Mês" : v === "semana" ? "Semana" : "7 dias"}
              </button>
            ))}
          </div>

          <Botao
            variante="principal"
            onClick={() => {
              setDiaAberto(null);
              setReservando(true);
            }}
          >
            Reservar tempo
          </Botao>
        </div>
      </header>

      {erro && <Aviso tom="erro">{erro}</Aviso>}
      {semVencimentos && (
        <div style={{ marginBottom: "var(--esp-4)" }}>
          <Aviso tom="atencao">
            A camada de pagamento não pôde ser lida — provavelmente o financeiro ainda não foi
            criado no banco. O resto da agenda está completo.
          </Aviso>
        </div>
      )}

      <Legenda />

      {visao === "lista" ? (
        <ListaDeDias dias={dias} porDia={porDia} hoje={hoje} aoAbrirDia={setDiaAberto} />
      ) : (
        <div className="cal">
          {DIAS_SEMANA.map((d) => (
            <div className="cal__cabeca" key={d}>
              {d}
            </div>
          ))}

          {dias.map((dia) => {
            const doDia = porDia.get(dia) ?? [];
            const classes = [
              "cal__dia",
              dia === hoje ? "cal__dia--hoje" : "",
              visao === "mes" && ehDeOutroMes(dia, mesAtual) ? "cal__dia--fora" : "",
              ehFimDeSemana(dia) ? "cal__dia--fds" : "",
              conflitos.has(dia) ? "cal__dia--conflito" : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <button className={classes} key={dia} onClick={() => setDiaAberto(dia)}>
                <span className="cal__numero mono">{diaDoMes(dia)}</span>
                {conflitos.has(dia) && (
                  <span className="cal__alerta" title="Dois compromissos firmes no mesmo dia">
                    !
                  </span>
                )}
                <span className="cal__eventos">
                  {doDia.slice(0, 3).map((e) => (
                    <Marca evento={e} key={e.chave} />
                  ))}
                  {doDia.length > 3 && (
                    <span className="cal__mais mono">+{doDia.length - 3}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <Modal
        aberto={diaAberto !== null}
        titulo={diaAberto ? dataCompleta(diaAberto) : ""}
        aoFechar={() => setDiaAberto(null)}
        rodape={
          <Botao variante="principal" onClick={() => setReservando(true)}>
            Reservar tempo neste dia
          </Botao>
        }
      >
        <DetalheDoDia
          eventos={diaAberto ? (porDia.get(diaAberto) ?? []) : []}
          emConflito={diaAberto ? conflitos.has(diaAberto) : false}
          aoAbrirJob={(id) => navegar(`/jobs/${id}`)}
          aoRemover={async (id) => {
            await removerCompromisso(id);
            await carregar();
          }}
        />
      </Modal>

      <ModalCompromisso
        aberto={reservando}
        jobs={jobs}
        dataPadrao={diaAberto ?? hoje}
        aoFechar={() => setReservando(false)}
        aoSalvar={() => {
          setDiaAberto(null);
          void carregar();
        }}
      />
    </>
  );
}

function Legenda() {
  return (
    <ul className="cal__legenda">
      {(Object.keys(ROTULO_CAMADA) as CamadaAgenda[]).map((c) => (
        <li key={c}>
          <span className={`cal__ponto cal__ponto--${c}`} aria-hidden="true" />
          {ROTULO_CAMADA[c]}
          {c === "edicao" && <span className="cal__futuro cal__futuro--macio">remarcável</span>}
        </li>
      ))}
    </ul>
  );
}

function Marca({ evento }: { evento: EventoAgenda }) {
  return (
    <span className={`cal__marca cal__marca--${evento.camada}`} title={`${evento.titulo}${evento.detalhe ? ` · ${evento.detalhe}` : ""}`}>
      {evento.hora && <b>{evento.hora} </b>}
      {evento.titulo}
    </span>
  );
}

function ListaDeDias({
  dias,
  porDia,
  hoje,
  aoAbrirDia,
}: {
  dias: string[];
  porDia: Map<string, EventoAgenda[]>;
  hoje: string;
  aoAbrirDia: (dia: string) => void;
}) {
  const comAlgo = dias.filter((d) => (porDia.get(d) ?? []).length > 0);

  if (comAlgo.length === 0) {
    return <p className="vazio">Nada marcado nos próximos sete dias. Aproveite ou preencha.</p>;
  }

  return (
    <ul className="cal__lista">
      {comAlgo.map((dia) => (
        <li key={dia}>
          <button className="cal__linha" onClick={() => aoAbrirDia(dia)}>
            <span className={`cal__linha-data mono ${dia === hoje ? "cal__linha-data--hoje" : ""}`}>
              {dia === hoje ? "hoje" : dataCompleta(dia)}
            </span>
            <span className="cal__linha-eventos">
              {(porDia.get(dia) ?? []).map((e) => (
                <Marca evento={e} key={e.chave} />
              ))}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function DetalheDoDia({
  eventos,
  emConflito,
  aoAbrirJob,
  aoRemover,
}: {
  eventos: EventoAgenda[];
  emConflito: boolean;
  aoAbrirJob: (id: string) => void;
  aoRemover: (id: string) => Promise<void>;
}) {
  if (eventos.length === 0) {
    return <p className="campo__dica">Dia livre.</p>;
  }

  return (
    <>
      {emConflito && (
        <div style={{ marginBottom: "var(--esp-3)" }}>
          <Aviso tom="erro">
            Dois compromissos firmes no mesmo dia. Captação e prazo de entrega têm cliente do
            outro lado — um dos dois precisa mudar.
          </Aviso>
        </div>
      )}

      <ul className="cal__detalhe">
        {eventos.map((e) => (
          <li key={e.chave}>
            <span className={`cal__ponto cal__ponto--${e.camada}`} aria-hidden="true" />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="cal__detalhe-titulo">
                {e.titulo}
                {e.firmeza === "macia" && <Etiqueta tom="macio">remarcável</Etiqueta>}
              </div>
              <div className="cal__detalhe-sub">
                {[ROTULO_CAMADA[e.camada], e.detalhe, e.hora].filter(Boolean).join(" · ")}
              </div>
            </div>
            <div style={{ display: "flex", gap: "var(--esp-1)" }}>
              {e.jobId && (
                <Botao pequeno variante="discreto" onClick={() => aoAbrirJob(e.jobId!)}>
                  Abrir job
                </Botao>
              )}
              {e.compromissoId && (
                <Botao
                  pequeno
                  variante="discreto"
                  onClick={() => void aoRemover(e.compromissoId!)}
                >
                  Remover
                </Botao>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
