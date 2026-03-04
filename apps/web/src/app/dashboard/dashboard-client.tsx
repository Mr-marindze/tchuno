"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthResponse, getMe, logout, refresh, startAutoRefresh } from "@/lib/auth";

type DashboardClientProps = {
  initialAuth: AuthResponse;
  initialMe: unknown;
};

type DashboardState = {
  auth: AuthResponse;
  me: unknown;
};

export default function DashboardClient({
  initialAuth,
  initialMe,
}: DashboardClientProps) {
  const router = useRouter();
  const [state, setState] = useState<DashboardState>({
    auth: initialAuth,
    me: initialMe,
  });
  const [status, setStatus] = useState("Sessão ativa.");

  useEffect(() => {
    const stopAutoRefresh = startAutoRefresh((auth) => {
      setState((current) => ({ ...current, auth }));
      setStatus("Sessão renovada em background.");
    });

    return () => {
      stopAutoRefresh();
    };
  }, []);

  async function handleRefreshNow() {
    setStatus("A renovar sessão...");

    try {
      const auth = await refresh(state.auth.refreshToken);
      const me = await getMe(auth.accessToken);
      setState({ auth, me });
      setStatus("Sessão renovada com sucesso.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falha no refresh.");
      router.replace("/");
    }
  }

  async function handleLogout() {
    try {
      await logout(state.auth.refreshToken);
    } finally {
      setStatus("Logout concluído.");
      router.replace("/");
    }
  }

  return (
    <main className="shell">
      <section className="card">
        <header className="header">
          <p className="kicker">Tchuno Dashboard</p>
          <h1>Área Protegida</h1>
          <p className="subtitle">Somente para utilizadores autenticados.</p>
        </header>

        <div className="actions" style={{ marginTop: "1rem" }}>
          <button type="button" onClick={handleRefreshNow}>
            Refresh Agora
          </button>
          <button type="button" onClick={handleLogout}>
            Logout
          </button>
        </div>

        <p className="status">Status: {status}</p>

        <pre className="result">
          {JSON.stringify(
            {
              me: state.me,
              user: state.auth.user,
              accessToken: `${state.auth.accessToken.slice(0, 24)}...`,
              refreshToken: `${state.auth.refreshToken.slice(0, 24)}...`,
            },
            null,
            2,
          )}
        </pre>

        <p className="status">
          <Link href="/" className="nav-link">
            Voltar ao login
          </Link>
        </p>
      </section>
    </main>
  );
}
