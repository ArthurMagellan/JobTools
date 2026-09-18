import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { aoMudarSessao, sessaoAtual } from "./data/auth";
import { AppShell } from "./components/layout/AppShell";
import { Carregando } from "./components/ui";
import { LoginPage } from "./features/auth/LoginPage";
import { QuadroPage } from "./features/quadro/QuadroPage";
import { ClientesPage } from "./features/clientes/ClientesPage";
import { ClientePage } from "./features/clientes/ClientePage";
import { JobPage } from "./features/jobs/JobPage";

export default function App() {
  const [sessao, setSessao] = useState<Session | null>(null);
  const [verificando, setVerificando] = useState(true);

  useEffect(() => {
    void sessaoAtual().then((s) => {
      setSessao(s);
      setVerificando(false);
    });
    return aoMudarSessao(setSessao);
  }, []);

  if (verificando) {
    return <Carregando texto="Abrindo o JobTools" />;
  }

  if (!sessao) {
    return <LoginPage />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell sessao={sessao} />}>
          <Route index element={<Navigate to="/quadro" replace />} />
          <Route path="/quadro" element={<QuadroPage />} />
          <Route path="/clientes" element={<ClientesPage />} />
          <Route path="/clientes/:id" element={<ClientePage />} />
          <Route path="/jobs/:id" element={<JobPage />} />
          <Route path="*" element={<Navigate to="/quadro" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
