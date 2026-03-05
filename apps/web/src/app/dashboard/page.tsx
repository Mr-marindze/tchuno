"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
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
  SessionListQuery,
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
  const [statusFilter, setStatusFilter] = useState<SessionListQuery["status"]>("active");
  const [sort, setSort] = useState<SessionListQuery["sort"]>("lastUsedAt:desc");
  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState("A validar sessão...");
  const [loading, setLoading] = useState(true);

  const loadSessions = useCallback(
    async (accessToken: string) => {
      const deviceSessions = await listSessions(accessToken, {
        status: statusFilter,
        sort,
        limit,
        offset,
      });
      setSessions(deviceSessions);
    },
    [statusFilter, sort, limit, offset],
  );

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

  useEffect(() => {
    if (!state?.auth.accessToken) {
      return;
    }

    loadSessions(state.auth.accessToken).catch((error) => {
      setStatus(error instanceof Error ? error.message : "Falha ao carregar sessões.");
    });
  }, [state?.auth.accessToken, loadSessions]);

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
      await loadSessions(auth.accessToken);
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
      await loadSessions(accessToken);
      setStatus("Sessão revogada.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falha ao revogar sessão.");
    }
  }

  async function handleReloadSessions() {
    const { accessToken } = getStoredTokens();

    if (!accessToken) {
      setStatus("Access token ausente.");
      return;
    }

    try {
      await loadSessions(accessToken);
      setStatus("Sessões recarregadas.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falha ao carregar sessões.");
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
        <div className="actions" style={{ marginBottom: "0.8rem" }}>
          <select
            value={statusFilter}
            onChange={(event) => {
              setOffset(0);
              setStatusFilter(event.target.value as SessionListQuery["status"]);
            }}
          >
            <option value="active">Ativas</option>
            <option value="revoked">Revogadas</option>
            <option value="all">Todas</option>
          </select>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SessionListQuery["sort"])}
          >
            <option value="lastUsedAt:desc">Último uso (desc)</option>
            <option value="lastUsedAt:asc">Último uso (asc)</option>
            <option value="createdAt:desc">Criação (desc)</option>
            <option value="createdAt:asc">Criação (asc)</option>
          </select>
          <select
            value={String(limit)}
            onChange={(event) => {
              setOffset(0);
              setLimit(Number(event.target.value));
            }}
          >
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
          </select>
          <button type="button" onClick={handleReloadSessions}>
            Recarregar
          </button>
        </div>
        <div className="actions" style={{ marginBottom: "0.8rem" }}>
          <button
            type="button"
            onClick={() => setOffset((current) => Math.max(0, current - limit))}
            disabled={offset === 0}
          >
            Página anterior
          </button>
          <button
            type="button"
            onClick={() => setOffset((current) => current + limit)}
            disabled={sessions.length < limit}
          >
            Próxima página
          </button>
          <p className="status">Offset atual: {offset}</p>
        </div>
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
