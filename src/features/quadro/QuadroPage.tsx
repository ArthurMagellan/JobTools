import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useNavigate } from "react-router-dom";
import { listarClientes } from "../../data/clientes";
import { listarJobsDoQuadro, mudarStatus, obterJob } from "../../data/jobs";
import {
  AJUDA_STATUS,
  ROTULO_STATUS,
  STATUS_QUADRO,
  type Cliente,
  type JobCompleto,
  type Status,
} from "../../data/types";
import { dataCurta, diasAte, prazoEmPalavras } from "../../lib/formato";
import { Aviso, Botao, Carregando, Etiqueta } from "../../components/ui";
import { ModalJob } from "../jobs/JobForm";
import "./quadro.css";

export function QuadroPage() {
  const navegar = useNavigate();
  const [jobs, setJobs] = useState<JobCompleto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtroCliente, setFiltroCliente] = useState("");
  const [modalAberto, setModalAberto] = useState(false);

  // Sensores com distância mínima: arrastar não pode roubar o clique do cartão.
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } })
  );

  useEffect(() => {
    void (async () => {
      try {
        const [js, cs] = await Promise.all([listarJobsDoQuadro(), listarClientes()]);
        setJobs(js);
        setClientes(cs);
        setErro(null);
      } catch (falha) {
        setErro((falha as Error).message);
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  const visiveis = useMemo(
    () => (filtroCliente ? jobs.filter((j) => j.cliente_id === filtroCliente) : jobs),
    [jobs, filtroCliente]
  );

  async function aoSoltar(evento: DragEndEvent) {
    const jobId = String(evento.active.id);
    const destino = evento.over?.id as Status | undefined;
    if (!destino) return;

    const job = jobs.find((j) => j.id === jobId);
    if (!job || job.status === destino) return;

    // Otimista: move na tela primeiro, desfaz se o banco recusar.
    const anterior = job.status;
    setJobs((atual) => atual.map((j) => (j.id === jobId ? { ...j, status: destino } : j)));

    try {
      await mudarStatus(jobId, destino);
    } catch (falha) {
      setJobs((atual) => atual.map((j) => (j.id === jobId ? { ...j, status: anterior } : j)));
      setErro((falha as Error).message);
    }
  }

  if (carregando) return <Carregando texto="Carregando o quadro" />;

  return (
    <>
      <header className="pagina__topo">
        <div className="pagina__titulo">
          <h1>Quadro</h1>
          <span className="pagina__sub">
            {visiveis.length} {visiveis.length === 1 ? "job ativo" : "jobs ativos"}
            {filtroCliente ? " neste filtro" : ""}
          </span>
        </div>
        <div className="pagina__acoes">
          <select
            className="campo__selecao quadro__filtro"
            value={filtroCliente}
            onChange={(e) => setFiltroCliente(e.target.value)}
            aria-label="Filtrar por cliente"
          >
            <option value="">Todos os clientes</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
          <Botao
            variante="principal"
            onClick={() => setModalAberto(true)}
            disabled={clientes.length === 0}
            title={clientes.length === 0 ? "Cadastre um cliente primeiro" : undefined}
          >
            Novo job
          </Botao>
        </div>
      </header>

      {erro && <Aviso tom="erro">{erro}</Aviso>}

      {clientes.length === 0 && (
        <Aviso tom="atencao">
          Nenhum cliente cadastrado ainda. Todo job pertence a um cliente — comece por lá.
        </Aviso>
      )}

      <DndContext sensors={sensores} onDragEnd={(e) => void aoSoltar(e)}>
        <div className="quadro">
          {STATUS_QUADRO.map((status) => (
            <Coluna
              key={status}
              status={status}
              jobs={visiveis.filter((j) => j.status === status)}
              aoAbrir={(id) => navegar(`/jobs/${id}`)}
            />
          ))}
        </div>
      </DndContext>

      <ModalJob
        aberto={modalAberto}
        clientes={clientes}
        aoFechar={() => setModalAberto(false)}
        aoCriarCliente={(c) => setClientes((atual) => [...atual, c])}
        aoSalvar={(salvo) => {
          void obterJob(salvo.id).then((completo) => {
            if (completo) setJobs((atual) => [...atual, completo]);
          });
        }}
      />
    </>
  );
}

function Coluna({
  status,
  jobs,
  aoAbrir,
}: {
  status: Status;
  jobs: JobCompleto[];
  aoAbrir: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const ajuda = AJUDA_STATUS[status];

  return (
    <section className={`coluna ${isOver ? "coluna--alvo" : ""}`} ref={setNodeRef}>
      <header className="coluna__cabeca">
        <span className="coluna__nome" title={ajuda}>
          {ROTULO_STATUS[status]}
          {ajuda && (
            <span className="coluna__marca" aria-hidden="true">
              ·
            </span>
          )}
        </span>
        <span className="coluna__conta mono">{jobs.length}</span>
      </header>

      {ajuda && <p className="coluna__ajuda">{ajuda}</p>}

      <div className="coluna__pilha">
        {jobs.map((job) => (
          <Cartao key={job.id} job={job} aoAbrir={aoAbrir} />
        ))}
        {jobs.length === 0 && <div className="coluna__vazia">—</div>}
      </div>
    </section>
  );
}

function Cartao({ job, aoAbrir }: { job: JobCompleto; aoAbrir: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: job.id });

  const proxima = job.datas.find((d) => (diasAte(d.data) ?? -1) >= 0) ?? job.datas[0];
  const dias = diasAte(job.prazo_entrega);
  const tomPrazo = dias === null ? "neutro" : dias < 0 ? "perigo" : dias <= 3 ? "atencao" : "neutro";

  return (
    <article
      ref={setNodeRef}
      className={`cartao ${isDragging ? "cartao--arrastando" : ""}`}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      {...listeners}
      {...attributes}
      onClick={() => aoAbrir(job.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter") aoAbrir(job.id);
      }}
      role="button"
      tabIndex={0}
    >
      <span className="cartao__cliente">{job.cliente?.nome ?? "sem cliente"}</span>
      <h3 className="cartao__titulo">{job.titulo}</h3>

      <div className="cartao__escopo" aria-label="Escopo">
        {job.escopo_captacao && <Etiqueta title="Captação">📹</Etiqueta>}
        {job.escopo_edicao && <Etiqueta title="Edição">✂️</Etiqueta>}
        {job.escopo_tratamento && <Etiqueta title="Tratamento de foto">◑</Etiqueta>}
      </div>

      <footer className="cartao__rodape">
        {proxima && (
          <span className="cartao__data mono" title="Próxima captação">
            📅 {dataCurta(proxima.data)}
          </span>
        )}
        {job.prazo_entrega && (
          <Etiqueta tom={tomPrazo} title={`Entrega em ${dataCurta(job.prazo_entrega)}`}>
            {prazoEmPalavras(job.prazo_entrega)}
          </Etiqueta>
        )}
      </footer>
    </article>
  );
}
