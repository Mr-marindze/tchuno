"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  formatRatingValue,
  formatStars,
} from "@/components/dashboard/dashboard-formatters";
import { useMarketplaceDiscovery } from "@/components/marketplace/use-marketplace-discovery";
import { MarketplaceWorkerCard } from "@/components/marketplace/marketplace-worker-card";
import {
  buildWorkerRankingContext,
  getWorkerCtaCopy,
  getWorkerDecisionBadges,
  getWorkerMainCategoryLabel,
  getWorkerPriceLabel,
} from "@/components/marketplace/marketplace-worker-presenter";
import { buildAuthRoute, saveAuthIntent } from "@/lib/access-control";
import { trackEvent } from "@/lib/tracking";
import { resolveWorkerDisplayName } from "@/lib/worker-profile";
import styles from "./page.module.css";

type QuickAreaChip = {
  label: string;
  categorySlug: string;
};

type JourneyFlow = {
  key: "client" | "provider";
  audience: string;
  title: string;
  steps: string[];
  ctaLabel: string;
  ctaHref: string;
};

const journeyFlows: JourneyFlow[] = [
  {
    key: "client",
    audience: "Para clientes",
    title: "Resolve o teu problema rapidamente",
    steps: [
      "Cria o teu pedido de serviço",
      "Recebe propostas de profissionais reais",
      "Seleciona, paga sinal e acompanha a execução",
    ],
    ctaLabel: "Encontrar profissional",
    ctaHref: "#discover",
  },
  {
    key: "provider",
    audience: "Para profissionais",
    title: "Ganha dinheiro com as tuas competências",
    steps: [
      "Cria o teu perfil em minutos",
      "Recebe pedidos na tua área",
      "Define o teu valor e começa a trabalhar",
    ],
    ctaLabel: "Quero trabalhar no Tchuno",
    ctaHref: "/registo?next=%2Fapp%2Fperfil",
  },
];

