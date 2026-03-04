"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import {
  AuthResponse,
  API_URL,
  clearTokens,
  login,
  logout,
  logoutAll,
  refresh,
  register,
  saveTokens,
} from "@/lib/auth";

type Mode = "login" | "register";

export default function Home() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("user1@tchuno.local");
  const [password, setPassword] = useState("12345678");
  const [name, setName] = useState("User 1");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<AuthResponse | null>(null);
  const [message, setMessage] = useState("Ready");

  const title = useMemo(
    () => (mode === "login" ? "Entrar no Tchuno" : "Criar conta no Tchuno"),
    [mode],
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("A processar...");

    try {
      const auth =
        mode === "login"
          ? await login({ email, password })
          : await register({ email, password, name: name.trim() || undefined });

      setResult(auth);
      saveTokens(auth);
      setMessage(`${mode === "login" ? "Login" : "Registo"} com sucesso.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onRefresh() {
    const refreshToken = result?.refreshToken ?? localStorage.getItem("tchuno_refresh_token");

    if (!refreshToken) {
      setMessage("Nenhum refresh token disponível.");
      return;
    }

    setIsSubmitting(true);
    setMessage("A renovar sessão...");

    try {
      const auth = await refresh(refreshToken);
      setResult(auth);
      saveTokens(auth);
      setMessage("Sessão renovada.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onLogout() {
    const refreshToken = result?.refreshToken ?? localStorage.getItem("tchuno_refresh_token");

    setIsSubmitting(true);
    setMessage("A terminar sessão...");

    try {
      if (refreshToken) {
        await logout(refreshToken);
      }
      setResult(null);
      clearTokens();
      setMessage("Sessão terminada.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onLogoutAll() {
    const accessToken = result?.accessToken ?? localStorage.getItem("tchuno_access_token");

    if (!accessToken) {
      setMessage("Access token ausente.");
      return;
    }

    setIsSubmitting(true);
    setMessage("A terminar todas as sessões...");

    try {
      await logoutAll(accessToken);
      setResult(null);
      clearTokens();
      setMessage("Todas as sessões foram terminadas.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="shell">
      <section className="card">
        <header className="header">
          <p className="kicker">Tchuno Auth</p>
          <h1>{title}</h1>
          <p className="subtitle">API alvo: {API_URL}</p>
        </header>

        <div className="mode-switch">
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => setMode("login")}
          >
            Login
          </button>
          <button
            type="button"
            className={mode === "register" ? "active" : ""}
            onClick={() => setMode("register")}
          >
            Register
          </button>
        </div>

        <form onSubmit={onSubmit} className="form">
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
            />
          </label>

          {mode === "register" ? (
            <label>
              Name
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
              />
            </label>
          ) : null}

          <button type="submit" disabled={isSubmitting} className="primary">
            {isSubmitting ? "Aguarda..." : mode === "login" ? "Entrar" : "Criar conta"}
          </button>
        </form>

        <div className="actions">
          <button type="button" onClick={onRefresh} disabled={isSubmitting}>
            Refresh
          </button>
          <button type="button" onClick={onLogout} disabled={isSubmitting}>
            Logout
          </button>
          <button type="button" onClick={onLogoutAll} disabled={isSubmitting}>
            Logout All
          </button>
        </div>

        <p className="status">Status: {message}</p>

        <pre className="result">
          {result
            ? JSON.stringify(
                {
                  user: result.user,
                  accessToken: `${result.accessToken.slice(0, 24)}...`,
                  refreshToken: `${result.refreshToken.slice(0, 24)}...`,
                },
                null,
                2,
              )
            : "Sem sessão ativa"}
        </pre>

        <p className="status">
          <Link href="/dashboard" className="nav-link">
            Ir para dashboard protegido
          </Link>
        </p>
      </section>
    </main>
  );
}
