import { useEffect, useMemo, useState } from "react";
import {
  atualizarCompromisso,
  conflitosDoDia,
  criarCompromisso,
  eventosDoPeriodo,
} from "../../data/agenda";
import {
  COMPROMISSO_PRECISA_JOB,
  ROTULO_COMPROMISSO,
  ROTULO_PERIODO,
  type Compromisso,
  type EventoAgenda,
  type JobCompleto,
  type PeriodoDia,
  type TipoCompromisso,
} from "../../data/types";
import { dataCompleta } from "../../lib/formato";
import { Aviso, Botao, Campo, Modal, Selecao } from "../../components/ui";

type Rascunho = {
  tipo: TipoCompromisso;
  job_id: string;
  data_inicio: string;
  data_fim: string;
  periodo: PeriodoDia;
  hora_inicio: string;
  hora_fim: string;
  titulo: string;
};

function vazio(dataPadrao: string, jobPadrao?: string): Rascunho {
  return {
    tipo: jobPadrao ? "edicao" : "pessoal",
    job_id: jobPadrao ?? "",
    data_inicio: dataPadrao,
    data_fim: "",
    periodo: "dia",
    hora_inicio: "",
    hora_fim: "",
    titulo: "",
  };
}

/**
 * Reservar tempo seu: um bloco de edição para um job, ou uma folga.
 *
 * Tudo aqui é compromisso macio (regra R2). Se cair em cima de uma captação, o
 * aviso é leve e não impede — editar remarca, captação não.
 */
