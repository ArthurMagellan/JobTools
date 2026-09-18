import { useEffect, useState } from "react";
import { adicionarData, atualizarJob, criarJob } from "../../data/jobs";
import type { Cliente, Job, JobCompleto, TipoJob } from "../../data/types";
import { Area, Aviso, Botao, Campo, Marcacao, Modal, Selecao } from "../../components/ui";
import { ModalCliente } from "../clientes/ClienteForm";

type Rascunho = {
  titulo: string;
  cliente_id: string;
  tipo: TipoJob;
  escopo_captacao: boolean;
  escopo_edicao: boolean;
  escopo_tratamento: boolean;
  prazo_entrega: string;
  valor_fechado: string;
  local: string;
  briefing: string;
  primeira_data: string;
};

const VAZIO: Rascunho = {
  titulo: "",
  cliente_id: "",
  tipo: "video",
  escopo_captacao: true,
  escopo_edicao: true,
  escopo_tratamento: false,
  prazo_entrega: "",
  valor_fechado: "",
  local: "",
  briefing: "",
  primeira_data: "",
};

export function ModalJob({
  aberto,
  job,
  clientes,
  aoFechar,
  aoSalvar,
  aoCriarCliente,
}: {
  aberto: boolean;
  job?: JobCompleto | null;
  clientes: Cliente[];
  aoFechar: () => void;
  aoSalvar: (job: Job) => void;
  aoCriarCliente: (cliente: Cliente) => void;
}) {
  const [r, setR] = useState<Rascunho>(VAZIO);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [criandoCliente, setCriandoCliente] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setErro(null);
    if (job) {
      setR({
        titulo: job.titulo,
        cliente_id: job.cliente_id,
        tipo: job.tipo,
        escopo_captacao: job.escopo_captacao,
        escopo_edicao: job.escopo_edicao,
        escopo_tratamento: job.escopo_tratamento,
        prazo_entrega: job.prazo_entrega ?? "",
        valor_fechado: job.valor_fechado === null ? "" : String(job.valor_fechado),
        local: job.local ?? "",
        briefing: job.briefing ?? "",
        primeira_data: "",
      });
    } else {
      setR({ ...VAZIO, cliente_id: clientes[0]?.id ?? "" });
    }
  }, [aberto, job, clientes]);

  function mudar<K extends keyof Rascunho>(campo: K, valor: Rascunho[K]) {
    setR((atual) => ({ ...atual, [campo]: valor }));
  }

  async function salvar() {
    if (!r.titulo.trim()) return setErro("Dê um título ao job.");
    if (!r.cliente_id) return setErro("Escolha um cliente — ou crie um novo aqui mesmo.");

    setSalvando(true);
    setErro(null);

    const dados = {
      titulo: r.titulo.trim(),
      cliente_id: r.cliente_id,
      tipo: r.tipo,
      escopo_captacao: r.escopo_captacao,
      escopo_edicao: r.escopo_edicao,
      escopo_tratamento: r.escopo_tratamento,
      prazo_entrega: r.prazo_entrega || null,
      valor_fechado: r.valor_fechado === "" ? null : Number(r.valor_fechado),
      local: r.local,
      briefing: r.briefing,
    };

    try {
      const salvo = job ? await atualizarJob(job.id, dados) : await criarJob(dados);
      if (!job && r.primeira_data) {
        await adicionarData(salvo.id, { data: r.primeira_data });
      }
      aoSalvar(salvo);
      aoFechar();
    } catch (falha) {
      setErro((falha as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <Modal
        aberto={aberto && !criandoCliente}
        titulo={job ? "Editar job" : "Novo job"}
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
            rotulo="Título"
            largo
            value={r.titulo}
            onChange={(e) => mudar("titulo", e.target.value)}
            placeholder="Casamento Ana & Léo"
            autoFocus
          />

          <div className="campo">
            <span className="campo__rotulo">Cliente</span>
            <div style={{ display: "flex", gap: "var(--esp-2)" }}>
              <select
                className="campo__selecao"
                value={r.cliente_id}
                onChange={(e) => mudar("cliente_id", e.target.value)}
              >
                {clientes.length === 0 && <option value="">Nenhum cliente cadastrado</option>}
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                    {c.empresa ? ` · ${c.empresa}` : ""}
                  </option>
                ))}
              </select>
              <Botao onClick={() => setCriandoCliente(true)} title="Criar cliente sem sair daqui">
                ＋
              </Botao>
            </div>
            <span className="campo__dica">
              Fechou no set? Crie o cliente aqui com o nome e complete depois.
            </span>
          </div>

          <Selecao rotulo="Tipo" value={r.tipo} onChange={(e) => mudar("tipo", e.target.value as TipoJob)}>
            <option value="video">Vídeo</option>
            <option value="foto">Foto</option>
            <option value="ambos">Vídeo e foto</option>
          </Selecao>

          <div className="campo grade__largo">
            <span className="campo__rotulo">Escopo</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--esp-4)" }}>
              <Marcacao
                rotulo="Captação"
                checked={r.escopo_captacao}
                onChange={(e) => mudar("escopo_captacao", e.target.checked)}
              />
              <Marcacao
                rotulo="Edição"
                checked={r.escopo_edicao}
                onChange={(e) => mudar("escopo_edicao", e.target.checked)}
              />
              <Marcacao
                rotulo="Tratamento de foto"
                checked={r.escopo_tratamento}
                onChange={(e) => mudar("escopo_tratamento", e.target.checked)}
              />
            </div>
            <span className="campo__dica">
              Três marcações independentes: resolve “só captação” e “vou editar ou não”.
            </span>
          </div>

          <Campo
            rotulo="Prazo de entrega"
            opcional
            type="date"
            value={r.prazo_entrega}
            onChange={(e) => mudar("prazo_entrega", e.target.value)}
          />

          {!job && (
            <Campo
              rotulo="Primeira captação"
              opcional
              type="date"
              value={r.primeira_data}
              onChange={(e) => mudar("primeira_data", e.target.value)}
              dica="Dá para somar outras diárias depois, dentro do job."
            />
          )}

          <Campo
            rotulo="Cachê"
            opcional
            type="number"
            min={0}
            step="0.01"
            value={r.valor_fechado}
            onChange={(e) => mudar("valor_fechado", e.target.value)}
            placeholder="3000"
            dica="Valor fechado do job. Quando e como esse dinheiro entra é assunto da fase 3."
          />

          <Campo
            rotulo="Local"
            opcional
            largo
            value={r.local}
            onChange={(e) => mudar("local", e.target.value)}
            placeholder="Espaço Villa, Itaipava"
          />

          <Area
            rotulo="Briefing e referências"
            opcional
            largo
            value={r.briefing}
            onChange={(e) => mudar("briefing", e.target.value)}
          />
        </div>
      </Modal>

      <ModalCliente
        aberto={criandoCliente}
        aoFechar={() => setCriandoCliente(false)}
        aoSalvar={(novo) => {
          aoCriarCliente(novo);
          mudar("cliente_id", novo.id);
        }}
      />
    </>
  );
}
