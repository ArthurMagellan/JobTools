import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { nomeDeUsuario, sair } from "../../data/auth";
import { exportVencido, exportarTudo, registrarExport } from "../../data/exportar";
import { Aviso } from "../ui";
import "./shell.css";

/** Cada item diz em que fase ele entra — o menu é honesto sobre o que já existe. */
const ITENS = [
  { para: "/quadro", rotulo: "Quadro", icone: "▦", fase: 1 },
  { para: "/calendario", rotulo: "Calendário", icone: "▤", fase: 1 },
  { para: "/clientes", rotulo: "Clientes", icone: "◎", fase: 1 },
  { para: "/financeiro", rotulo: "Financeiro", icone: "◈", fase: 1 },
] as const;

const NOME_DA_ROTA: Record<string, string> = {
  quadro: "Quadro",
  calendario: "Calendário",
  clientes: "Clientes",
  financeiro: "Financeiro",
  jobs: "Job",
};

type Tema = "sistema" | "claro" | "escuro";

function usarTema(): [Tema, () => void] {
  const [tema, setTema] = useState<Tema>(() => {
    try {
      return (localStorage.getItem("jobtools-tema") as Tema) || "sistema";
    } catch {
      return "sistema";
    }
  });

  useEffect(() => {
    const raiz = document.documentElement;
    if (tema === "sistema") raiz.removeAttribute("data-tema");
    else raiz.setAttribute("data-tema", tema);
    try {
      localStorage.setItem("jobtools-tema", tema);
    } catch {
      /* navegador sem armazenamento: o tema só não persiste */
    }
  }, [tema]);

  const alternar = () =>
    setTema((t) => (t === "sistema" ? "escuro" : t === "escuro" ? "claro" : "sistema"));

  return [tema, alternar];
}

export function AppShell({ sessao }: { sessao: Session | null }) {
  const { pathname } = useLocation();
  const [tema, alternarTema] = usarTema();

  const [exportando, setExportando] = useState(false);
  const [vencido, setVencido] = useState(() => exportVencido());
  const [avisoExport, setAvisoExport] = useState<{
    tom: "neutro" | "erro";
    texto: string;
  } | null>(null);

  async function exportar() {
    setExportando(true);
    setAvisoExport(null);
    try {
      const r = await exportarTudo();
      registrarExport();
      setVencido(false);

      const falhas = r.tabelas.filter((t) => t.erro);
      setAvisoExport({
        tom: falhas.length > 0 ? "erro" : "neutro",
        texto:
          falhas.length > 0
            ? `${r.arquivo} baixado com ${r.total} registros, mas ${falhas.length} tabela(s) falharam: ${falhas
                .map((f) => f.nome)
                .join(", ")}. Confira o LEIA-ME dentro do arquivo.`
            : `${r.arquivo} baixado — ${r.total} registros de ${r.tabelas.length} tabelas. Guarde fora deste computador.`,
      });
    } catch (falha) {
      setAvisoExport({ tom: "erro", texto: (falha as Error).message });
    } finally {
      setExportando(false);
    }
  }

  const partes = pathname.split("/").filter(Boolean);
  const secao = partes[0] ?? "quadro";

  return (
    <div className="pagina-fundo">
      <div className="casca">
        <nav className="menu" aria-label="Navegação principal">
          <div className="menu__marca">
            <span className="menu__logo" aria-hidden="true">
              ◐
            </span>
            <span className="menu__nome">JobTools</span>
          </div>

          <ul className="menu__lista">
            {ITENS.map((item) => {
              const pronto = item.fase === 1;
              return (
                <li key={item.para}>
                  {pronto ? (
                    <NavLink
                      to={item.para}
                      className={({ isActive }) =>
                        `menu__item ${isActive ? "menu__item--ativo" : ""}`
                      }
                    >
                      <span className="menu__icone" aria-hidden="true">
                        {item.icone}
                      </span>
                      <span>{item.rotulo}</span>
                    </NavLink>
                  ) : (
                    <span
                      className="menu__item menu__item--futuro"
                      title={`Entra na fase ${item.fase}`}
                      aria-disabled="true"
                    >
                      <span className="menu__icone" aria-hidden="true">
                        {item.icone}
                      </span>
                      <span>{item.rotulo}</span>
                      <span className="menu__fase">fase {item.fase}</span>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="menu__rodape">
            <span className="menu__usuario mono">{nomeDeUsuario(sessao)}</span>
            <button className="menu__sair" onClick={() => void sair()}>
              Sair
            </button>
          </div>
        </nav>

        <main className="conteudo">
          <div className="barra">
            <nav className="barra__trilha" aria-label="Trilha de navegação">
              <Link to="/quadro" aria-label="Início">
                ⌂
              </Link>
              <span aria-hidden="true">›</span>
              <span className="barra__atual">{NOME_DA_ROTA[secao] ?? "Quadro"}</span>
            </nav>

            <div className="barra__acoes">
              {vencido && !exportando && (
                <span className="barra__cobranca" title="O combinado é exportar uma vez por mês">
                  sem backup há mais de 30 dias
                </span>
              )}

              <button
                className="barra__exportar"
                onClick={() => void exportar()}
                disabled={exportando}
                title="Baixa um ZIP com todos os seus dados: CSVs para o Excel e um JSON para restaurar"
              >
                {exportando ? "Exportando…" : "Exportar dados"}
              </button>

              <button
                className="barra__tema"
                onClick={alternarTema}
                title={`Tema: ${tema}. Clique para alternar.`}
                aria-label={`Tema: ${tema}. Alternar.`}
              >
                {tema === "escuro" ? "◑" : tema === "claro" ? "○" : "◐"}
              </button>
            </div>
          </div>

          {avisoExport && (
            <div style={{ marginBottom: "var(--esp-4)" }}>
              <Aviso tom={avisoExport.tom}>{avisoExport.texto}</Aviso>
            </div>
          )}

          <Outlet />
        </main>
      </div>
    </div>
  );
}
