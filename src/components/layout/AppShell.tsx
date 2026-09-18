import { NavLink, Outlet } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { nomeDeUsuario, sair } from "../../data/auth";
import "./shell.css";

/** Cada item diz em que fase ele entra — o menu é honesto sobre o que já existe. */
const ITENS = [
  { para: "/quadro", rotulo: "Quadro", icone: "▦", fase: 1 },
  { para: "/clientes", rotulo: "Clientes", icone: "◎", fase: 1 },
  { para: "/calendario", rotulo: "Calendário", icone: "▤", fase: 1 },
  { para: "/financeiro", rotulo: "Financeiro", icone: "◈", fase: 3 },
] as const;

export function AppShell({ sessao }: { sessao: Session | null }) {
  return (
    <div className="shell">
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
                    className={({ isActive }) => `menu__item ${isActive ? "menu__item--ativo" : ""}`}
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
        <Outlet />
      </main>
    </div>
  );
}
