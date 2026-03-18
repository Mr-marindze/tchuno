import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import {
  getRatingBadgeTone,
  StatusTone,
} from "@/components/dashboard/dashboard-formatters";
import {
  ProfileCompleteness,
  ProfileReputation,
} from "@/components/dashboard/dashboard-profile";
import {
  DashboardActionPanel,
  DashboardBadge,
  DashboardEmptyState,
  DashboardMetaStat,
  DashboardPaginationRow,
  DashboardPanel,
  DashboardSectionHeader,
  DashboardSummaryCard,
} from "@/components/dashboard/ui/dashboard-primitives";
import { MarketplaceWorkerCard } from "@/components/marketplace/marketplace-worker-card";
import {
  buildWorkerRankingContext,
  getWorkerCtaCopy,
  getWorkerComparisonItems,
  getWorkerDecisionBadges,
  getWorkerRelevance,
  getWorkerResponseEtaLabel,
} from "@/components/marketplace/marketplace-worker-presenter";
import { Category } from "@/lib/categories";
import { PaginationMeta } from "@/lib/pagination";
import { trackEvent } from "@/lib/tracking";
import { WorkerProfile } from "@/lib/worker-profile";

type WorkerAvailabilityFilter = "all" | "true" | "false";
type WorkerSortMode =
  | "updatedAt:asc"
  | "updatedAt:desc"
  | "rating:asc"
  | "rating:desc"
  | "hourlyRate:asc"
  | "hourlyRate:desc";

type WorkerDiscoveryStats = {
  availableCount: number;
  completeCount: number;
  withHistoryCount: number;
};

type WorkersDomainSectionProps = {
  workerProfilesStatus: string;
  getStatusTone: (message: string) => StatusTone;
  workerCategorySlugFilter: string;
  onWorkerCategorySlugFilterChange: (value: string) => void;
  activeCategories: Category[];
  workerAvailabilityFilter: WorkerAvailabilityFilter;
  onWorkerAvailabilityFilterChange: (value: WorkerAvailabilityFilter) => void;
  workerLimit: number;
  onWorkerLimitChange: (value: number) => void;
  workerSearch: string;
  onWorkerSearchChange: (value: string) => void;
  workerSortMode: WorkerSortMode;
  onWorkerSortModeChange: (value: WorkerSortMode) => void;
  onReloadWorkerProfiles: () => void;
  workerProfilesLoading: boolean;
  onWorkerPreviousPage: () => void;
  onWorkerNextPage: () => void;
  workerPage: number;
  workerProfilesMeta: PaginationMeta | null;
  visibleWorkerProfiles: WorkerProfile[];
  workerDiscoveryStats: WorkerDiscoveryStats;
  currentUserId: string;
  getProfileCompleteness: (profile: WorkerProfile) => ProfileCompleteness;
  getProfileReputation: (
    ratingValue: number | string,
    ratingCount: number,
  ) => ProfileReputation;
  formatStars: (rating: number | string) => string;
  formatRatingValue: (rating: number | string) => string;
  formatCurrencyMzn: (value: number | null) => string;
  formatDate: (value: string) => string;
  shortenId: (value: string) => string;
};

