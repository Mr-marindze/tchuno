"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  formatRatingValue,
  formatStars,
  getStatusTone,
} from "@/components/dashboard/dashboard-formatters";
import { useMarketplaceDiscovery } from "@/components/marketplace/use-marketplace-discovery";
import { MarketplaceWorkerCard } from "@/components/marketplace/marketplace-worker-card";
import {
  buildWorkerRankingContext,
  getWorkerCtaCopy,
  getWorkerDecisionBadges,
  getWorkerMainCategoryLabel,
  getWorkerPriceLabel,
  getWorkerResponseEtaLabel,
} from "@/components/marketplace/marketplace-worker-presenter";
import { buildAuthRoute, saveAuthIntent } from "@/lib/access-control";
import { trackEvent } from "@/lib/tracking";
import { resolveWorkerDisplayName } from "@/lib/worker-profile";
import styles from "./page.module.css";

type QuickAreaChip = {
  label: string;
  searchTerm: string;
  categorySlugHint?: string;
};

type JourneyFlow = {
  audience: string;
  title: string;
  summary: string;
  steps: string[];
  ctaLabel: string;
  ctaHref: string;
};

const quickAreaChips: QuickAreaChip[] = [
  {
    label: "Casa & Reparações",
    searchTerm: "canalizador",
    categorySlugHint: "canalizacao",
  },
  {
    label: "Aulas & Formação",
    searchTerm: "explicador",
  },
  {
    label: "Saúde & Bem-estar",
    searchTerm: "fisioterapeuta",
  },
  {
    label: "Jurídico & Consultoria",
    searchTerm: "advogado",
  },
  {
    label: "Negócios & Digital",
    searchTerm: "designer",
  },
  {
    label: "Eventos & Criativos",
    searchTerm: "fotógrafo",
  },
];

