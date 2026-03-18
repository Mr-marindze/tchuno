import { AdminOpsJobListItem, AdminOpsOverview } from "@/lib/admin-ops";
import {
  getJobStatusBadgeTone,
  StatusTone,
} from "@/components/dashboard/dashboard-formatters";
import {
  DashboardActionPanel,
  DashboardBadge,
  DashboardEmptyState,
  DashboardSectionHeader,
  DashboardSummaryCard,
} from "@/components/dashboard/ui/dashboard-primitives";
import { Job, JobStatus } from "@/lib/jobs";

type AdminDomainSectionProps = {
  adminOpsStatus: string;
  adminOpsLoading: boolean;
  adminOpsOverview: AdminOpsOverview | null;
  onReload: () => void;
  getStatusTone: (message: string) => StatusTone;
  jobStatuses: JobStatus[];
  formatJobStatus: (status: JobStatus) => string;
  formatPricingMode: (value: Job["pricingMode"]) => string;
  formatCurrencyMzn: (value: number | null) => string;
  formatDate: (value: string) => string;
  shortenId: (value: string) => string;
};

export function AdminDomainSection({
  adminOpsStatus,
  adminOpsLoading,
  adminOpsOverview,
  onReload,
  getStatusTone,
  jobStatuses,
  formatJobStatus,
  formatPricingMode,
  formatCurrencyMzn,
  formatDate,
  shortenId,
}: AdminDomainSectionProps) {
  function renderJobList(items: AdminOpsJobListItem[], emptyMessage: string) {
    if (items.length === 0) {
      return <DashboardEmptyState message={emptyMessage} />;
    }

    return items.map((job) => (
      <article key={job.id} className="list-item job-card">
        <p className="item-title">
          {job.title}
          <DashboardBadge tone={getJobStatusBadgeTone(job.status)}>
            {formatJobStatus(job.status)}
          </DashboardBadge>
        </p>
        <p>
          <strong>ID:</strong> {shortenId(job.id)}
        </p>
        <p>
          <strong>Preço:</strong> {formatPricingMode(job.pricingMode)}
        </p>
        <p>
          <strong>Orçamento:</strong> {formatCurrencyMzn(job.budget)}
        </p>
        {typeof job.quotedAmount === "number" ? (
          <p>
            <strong>Cotação:</strong> {formatCurrencyMzn(job.quotedAmount)}
          </p>
        ) : null}
        <p>
          <strong>Cliente:</strong> {shortenId(job.clientId)}
        </p>
        <p>
          <strong>Worker:</strong> {shortenId(job.workerProfileId)}
        </p>
        <p>
          <strong>Criado:</strong> {formatDate(job.createdAt)}
        </p>
        {job.completedAt ? (
          <p>
            <strong>Concluído:</strong> {formatDate(job.completedAt)}
          </p>
        ) : null}
        {job.canceledAt ? (
          <p>
            <strong>Cancelado:</strong> {formatDate(job.canceledAt)}
          </p>
        ) : null}
        {job.cancelReason ? (
          <p>
            <strong>Motivo:</strong> {job.cancelReason}
          </p>
        ) : null}
        <p className="muted">Review: {job.hasReview ? "publicada" : "pendente"}</p>
      </article>
    ));
  }

  const hasCanceledRecently = Boolean(
    adminOpsOverview && adminOpsOverview.recentlyCanceledJobs.length > 0,
  );
  const hasCompletedWithoutReview = Boolean(
    adminOpsOverview && adminOpsOverview.completedWithoutReviewJobs.length > 0,
  );
  const alertCount = [hasCanceledRecently, hasCompletedWithoutReview].filter(Boolean).length;

  return (
    <section id="admin-ops" className="dashboard-section">
      <DashboardSectionHeader
        title="Admin Ops Mínimo"
        subtitle="Leitura rápida da operação do MVP para pilotagem diária e ação imediata."
        status={adminOpsStatus}
        statusTone={getStatusTone(adminOpsStatus)}
      />

      {adminOpsOverview ? (
        <DashboardActionPanel
          title="Sinais de operação"
          description={
            alertCount === 0
              ? "Sem alertas críticos agora. Mantém monitoria dos jobs recentes."
              : `${alertCount} alerta(s) pedem acompanhamento.`
          }
        >
          <div className="pill-row">
            <DashboardBadge tone={hasCanceledRecently ? "is-danger" : "is-ok"}>
              Cancelamentos recentes: {adminOpsOverview.recentlyCanceledJobs.length}
            </DashboardBadge>
            <DashboardBadge
              tone={hasCompletedWithoutReview ? "is-danger" : "is-ok"}
            >
              Concluídos sem review: {adminOpsOverview.completedWithoutReviewJobs.length}
            </DashboardBadge>
          </div>
        </DashboardActionPanel>
      ) : null}

      <div className="section-toolbar">
        <button type="button" onClick={onReload} disabled={adminOpsLoading}>
          {adminOpsLoading ? "A carregar..." : "Recarregar painel admin"}
        </button>
      </div>

      {!adminOpsOverview ? (
        <div className="result">
          <DashboardEmptyState message="Sem dados operacionais neste momento." />
        </div>
      ) : (
        <>
          <div className="overview-grid">
            <DashboardSummaryCard
              label="Total de jobs"
              value={adminOpsOverview.kpis.totalJobs}
            />
            <DashboardSummaryCard
              label="Taxa de conclusão"
              value={`${adminOpsOverview.kpis.completionRate.toFixed(1)}%`}
            />
            <DashboardSummaryCard
              label="Total de reviews"
              value={adminOpsOverview.kpis.totalReviews}
            />
            <DashboardSummaryCard
              label="Rating médio"
              value={adminOpsOverview.kpis.averageRating.toFixed(2)}
            />
            <DashboardSummaryCard
              label="Workers ativos/publicáveis"
              value={adminOpsOverview.kpis.activePublicableWorkers}
            />
            <DashboardSummaryCard
              label="Pricing mode"
              value="-"
              note={`FIXED: ${adminOpsOverview.kpis.jobsByPricingMode.FIXED_PRICE} | QUOTE: ${adminOpsOverview.kpis.jobsByPricingMode.QUOTE_REQUEST}`}
            />
          </div>

          <div className="result">
            <p className="item-title">Jobs por estado</p>
            <div className="flow-summary">
              {jobStatuses.map((status) => (
                <article
                  key={`admin-job-status-${status}`}
                  className="flow-summary-item"
                >
                  <p className="metric-label">{formatJobStatus(status)}</p>
                  <p className="metric-value">
                    {adminOpsOverview.kpis.jobsByStatus[status]}
                  </p>
                </article>
              ))}
            </div>
          </div>

          <div className="panel-grid">
            <div className="result">
              <p className="item-title">Jobs recentes</p>
              {renderJobList(
                adminOpsOverview.recentJobs,
                "Sem jobs recentes para mostrar.",
              )}
            </div>
            <div className="result">
              <p className="item-title">Cancelados recentemente</p>
              {renderJobList(
                adminOpsOverview.recentlyCanceledJobs,
                "Sem cancelamentos recentes.",
              )}
            </div>
          </div>

          <div className="result">
            <p className="item-title">Concluídos sem review</p>
            {renderJobList(
              adminOpsOverview.completedWithoutReviewJobs,
              "Sem jobs concluídos pendentes de review.",
            )}
          </div>
        </>
      )}
    </section>
  );
}
