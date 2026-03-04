"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AuthResponse,
  clearTokens,
  DeviceSession,
  ensureSession,
  getStoredTokens,
  listSessions,
  logout,
  logoutAll,
  refresh,
  revokeSession,
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
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
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
      const deviceSessions = await listSessions(session.auth.accessToken);
      setSessions(deviceSessions);
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
      const deviceSessions = await listSessions(auth.accessToken);
      setSessions(deviceSessions);
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

  async function handleLogoutAll() {
    const { accessToken } = getStoredTokens();

    if (!accessToken) {
      setStatus("Access token ausente.");
      return;
    }

    try {
      await logoutAll(accessToken);
    } finally {
      clearTokens();
      setStatus("Todas as sessões foram terminadas.");
      router.replace("/");
    }
  }

  async function handleRevokeSession(sessionId: string) {
    const { accessToken } = getStoredTokens();

    if (!accessToken) {
      setStatus("Access token ausente.");
      return;
    }

    try {
      await revokeSession(accessToken, sessionId);
      const deviceSessions = await listSessions(accessToken);
      setSessions(deviceSessions);
      setStatus("Sessão revogada.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falha ao revogar sessão.");
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
          <button type="button" onClick={handleLogoutAll}>
            Logout All
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

        <h2 style={{ marginTop: "1rem", fontWeight: 700 }}>Dispositivos/Sessões</h2>
        <div className="result">
          {sessions.length === 0 ? (
            <p>Sem sessões registadas.</p>
          ) : (
            sessions.map((session) => (
              <div key={session.id} style={{ marginBottom: "0.8rem", borderBottom: "1px solid rgba(186,230,253,0.2)", paddingBottom: "0.7rem" }}>
                <p><strong>deviceId:</strong> {session.deviceId}</p>
                <p><strong>ip:</strong> {session.ip ?? "n/a"}</p>
                <p><strong>lastUsedAt:</strong> {session.lastUsedAt}</p>
                <p><strong>status:</strong> {session.revokedAt ? "revogada" : "ativa"}</p>
                <button
                  type="button"
                  onClick={() => handleRevokeSession(session.id)}
                  disabled={Boolean(session.revokedAt)}
                >
                  Revogar sessão
                </button>
              </div>
            ))
          )}
        </div>

        <p className="status">
          <Link href="/" className="nav-link">
            Voltar ao login
          </Link>
        </p>
      </section>
    </main>
  );
}
