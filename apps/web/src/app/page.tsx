"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
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
import { ToastTone, useToast } from "@/components/toast-provider";
import { humanizeUnknownError } from "@/lib/http-errors";

type Mode = "login" | "register";

export default function Home() {
  const { pushToast } = useToast();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("user1@tchuno.local");
  const [password, setPassword] = useState("abc12345");
  const [name, setName] = useState("User 1");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<AuthResponse | null>(null);
  const [message, setMessage] = useState("Ready");
  const [hasSession, setHasSession] = useState(false);

  const title = useMemo(
    () => (mode === "login" ? "Entrar no Tchuno" : "Criar conta no Tchuno"),
    [mode],
  );

  useEffect(() => {
    const accessToken = localStorage.getItem("tchuno_access_token");
    const refreshToken = localStorage.getItem("tchuno_refresh_token");
    setHasSession(Boolean(accessToken || refreshToken));
  }, []);

  function setFeedback(nextMessage: string, tone: ToastTone = "info"): void {
    setMessage(nextMessage);
    if (tone !== "info") {
      pushToast({ message: nextMessage, tone });
    }
  }

  function validateAuthForm(): string | null {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return "Email inválido.";
    }

    if (
      password.length < 8 ||
      !/[a-zA-Z]/.test(password) ||
      !/[0-9]/.test(password)
    ) {
      return "Password deve ter pelo menos 8 caracteres, 1 letra e 1 número.";
    }

    if (mode === "register") {
      const normalizedName = name.trim();
      if (normalizedName.length > 0 && normalizedName.length < 2) {
        return "Name deve ter pelo menos 2 caracteres.";
      }
    }

    return null;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validateAuthForm();
    if (validationError) {
      setFeedback(validationError, "error");
      return;
    }

    setIsSubmitting(true);
    setMessage("A processar...");

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const auth =
        mode === "login"
          ? await login({ email: normalizedEmail, password })
          : await register({
              email: normalizedEmail,
              password,
              name: name.trim() || undefined,
            });

      setResult(auth);
      saveTokens(auth);
      setHasSession(true);
      setFeedback(`${mode === "login" ? "Login" : "Registo"} com sucesso.`, "success");
    } catch (error) {
      setFeedback(humanizeUnknownError(error, "Erro inesperado no login."), "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onRefresh() {
    const refreshToken = result?.refreshToken ?? localStorage.getItem("tchuno_refresh_token");

    if (!refreshToken) {
      setFeedback("Nenhum refresh token disponível.", "error");
      return;
    }

    setIsSubmitting(true);
    setMessage("A renovar sessão...");

    try {
      const auth = await refresh(refreshToken);
      setResult(auth);
      saveTokens(auth);
      setHasSession(true);
      setFeedback("Sessão renovada.", "success");
    } catch (error) {
      setFeedback(humanizeUnknownError(error, "Erro inesperado no refresh."), "error");
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
      setHasSession(false);
      setFeedback("Sessão terminada.", "success");
    } catch (error) {
      setFeedback(humanizeUnknownError(error, "Erro inesperado no logout."), "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onLogoutAll() {
    const accessToken = result?.accessToken ?? localStorage.getItem("tchuno_access_token");

    if (!accessToken) {
      setFeedback("Access token ausente.", "error");
      return;
    }

    setIsSubmitting(true);
    setMessage("A terminar todas as sessões...");

    try {
      await logoutAll(accessToken);
      setResult(null);
      clearTokens();
      setHasSession(false);
      setFeedback("Todas as sessões foram terminadas.", "success");
    } catch (error) {
      setFeedback(
        humanizeUnknownError(error, "Erro inesperado no logout all."),
        "error",
      );
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
              pattern="(?=.*[A-Za-z])(?=.*[0-9]).{8,}"
              title="Use pelo menos 8 caracteres, incluindo 1 letra e 1 número."
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

        {hasSession ? (
          <p className="status">
            <Link href="/dashboard" className="nav-link">
              Ir para dashboard protegido
            </Link>
          </p>
        ) : (
          <p className="status">Faz login para aceder ao dashboard protegido.</p>
        )}
      </section>
    </main>
  );
}
