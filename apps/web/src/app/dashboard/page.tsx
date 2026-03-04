"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AuthResponse,
  clearTokens,
  ensureSession,
  getStoredTokens,
  logout,
  refresh,
  saveTokens,
  startAutoRefresh,
} from "@/lib/auth";

type DashboardState = {
  me: unknown;
  auth: AuthResponse;
};

export default function DashboardPage() {
  const router = useRouter();
  const [state, setState] = useState<DashboardState | null>(null);
  const [status, setStatus] = useState("A validar sessão...");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      const session = await ensureSession();

      if (!isMounted) {
        return;
      }

      if (!session) {
        setStatus("Sessão inválida. Redirecionando...");
        router.replace("/");
        return;
      }

      setState({ auth: session.auth, me: session.me });
      setStatus("Sessão ativa.");
      setLoading(false);
    }

    bootstrap().catch(() => {
      setStatus("Erro ao validar sessão.");
      router.replace("/");
    });

    const stopAutoRefresh = startAutoRefresh((auth) => {
      setState((current) =>
        current
          ? {
              ...current,
              auth,
            }
          : current,
      );
      setStatus("Sessão renovada em background.");
    });

    return () => {
      isMounted = false;
      stopAutoRefresh();
    };
  }, [router]);

  async function handleRefreshNow() {
    const { refreshToken } = getStoredTokens();
    if (!refreshToken) {
      setStatus("Refresh token ausente.");
      return;
    }

    setStatus("A renovar sessão...");

    try {
      const auth = await refresh(refreshToken);
      saveTokens(auth);
      setState((current) => (current ? { ...current, auth } : current));
      setStatus("Sessão renovada com sucesso.");
    } catch (error) {
      clearTokens();
      setStatus(error instanceof Error ? error.message : "Falha no refresh.");
      router.replace("/");
    }
  }

  async function handleLogout() {
    const { refreshToken } = getStoredTokens();

    try {
      if (refreshToken) {
        await logout(refreshToken);
      }
    } finally {
      clearTokens();
      setStatus("Logout concluído.");
      router.replace("/");
    }
  }

  if (loading) {
    return (
      <main className="shell">
        <section className="card">
          <h1>A validar sessão...</h1>
          <p className="status">{status}</p>
        </section>
      </main>
    );
  }

  if (!state) {
    return null;
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
