import Link from "next/link";
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
import { Category } from "@/lib/categories";
import { PaginationMeta } from "@/lib/pagination";
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
        {workerProfilesLoading && visibleWorkerProfiles.length === 0 ? (
          <p>A carregar profissionais...</p>
        ) : visibleWorkerProfiles.length === 0 ? (
          <DashboardEmptyState
            message={
              workerSearch.trim().length > 0
                ? "Nenhum profissional corresponde à pesquisa atual."
                : "Não há profissionais para estes filtros. Remove os filtros e tenta novamente."
            }
            action={
              <button type="button" onClick={handleResetFilters}>
                Limpar filtros
              </button>
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

              return (
                <article key={profile.id} className="worker-card">
                  <p className="item-title">
                    {isMe ? "O teu perfil" : `Worker ${shortenId(profile.userId)}`}
                    <DashboardBadge tone={profile.isAvailable ? "is-ok" : "is-muted"}>
                      {profile.isAvailable ? "Disponível" : "Indisponível"}
                    </DashboardBadge>
                  </p>
                  <div className="pill-row">
                    <DashboardBadge
                      tone={profileCompleteness.score >= 5 ? "is-ok" : "is-muted"}
                    >
                      Completude {profileCompleteness.percent}%
                    </DashboardBadge>
                    <DashboardBadge tone={getRatingBadgeTone(profile.ratingAvg)}>
                      Rating {formatRatingValue(profile.ratingAvg)}/5
                    </DashboardBadge>
                    <DashboardBadge tone={reputation.tone}>{reputation.label}</DashboardBadge>
                  </div>
                  <p>
                    <strong>Rating:</strong> {formatStars(profile.ratingAvg)}{" "}
                    {formatRatingValue(profile.ratingAvg)} ({profile.ratingCount})
                  </p>
                  <p>
                    <strong>Tarifa:</strong>{" "}
                    {typeof profile.hourlyRate === "number"
                      ? formatCurrencyMzn(profile.hourlyRate)
                      : "Não definida"}
                  </p>
                  <p>
                    <strong>Experiência:</strong> {profile.experienceYears} anos
                  </p>
                  <p>
                    <strong>Cidade:</strong> {profileCompleteness.location.city}
                  </p>
                  <p>
                    <strong>Bairro:</strong> {profileCompleteness.location.neighborhood}
                  </p>
                  <p>
                    <strong>Categorias:</strong>{" "}
                    {profile.categories.length > 0
                      ? profile.categories.map((item) => item.name).join(", ")
                      : "Sem categorias"}
                  </p>
                  {profileCompleteness.missing.length > 0 ? (
                    <p className="muted">
                      Falta para perfil completo: {profileCompleteness.missing[0]}.
                    </p>
                  ) : (
                    <p className="muted">Perfil com sinais fortes de confiança.</p>
                  )}
                  <p className="muted">Atualizado: {formatDate(profile.updatedAt)}</p>
                </article>
              );
            })}
          </div>
        )}
      </DashboardPanel>
    </section>
  );
}
