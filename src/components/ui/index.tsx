import { useEffect, useRef, type ReactNode } from "react";
import "./ui.css";

// ---------------------------------------------------------------- botão

type VarianteBotao = "normal" | "principal" | "perigo" | "discreto";

export function Botao({
  variante = "normal",
  pequeno,
  children,
  className = "",
  ...resto
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: VarianteBotao;
  pequeno?: boolean;
}) {
  const classes = [
    "botao",
    variante !== "normal" ? `botao--${variante}` : "",
    pequeno ? "botao--pequeno" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type="button" className={classes} {...resto}>
      {children}
    </button>
  );
}

// ---------------------------------------------------------------- campos

interface BaseCampo {
  rotulo: string;
  opcional?: boolean;
  dica?: string;
  erro?: string;
  largo?: boolean;
}

function Envolucro({
  rotulo,
  opcional,
  dica,
  erro,
  largo,
  children,
}: BaseCampo & { children: ReactNode }) {
  return (
    <label className={`campo ${largo ? "grade__largo" : ""}`}>
      <span className="campo__rotulo">
        {rotulo}
        {opcional && <span className="campo__opcional"> · opcional</span>}
      </span>
      {children}
      {dica && !erro && <span className="campo__dica">{dica}</span>}
      {erro && <span className="campo__erro">{erro}</span>}
    </label>
  );
}

export function Campo({
  rotulo,
  opcional,
  dica,
  erro,
  largo,
  ...resto
}: BaseCampo & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Envolucro rotulo={rotulo} opcional={opcional} dica={dica} erro={erro} largo={largo}>
      <input className="campo__entrada" {...resto} />
    </Envolucro>
  );
}

export function Area({
  rotulo,
  opcional,
  dica,
  erro,
  largo,
  ...resto
}: BaseCampo & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Envolucro rotulo={rotulo} opcional={opcional} dica={dica} erro={erro} largo={largo}>
      <textarea className="campo__area" {...resto} />
    </Envolucro>
  );
}

export function Selecao({
  rotulo,
  opcional,
  dica,
  erro,
  largo,
  children,
  ...resto
}: BaseCampo & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Envolucro rotulo={rotulo} opcional={opcional} dica={dica} erro={erro} largo={largo}>
      <select className="campo__selecao" {...resto}>
        {children}
      </select>
    </Envolucro>
  );
}

export function Marcacao({
  rotulo,
  ...resto
}: { rotulo: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="marcacao">
      <input type="checkbox" {...resto} />
      <span>{rotulo}</span>
    </label>
  );
}

// ---------------------------------------------------------------- etiqueta

type TomEtiqueta = "neutro" | "acento" | "ok" | "atencao" | "perigo" | "macio";

export function Etiqueta({
  tom = "neutro",
  children,
  title,
}: {
  tom?: TomEtiqueta;
  children: ReactNode;
  title?: string;
}) {
  return (
    <span className={`etiqueta ${tom !== "neutro" ? `etiqueta--${tom}` : ""}`} title={title}>
      {children}
    </span>
  );
}

// ---------------------------------------------------------------- aviso

export function Aviso({
  tom = "neutro",
  children,
}: {
  tom?: "neutro" | "erro" | "atencao";
  children: ReactNode;
}) {
  return (
    <div className={`aviso ${tom !== "neutro" ? `aviso--${tom}` : ""}`} role={tom === "erro" ? "alert" : undefined}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------- carregando

export function Carregando({ texto = "Carregando" }: { texto?: string }) {
  return (
    <div className="carregando">
      <span className="girando" aria-hidden="true" />
      <span>{texto}…</span>
    </div>
  );
}

// ---------------------------------------------------------------- painel

export function Painel({
  titulo,
  acao,
  children,
}: {
  titulo: ReactNode;
  acao?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="painel">
      <header className="painel__cabeca">
        <h3 style={{ fontSize: "var(--texto-md)" }}>{titulo}</h3>
        {acao}
      </header>
      <div className="painel__corpo">{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------- modal

export function Modal({
  titulo,
  aberto,
  aoFechar,
  largo,
  rodape,
  children,
}: {
  titulo: string;
  aberto: boolean;
  aoFechar: () => void;
  largo?: boolean;
  rodape?: ReactNode;
  children: ReactNode;
}) {
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") aoFechar();
    };
    document.addEventListener("keydown", aoTeclar);
    caixa.current?.querySelector<HTMLElement>("input, textarea, select, button")?.focus();
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aberto, aoFechar]);

  if (!aberto) return null;

  return (
    <div
      className="modal__fundo"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) aoFechar();
      }}
    >
      <div
        className={`modal ${largo ? "modal--largo" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        ref={caixa}
      >
        <header className="modal__cabeca">
          <h2 style={{ fontSize: "var(--texto-lg)" }}>{titulo}</h2>
          <Botao variante="discreto" pequeno onClick={aoFechar} aria-label="Fechar">
            ✕
          </Botao>
        </header>
        <div className="modal__corpo">{children}</div>
        {rodape && <footer className="modal__rodape">{rodape}</footer>}
      </div>
    </div>
  );
}


// ---------------------------------------------------------------- indicador

/**
 * Bloco de número do topo. Só existe onde o número É o assunto da tela —
 * no financeiro. Espalhar isso por todo lugar achata a hierarquia.
 */
export function Indicador({
  rotulo,
  valor,
  apoio,
  tom = "neutro",
  icone,
}: {
  rotulo: string;
  valor: string;
  apoio?: ReactNode;
  tom?: "neutro" | "acento" | "ok" | "atencao" | "perigo";
  icone?: string;
}) {
  return (
    <article className={`indicador ${tom !== "neutro" ? `indicador--${tom}` : ""}`}>
      {icone && (
        <span className="indicador__icone" aria-hidden="true">
          {icone}
        </span>
      )}
      <div className="indicador__corpo">
        <span className="indicador__valor mono">{valor}</span>
        <span className="indicador__rotulo">{rotulo}</span>
        {apoio && <span className="indicador__apoio">{apoio}</span>}
      </div>
    </article>
  );
}