export function ModalCompromisso({
  aberto,
  compromisso,
  jobs,
  dataPadrao,
  jobPadrao,
  aoFechar,
  aoSalvar,
}: {
  aberto: boolean;
  compromisso?: Compromisso | null;
  jobs: JobCompleto[];
  dataPadrao: string;
  jobPadrao?: string;
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const [r, setR] = useState<Rascunho>(() => vazio(dataPadrao, jobPadrao));
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [doDia, setDoDia] = useState<EventoAgenda[]>([]);

  useEffect(() => {
    if (!aberto) return;
    setErro(null);
    if (compromisso) {
      setR({
        tipo: compromisso.tipo,
        job_id: compromisso.job_id ?? "",
        data_inicio: compromisso.data_inicio,
        data_fim: compromisso.data_fim ?? "",
        periodo: compromisso.periodo,
        hora_inicio: compromisso.hora_inicio?.slice(0, 5) ?? "",
        hora_fim: compromisso.hora_fim?.slice(0, 5) ?? "",
        titulo: compromisso.titulo ?? "",
      });
    } else {
      setR(vazio(dataPadrao, jobPadrao));
    }
  }, [aberto, compromisso, dataPadrao, jobPadrao]);

  // Consulta o dia escolhido para avisar sobre choque de agenda.
  useEffect(() => {
    if (!aberto || !r.data_inicio) return;
    let vivo = true;
    void eventosDoPeriodo(r.data_inicio, r.data_fim || r.data_inicio)
      .then((agenda) => {
        if (vivo) setDoDia(agenda.eventos.filter((e) => e.compromissoId !== compromisso?.id));
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [aberto, r.data_inicio, r.data_fim, compromisso?.id]);

  const conflito = useMemo(() => conflitosDoDia(doDia, "macia"), [doDia]);
  const precisaJob = COMPROMISSO_PRECISA_JOB.includes(r.tipo);

  function mudar<K extends keyof Rascunho>(campo: K, valor: Rascunho[K]) {
    setR((atual) => ({ ...atual, [campo]: valor }));
  }

  async function salvar() {
    if (!r.data_inicio) return setErro("Escolha ao menos a data de início.");
    if (precisaJob && !r.job_id) {
      return setErro("Bloco de edição pertence a um job — escolha qual.");
    }
    if (r.data_fim && r.data_fim < r.data_inicio) {
      return setErro("A data final não pode ser anterior à inicial.");
    }

    setSalvando(true);
    setErro(null);

    const dados = {
      tipo: r.tipo,
      job_id: precisaJob ? r.job_id : null,
      data_inicio: r.data_inicio,
      data_fim: r.data_fim || null,
      periodo: r.periodo,
      hora_inicio: r.periodo === "horario" ? r.hora_inicio || null : null,
      hora_fim: r.periodo === "horario" ? r.hora_fim || null : null,
      titulo: r.titulo || null,
    };

    try {
      if (compromisso) await atualizarCompromisso(compromisso.id, dados);
      else await criarCompromisso(dados);
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
      titulo={compromisso ? "Editar reserva" : "Reservar tempo"}
      aoFechar={aoFechar}
      largo
      rodape={
        <>
          <Botao onClick={aoFechar} disabled={salvando}>
            Cancelar
          </Botao>
          <Botao variante="principal" onClick={() => void salvar()} disabled={salvando}>
            {salvando ? "Salvando…" : "Reservar"}
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

        {conflito && (
          <div className="grade__largo">
            <Aviso tom="atencao">{conflito.mensagem}</Aviso>
          </div>
        )}

        <Selecao
          rotulo="Tipo"
          value={r.tipo}
          onChange={(e) => mudar("tipo", e.target.value as TipoCompromisso)}
        >
          {(Object.keys(ROTULO_COMPROMISSO) as TipoCompromisso[]).map((t) => (
            <option key={t} value={t}>
              {ROTULO_COMPROMISSO[t]}
            </option>
          ))}
        </Selecao>

        {precisaJob ? (
          <Selecao
            rotulo="Job"
            value={r.job_id}
            onChange={(e) => mudar("job_id", e.target.value)}
            dica="O bloco aparece dentro do job também."
          >
            <option value="">Escolha um job</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.titulo}
                {j.cliente ? ` · ${j.cliente.nome}` : ""}
              </option>
            ))}
          </Selecao>
        ) : (
          <Campo
            rotulo="Título"
            opcional
            value={r.titulo}
            onChange={(e) => mudar("titulo", e.target.value)}
            placeholder="Viagem, folga, médico…"
          />
        )}

        <Campo
          rotulo="De"
          type="date"
          value={r.data_inicio}
          onChange={(e) => mudar("data_inicio", e.target.value)}
        />
        <Campo
          rotulo="Até"
          opcional
          type="date"
          value={r.data_fim}
          min={r.data_inicio}
          onChange={(e) => mudar("data_fim", e.target.value)}
          dica="Vazio = um dia só."
        />

        <Selecao
          rotulo="Quando no dia"
          value={r.periodo}
          onChange={(e) => mudar("periodo", e.target.value as PeriodoDia)}
        >
          {(Object.keys(ROTULO_PERIODO) as PeriodoDia[]).map((p) => (
            <option key={p} value={p}>
              {ROTULO_PERIODO[p]}
            </option>
          ))}
        </Selecao>

        {r.periodo === "horario" && (
          <div style={{ display: "flex", gap: "var(--esp-2)" }}>
            <Campo
              rotulo="Início"
              type="time"
              value={r.hora_inicio}
              onChange={(e) => mudar("hora_inicio", e.target.value)}
            />
            <Campo
              rotulo="Fim"
              opcional
              type="time"
              value={r.hora_fim}
              onChange={(e) => mudar("hora_fim", e.target.value)}
            />
          </div>
        )}

        {precisaJob && (
          <Campo
            rotulo="Nota"
            opcional
            largo
            value={r.titulo}
            onChange={(e) => mudar("titulo", e.target.value)}
            placeholder="Corte, color, finalizar trilha…"
          />
        )}

        <p className="campo__dica grade__largo">
          Reserva é compromisso seu com você mesmo: se uma captação cair em cima,
          o sistema avisa de leve e deixa passar — {dataCompleta(r.data_inicio)} continua seu.
        </p>
      </div>
    </Modal>
  );
}