export default function Home() {
  const router = useRouter();
  const [hasSession] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    const accessToken = localStorage.getItem("tchuno_access_token");
    const refreshToken = localStorage.getItem("tchuno_refresh_token");
    return Boolean(accessToken || refreshToken);
  });
  const {
    discoveryLoading,
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

  const workerRanking = useMemo(
    () => buildWorkerRankingContext(visibleWorkers),
    [visibleWorkers],
  );
  const featuredPreviewWorkers = useMemo(
    () => visibleWorkers.slice(0, 6),
    [visibleWorkers],
  );
  const quickAreaChips = useMemo<QuickAreaChip[]>(
    () =>
      marketCategories.slice(0, 4).map((category) => ({
        label: category.name,
        categorySlug: category.slug,
      })),
    [marketCategories],
  );
  const trustReviewCount = useMemo(
    () =>
      featuredPreviewWorkers.reduce(
        (total, worker) => total + (worker.ratingCount || 0),
        0,
      ),
    [featuredPreviewWorkers],
  );
  const trustCountValue =
    trustSummary.totalCount >= 5 ? String(trustSummary.totalCount) : "A crescer";
  const trustCountNote =
    trustSummary.totalCount >= 5
      ? "Profissionais disponíveis em várias áreas"
      : "Catálogo em expansão.";
  const trustRatingValue =
    trustReviewCount >= 5 ? `${trustSummary.avgRating}/5` : "Em atualização";
  const trustRatingNote =
    trustReviewCount >= 5
      ? `Com base em ${trustReviewCount} avaliações públicas`
      : "A recolher mais avaliações.";
  const trustResponseEta = useMemo(() => {
    const highConfidence = featuredPreviewWorkers.some(
      (worker) =>
        worker.isAvailable &&
        (worker.ratingCount >= 10 || worker.experienceYears >= 8),
    );
    if (highConfidence) {
      return "~10 min";
    }

    const mediumConfidence = featuredPreviewWorkers.some(
      (worker) =>
        worker.isAvailable &&
        (worker.ratingCount >= 4 || worker.experienceYears >= 4),
    );
    if (mediumConfidence) {
      return "~30 min";
    }

    return "Até 1h";
  }, [featuredPreviewWorkers]);
  const workerHeuristicSnapshot = useMemo(
    () =>
      featuredPreviewWorkers.map((worker) => {
        const hasHourlyRate = typeof worker.hourlyRate === "number";
        const ctaCopy = getWorkerCtaCopy({
          isAvailable: worker.isAvailable,
          hasHourlyRate,
        });

        return {
          workerId: worker.id,
          ctaPrimaryLabel: ctaCopy.primaryLabel,
          relevanceLabel:
            workerRanking.rankingLabelById[worker.id] ?? "Relevante nesta lista",
          highlighted: workerRanking.strongHighlightById[worker.id] ?? false,
          ratingRank: workerRanking.ratingRankById[worker.id] ?? null,
          priceRank: workerRanking.priceRankById[worker.id] ?? null,
          relevanceRank: workerRanking.relevanceRankById[worker.id] ?? null,
          relevanceScore: workerRanking.relevanceScoreById[worker.id] ?? 0,
        };
      }),
    [featuredPreviewWorkers, workerRanking],
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
  }, [rankingSignature, workerHeuristicSnapshot, workerRanking.topWorkersDebug]);

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
      highlightedCount: workerHeuristicSnapshot.filter((item) => item.highlighted)
        .length,
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
      label: "Encontrar profissional",
      ctaType: "primary",
      sessionState: hasSession ? "authenticated" : "guest",
    });
  }

  function onQuickAreaClick(chip: QuickAreaChip) {
    if (discoverySearch.trim().length > 0) {
      onDiscoverySearchChange("");
    }

    onToggleDiscoveryCategory(chip.categorySlug);

    scrollToDiscoverResults();
  }

  return (
    <main className={`shell marketplace-shell ${styles.marketplaceHome}`}>
      <section className={`card card--wide ${styles.landingSurface}`}>
        <header className={styles.landingHero} aria-label="Hero da landing">
          <p className={`kicker ${styles.heroKicker}`}>Tchuno • Marketplace</p>
          <h1 className={styles.heroTitle}>O que precisas hoje?</h1>
          <p className={`subtitle ${styles.heroSubtitle}`}>
            Encontra profissionais de confiança perto de ti.
          </p>

          <form className={styles.landingSearch} onSubmit={onSubmitHeroSearch}>
            <label
              htmlFor="landing-search-input"
              className={styles.srOnly}
            >
              Pesquisa principal
            </label>
            <div className={styles.landingSearchRow}>
              <input
                id="landing-search-input"
                type="search"
                value={discoverySearch}
                onChange={(event) => onDiscoverySearchChange(event.target.value)}
                placeholder="Procurar professor, eletricista, designer..."
                className={styles.landingSearchInput}
              />
              <button type="submit" className={`primary ${styles.searchSubmit}`}>
                Encontrar profissional
              </button>
            </div>
          </form>

          <div className={styles.heroPrimaryActions}>
            <Link href="/registo?next=%2Fapp%2Fperfil" className="primary primary--ghost">
              Quero trabalhar no Tchuno
            </Link>
          </div>

          <div className={styles.landingChipRow} aria-label="Categorias rápidas">
            {quickAreaChips.map((chip) => (
              <button
                key={chip.label}
                type="button"
                className="marketplace-chip"
                onClick={() => onQuickAreaClick(chip)}
              >
                {chip.label}
              </button>
            ))}
          </div>

          <p className={styles.heroPolicy}>
            O valor é acordado por propostas no pedido e o contacto desbloqueia após sinal.
          </p>
        </header>

        <section className={styles.landingTrust} aria-label="Sinais de confiança">
          <div className={styles.marketplaceSectionHeader}>
            <h2 className="section-title">Confiança para decidir rápido</h2>
          </div>
          <div className={`overview-grid ${styles.landingTrustGrid}`}>
            <article className="metric-card">
              <p className="metric-label">Profissionais disponíveis</p>
              <p className="metric-value">{trustCountValue}</p>
              <p className="metric-note">{trustCountNote}</p>
            </article>
            <article className="metric-card">
              <p className="metric-label">Avaliação média</p>
              <p className="metric-value">{trustRatingValue}</p>
              <p className="metric-note">{trustRatingNote}</p>
            </article>
            <article className="metric-card">
              <p className="metric-label">Resposta média estimada</p>
              <p className="metric-value">{trustResponseEta}</p>
              <p className="metric-note">Estimativa baseada no histórico</p>
            </article>
          </div>
        </section>

        <section className="marketplace-section" id="discover">
          <div className={styles.marketplaceSectionHeader}>
            <h2 className="section-title">Profissionais em destaque</h2>
            <p className="section-lead">
              Perfis com melhor equilíbrio entre reputação e disponibilidade.
            </p>
          </div>

          <div className={`actions actions--inline ${styles.landingResultActions}`}>
            <Link href="/prestadores" className="primary primary--ghost">
              Ver catálogo completo
            </Link>
          </div>

          <div className="dashboard-nav marketplace-chip-grid" aria-label="Categorias">
            {visibleCategories.length === 0 ? (
              <div className="marketplace-empty-state">
                <p className="empty-state">
                  Sem categorias para esta pesquisa. Tenta um termo mais amplo.
                </p>
              </div>
            ) : (
              visibleCategories.slice(0, 6).map((category) => (
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
            {visibleCategories.length > 6 ? (
              <Link href="/categorias" className="marketplace-inline-link">
                Ver todas as áreas
              </Link>
            ) : null}
          </div>

          <p className={styles.discoveryPolicy}>
            Valor combinado diretamente entre cliente e profissional.
          </p>

          <div className="panel-grid marketplace-worker-grid">
            {discoveryLoading ? (
              <p className="status">A carregar profissionais...</p>
            ) : featuredPreviewWorkers.length === 0 ? (
              <div className="marketplace-empty-state">
                <p className="empty-state">
                  Não encontrámos profissionais para este filtro. Ajusta a pesquisa ou remove a categoria selecionada.
                </p>
                <div className="actions actions--inline">
                  <button type="button" onClick={onResetDiscoveryFilters}>
                    Ver mais profissionais
                  </button>
                  {hasSession ? (
                    <Link href="/prestadores" className="primary primary--ghost">
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
              featuredPreviewWorkers.map((worker) => {
                const hasHourlyRate = typeof worker.hourlyRate === "number";
                const ratingValue = Number(worker.ratingAvg || 0);
                const ctaCopy = getWorkerCtaCopy({
                  isAvailable: worker.isAvailable,
                  hasHourlyRate,
                });
                const rankingLabel =
                  workerRanking.rankingLabelById[worker.id] ?? "Relevante nesta lista";
                const isStrongHighlight =
                  workerRanking.strongHighlightById[worker.id] ?? false;
                const scoreBreakdown =
                  workerRanking.scoreBreakdownById[worker.id] ?? null;
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
                const priceLabel = getWorkerPriceLabel(worker.hourlyRate);
                const mainCategoryLabel = getWorkerMainCategoryLabel(worker);
                const workerTitle = resolveWorkerDisplayName(worker);

                return (
                  <MarketplaceWorkerCard
                    key={worker.id}
                    title={workerTitle}
                    avatarFallbackLabel={workerTitle}
                    highlighted={isStrongHighlight}
                    relevanceLabel={isStrongHighlight ? rankingLabel : undefined}
                    availabilityTone={worker.isAvailable ? "is-ok" : "is-muted"}
                    availabilityLabel={
                      worker.isAvailable ? "Disponível" : "Agenda limitada"
                    }
                    rating={{
                      stars: formatStars(worker.ratingAvg),
                      value: formatRatingValue(worker.ratingAvg),
                      reviewCount: worker.ratingCount,
                    }}
                    trustSignals={[
                      {
                        label: "Especialidade",
                        value: mainCategoryLabel,
                      },
                    ]}
                    badges={
                      <>
                        {decisionBadges.slice(0, 1).map((badge) => (
                          <span key={badge.label} className={`status-pill ${badge.tone}`}>
                            {badge.label}
                          </span>
                        ))}
                      </>
                    }
                    details={[
                      {
                        label: "Localização",
                        value: worker.location ?? "Não indicada",
                      },
                      {
                        label: "Preço",
                        value: priceLabel,
                      },
                    ]}
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
                      hasSession ? (
                        <Link
                          href="/app/pedidos#novo-pedido"
                          className="primary"
                          onClick={() =>
                            trackEvent("marketplace.cta.click", {
                              source: "landing.worker_card",
                              view: "landing",
                              workerId: worker.id,
                              label: ctaCopy.primaryLabel,
                              ctaType: "primary",
                              sessionState: "authenticated",
                            })
                          }
                        >
                          {ctaCopy.primaryLabel}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          className="primary"
                          onClick={() =>
                            redirectToLoginWithIntent({
                              nextPath: "/app/pedidos#novo-pedido",
                              sourcePath: "/",
                              selectedService:
                                discoverySearch.trim() || mainCategoryLabel || undefined,
                              selectedProviderId: worker.id,
                            })
                          }
                        >
                          Entrar para pedir serviço
                        </button>
                      )
                    }
                    footer={
                      <Link
                        href={`/prestadores/${worker.userId}`}
                        className="marketplace-inline-link"
                      >
                        Ver perfil
                      </Link>
                    }
                  />
                );
              })
            )}
          </div>
        </section>

        <section className="landing-how" aria-label="Como funciona">
          <div className="landing-how-head">
            <h2 className="section-title">Como funciona no Tchuno</h2>
            <p className="section-lead">
              Encontra quem resolve o teu problema ou começa a ganhar com o teu talento.
              Tudo em poucos passos.
            </p>
          </div>

          <div className="landing-how-grid">
            {journeyFlows.map((journey) => (
              <article
                key={journey.audience}
                className={`landing-how-card ${
                  journey.key === "client" ? "is-client" : "is-provider"
                }`}
              >
                <p className="landing-how-audience">{journey.audience}</p>
                <h3>{journey.title}</h3>
                <ol className="landing-how-steps">
                  {journey.steps.map((step, index) => (
                    <li key={step}>
                      <span className="landing-how-step-index">{index + 1}</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
                {journey.ctaHref.startsWith("#") ? (
                  <button
                    type="button"
                    className={`primary landing-how-cta${
                      journey.key === "provider" ? " primary--ghost" : ""
                    }`}
                    onClick={scrollToDiscoverResults}
                  >
                    {journey.ctaLabel}
                  </button>
                ) : (
                  <Link
                    href={journey.ctaHref}
                    className={`primary landing-how-cta${
                      journey.key === "provider" ? " primary--ghost" : ""
                    }`}
                  >
                    {journey.ctaLabel}
                  </Link>
                )}
              </article>
            ))}
          </div>

          <div className="landing-how-final">
            <h3>Começa agora, sem complicação</h3>
            <Link
              href="/login?next=%2Fapp%2Fpedidos"
              className="primary landing-how-final-cta"
            >
              Entrar no Tchuno
            </Link>
          </div>
        </section>

      </section>
    </main>
  );
}