export function WorkersDomainSection({
  workerProfilesStatus,
  getStatusTone,
  workerCategorySlugFilter,
  onWorkerCategorySlugFilterChange,
  activeCategories,
  workerAvailabilityFilter,
  onWorkerAvailabilityFilterChange,
  workerLimit,
  onWorkerLimitChange,
  workerSearch,
  onWorkerSearchChange,
  workerSortMode,
  onWorkerSortModeChange,
  onReloadWorkerProfiles,
  workerProfilesLoading,
  onWorkerPreviousPage,
  onWorkerNextPage,
  workerPage,
  workerProfilesMeta,
  visibleWorkerProfiles,
  workerDiscoveryStats,
  currentUserId,
  getProfileCompleteness,
  getProfileReputation,
  formatStars,
  formatRatingValue,
  formatCurrencyMzn,
  formatDate,
  shortenId,
}: WorkersDomainSectionProps) {
  const workerRanking = useMemo(
    () => buildWorkerRankingContext(visibleWorkerProfiles),
    [visibleWorkerProfiles],
  );
  const workerHeuristicSnapshot = useMemo(
    () =>
      visibleWorkerProfiles.map((profile) => {
        const isMe = profile.userId === currentUserId;
        const ratingValue = Number(profile.ratingAvg || 0);
        const hasHourlyRate = typeof profile.hourlyRate === "number";
        const ctaCopy = getWorkerCtaCopy({
          isOwnProfile: isMe,
          isAvailable: profile.isAvailable,
          hasHourlyRate,
        });
        const relevance = getWorkerRelevance({
          isAvailable: profile.isAvailable,
          ratingValue,
          ratingCount: profile.ratingCount,
        });

        return {
          workerId: profile.id,
          ctaPrimaryLabel: ctaCopy.primaryLabel,
          relevanceLabel: relevance.label ?? null,
          highlighted: relevance.highlighted,
          ratingRank: workerRanking.ratingRankById[profile.id] ?? null,
          priceRank: workerRanking.priceRankById[profile.id] ?? null,
        };
      }),
    [visibleWorkerProfiles, currentUserId, workerRanking],
  );
  const rankingSignature = useMemo(
    () =>
      workerHeuristicSnapshot
        .map(
          (item) =>
            `${item.workerId}:${item.ratingRank ?? "-"}:${item.priceRank ?? "-"}`,
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

    trackEvent("dashboard.heuristic.ranking.apply", {
      source: "dashboard.workers",
      view: "dashboard.workers",
      workerCount: workerHeuristicSnapshot.length,
      workersWithRatingRank: workerHeuristicSnapshot.filter(
        (item) => typeof item.ratingRank === "number",
      ).length,
      workersWithPriceRank: workerHeuristicSnapshot.filter(
        (item) => typeof item.priceRank === "number",
      ).length,
    });
    lastRankingSignatureRef.current = rankingSignature;
  }, [rankingSignature, workerHeuristicSnapshot]);

  useEffect(() => {
    if (highlightSignature.length === 0) {
      return;
    }

    if (lastHighlightSignatureRef.current === highlightSignature) {
      return;
    }

    trackEvent("dashboard.heuristic.highlight.apply", {
      source: "dashboard.workers",
      view: "dashboard.workers",
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

    trackEvent("dashboard.heuristic.cta.apply", {
      source: "dashboard.workers",
      view: "dashboard.workers",
      workerCount: workerHeuristicSnapshot.length,
      labels: Array.from(
        new Set(workerHeuristicSnapshot.map((item) => item.ctaPrimaryLabel)),
      ),
    });
    lastCtaSignatureRef.current = ctaSignature;
  }, [ctaSignature, workerHeuristicSnapshot]);

  function handleResetFilters() {
    onWorkerCategorySlugFilterChange("");
    onWorkerAvailabilityFilterChange("all");
    onWorkerSearchChange("");
    onWorkerSortModeChange("updatedAt:desc");
    onWorkerLimitChange(10);
  }

  return (
    <section id="workers" className="dashboard-section">
      <DashboardSectionHeader
        title="Descoberta de Profissionais"
        subtitle="Esta vista simula o perfil público que um cliente usa para decidir em quem confiar."
        status={workerProfilesStatus}
        statusTone={getStatusTone(workerProfilesStatus)}
      />

      <DashboardActionPanel
        title="Resumo da descoberta"
        actions={
          <>
            <button
              type="button"
              onClick={onReloadWorkerProfiles}
              disabled={workerProfilesLoading}
            >
              Recarregar profissionais
            </button>
            <button type="button" onClick={handleResetFilters}>
              Limpar filtros
            </button>
            <Link href="/dashboard/jobs" className="primary primary--ghost">
              Ir para jobs
            </Link>
          </>
        }
      >
        <div className="flow-summary">
          <DashboardSummaryCard
            className="flow-summary-item"
            label="Total visível"
            value={visibleWorkerProfiles.length}
          />
          <DashboardSummaryCard
            className="flow-summary-item"
            label="Disponíveis"
            value={workerDiscoveryStats.availableCount}
          />
          <DashboardSummaryCard
            className="flow-summary-item"
            label="Perfis completos"
            value={workerDiscoveryStats.completeCount}
          />
          <DashboardSummaryCard
            className="flow-summary-item"
            label="Com histórico"
            value={workerDiscoveryStats.withHistoryCount}
          />
        </div>
      </DashboardActionPanel>

      <div className="section-toolbar">
        <label>
          Categoria
          <select
            value={workerCategorySlugFilter}
            onChange={(event) => onWorkerCategorySlugFilterChange(event.target.value)}
          >
            <option value="">Todas as categorias</option>
            {activeCategories.map((category) => (
              <option key={category.id} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Disponibilidade
          <select
            value={workerAvailabilityFilter}
            onChange={(event) =>
              onWorkerAvailabilityFilterChange(
                event.target.value as "all" | "true" | "false",
              )
            }
          >
            <option value="all">Todos</option>
            <option value="true">Disponíveis</option>
            <option value="false">Indisponíveis</option>
          </select>
        </label>
        <label>
          Limite API
          <select
            value={String(workerLimit)}
            onChange={(event) => onWorkerLimitChange(Number(event.target.value))}
          >
            <option value="5">5</option>
            <option value="10">10</option>
            <option value="20">20</option>
          </select>
        </label>
        <label>
          Pesquisar
          <input
            type="search"
            value={workerSearch}
            onChange={(event) => onWorkerSearchChange(event.target.value)}
            placeholder="userId, localização ou categoria"
          />
        </label>
        <label>
          Ordenar
          <select
            value={workerSortMode}
            onChange={(event) =>
              onWorkerSortModeChange(
                event.target.value as
                  | "updatedAt:asc"
                  | "updatedAt:desc"
                  | "rating:asc"
                  | "rating:desc"
                  | "hourlyRate:asc"
                  | "hourlyRate:desc",
              )
            }
          >
            <option value="updatedAt:asc">Atualização (asc)</option>
            <option value="updatedAt:desc">Atualização (desc)</option>
            <option value="rating:asc">Rating (asc)</option>
            <option value="rating:desc">Rating (desc)</option>
            <option value="hourlyRate:asc">Tarifa (asc)</option>
            <option value="hourlyRate:desc">Tarifa (desc)</option>
          </select>
        </label>
        <button
          type="button"
          onClick={onReloadWorkerProfiles}
          disabled={workerProfilesLoading}
        >
          Recarregar
        </button>
      </div>

      <DashboardPaginationRow
        onPrevious={onWorkerPreviousPage}
        onNext={onWorkerNextPage}
        previousDisabled={workerProfilesLoading || workerPage <= 1}
        nextDisabled={workerProfilesLoading || !workerProfilesMeta?.hasNext}
      >
        <DashboardMetaStat label="Página" value={workerProfilesMeta?.page ?? workerPage} />
        <DashboardMetaStat label="Total API" value={workerProfilesMeta?.total ?? 0} />
        <DashboardMetaStat label="Visíveis" value={visibleWorkerProfiles.length} />
        <DashboardMetaStat
          label="Disponíveis"
          value={workerDiscoveryStats.availableCount}
        />
        <DashboardMetaStat
          label="Perfis completos"
          value={workerDiscoveryStats.completeCount}
        />
        <DashboardMetaStat
          label="Com histórico"
          value={workerDiscoveryStats.withHistoryCount}
        />
      </DashboardPaginationRow>

      <DashboardPanel title="Profissionais encontrados">
        <p className="muted marketplace-signal-note">
          Badges e comparação rápida são relativos aos profissionais desta
          página/filtro.
        </p>
        {workerProfilesLoading && visibleWorkerProfiles.length === 0 ? (
          <p>A carregar profissionais...</p>
        ) : visibleWorkerProfiles.length === 0 ? (
          <DashboardEmptyState
            message={
              workerSearch.trim().length > 0
                ? "Nenhum profissional corresponde à pesquisa atual. Tenta um termo mais amplo."
                : "Não há profissionais para estes filtros. Remove filtros para ver mais opções."
            }
            action={
              <>
                <button type="button" onClick={handleResetFilters}>
                  Limpar filtros
                </button>
                <Link href="/dashboard/jobs#job-create" className="primary primary--ghost">
                  Criar pedido mesmo assim
                </Link>
              </>
            }
          />
        ) : (
          <div className="panel-grid">
            {visibleWorkerProfiles.map((profile) => {
              const isMe = profile.userId === currentUserId;
              const profileCompleteness = getProfileCompleteness(profile);
              const reputation = getProfileReputation(
                profile.ratingAvg,
                profile.ratingCount,
              );
              const hasHourlyRate = typeof profile.hourlyRate === "number";
              const ratingValue = Number(profile.ratingAvg || 0);
              const ctaCopy = getWorkerCtaCopy({
                isOwnProfile: isMe,
                isAvailable: profile.isAvailable,
                hasHourlyRate,
              });
              const relevance = getWorkerRelevance({
                isAvailable: profile.isAvailable,
                ratingValue,
                ratingCount: profile.ratingCount,
              });
              const responseEta = getWorkerResponseEtaLabel({
                isAvailable: profile.isAvailable,
                ratingValue,
                ratingCount: profile.ratingCount,
                experienceYears: profile.experienceYears,
                hourlyRate: profile.hourlyRate,
                ratingRank: workerRanking.ratingRankById[profile.id] ?? null,
                priceRank: workerRanking.priceRankById[profile.id] ?? null,
              });
              const decisionBadges = getWorkerDecisionBadges({
                isAvailable: profile.isAvailable,
                ratingValue,
                ratingCount: profile.ratingCount,
                experienceYears: profile.experienceYears,
                hourlyRate: profile.hourlyRate,
                ratingRank: workerRanking.ratingRankById[profile.id] ?? null,
                priceRank: workerRanking.priceRankById[profile.id] ?? null,
              });
              const comparisonItems = getWorkerComparisonItems({
                isAvailable: profile.isAvailable,
                ratingValue,
                ratingCount: profile.ratingCount,
                experienceYears: profile.experienceYears,
                hourlyRate: profile.hourlyRate,
                ratingRank: workerRanking.ratingRankById[profile.id] ?? null,
                priceRank: workerRanking.priceRankById[profile.id] ?? null,
              });

              return (
                <MarketplaceWorkerCard
                  key={profile.id}
                  title={isMe ? "O teu perfil" : `Worker ${shortenId(profile.userId)}`}
                  highlighted={!isMe && relevance.highlighted}
                  relevanceLabel={isMe ? "Perfil próprio" : relevance.label ?? undefined}
                  availabilityTone={profile.isAvailable ? "is-ok" : "is-muted"}
                  availabilityLabel={
                    profile.isAvailable ? "Disponível hoje" : "Agenda limitada"
                  }
                  responseTimeLabel={responseEta}
                  rating={{
                    stars: formatStars(profile.ratingAvg),
                    value: formatRatingValue(profile.ratingAvg),
                    reviewCount: profile.ratingCount,
                  }}
                  comparisonItems={comparisonItems}
                  trustSignals={[
                    {
                      label: "Avaliações",
                      value:
                        profile.ratingCount > 0
                          ? `${profile.ratingCount} clientes`
                          : "Sem histórico ainda",
                    },
                    {
                      label: "Disponibilidade",
                      value: profile.isAvailable
                        ? "Aceita novos pedidos"
                        : "Confirma agenda por mensagem",
                    },
                  ]}
                  badges={
                    <>
                      {decisionBadges.map((badge) => (
                        <DashboardBadge key={badge.label} tone={badge.tone}>
                          {badge.label}
                        </DashboardBadge>
                      ))}
                      <DashboardBadge
                        tone={profileCompleteness.score >= 5 ? "is-ok" : "is-muted"}
                      >
                        Completude {profileCompleteness.percent}%
                      </DashboardBadge>
                      <DashboardBadge tone={getRatingBadgeTone(profile.ratingAvg)}>
                        Rating {formatRatingValue(profile.ratingAvg)}/5
                      </DashboardBadge>
                      <DashboardBadge tone={reputation.tone}>
                        {reputation.label}
                      </DashboardBadge>
                    </>
                  }
                  details={[
                    {
                      label: "Tarifa",
                      value:
                        typeof profile.hourlyRate === "number"
                          ? formatCurrencyMzn(profile.hourlyRate)
                          : "Não definida",
                    },
                    {
                      label: "Experiência",
                      value: `${profile.experienceYears} anos`,
                    },
                    {
                      label: "Localização",
                      value: `${profileCompleteness.location.city}, ${profileCompleteness.location.neighborhood}`,
                    },
                    {
                      label: "Categorias",
                      value:
                        profile.categories.length > 0
                          ? profile.categories.map((item) => item.name).join(", ")
                          : "Sem categorias",
                    },
                  ]}
                  note={
                    profileCompleteness.missing.length > 0
                      ? `Falta para perfil completo: ${profileCompleteness.missing[0]}.`
                      : "Perfil com sinais fortes de confiança."
                  }
                  footer={`Atualizado: ${formatDate(profile.updatedAt)}`}
                  actions={
                    <>
                      <Link
                        href={isMe ? "/dashboard/profile" : "/dashboard/jobs#job-create"}
                        className="primary"
                        onClick={() =>
                          trackEvent("dashboard.cta.click", {
                            source: "dashboard.workers.card",
                            view: "dashboard.workers",
                            workerId: profile.id,
                            isOwnProfile: isMe,
                            label: ctaCopy.primaryLabel,
                            ctaType: "primary",
                          })
                        }
                      >
                        {ctaCopy.primaryLabel}
                      </Link>
                      <Link
                        href="/dashboard/jobs#job-create"
                        className="primary primary--ghost"
                        onClick={() =>
                          trackEvent("dashboard.cta.click", {
                            source: "dashboard.workers.card",
                            view: "dashboard.workers",
                            workerId: profile.id,
                            isOwnProfile: isMe,
                            label: ctaCopy.secondaryLabel,
                            ctaType: "secondary",
                          })
                        }
                      >
                        {ctaCopy.secondaryLabel}
                      </Link>
                    </>
                  }
                  ctaHint={ctaCopy.helperText}
                  onCardClick={() =>
                    trackEvent("dashboard.worker.card.click", {
                      source: "dashboard.workers.card",
                      view: "dashboard.workers",
                      workerId: profile.id,
                      isOwnProfile: isMe,
                      highlighted: relevance.highlighted,
                      relevanceLabel: relevance.label ?? null,
                    })
                  }
                />
              );
            })}
          </div>
        )}
      </DashboardPanel>
    </section>
  );
}
