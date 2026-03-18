import Link from "next/link";
import { FormEvent } from "react";
import { StatusTone } from "@/components/dashboard/dashboard-formatters";
import {
  LocationParts,
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
import {
  AuthResponse,
  DeviceSession,
  SessionListMeta,
  SessionListQuery,
} from "@/lib/auth";
import { Category } from "@/lib/categories";
import { WorkerProfile } from "@/lib/worker-profile";

type ProfileDebugData = {
  me: unknown;
  user: AuthResponse["user"];
  accessTokenPreview: string;
  refreshTokenPreview: string;
};

type ProfileDomainSectionProps = {
  debugData: ProfileDebugData;
  getStatusTone: (message: string) => StatusTone;
  statusFilter: SessionListQuery["status"];
  onStatusFilterChange: (value: SessionListQuery["status"]) => void;
  sort: SessionListQuery["sort"];
  onSortChange: (value: SessionListQuery["sort"]) => void;
  limit: number;
  onLimitChange: (value: number) => void;
  sessionsMeta: SessionListMeta | null;
  sessions: DeviceSession[];
  currentDeviceId: string;
  onReloadSessions: () => void;
  onPreviousSessionsPage: () => void;
  onNextSessionsPage: () => void;
  canGoToPreviousSessionsPage: boolean;
  canGoToNextSessionsPage: boolean;
  onRevokeSession: (sessionId: string) => void;
  workerProfileStatus: string;
  workerProfileLoading: boolean;
  onReloadWorkerProfile: () => void;
  profileIsAvailable: boolean;
  onProfileIsAvailableChange: (checked: boolean) => void;
  workerProfile: WorkerProfile | null;
  myProfileCompleteness: ProfileCompleteness | null;
  myProfileReputation: ProfileReputation | null;
  myProfileLocation: LocationParts | null;
  onSaveWorkerProfile: (event: FormEvent<HTMLFormElement>) => void;
  profileBio: string;
  onProfileBioChange: (value: string) => void;
  profileLocation: string;
  onProfileLocationChange: (value: string) => void;
  profileHourlyRate: string;
  onProfileHourlyRateChange: (value: string) => void;
  profileExperienceYears: string;
  onProfileExperienceYearsChange: (value: string) => void;
  activeCategories: Category[];
  profileCategoryIds: string[];
  onToggleProfileCategory: (categoryId: string, checked: boolean) => void;
  formatCurrencyMzn: (value: number | null) => string;
  formatStars: (rating: number | string) => string;
  formatRatingValue: (rating: number | string) => string;
  formatDate: (value: string) => string;
  shortenId: (value: string) => string;
};

export function ProfileDomainSection({
  debugData,
  getStatusTone,
  statusFilter,
  onStatusFilterChange,
  sort,
  onSortChange,
  limit,
  onLimitChange,
  sessionsMeta,
  sessions,
  currentDeviceId,
  onReloadSessions,
  onPreviousSessionsPage,
  onNextSessionsPage,
  canGoToPreviousSessionsPage,
  canGoToNextSessionsPage,
  onRevokeSession,
  workerProfileStatus,
  workerProfileLoading,
  onReloadWorkerProfile,
  profileIsAvailable,
  onProfileIsAvailableChange,
  workerProfile,
  myProfileCompleteness,
  myProfileReputation,
  myProfileLocation,
  onSaveWorkerProfile,
  profileBio,
  onProfileBioChange,
  profileLocation,
  onProfileLocationChange,
  profileHourlyRate,
  onProfileHourlyRateChange,
  profileExperienceYears,
  onProfileExperienceYearsChange,
  activeCategories,
  profileCategoryIds,
  onToggleProfileCategory,
  formatCurrencyMzn,
  formatStars,
  formatRatingValue,
  formatDate,
  shortenId,
}: ProfileDomainSectionProps) {
  const totalSessions = sessionsMeta?.total ?? sessions.length;
  const activeSessions = sessions.filter((session) => !session.revokedAt).length;
  const nextProfileAction =
    myProfileCompleteness && myProfileCompleteness.missing.length > 0
      ? myProfileCompleteness.missing[0]
      : workerProfile
        ? "Manter disponibilidade e atualizar dados sempre que mudares de contexto."
        : "Criar e publicar o teu perfil profissional.";
  const profileCategoriesCount =
    workerProfile?.categories.length ?? profileCategoryIds.length;
  const profileRateValue =
    workerProfile && typeof workerProfile.hourlyRate === "number"
      ? formatCurrencyMzn(workerProfile.hourlyRate)
      : "Não definido";
  const profileRatingValue = workerProfile
    ? `${formatRatingValue(workerProfile.ratingAvg)}/5`
    : "Sem rating";

  return (
    <>
      <details className="debug-panel">
        <summary>Debug de sessão</summary>
        <pre className="result">{JSON.stringify(debugData, null, 2)}</pre>
      </details>

      <section id="sessions" className="dashboard-section">
        <DashboardSectionHeader
          title="Dispositivos e Sessões"
          subtitle="Segurança em mobile-first: acompanha atividade por dispositivo e revoga o que não reconheces."
        />

        <DashboardActionPanel title="Resumo de segurança">
          <div className="flow-summary">
            <DashboardSummaryCard
              className="flow-summary-item"
              label="Sessões totais"
              value={totalSessions}
            />
            <DashboardSummaryCard
              className="flow-summary-item"
              label="Sessões ativas"
              value={activeSessions}
            />
            <DashboardSummaryCard
              className="flow-summary-item"
              label="Sessões revogadas"
              value={Math.max(0, totalSessions - activeSessions)}
            />
          </div>
        </DashboardActionPanel>

        <div className="section-toolbar">
          <label>
            Estado
            <select
              value={statusFilter}
              onChange={(event) =>
                onStatusFilterChange(event.target.value as SessionListQuery["status"])
              }
            >
              <option value="active">Ativas</option>
              <option value="revoked">Revogadas</option>
              <option value="all">Todas</option>
            </select>
          </label>
          <label>
            Ordenar
            <select
              value={sort}
              onChange={(event) =>
                onSortChange(event.target.value as SessionListQuery["sort"])
              }
            >
              <option value="lastUsedAt:desc">Último uso (desc)</option>
              <option value="lastUsedAt:asc">Último uso (asc)</option>
              <option value="createdAt:desc">Criação (desc)</option>
              <option value="createdAt:asc">Criação (asc)</option>
            </select>
          </label>
          <label>
            Itens/página
            <select
              value={String(limit)}
              onChange={(event) => onLimitChange(Number(event.target.value))}
            >
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
            </select>
          </label>
          <button type="button" onClick={onReloadSessions}>
            Recarregar
          </button>
        </div>

        <DashboardPaginationRow
          onPrevious={onPreviousSessionsPage}
          onNext={onNextSessionsPage}
          previousDisabled={!canGoToPreviousSessionsPage}
          nextDisabled={!canGoToNextSessionsPage}
        >
          <DashboardMetaStat
            label="Página"
            value={`${sessionsMeta?.page ?? 1}/${sessionsMeta?.pageCount ?? 1}`}
          />
          <DashboardMetaStat label="Total" value={sessionsMeta?.total ?? sessions.length} />
        </DashboardPaginationRow>

        <DashboardPanel title="Sessões do utilizador">
          {sessions.length === 0 ? (
            <DashboardEmptyState
              message={
                <>
                  Ainda não há sessões neste filtro. Usa <strong>Todas</strong>{" "}
                  para validar histórico e garantir que só tens dispositivos
                  confiáveis.
                </>
              }
            />
          ) : (
            sessions.map((session) => {
              const isCurrentDevice = session.deviceId === currentDeviceId;
              const isRevoked = Boolean(session.revokedAt);
              return (
                <article key={session.id} className="list-item session-item">
                  <p className="item-title">
                    {isCurrentDevice ? "Dispositivo atual" : "Dispositivo"}
                    <DashboardBadge tone={isRevoked ? "is-danger" : "is-ok"}>
                      {isRevoked ? "Revogada" : "Ativa"}
                    </DashboardBadge>
                  </p>
                  <p>
                    <strong>ID:</strong> {shortenId(session.deviceId)}
                  </p>
                  <p>
                    <strong>IP:</strong> {session.ip ?? "n/a"}
                  </p>
                  <p>
                    <strong>Criada:</strong> {formatDate(session.createdAt)}
                  </p>
                  <p>
                    <strong>Último uso:</strong> {formatDate(session.lastUsedAt)}
                  </p>
                  <button
                    type="button"
                    onClick={() => onRevokeSession(session.id)}
                    disabled={isRevoked || isCurrentDevice}
                  >
                    {isCurrentDevice ? "Sessão atual" : "Revogar sessão"}
                  </button>
                </article>
              );
            })
          )}
        </DashboardPanel>
      </section>

      <section id="my-profile" className="dashboard-section">
        <DashboardSectionHeader
          title="Meu Perfil de Worker"
          subtitle="Um perfil completo aumenta confiança: localização, experiência, tarifa e categorias claras."
          status={workerProfileStatus}
          statusTone={getStatusTone(workerProfileStatus)}
        />

        <DashboardActionPanel
          title="Próximo passo no perfil"
          description={nextProfileAction}
          actions={
            <>
              <a href="#my-profile-form" className="primary">
                Editar perfil
              </a>
              <button
                type="button"
                onClick={onReloadWorkerProfile}
                disabled={workerProfileLoading}
              >
                Recarregar estado
              </button>
            </>
          }
        />
        <div className="overview-grid">
          <DashboardSummaryCard
            label="Disponibilidade"
            value={profileIsAvailable ? "Disponível" : "Indisponível"}
          />
          <DashboardSummaryCard label="Preço/hora" value={profileRateValue} />
          <DashboardSummaryCard label="Rating" value={profileRatingValue} />
          <DashboardSummaryCard
            label="Categorias ativas"
            value={profileCategoriesCount}
          />
        </div>

        <div className="section-toolbar">
          <button
            type="button"
            onClick={onReloadWorkerProfile}
            disabled={workerProfileLoading}
          >
            Recarregar perfil
          </button>
          <label className="inline-check">
            <input
              type="checkbox"
              checked={profileIsAvailable}
              onChange={(event) => onProfileIsAvailableChange(event.target.checked)}
            />
            Disponível para trabalhos
          </label>
        </div>

        <DashboardPanel title="Estado de confiança do perfil">
          {workerProfile && myProfileCompleteness && myProfileReputation ? (
            <>
              <div className="pill-row">
                <DashboardBadge
                  tone={myProfileCompleteness.score >= 5 ? "is-ok" : "is-muted"}
                >
                  Perfil {myProfileCompleteness.percent}% completo
                </DashboardBadge>
                <DashboardBadge tone={myProfileReputation.tone}>
                  {myProfileReputation.label}
                </DashboardBadge>
              </div>
              {myProfileCompleteness.missing.length > 0 ? (
                <ul className="checklist">
                  {myProfileCompleteness.missing.map((item) => (
                    <li key={item} className="is-blocked">
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">
                  Perfil completo. Mantém disponibilidade e atualiza reviews para
                  preservar confiança.
                </p>
              )}
            </>
          ) : (
            <DashboardEmptyState
              message="Ainda não existe perfil para avaliar completude. Guarda o teu perfil para ativar estes sinais de confiança."
            />
          )}
        </DashboardPanel>

        <form onSubmit={onSaveWorkerProfile} className="form" id="my-profile-form">
          <label>
            Bio (opcional)
            <textarea
              value={profileBio}
              onChange={(event) => onProfileBioChange(event.target.value)}
              maxLength={1000}
            />
          </label>
          <label>
            Localização (opcional)
            <input
              type="text"
              value={profileLocation}
              onChange={(event) => onProfileLocationChange(event.target.value)}
              placeholder="Cidade, Bairro"
              maxLength={120}
            />
          </label>
          <label>
            Tarifa por hora (opcional)
            <input
              type="number"
              value={profileHourlyRate}
              onChange={(event) => onProfileHourlyRateChange(event.target.value)}
              min={0}
              max={1_000_000}
              step={1}
            />
          </label>
          <label>
            Anos de experiência
            <input
              type="number"
              value={profileExperienceYears}
              onChange={(event) => onProfileExperienceYearsChange(event.target.value)}
              min={0}
              max={80}
              step={1}
              required
            />
          </label>

          <DashboardPanel title="Categorias ativas">
            {activeCategories.length === 0 ? (
              <DashboardEmptyState message="Sem categorias ativas. Vai à secção de categorias e cria pelo menos uma antes de guardar o perfil." />
            ) : (
              <div className="checkbox-list">
                {activeCategories.map((category) => (
                  <label key={category.id}>
                    <input
                      type="checkbox"
                      checked={profileCategoryIds.includes(category.id)}
                      onChange={(event) =>
                        onToggleProfileCategory(category.id, event.target.checked)
                      }
                    />
                    {category.name} ({category.slug})
                  </label>
                ))}
              </div>
            )}
          </DashboardPanel>

          <button
            type="submit"
            className="primary"
            disabled={workerProfileLoading}
          >
            {workerProfileLoading ? "Aguarda..." : "Guardar perfil profissional"}
          </button>
        </form>

        <DashboardPanel title="Preview do perfil público">
          {workerProfile ? (
            <article className="worker-card">
              <p className="item-title">
                Perfil público pronto
                <DashboardBadge tone={workerProfile.isAvailable ? "is-ok" : "is-muted"}>
                  {workerProfile.isAvailable ? "Disponível" : "Indisponível"}
                </DashboardBadge>
              </p>
              {myProfileCompleteness && myProfileReputation ? (
                <div className="pill-row">
                  <DashboardBadge
                    tone={myProfileCompleteness.score >= 5 ? "is-ok" : "is-muted"}
                  >
                    Completude {myProfileCompleteness.percent}%
                  </DashboardBadge>
                  <DashboardBadge tone={myProfileReputation.tone}>
                    {myProfileReputation.label}
                  </DashboardBadge>
                </div>
              ) : null}
              <p>
                <strong>Worker:</strong> {shortenId(workerProfile.userId)}
              </p>
              <p>
                <strong>Tarifa:</strong>{" "}
                {typeof workerProfile.hourlyRate === "number"
                  ? formatCurrencyMzn(workerProfile.hourlyRate)
                  : "Não definida"}
              </p>
              <p>
                <strong>Experiência:</strong> {workerProfile.experienceYears} anos
              </p>
              <p>
                <strong>Cidade:</strong>{" "}
                {myProfileLocation ? myProfileLocation.city : "Não indicado"}
              </p>
              <p>
                <strong>Bairro:</strong>{" "}
                {myProfileLocation
                  ? myProfileLocation.neighborhood
                  : "Não indicado"}
              </p>
              <p>
                <strong>Rating:</strong> {formatStars(workerProfile.ratingAvg)}{" "}
                {formatRatingValue(workerProfile.ratingAvg)} ({workerProfile.ratingCount})
              </p>
              <p>
                <strong>Categorias:</strong>{" "}
                {workerProfile.categories.length > 0
                  ? workerProfile.categories.map((item) => item.name).join(", ")
                  : "Sem categorias"}
              </p>
              {workerProfile.bio ? <p>{workerProfile.bio}</p> : null}
              <div className="actions actions--inline marketplace-worker-actions">
                <Link href="/dashboard/jobs" className="primary">
                  Ver jobs e pedidos
                </Link>
                <button
                  type="button"
                  onClick={onReloadWorkerProfile}
                  disabled={workerProfileLoading}
                >
                  Recarregar preview
                </button>
              </div>
            </article>
          ) : (
            <DashboardEmptyState
              message="Ainda não tens perfil profissional. Preenche o formulário acima e publica o teu perfil para aparecer na busca de clientes."
            />
          )}
        </DashboardPanel>
      </section>
    </>
  );
}
