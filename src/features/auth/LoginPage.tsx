import { useState, type FormEvent } from "react";
import { entrar } from "../../data/auth";
import { Aviso, Botao, Campo } from "../../components/ui";
import "./login.css";

export function LoginPage() {
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEntrando(true);
    try {
      await entrar(usuario, senha);
      // A sessão nova dispara o redirecionamento em App.tsx.
    } catch (falha) {
      setErro((falha as Error).message);
      setEntrando(false);
    }
  }

  return (
    <div className="login">
      <form className="login__caixa" onSubmit={enviar}>
        <div className="login__marca">
          <span className="login__logo" aria-hidden="true">
            ◐
          </span>
          <h1>JobTools</h1>
        </div>
        <p className="login__linha">Controle de demandas, agenda e faturamento.</p>

        {erro && <Aviso tom="erro">{erro}</Aviso>}

        <Campo
          rotulo="Usuário"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          placeholder="magellanarthur"
        />

        <Campo
          rotulo="Senha"
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          autoComplete="current-password"
          required
        />

        <Botao
          type="submit"
          variante="principal"
          disabled={entrando || !usuario || !senha}
          className="login__botao"
        >
          {entrando ? "Entrando…" : "Entrar"}
        </Botao>
      </form>
    </div>
  );
}
