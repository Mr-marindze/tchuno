"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import {
  type AppRole,
  buildAuthRoute,
  consumeAuthIntent,
  getRoleHomePath,
  isSafeInternalPath,
  readAuthIntent,
  resolveAppRoleFromMe,
  resolvePostLoginPath,
} from "@/lib/access-control";
import {
  AuthResponse,
  ensureSession,
  login,
  register,
  saveTokens,
} from "@/lib/auth";
import { humanizeUnknownError } from "@/lib/http-errors";

type AuthMode = "login" | "register";

type AuthEntryFormProps = {
  mode: AuthMode;
};

function getSafeQueryNext(searchParams: URLSearchParams | null): string | null {
  const next = searchParams?.get("next") ?? null;
  return isSafeInternalPath(next) ? next : null;
}

function getForceLoginFlag(searchParams: URLSearchParams | null): boolean {
  const value = (searchParams?.get("force") ?? "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

function getDefaultPath(auth: AuthResponse, me: unknown): string {
  const fallbackRole =
    auth.user.role === "ADMIN"
      ? auth.user.adminSubrole === "SUPPORT_ADMIN"
        ? "support_admin"
        : auth.user.adminSubrole === "OPS_ADMIN"
          ? "ops_admin"
          : auth.user.adminSubrole === "SUPER_ADMIN"
            ? "super_admin"
            : "admin"
      : "customer";
  const role = resolveAppRoleFromMe(me) ?? fallbackRole;
  return getRoleHomePath(role);
}

function getResolvedRole(auth: AuthResponse, me: unknown): AppRole {
  const fallbackRole =
    auth.user.role === "ADMIN"
      ? auth.user.adminSubrole === "SUPPORT_ADMIN"
        ? "support_admin"
        : auth.user.adminSubrole === "OPS_ADMIN"
          ? "ops_admin"
          : auth.user.adminSubrole === "SUPER_ADMIN"
            ? "super_admin"
            : "admin"
      : "customer";

  return resolveAppRoleFromMe(me) ?? fallbackRole;
}

export function AuthEntryForm({ mode }: AuthEntryFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("user1@tchuno.local");
  const [password, setPassword] = useState("abc12345");
  const [name, setName] = useState("User 1");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState("Pronto para autenticar.");
  const [intentPreview, setIntentPreview] = useState<ReturnType<typeof readAuthIntent>>(null);
  const [safeNextPath, setSafeNextPath] = useState<string | null>(null);
  const [forceLogin, setForceLogin] = useState(false);

  useEffect(() => {
    setIntentPreview(readAuthIntent());

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      setSafeNextPath(getSafeQueryNext(params));
      setForceLogin(getForceLoginFlag(params));
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      if (forceLogin) {
        return;
      }

      const session = await ensureSession();
      if (!active || !session) {
        return;
      }

      const destination = resolvePostLoginPath({
        nextPath: safeNextPath,
        fallbackPath: getDefaultPath(session.auth, session.me),
        role: getResolvedRole(session.auth, session.me),
      });
      router.replace(destination);
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, [forceLogin, router, safeNextPath]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = name.trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setStatus("Email inválido.");
      return;
    }

    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setStatus("Password deve ter pelo menos 8 caracteres, 1 letra e 1 número.");
      return;
    }

    setIsSubmitting(true);
    setStatus(mode === "login" ? "A iniciar sessão..." : "A criar conta...");

    try {
      const auth =
        mode === "login"
          ? await login({ email: normalizedEmail, password })
          : await register({
              email: normalizedEmail,
              password,
              name: normalizedName.length > 0 ? normalizedName : undefined,
            });

      saveTokens(auth);
      const session = await ensureSession();
      const consumedIntent = consumeAuthIntent();

      const destination = resolvePostLoginPath({
        nextPath: safeNextPath ?? consumedIntent?.nextPath,
        fallbackPath: session ? getDefaultPath(session.auth, session.me) : "/app",
        role: session ? getResolvedRole(session.auth, session.me) : "guest",
      });

      setStatus(mode === "login" ? "Sessão iniciada com sucesso." : "Conta criada com sucesso.");
      router.replace(destination);
    } catch (error) {
      setStatus(
        humanizeUnknownError(
          error,
          mode === "login" ? "Falha ao iniciar sessão." : "Falha ao criar conta.",
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="shell">
      <section className="card">
        <header className="header">
          <p className="kicker">Autenticação</p>
          <h1>{mode === "login" ? "Entrar" : "Criar conta"}</h1>
          <p className="subtitle">
            {mode === "login"
              ? forceLogin
                ? "Entra com outra conta. Depois do login vais para a área certa dessa conta."
                : "Acede para continuar do ponto certo."
              : "Cria a tua conta e começa a pedir ou prestar serviços."}
          </p>
        </header>

        <form className="form" onSubmit={onSubmit}>
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
              Nome (opcional)
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
              />
            </label>
          ) : null}

          <button type="submit" className="primary" disabled={isSubmitting}>
            {isSubmitting
              ? "Aguarda..."
              : mode === "login"
                ? "Entrar"
                : "Criar conta"}
          </button>
        </form>

        <div className="actions actions--inline">
          {mode === "login" ? (
            <Link href={buildAuthRoute({ mode: "register", nextPath: safeNextPath ?? undefined })}>
              Ainda não tens conta? Regista-te
            </Link>
          ) : (
            <Link href={buildAuthRoute({ mode: "login", nextPath: safeNextPath ?? undefined })}>
              Já tens conta? Faz login
            </Link>
          )}
          <Link href="/recuperar-senha">Recuperar senha</Link>
        </div>

        {intentPreview ? (
          <p className="status">
            Continuação guardada: <strong>{intentPreview.nextPath}</strong>
          </p>
        ) : null}

        <p className="status">{status}</p>
      </section>
    </main>
  );
}
