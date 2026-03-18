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
import {
  formatCurrencyMzn,
  formatRatingValue,
  formatStars,
  getStatusTone,
  shortenId,
} from "@/components/dashboard/dashboard-formatters";
import { useMarketplaceDiscovery } from "@/components/marketplace/use-marketplace-discovery";
import { MarketplaceWorkerCard } from "@/components/marketplace/marketplace-worker-card";
import {
  getWorkerCtaCopy,
  getWorkerRelevance,
} from "@/components/marketplace/marketplace-worker-presenter";
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
  const {
    discoveryLoading,
    discoveryMessage,
    discoverySearch,
    discoveryCategory,
    marketCategories,
    visibleCategories,
    visibleWorkers,
    trustSummary,
    onDiscoverySearchChange,
    onToggleDiscoveryCategory,
    onResetDiscoveryFilters,
  } = useMarketplaceDiscovery();

  const title = useMemo(
    () =>
      mode === "login" ? "Entrar no Tchuno" : "Criar conta e contratar serviços",
    [mode],
  );

  useEffect(() => {
    const accessToken = localStorage.getItem("tchuno_access_token");
    const refreshToken = localStorage.getItem("tchuno_refresh_token");
    setHasSession(Boolean(accessToken || refreshToken));
  }, []);

  function focusAuth(targetMode: Mode = "login"): void {
    setMode(targetMode);
    if (typeof document !== "undefined") {
      document
        .getElementById("auth-panel")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

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
    const refreshToken =
      result?.refreshToken ?? localStorage.getItem("tchuno_refresh_token");

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
    const refreshToken =
      result?.refreshToken ?? localStorage.getItem("tchuno_refresh_token");

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
    const accessToken =
      result?.accessToken ?? localStorage.getItem("tchuno_access_token");

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
    <main className="shell marketplace-shell">
      <section className="card card--wide marketplace-layout">
        <div className="marketplace-main">
          <header className="header marketplace-hero">
            <p className="kicker">Tchuno Marketplace</p>
            <h1>Encontra profissionais locais e contrata com confiança</h1>
            <p className="subtitle">
              Descobre serviços por categoria, valida reputação e cria pedidos com
              acompanhamento claro do início à conclusão.
            </p>
          </header>

          <div className="actions actions--inline marketplace-hero-actions">
            <div className="actions actions--inline marketplace-hero-actions-main">
              {hasSession ? (
                <Link href="/dashboard/jobs" className="primary">
                  Criar pedido agora
                </Link>
              ) : (
                <button
                  type="button"
                  className="primary"
                  onClick={() => focusAuth("login")}
                >
                  Entrar para contratar
                </button>
              )}
            </div>
            <p className="marketplace-hero-secondary">
              {hasSession ? (
                <>
                  Preferes explorar primeiro?{" "}
                  <Link href="/dashboard/workers" className="nav-link">
                    Ver catálogo de profissionais
                  </Link>
                </>
              ) : (
                <>
                  Ainda sem conta?{" "}
                  <button
                    type="button"
                    className="marketplace-inline-link"
                    onClick={() => focusAuth("register")}
                  >
                    Criar conta gratuita
                  </button>
                </>
              )}
            </p>
          </div>

          <p className={`status status--${getStatusTone(discoveryMessage)}`}>
            {discoveryMessage}
          </p>

          <section className="marketplace-section" id="discover">
            <h2 className="section-title">Descoberta de serviços</h2>
            <p className="section-lead">
              Pesquisa por serviço, localização ou categoria. Depois abre o dashboard
              para avançar com pedido e contratação.
            </p>

            <div className="section-toolbar marketplace-search-toolbar">
              <label>
                Pesquisa principal
                <input
                  type="search"
                  value={discoverySearch}
                  onChange={(event) => onDiscoverySearchChange(event.target.value)}
                  placeholder="Ex.: eletricista, canalização, Matola"
                />
              </label>
              <button type="button" onClick={onResetDiscoveryFilters}>
                Limpar pesquisa
              </button>
            </div>

            <div className="dashboard-nav marketplace-chip-grid" aria-label="Categorias">
              {visibleCategories.length === 0 ? (
                <span className="empty-state">Sem categorias para este termo.</span>
              ) : (
                visibleCategories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    className={`marketplace-chip${
                      discoveryCategory === category.slug ? " is-active" : ""
                    }`}
                    onClick={() => onToggleDiscoveryCategory(category.slug)}
                  >
                    {category.name}
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="marketplace-section">
            <h2 className="section-title">Profissionais em destaque</h2>
            <p className="section-lead">
              Catálogo rápido com sinais de confiança para acelerar a decisão de
              contratação.
            </p>

            <div className="overview-grid">
              <article className="metric-card">
                <p className="metric-label">Disponíveis</p>
                <p className="metric-value">{trustSummary.availableCount}</p>
              </article>
              <article className="metric-card">
                <p className="metric-label">Com avaliações</p>
                <p className="metric-value">{trustSummary.ratedCount}</p>
              </article>
              <article className="metric-card">
                <p className="metric-label">Rating médio</p>
                <p className="metric-value">{trustSummary.avgRating}/5</p>
              </article>
              <article className="metric-card">
                <p className="metric-label">Categorias ativas</p>
                <p className="metric-value">{marketCategories.length}</p>
              </article>
            </div>

            <div className="panel-grid marketplace-worker-grid">
              {discoveryLoading ? (
                <p className="status">A carregar profissionais...</p>
              ) : visibleWorkers.length === 0 ? (
                <p className="empty-state">
                  Não encontrámos profissionais para este filtro. Ajusta a pesquisa
                  ou remove a categoria selecionada.
                </p>
              ) : (
                visibleWorkers.map((worker, index) => {
                  const hasHourlyRate = typeof worker.hourlyRate === "number";
                  const ctaCopy = getWorkerCtaCopy({
                    isAvailable: worker.isAvailable,
                    hasHourlyRate,
                  });
                  const relevance = getWorkerRelevance({
                    isAvailable: worker.isAvailable,
                    ratingValue: Number(worker.ratingAvg || 0),
                    ratingCount: worker.ratingCount,
                  });
                  const guestPrimaryLabel = ctaCopy.primaryLabel.startsWith("Contactar")
                    ? "Entrar para contactar"
                    : `Entrar para ${ctaCopy.primaryLabel.toLowerCase()}`;

                  return (
                    <MarketplaceWorkerCard
                      key={worker.id}
                      title={`Profissional ${shortenId(worker.userId)}`}
                      highlighted={index < 2 || relevance.highlighted}
                      relevanceLabel={relevance.label ?? undefined}
                      availabilityTone={worker.isAvailable ? "is-ok" : "is-muted"}
                      availabilityLabel={worker.isAvailable ? "Disponível" : "Indisponível"}
                      rating={{
                        stars: formatStars(worker.ratingAvg),
                        value: formatRatingValue(worker.ratingAvg),
                        reviewCount: worker.ratingCount,
                      }}
                      trustSignals={[
                        {
                          label: "Avaliações",
                          value: worker.ratingCount,
                        },
                        {
                          label: "Experiência",
                          value: `${worker.experienceYears} anos`,
                        },
                      ]}
                      details={[
                        {
                          label: "Localização",
                          value: worker.location ?? "Não indicada",
                        },
                        {
                          label: "Preço/hora",
                          value: formatCurrencyMzn(worker.hourlyRate),
                        },
                        {
                          label: "Categorias",
                          value:
                            worker.categories.length > 0
                              ? worker.categories.map((item) => item.name).join(", ")
                              : "Sem categorias",
                        },
                      ]}
                      note={worker.bio ?? undefined}
                      actions={
                        <>
                          {hasSession ? (
                            <Link href="/dashboard/jobs#job-create" className="primary">
                              {ctaCopy.primaryLabel}
                            </Link>
                          ) : (
                            <button
                              type="button"
                              className="primary"
                              onClick={() => focusAuth("login")}
                            >
                              {guestPrimaryLabel}
                            </button>
                          )}
                          <Link href="/dashboard/workers" className="primary primary--ghost">
                            Ver catálogo completo
                          </Link>
                        </>
                      }
                    />
                  );
                })
              )}
            </div>
          </section>

          <section className="marketplace-section marketplace-journey">
            <h2 className="section-title">Como funciona no Tchuno</h2>
            <div className="flow-summary">
              <article className="flow-summary-item">
                <p className="metric-label">1. Descobrir</p>
                <p className="metric-note">
                  Escolhe categoria e profissional com base em reputação,
                  disponibilidade e localização.
                </p>
              </article>
              <article className="flow-summary-item">
                <p className="metric-label">2. Pedir</p>
                <p className="metric-note">
                  Cria o pedido com descrição clara e orçamento em preço fixo ou
                  cotação.
                </p>
              </article>
              <article className="flow-summary-item">
                <p className="metric-label">3. Acompanhar</p>
                <p className="metric-note">
                  Segue estado, timeline e próxima ação até concluir e avaliar.
                </p>
              </article>
            </div>
          </section>
        </div>

        <aside id="auth-panel" className="marketplace-auth">
          <header className="header">
            <p className="kicker">Acesso</p>
            <h2>{title}</h2>
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
              Registar
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
                Nome
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
              Renovar sessão
            </button>
            <button type="button" onClick={onLogout} disabled={isSubmitting}>
              Terminar sessão
            </button>
            <button type="button" onClick={onLogoutAll} disabled={isSubmitting}>
              Terminar todas
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
        </aside>
      </section>
    </main>
  );
}
