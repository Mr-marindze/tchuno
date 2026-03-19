"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
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
  formatRatingValue,
  formatStars,
  getStatusTone,
  shortenId,
} from "@/components/dashboard/dashboard-formatters";
import { useMarketplaceDiscovery } from "@/components/marketplace/use-marketplace-discovery";
import { MarketplaceWorkerCard } from "@/components/marketplace/marketplace-worker-card";
import {
  buildWorkerRankingContext,
  getWorkerCtaCopy,
  getWorkerComparisonItems,
  getWorkerDecisionBadges,
  getWorkerMainCategoryLabel,
  getWorkerPriceLabel,
  getWorkerReviewLabel,
  getWorkerResponseEtaLabel,
} from "@/components/marketplace/marketplace-worker-presenter";
import { ToastTone, useToast } from "@/components/toast-provider";
import { humanizeUnknownError } from "@/lib/http-errors";
import { trackEvent } from "@/lib/tracking";
import { buildAuthRoute, saveAuthIntent } from "@/lib/access-control";
import styles from "./page.module.css";

type Mode = "login" | "register";

export default function Home() {
  const { pushToast } = useToast();
  const router = useRouter();
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
      mode === "login"
        ? "Entrar no Tchuno"
        : "Criar conta e contratar serviços",
    [mode],
  );
  const workerRanking = useMemo(
    () => buildWorkerRankingContext(visibleWorkers),
    [visibleWorkers],
  );
  const workerHeuristicSnapshot = useMemo(
    () =>
      visibleWorkers.map((worker) => {
        const hasHourlyRate = typeof worker.hourlyRate === "number";
        const ctaCopy = getWorkerCtaCopy({
          isAvailable: worker.isAvailable,
          hasHourlyRate,
        });
        const rankingLabel =
          workerRanking.rankingLabelById[worker.id] ?? "Relevante nesta lista";
        const highlighted =
          workerRanking.strongHighlightById[worker.id] ?? false;

        return {
          workerId: worker.id,
          ctaPrimaryLabel: ctaCopy.primaryLabel,
          relevanceLabel: rankingLabel,
          highlighted,
          ratingRank: workerRanking.ratingRankById[worker.id] ?? null,
          priceRank: workerRanking.priceRankById[worker.id] ?? null,
          relevanceRank: workerRanking.relevanceRankById[worker.id] ?? null,
          relevanceScore: workerRanking.relevanceScoreById[worker.id] ?? 0,
        };
      }),
    [visibleWorkers, workerRanking],
  );
  const rankingSignature = useMemo(
    () =>
      workerHeuristicSnapshot
        .map(
          (item) =>
            `${item.workerId}:${item.ratingRank ?? "-"}:${item.priceRank ?? "-"}:${item.relevanceRank ?? "-"}:${item.relevanceScore.toFixed(3)}`,
        )
        .join("|"),
    [workerHeuristicSnapshot],
  );
  const highlightSignature = useMemo(
    () =>
      workerHeuristicSnapshot
        .map(
          (item) =>
            `${item.workerId}:${item.highlighted ? "1" : "0"}:${item.relevanceLabel ?? "-"}`,
        )
        .join("|"),
    [workerHeuristicSnapshot],
  );
  const ctaSignature = useMemo(
    () =>
      workerHeuristicSnapshot
        .map((item) => `${item.workerId}:${item.ctaPrimaryLabel}`)
        .join("|"),
    [workerHeuristicSnapshot],
  );
  const lastRankingSignatureRef = useRef<string | null>(null);
  const lastHighlightSignatureRef = useRef<string | null>(null);
  const lastCtaSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    const accessToken = localStorage.getItem("tchuno_access_token");
    const refreshToken = localStorage.getItem("tchuno_refresh_token");
    setHasSession(Boolean(accessToken || refreshToken));
  }, []);

  useEffect(() => {
    if (rankingSignature.length === 0) {
      return;
    }

    if (lastRankingSignatureRef.current === rankingSignature) {
      return;
    }

    trackEvent("marketplace.heuristic.ranking.apply", {
      source: "landing.featured_workers",
      view: "landing",
      workerCount: workerHeuristicSnapshot.length,
      workersWithRatingRank: workerHeuristicSnapshot.filter(
        (item) => typeof item.ratingRank === "number",
      ).length,
      workersWithPriceRank: workerHeuristicSnapshot.filter(
        (item) => typeof item.priceRank === "number",
      ).length,
      topWorkers: workerRanking.topWorkersDebug,
    });
    lastRankingSignatureRef.current = rankingSignature;
  }, [
    rankingSignature,
    workerHeuristicSnapshot,
    workerRanking.topWorkersDebug,
  ]);

  useEffect(() => {
    if (highlightSignature.length === 0) {
      return;
    }

    if (lastHighlightSignatureRef.current === highlightSignature) {
      return;
    }

    trackEvent("marketplace.heuristic.highlight.apply", {
      source: "landing.featured_workers",
      view: "landing",
      workerCount: workerHeuristicSnapshot.length,
      highlightedCount: workerHeuristicSnapshot.filter(
        (item) => item.highlighted,
      ).length,
      labels: Array.from(
        new Set(
          workerHeuristicSnapshot
            .map((item) => item.relevanceLabel)
            .filter((value): value is string => Boolean(value)),
        ),
      ),
    });
    lastHighlightSignatureRef.current = highlightSignature;
  }, [highlightSignature, workerHeuristicSnapshot]);

  useEffect(() => {
    if (ctaSignature.length === 0) {
      return;
    }

    if (lastCtaSignatureRef.current === ctaSignature) {
      return;
    }

    trackEvent("marketplace.heuristic.cta.apply", {
      source: "landing.featured_workers",
      view: "landing",
      workerCount: workerHeuristicSnapshot.length,
      labels: Array.from(
        new Set(workerHeuristicSnapshot.map((item) => item.ctaPrimaryLabel)),
      ),
    });
    lastCtaSignatureRef.current = ctaSignature;
  }, [ctaSignature, workerHeuristicSnapshot]);

  function redirectToLoginWithIntent(input: {
    nextPath: string;
    selectedService?: string;
    selectedProviderId?: string;
    sourcePath?: string;
  }): void {
    saveAuthIntent({
      nextPath: input.nextPath,
      sourcePath: input.sourcePath ?? "/",
      selectedService: input.selectedService,
      selectedProviderId: input.selectedProviderId,
    });

    router.push(
      buildAuthRoute({
        mode: "login",
        nextPath: input.nextPath,
      }),
    );
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
      setFeedback(
        `${mode === "login" ? "Login" : "Registo"} com sucesso.`,
        "success",
      );
    } catch (error) {
      setFeedback(
        humanizeUnknownError(error, "Erro inesperado no login."),
        "error",
      );
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
      setFeedback(
        humanizeUnknownError(error, "Erro inesperado no refresh."),
        "error",
      );
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
      setFeedback(
        humanizeUnknownError(error, "Erro inesperado no logout."),
        "error",
      );
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

  const quickCategoryChips = useMemo(
    () => [
      { label: "Canalização", slug: "canalizacao", searchTerm: "canalizador" },
      { label: "Eletricista", slug: "eletricista", searchTerm: "eletricista" },
      { label: "Limpeza", slug: "limpeza", searchTerm: "limpeza" },
      { label: "Pintura", slug: "pintura", searchTerm: "pintura" },
    ],
    [],
  );

  function scrollToDiscoverResults() {
    if (typeof document === "undefined") {
      return;
    }

    document
      .getElementById("discover")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function onSubmitHeroSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    scrollToDiscoverResults();
    trackEvent("marketplace.cta.click", {
      source: "landing.hero",
      view: "landing",
      label: "Pesquisar serviço",
      ctaType: "primary",
      sessionState: hasSession ? "authenticated" : "guest",
    });
  }

  function onQuickCategoryClick(chip: { slug: string; searchTerm: string }) {
    onDiscoverySearchChange(chip.searchTerm);

    const categoryMatch = marketCategories.find((category) => {
      const normalizedName = category.name.trim().toLowerCase();
      const normalizedSlug = category.slug.trim().toLowerCase();
      return normalizedSlug === chip.slug || normalizedName.includes(chip.slug);
    });

    if (categoryMatch && discoveryCategory !== categoryMatch.slug) {
      onToggleDiscoveryCategory(categoryMatch.slug);
    } else if (!categoryMatch && discoveryCategory) {
      onToggleDiscoveryCategory(discoveryCategory);
    }

    scrollToDiscoverResults();
  }

  return (
    <main className={`shell marketplace-shell ${styles.marketplaceHome}`}>
      <section className={`card card--wide ${styles.landingSurface}`}>
        <header className={styles.landingHero} aria-label="Hero da landing">
          <p className={`kicker ${styles.heroKicker}`}>Marketplace Tchuno</p>
          <h1 className={styles.heroTitle}>O que precisas hoje?</h1>
          <p className={`subtitle ${styles.heroSubtitle}`}>
            Encontra profissionais confiáveis perto de ti
          </p>

          <form className={styles.landingSearch} onSubmit={onSubmitHeroSearch}>
            <label
              htmlFor="landing-search-input"
              className={styles.landingSearchLabel}
            >
              Pesquisa principal
            </label>
            <div className={styles.landingSearchRow}>
              <input
                id="landing-search-input"
                type="search"
                value={discoverySearch}
                onChange={(event) =>
                  onDiscoverySearchChange(event.target.value)
                }
                placeholder="Procurar canalizador, eletricista, limpeza..."
                className={styles.landingSearchInput}
              />
              <button
                type="submit"
                className={`primary ${styles.searchSubmit}`}
              >
                Pesquisar
              </button>
            </div>
          </form>

          <div
            className={styles.landingChipRow}
            aria-label="Categorias rápidas"
          >
            {quickCategoryChips.map((chip) => (
              <button
                key={chip.slug}
                type="button"
                className={`marketplace-chip${
                  discoveryCategory === chip.slug ? " is-active" : ""
                }`}
                onClick={() => onQuickCategoryClick(chip)}
              >
                {chip.label}
              </button>
            ))}
          </div>

          <p
            className={`status status--${getStatusTone(
              discoveryMessage,
            )} ${styles.heroStatus}`}
          >
            {discoveryMessage}
          </p>
        </header>

        <section
          className={styles.landingBenefits}
          aria-label="Benefícios principais"
        >
          <article className={styles.landingBenefitCard}>
            <h2>Encontra profissionais confiáveis</h2>
            <p>
              Perfis com reputação, localização e categoria para decidires
              rápido.
            </p>
          </article>
          <article className={styles.landingBenefitCard}>
            <h2>Recebe propostas rapidamente</h2>
            <p>
              Pede serviço em poucos passos e acompanha o estado no dashboard.
            </p>
          </article>
          <article className={styles.landingBenefitCard}>
            <h2>Conclui com segurança</h2>
            <p>
              Vê progresso, confirma entregas e avalia o profissional no fim.
            </p>
          </article>
        </section>

        <section className="marketplace-section" id="discover">
          <div className={styles.marketplaceSectionHeader}>
            <h2 className="section-title">Profissionais em destaque</h2>
            <p className="section-lead">
              Lista rápida para começar. Se precisares de mais opções, abre o
              catálogo completo.
            </p>
          </div>

          <div
            className={`actions actions--inline ${styles.landingResultActions}`}
          >
            <button type="button" onClick={onResetDiscoveryFilters}>
              Limpar filtros
            </button>
            <Link href="/prestadores" className="primary primary--ghost">
              Ver todos os profissionais
            </Link>
          </div>

          <div className={`overview-grid ${styles.landingTrustGrid}`}>
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

          <div
            className="dashboard-nav marketplace-chip-grid"
            aria-label="Categorias"
          >
            {visibleCategories.length === 0 ? (
              <div className="marketplace-empty-state">
                <p className="empty-state">
                  Sem categorias para este termo. Tenta um serviço mais amplo.
                </p>
              </div>
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

          <div className="panel-grid marketplace-worker-grid">
            {discoveryLoading ? (
              <p className="status">A carregar profissionais...</p>
            ) : visibleWorkers.length === 0 ? (
              <div className="marketplace-empty-state">
                <p className="empty-state">
                  Não encontrámos profissionais para este filtro. Ajusta a
                  pesquisa ou remove a categoria selecionada.
                </p>
                <div className="actions actions--inline">
                  <button type="button" onClick={onResetDiscoveryFilters}>
                    Ver todos os profissionais
                  </button>
                  {hasSession ? (
                    <Link
                      href="/prestadores"
                      className="primary primary--ghost"
                    >
                      Abrir catálogo completo
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="primary primary--ghost"
                      onClick={() =>
                        redirectToLoginWithIntent({
                          nextPath: "/app/pedidos",
                          sourcePath: "/",
                          selectedService:
                            discoverySearch.trim() || discoveryCategory || undefined,
                        })
                      }
                    >
                      Entrar para continuar
                    </button>
                  )}
                </div>
              </div>
            ) : (
              visibleWorkers.map((worker) => {
                const hasHourlyRate = typeof worker.hourlyRate === "number";
                const ratingValue = Number(worker.ratingAvg || 0);
                const ctaCopy = getWorkerCtaCopy({
                  isAvailable: worker.isAvailable,
                  hasHourlyRate,
                });
                const rankingLabel =
                  workerRanking.rankingLabelById[worker.id] ??
                  "Relevante nesta lista";
                const isStrongHighlight =
                  workerRanking.strongHighlightById[worker.id] ?? false;
                const scoreBreakdown =
                  workerRanking.scoreBreakdownById[worker.id] ?? null;
                const guestPrimaryLabel = `Entrar para ${ctaCopy.primaryLabel.toLowerCase()}`;
                const responseEta = getWorkerResponseEtaLabel({
                  isAvailable: worker.isAvailable,
                  ratingValue,
                  ratingCount: worker.ratingCount,
                  experienceYears: worker.experienceYears,
                  hourlyRate: worker.hourlyRate,
                  ratingRank: workerRanking.ratingRankById[worker.id] ?? null,
                  priceRank: workerRanking.priceRankById[worker.id] ?? null,
                });
                const decisionBadges = getWorkerDecisionBadges({
                  isAvailable: worker.isAvailable,
                  ratingValue,
                  ratingCount: worker.ratingCount,
                  experienceYears: worker.experienceYears,
                  hourlyRate: worker.hourlyRate,
                  ratingRank: workerRanking.ratingRankById[worker.id] ?? null,
                  priceRank: workerRanking.priceRankById[worker.id] ?? null,
                  rankingLabel,
                  scoreBreakdown,
                });
                const comparisonItems = getWorkerComparisonItems({
                  isAvailable: worker.isAvailable,
                  ratingValue,
                  ratingCount: worker.ratingCount,
                  experienceYears: worker.experienceYears,
                  hourlyRate: worker.hourlyRate,
                  ratingRank: workerRanking.ratingRankById[worker.id] ?? null,
                  priceRank: workerRanking.priceRankById[worker.id] ?? null,
                });
                const priceLabel = getWorkerPriceLabel(worker.hourlyRate);
                const mainCategoryLabel = getWorkerMainCategoryLabel(worker);
                const reviewLabel = getWorkerReviewLabel(worker.ratingCount);

                return (
                  <MarketplaceWorkerCard
                    key={worker.id}
                    title={`Profissional ${shortenId(worker.userId)}`}
                    highlighted={isStrongHighlight}
                    relevanceLabel={rankingLabel}
                    availabilityTone={worker.isAvailable ? "is-ok" : "is-muted"}
                    availabilityLabel={
                      worker.isAvailable ? "Disponível hoje" : "Agenda limitada"
                    }
                    responseTimeLabel={responseEta}
                    rating={{
                      stars: formatStars(worker.ratingAvg),
                      value: formatRatingValue(worker.ratingAvg),
                      reviewCount: worker.ratingCount,
                    }}
                    comparisonItems={comparisonItems}
                    trustSignals={[
                      {
                        label: "Reputação",
                        value:
                          worker.ratingCount > 0
                            ? reviewLabel
                            : "Sem avaliações ainda",
                      },
                      {
                        label: "Categoria principal",
                        value: mainCategoryLabel,
                      },
                    ]}
                    badges={
                      <>
                        {decisionBadges.map((badge) => (
                          <span
                            key={badge.label}
                            className={`status-pill ${badge.tone}`}
                          >
                            {badge.label}
                          </span>
                        ))}
                      </>
                    }
                    details={[
                      {
                        label: "Preço",
                        value: priceLabel,
                      },
                      {
                        label: "Localização",
                        value: worker.location ?? "Não indicada",
                      },
                      {
                        label: "Categoria",
                        value: mainCategoryLabel,
                      },
                    ]}
                    note={worker.bio ?? undefined}
                    ctaHint={
                      hasSession
                        ? ctaCopy.helperText
                        : "Cria conta em segundos para comparar perfis e pedir serviço sem compromisso."
                    }
                    onCardClick={() =>
                      trackEvent("marketplace.worker.card.click", {
                        source: "landing.worker_card",
                        view: "landing",
                        workerId: worker.id,
                        highlighted: isStrongHighlight,
                        relevanceLabel: rankingLabel,
                      })
                    }
                    actions={
                      <>
                        {hasSession ? (
                          <Link
                            href="/app/pedidos#job-create"
                            className="primary"
                            onClick={() =>
                              trackEvent("marketplace.cta.click", {
                                source: "landing.worker_card",
                                view: "landing",
                                workerId: worker.id,
                                label: ctaCopy.primaryLabel,
                                ctaType: "primary",
                                sessionState: "authenticated",
                                pricingContext: hasHourlyRate
                                  ? "fixed-price-or-quote"
                                  : "quote-first",
                              })
                            }
                          >
                            {ctaCopy.primaryLabel}
                          </Link>
                        ) : (
                          <button
                            type="button"
                            className="primary"
                            onClick={() => {
                              trackEvent("marketplace.cta.click", {
                                source: "landing.worker_card",
                                view: "landing",
                                workerId: worker.id,
                                label: guestPrimaryLabel,
                                ctaType: "primary",
                                sessionState: "guest",
                                pricingContext: hasHourlyRate
                                  ? "fixed-price-or-quote"
                                  : "quote-first",
                              });
                              redirectToLoginWithIntent({
                                nextPath: "/app/pedidos#job-create",
                                sourcePath: "/",
                                selectedService:
                                  discoverySearch.trim() ||
                                  mainCategoryLabel ||
                                  undefined,
                                selectedProviderId: worker.id,
                              });
                            }}
                          >
                            {guestPrimaryLabel}
                          </button>
                        )}
                        <Link
                          href={`/prestadores/${worker.userId}`}
                          className="primary primary--ghost"
                        >
                          Ver perfil
                        </Link>
                      </>
                    }
                  />
                );
              })
            )}
          </div>
        </section>

        <section className={styles.landingFinalCta}>
          <h2>Pronto para contratar com confiança?</h2>
          <p>
            Entra no Tchuno e acompanha cada pedido com clareza do início ao
            fim.
          </p>
          <div className="actions actions--inline">
            {hasSession ? (
              <Link
                href="/app"
                className="primary"
                onClick={() =>
                  trackEvent("marketplace.cta.click", {
                    source: "landing.hero",
                    view: "landing",
                    label: "Entrar no Tchuno",
                    ctaType: "primary",
                    sessionState: "authenticated",
                  })
                }
              >
                Entrar no Tchuno
              </Link>
            ) : (
              <button
                type="button"
                className="primary"
                onClick={() => {
                  trackEvent("marketplace.cta.click", {
                    source: "landing.hero",
                    view: "landing",
                    label: "Entrar no Tchuno",
                    ctaType: "primary",
                    sessionState: "guest",
                  });
                  redirectToLoginWithIntent({
                    nextPath: "/app",
                    sourcePath: "/",
                    selectedService:
                      discoverySearch.trim() || discoveryCategory || undefined,
                  });
                }}
              >
                Entrar no Tchuno
              </button>
            )}
            <Link href="/prestadores" className="primary primary--ghost">
              Ver profissionais
            </Link>
          </div>
        </section>

        <section id="auth-panel" className="marketplace-auth">
          <header className="header">
            <p className="kicker">Acesso rápido</p>
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
              {isSubmitting
                ? "Aguarda..."
                : mode === "login"
                  ? "Entrar"
                  : "Criar conta"}
            </button>
          </form>

          <div className="actions actions--inline">
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
              <Link href="/app" className="nav-link">
                Ir para a área autenticada
              </Link>
            </p>
          ) : (
            <p className="status">
              Faz login para aceder ao dashboard protegido.
            </p>
          )}
        </section>
      </section>
    </main>
  );
}