const journeyFlows: JourneyFlow[] = [
  {
    audience: "Para clientes",
    title: "Encontra e contrata com clareza",
    summary: "Tudo em poucos passos, sem complicação.",
    steps: [
      "Diga o que precisa.",
      "Receba respostas dos profissionais.",
      "Escolha o profissional ideal para si.",
    ],
    ctaLabel: "Encontrar profissional",
    ctaHref: "#discover",
  },
  {
    audience: "Para profissionais",
    title: "Cria oportunidades com o teu talento",
    summary: "Mostra o teu perfil e recebe pedidos de várias áreas.",
    steps: [
      "Crie o seu perfil profissional.",
      "Receba pedidos alinhados à sua área.",
      "Ganhe pelo seu trabalho com valor negociado.",
    ],
    ctaLabel: "Quero trabalhar no Tchuno",
    ctaHref: "/registo?next=%2Fpro%2Fperfil",
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

  const workerRanking = useMemo(
    () => buildWorkerRankingContext(visibleWorkers),
    [visibleWorkers],
  );
  const featuredPreviewWorkers = useMemo(
    () => visibleWorkers.slice(0, 6),
    [visibleWorkers],
  );
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
    onDiscoverySearchChange(chip.searchTerm);

    const categoryMatch = marketCategories.find((category) => {
      const normalizedName = category.name.trim().toLowerCase();
      const normalizedSlug = category.slug.trim().toLowerCase();
      const normalizedHint = chip.categorySlugHint?.trim().toLowerCase();

      if (!normalizedHint) {
        return false;
      }

      return (
        normalizedSlug === normalizedHint ||
        normalizedName.includes(normalizedHint)
      );
    });

    if (categoryMatch && discoveryCategory !== categoryMatch.slug) {
      onToggleDiscoveryCategory(categoryMatch.slug);
    }

    scrollToDiscoverResults();

    trackEvent("marketplace.category.select", {
      source: "landing.discovery",
      view: "landing",
      categorySlug: categoryMatch?.slug ?? null,
      previousCategorySlug: discoveryCategory || null,
      categoryCount: marketCategories.length,
      resultCount: visibleWorkers.length,
    });
  }

  return (
    <main className={`shell marketplace-shell ${styles.marketplaceHome}`}>
      <section className={`card card--wide ${styles.landingSurface}`}>
        <header className={styles.landingHero} aria-label="Hero da landing">
          <p className={`kicker ${styles.heroKicker}`}>Tchuno • Marketplace</p>
          <h1 className={styles.heroTitle}>O que precisas hoje?</h1>
          <p className={`subtitle ${styles.heroSubtitle}`}>
            Encontra profissionais confiáveis perto de ti.
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
                onChange={(event) => onDiscoverySearchChange(event.target.value)}
                placeholder="Procurar canalizador, eletricista, limpeza..."
                className={styles.landingSearchInput}
              />
              <button type="submit" className={`primary ${styles.searchSubmit}`}>
                Encontrar profissional
              </button>
            </div>
          </form>

          <div className={styles.heroPrimaryActions}>
            <button
              type="button"
              className="primary"
              onClick={scrollToDiscoverResults}
            >
              Encontrar profissional
            </button>
            <Link href="/registo?next=%2Fpro%2Fperfil" className="primary primary--ghost">
              Registar-me como profissional
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

          <p className={`status status--${getStatusTone(discoveryMessage)} ${styles.heroStatus}`}>
            {discoveryMessage}
          </p>
          <p className={styles.heroPolicy}>
            O valor final é negociado entre cliente e profissional dentro do Tchuno.
          </p>
        </header>

        <section className={styles.landingTrust} aria-label="Sinais de confiança">
          <div className={styles.marketplaceSectionHeader}>
            <h2 className="section-title">Confiança para decidir rápido</h2>
          </div>
          <div className={`overview-grid ${styles.landingTrustGrid}`}>
            <article className="metric-card">
              <p className="metric-label">Profissionais em destaque</p>
              <p className="metric-value">{trustSummary.totalCount}</p>
              <p className="metric-note">
                Profissionais disponíveis em várias áreas
              </p>
            </article>
            <article className="metric-card">
              <p className="metric-label">Avaliação média</p>
              <p className="metric-value">{trustSummary.avgRating}/5</p>
              <p className="metric-note">Com base em avaliações públicas</p>
            </article>
            <article className="metric-card">
              <p className="metric-label">Resposta média estimada</p>
              <p className="metric-value">{trustResponseEta}</p>
              <p className="metric-note">Estimativa baseada no histórico</p>
            </article>
          </div>
        </section>

        <section className={styles.landingAreas} aria-label="Grandes áreas de serviço">
          <div className={styles.marketplaceSectionHeader}>
            <h2 className="section-title">Grandes áreas de serviço</h2>
            <p className="section-lead">
              O Tchuno liga clientes a profissionais de várias áreas, não só serviços domésticos.
            </p>
          </div>
          <div className={styles.landingAreasGrid}>
            {quickAreaChips.map((chip) => (
              <button
                key={`area-${chip.label}`}
                type="button"
                className={styles.landingAreaCard}
                onClick={() => onQuickAreaClick(chip)}
              >
                <p className={styles.landingAreaTitle}>{chip.label}</p>
                <p className={styles.landingAreaHint}>Explorar profissionais</p>
              </button>
            ))}
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
            <button type="button" onClick={onResetDiscoveryFilters}>
              Limpar filtros
            </button>
            <Link href="/prestadores" className="primary primary--ghost">
              Ver catálogo completo
            </Link>
          </div>

          <p className={styles.discoveryPolicy}>
            O Tchuno não fixa preços. Cliente e profissional combinam o valor do serviço na plataforma.
          </p>

          <div className="dashboard-nav marketplace-chip-grid" aria-label="Categorias">
            {visibleCategories.length === 0 ? (
              <div className="marketplace-empty-state">
                <p className="empty-state">
                  Sem categorias para esta pesquisa. Tenta um termo mais amplo.
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
                const priceLabel = getWorkerPriceLabel(worker.hourlyRate);
                const mainCategoryLabel = getWorkerMainCategoryLabel(worker);
                const workerTitle = resolveWorkerDisplayName(worker);

                return (
                  <MarketplaceWorkerCard
                    key={worker.id}
                    title={workerTitle}
                    highlighted={isStrongHighlight}
                    relevanceLabel={isStrongHighlight ? rankingLabel : undefined}
                    availabilityTone={worker.isAvailable ? "is-ok" : "is-muted"}
                    availabilityLabel={
                      worker.isAvailable ? "Disponível" : "Agenda limitada"
                    }
                    responseTimeLabel={responseEta}
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
                      {
                        label: "Localização",
                        value: worker.location ?? "Não indicada",
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
                        label: "Preço",
                        value: priceLabel,
                      },
                    ]}
                    ctaHint={
                      hasSession
                        ? "Valor combinado diretamente entre cliente e profissional."
                        : "Faz login para pedir serviço e continuar sem perder o contexto."
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
                                nextPath: "/app/pedidos#job-create",
                                sourcePath: "/",
                                selectedService:
                                  discoverySearch.trim() || mainCategoryLabel || undefined,
                                selectedProviderId: worker.id,
                              })
                            }
                          >
                            Entrar para pedir serviço
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

        <section className={styles.howItWorks} aria-label="Como funciona">
          <div className={styles.marketplaceSectionHeader}>
            <h2 className="section-title">Como funciona no Tchuno</h2>
            <p className="section-lead">
              Um fluxo simples para quem procura serviços e para quem quer
              criar oportunidades de trabalho.
            </p>
          </div>

          <div className={styles.howJourneyGrid}>
            {journeyFlows.map((journey) => (
              <article key={journey.audience} className={styles.howJourneyCard}>
                <p className={styles.howJourneyAudience}>{journey.audience}</p>
                <h3>{journey.title}</h3>
                <p>{journey.summary}</p>
                <ol className={styles.howJourneySteps}>
                  {journey.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                {journey.ctaHref.startsWith("#") ? (
                  <button
                    type="button"
                    className="primary"
                    onClick={scrollToDiscoverResults}
                  >
                    {journey.ctaLabel}
                  </button>
                ) : (
                  <Link href={journey.ctaHref} className="primary">
                    {journey.ctaLabel}
                  </Link>
                )}
              </article>
            ))}
          </div>
        </section>

        <section className={styles.landingFinalCta}>
          <h2>Pronto para avançar?</h2>
          <p>
            Escolhe o tipo de ação que faz mais sentido para ti e continua no teu ritmo.
          </p>
          <div className="actions actions--inline">
            <Link href="/dashboard" className="primary">
              Entrar no Tchuno
            </Link>
            <Link href="/registo?next=%2Fpro%2Fperfil" className="primary primary--ghost">
              Quero trabalhar no Tchuno
            </Link>
          </div>
        </section>
      </section>
    </main>
  );
}
