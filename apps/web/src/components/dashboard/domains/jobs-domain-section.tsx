import { FormEvent } from "react";
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
import { Category } from "@/lib/categories";
import { buildJobActionPlan } from "@/lib/job-cta";
import { JobTimeline } from "@/components/job-timeline";
import { Job, JobStatus } from "@/lib/jobs";
import { PaginationMeta } from "@/lib/pagination";
import { WorkerProfile } from "@/lib/worker-profile";

type JobSortMode =
  | "createdAt:asc"
  | "createdAt:desc"
  | "budget:asc"
  | "budget:desc";
type JobJourneyView = "all" | "client" | "worker";
type JobPricingMode = "FIXED_PRICE" | "QUOTE_REQUEST";

type JobCreationChecklistItem = {
  label: string;
  ready: boolean;
  help: string;
};

type JobsDomainSectionProps = {
  jobsStatus: string;
  getStatusTone: (message: string) => StatusTone;
  clientJobFlowCounts: Record<JobStatus, number>;
  reviewableJobs: Job[];
  jobCreationChecklist: JobCreationChecklistItem[];
  selectedJobWorkerProfile: WorkerProfile | null;
  availableJobCategories: Category[];
  jobStatuses: JobStatus[];
  jobStatusFilter: "ALL" | JobStatus;
  onJobStatusFilterChange: (value: "ALL" | JobStatus) => void;
  jobLimit: number;
  onJobLimitChange: (value: number) => void;
  jobSearch: string;
  onJobSearchChange: (value: string) => void;
  jobSortMode: JobSortMode;
  onJobSortModeChange: (value: JobSortMode) => void;
  onReloadJobs: () => void;
  jobsLoading: boolean;
  onJobPreviousPage: () => void;
  onJobNextPage: () => void;
  jobPage: number;
  clientJobsMeta: PaginationMeta | null;
  workerJobsMeta: PaginationMeta | null;
  visibleClientJobs: Job[];
  visibleWorkerJobs: Job[];
  onCreateJob: (event: FormEvent<HTMLFormElement>) => void;
  jobWorkerProfileId: string;
  onJobWorkerProfileIdChange: (value: string) => void;
  jobWorkerOptions: WorkerProfile[];
  jobCategoryId: string;
  onJobCategoryIdChange: (value: string) => void;
  jobPricingMode: JobPricingMode;
  onJobPricingModeChange: (value: JobPricingMode) => void;
  jobTitle: string;
  onJobTitleChange: (value: string) => void;
  jobDescription: string;
  onJobDescriptionChange: (value: string) => void;
  jobBudget: string;
  onJobBudgetChange: (value: string) => void;
  jobScheduledFor: string;
  onJobScheduledForChange: (value: string) => void;
  jobJourneyView: JobJourneyView;
  onJobJourneyViewChange: (value: JobJourneyView) => void;
  showClientJourney: boolean;
  showWorkerJourney: boolean;
  reviewableJobIdSet: Set<string>;
  onUpdateJobStatus: (
    jobId: string,
    nextStatus: JobStatus,
    roleLabel: "client" | "worker",
    options?: {
      quotedAmount?: number;
      cancelReason?: string;
    },
  ) => void;
  jobQuoteDraftAmount: Record<string, string>;
  onJobQuoteDraftAmountChange: (jobId: string, value: string) => void;
  jobQuoteDraftMessage: Record<string, string>;
  onJobQuoteDraftMessageChange: (jobId: string, value: string) => void;
  onProposeQuote: (jobId: string) => void;
  onGoToReviewJob: (jobId: string) => void;
  formatJobStatus: (status: JobStatus) => string;
  formatCurrencyMzn: (value: number | null) => string;
  shortenId: (value: string) => string;
  formatDate: (value: string) => string;
};

export function JobsDomainSection({
  jobsStatus,
  getStatusTone,
  clientJobFlowCounts,
  reviewableJobs,
  jobCreationChecklist,
  selectedJobWorkerProfile,
  availableJobCategories,
  jobStatuses,
  jobStatusFilter,
  onJobStatusFilterChange,
  jobLimit,
  onJobLimitChange,
  jobSearch,
  onJobSearchChange,
  jobSortMode,
  onJobSortModeChange,
  onReloadJobs,
  jobsLoading,
  onJobPreviousPage,
  onJobNextPage,
  jobPage,
  clientJobsMeta,
  workerJobsMeta,
  visibleClientJobs,
  visibleWorkerJobs,
  onCreateJob,
  jobWorkerProfileId,
  onJobWorkerProfileIdChange,
  jobWorkerOptions,
  jobCategoryId,
  onJobCategoryIdChange,
  jobPricingMode,
  onJobPricingModeChange,
  jobTitle,
  onJobTitleChange,
  jobDescription,
  onJobDescriptionChange,
  jobBudget,
  onJobBudgetChange,
  jobScheduledFor,
  onJobScheduledForChange,
  jobJourneyView,
  onJobJourneyViewChange,
  showClientJourney,
  showWorkerJourney,
  reviewableJobIdSet,
  onUpdateJobStatus,
  jobQuoteDraftAmount,
  onJobQuoteDraftAmountChange,
  jobQuoteDraftMessage,
  onJobQuoteDraftMessageChange,
  onProposeQuote,
  onGoToReviewJob,
  formatJobStatus,
  formatCurrencyMzn,
  shortenId,
  formatDate,
}: JobsDomainSectionProps) {
  const inExecutionCount =
    clientJobFlowCounts.ACCEPTED + clientJobFlowCounts.IN_PROGRESS;
  const hasReviewBacklog = reviewableJobs.length > 0;

  return (
    <section id="jobs" className="dashboard-section">
      <DashboardSectionHeader
        title="Jobs"
        subtitle="Criação guiada: confirma pré-requisitos, publica o pedido e acompanha as transições de estado."
        status={jobsStatus}
        statusTone={getStatusTone(jobsStatus)}
      />

      <DashboardActionPanel
        title="Ação recomendada agora"
        description={
          hasReviewBacklog
            ? `Tens ${reviewableJobs.length} job(s) concluído(s) sem review. Fecha o ciclo de confiança primeiro.`
            : "Sem backlog de reviews. Foca em pedidos novos e execução em curso."
        }
        actions={
          <>
            {hasReviewBacklog ? (
              <a href="#reviews" className="primary">
                Ir para reviews pendentes
              </a>
            ) : (
              <a href="#job-create" className="primary">
                Criar novo job
              </a>
            )}
            <button type="button" onClick={onReloadJobs} disabled={jobsLoading}>
              Recarregar lista
            </button>
          </>
        }
      />

      <div className="result">
        <p className="item-title">Fluxo do pedido (cliente {"->"} worker {"->"} review)</p>
        <div className="flow-summary">
          <DashboardSummaryCard
            className="flow-summary-item"
            label="Aguardando aceitação"
            value={clientJobFlowCounts.REQUESTED}
          />
          <DashboardSummaryCard
            className="flow-summary-item"
            label="Em execução"
            value={inExecutionCount}
          />
          <DashboardSummaryCard
            className="flow-summary-item"
            label="Concluídos"
            value={clientJobFlowCounts.COMPLETED}
          />
          <DashboardSummaryCard
            className="flow-summary-item"
            label="Pendentes de review"
            value={reviewableJobs.length}
          />
          <DashboardSummaryCard
            className="flow-summary-item"
            label="Cancelados"
            value={clientJobFlowCounts.CANCELED}
          />
        </div>
        {reviewableJobs.length > 0 ? (
          <p className="status" style={{ marginTop: "0.4rem" }}>
            Tens {reviewableJobs.length} job(s) prontos para avaliação. <a href="#reviews" className="nav-link">Ir para reviews</a>
          </p>
        ) : (
          <p className="muted">
            Quando um job chega a concluído, ele aparece automaticamente em Reviews.
          </p>
        )}
      </div>

      <div className="result">
        <p className="item-title">Checklist antes de criar job</p>
        <ul className="checklist">
          {jobCreationChecklist.map((item) => (
            <li key={item.label} className={item.ready ? "is-ready" : "is-blocked"}>
              <strong>{item.ready ? "Pronto" : "Pendente"}:</strong> {item.label}. {item.help}
            </li>
          ))}
        </ul>
        <p className="muted">
          Worker selecionado:{" "}
          {selectedJobWorkerProfile
            ? `${shortenId(selectedJobWorkerProfile.userId)} (${selectedJobWorkerProfile.location ?? "n/a"})`
            : "Nenhum"}
        </p>
        <p className="muted">Categorias compatíveis com o worker: {availableJobCategories.length}</p>
      </div>

      <div className="section-toolbar">
        <label>
          Estado
          <select
            value={jobStatusFilter}
            onChange={(event) => onJobStatusFilterChange(event.target.value as "ALL" | JobStatus)}
          >
            <option value="ALL">Todos os estados</option>
            {jobStatuses.map((statusOption) => (
              <option key={statusOption} value={statusOption}>
                {formatJobStatus(statusOption)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Limite API
          <select
            value={String(jobLimit)}
            onChange={(event) => onJobLimitChange(Number(event.target.value))}
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
            value={jobSearch}
            onChange={(event) => onJobSearchChange(event.target.value)}
            placeholder="Título ou descrição"
          />
        </label>
        <label>
          Ordenar
          <select
            value={jobSortMode}
            onChange={(event) => onJobSortModeChange(event.target.value as JobSortMode)}
          >
            <option value="createdAt:asc">Criação (asc)</option>
            <option value="createdAt:desc">Criação (desc)</option>
            <option value="budget:asc">Orçamento (asc)</option>
            <option value="budget:desc">Orçamento (desc)</option>
          </select>
        </label>
        <button type="button" onClick={onReloadJobs} disabled={jobsLoading}>
          Recarregar
        </button>
      </div>

      <div className="meta-row">
        <button type="button" onClick={onJobPreviousPage} disabled={jobsLoading || jobPage <= 1}>
          Página anterior
        </button>
        <button
          type="button"
          onClick={onJobNextPage}
          disabled={jobsLoading || !(clientJobsMeta?.hasNext || workerJobsMeta?.hasNext)}
        >
          Próxima página
        </button>
        <p className="status">
          Página: {clientJobsMeta?.page ?? workerJobsMeta?.page ?? jobPage}
        </p>
        <p className="status">
          Cliente {visibleClientJobs.length}/{clientJobsMeta?.total ?? 0} | Worker {visibleWorkerJobs.length}/{workerJobsMeta?.total ?? 0}
        </p>
      </div>

      <form onSubmit={onCreateJob} className="form" id="job-create">
        <label>
          Profissional
          <select
            value={jobWorkerProfileId}
            onChange={(event) => onJobWorkerProfileIdChange(event.target.value)}
            required
          >
            {jobWorkerOptions.length === 0 ? (
              <option value="">Sem profissionais disponiveis</option>
            ) : (
              jobWorkerOptions.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {shortenId(profile.userId)} ({profile.location ?? "n/a"})
                </option>
              ))
            )}
          </select>
        </label>
        <label>
          Categoria
          <select
            value={jobCategoryId}
            onChange={(event) => onJobCategoryIdChange(event.target.value)}
            required
          >
            {availableJobCategories.length === 0 ? (
              <option value="">Sem categoria compativel</option>
            ) : (
              availableJobCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))
            )}
          </select>
        </label>
        <label>
          Modo de preco
          <select
            value={jobPricingMode}
            onChange={(event) =>
              onJobPricingModeChange(event.target.value as "FIXED_PRICE" | "QUOTE_REQUEST")
            }
          >
            <option value="FIXED_PRICE">Preco fixo</option>
            <option value="QUOTE_REQUEST">Sob cotacao</option>
          </select>
        </label>
        <label>
          Titulo
          <input
            type="text"
            value={jobTitle}
            onChange={(event) => onJobTitleChange(event.target.value)}
            minLength={3}
            maxLength={120}
            required
          />
        </label>
        <label>
          Descricao
          <textarea
            value={jobDescription}
            onChange={(event) => onJobDescriptionChange(event.target.value)}
            maxLength={2000}
            minLength={10}
            required
          />
        </label>
        <label>
          {jobPricingMode === "FIXED_PRICE" ? "Orçamento (obrigatório)" : "Orçamento máximo (opcional)"}
          <input
            type="number"
            value={jobBudget}
            onChange={(event) => onJobBudgetChange(event.target.value)}
            min={jobPricingMode === "FIXED_PRICE" ? 1 : 0}
            max={100_000_000}
            step={1}
            required={jobPricingMode === "FIXED_PRICE"}
          />
        </label>
        <label>
          Data agendada (opcional)
          <input
            type="datetime-local"
            value={jobScheduledFor}
            onChange={(event) => onJobScheduledForChange(event.target.value)}
          />
        </label>
        <button
          type="submit"
          className="primary"
          disabled={jobsLoading || jobWorkerOptions.length === 0 || availableJobCategories.length === 0}
        >
          {jobsLoading ? "Aguarda..." : "Criar job"}
        </button>
      </form>

      <div className="journey-switch">
        <button
          type="button"
          className={jobJourneyView === "all" ? "active" : ""}
          onClick={() => onJobJourneyViewChange("all")}
        >
          Ambos
        </button>
        <button
          type="button"
          className={jobJourneyView === "client" ? "active" : ""}
          onClick={() => onJobJourneyViewChange("client")}
        >
          Jornada cliente
        </button>
        <button
          type="button"
          className={jobJourneyView === "worker" ? "active" : ""}
          onClick={() => onJobJourneyViewChange("worker")}
        >
          Jornada worker
        </button>
      </div>
      <p className="muted">
        Foco ativo:{" "}
        {jobJourneyView === "all"
          ? "Cliente e worker"
          : jobJourneyView === "client"
            ? "So cliente"
            : "So worker"}
        .
      </p>

      <div className={`panel-grid ${jobJourneyView === "all" ? "" : "panel-grid--single"}`}>
        {showClientJourney ? (
          <div className="result">
            <p className="item-title">Meus jobs (cliente)</p>
            {jobsLoading && visibleClientJobs.length === 0 ? (
              <p>A carregar jobs de cliente...</p>
            ) : visibleClientJobs.length === 0 ? (
              <DashboardEmptyState
                message={
                  jobSearch.trim().length > 0
                    ? "Nenhum job de cliente corresponde à pesquisa atual."
                    : "Ainda não tens jobs publicados. Cria o teu primeiro pedido em 2 minutos."
                }
              />
            ) : (
              visibleClientJobs.map((job) => {
                const actionPlan = buildJobActionPlan({
                  actor: "client",
                  job,
                  canReview: reviewableJobIdSet.has(job.id),
                });
                const primaryStatusAction =
                  actionPlan.primary.kind === "status" ? actionPlan.primary : null;
                const secondaryStatusAction =
                  actionPlan.secondary?.kind === "status" ? actionPlan.secondary : null;

                return (
                  <article key={job.id} className="list-item job-card">
                    <p className="item-title">
                      {job.title}
                      <DashboardBadge tone={getJobStatusBadgeTone(job.status)}>
                        {formatJobStatus(job.status)}
                      </DashboardBadge>
                    </p>
                    <p>
                      <strong>Orçamento:</strong> {formatCurrencyMzn(job.budget)}
                    </p>
                    <p>
                      <strong>Modo de preco:</strong>{" "}
                      {job.pricingMode === "QUOTE_REQUEST" ? "Sob cotacao" : "Preco fixo"}
                    </p>
                    {job.pricingMode === "QUOTE_REQUEST" && typeof job.quotedAmount === "number" ? (
                      <p>
                        <strong>Proposta:</strong> {formatCurrencyMzn(job.quotedAmount)}
                      </p>
                    ) : null}
                    {job.pricingMode === "QUOTE_REQUEST" && job.quoteMessage ? (
                      <p>
                        <strong>Mensagem da proposta:</strong> {job.quoteMessage}
                      </p>
                    ) : null}
                    <p>
                      <strong>Worker:</strong> {shortenId(job.workerProfileId)}
                    </p>
                    <p>
                      <strong>Categoria:</strong> {shortenId(job.categoryId)}
                    </p>
                    <p>
                      <strong>Criado:</strong> {formatDate(job.createdAt)}
                    </p>
                    {job.scheduledFor ? (
                      <p>
                        <strong>Agendado:</strong> {formatDate(job.scheduledFor)}
                      </p>
                    ) : null}
                    <JobTimeline job={job} />
                    {actionPlan.primary.kind === "review" ? (
                      <div
                        className="actions"
                        style={{
                          marginTop: "0.5rem",
                          gridTemplateColumns: "1fr",
                        }}
                      >
                        <button
                          type="button"
                          className="primary"
                          onClick={() => onGoToReviewJob(job.id)}
                        >
                          {actionPlan.primary.label}
                        </button>
                      </div>
                    ) : (
                      <div
                        className="actions"
                        style={{
                          marginTop: "0.5rem",
                          gridTemplateColumns: secondaryStatusAction
                            ? "repeat(2, 1fr)"
                            : "1fr",
                        }}
                      >
                        {primaryStatusAction ? (
                          <button
                            type="button"
                            className={
                              primaryStatusAction.emphasis === "danger"
                                ? "is-danger"
                                : "primary"
                            }
                            onClick={() =>
                              onUpdateJobStatus(job.id, primaryStatusAction.nextStatus, "client", {
                                quotedAmount: primaryStatusAction.options?.quotedAmount,
                              })
                            }
                            disabled={jobsLoading}
                          >
                            {primaryStatusAction.label}
                          </button>
                        ) : (
                          <button type="button" disabled>
                            {actionPlan.primary.label}
                          </button>
                        )}
                        {secondaryStatusAction ? (
                          <button
                            type="button"
                            className={
                              secondaryStatusAction.emphasis === "danger" ? "is-danger" : undefined
                            }
                            onClick={() =>
                              onUpdateJobStatus(job.id, secondaryStatusAction.nextStatus, "client")
                            }
                            disabled={jobsLoading}
                          >
                            {secondaryStatusAction.label}
                          </button>
                        ) : null}
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </div>
        ) : null}

        {showWorkerJourney ? (
          <div className="result">
            <p className="item-title">Jobs atribuidos a mim (worker)</p>
            {jobsLoading && visibleWorkerJobs.length === 0 ? (
              <p>A carregar jobs de worker...</p>
            ) : visibleWorkerJobs.length === 0 ? (
              <DashboardEmptyState
                message={
                  jobSearch.trim().length > 0
                    ? "Nenhum job de worker corresponde à pesquisa atual."
                    : "Ainda não recebeste jobs. Mantém o perfil disponível e com categorias corretas."
                }
              />
            ) : (
              visibleWorkerJobs.map((job) => {
                const actionPlan = buildJobActionPlan({
                  actor: "worker",
                  job,
                  canReview: false,
                });
                const quoteAmountInput =
                  jobQuoteDraftAmount[job.id] ??
                  (typeof job.quotedAmount === "number" ? String(job.quotedAmount) : "");
                const quoteMessageInput =
                  jobQuoteDraftMessage[job.id] ?? job.quoteMessage ?? "";
                const shouldShowQuoteForm = actionPlan.primary.kind === "quote";
                const primaryStatusAction =
                  actionPlan.primary.kind === "status" ? actionPlan.primary : null;

                return (
                  <article key={job.id} className="list-item job-card">
                    <p className="item-title">
                      {job.title}
                      <DashboardBadge tone={getJobStatusBadgeTone(job.status)}>
                        {formatJobStatus(job.status)}
                      </DashboardBadge>
                    </p>
                    <p>
                      <strong>Orçamento:</strong> {formatCurrencyMzn(job.budget)}
                    </p>
                    <p>
                      <strong>Modo de preco:</strong>{" "}
                      {job.pricingMode === "QUOTE_REQUEST" ? "Sob cotacao" : "Preco fixo"}
                    </p>
                    {job.pricingMode === "QUOTE_REQUEST" && typeof job.quotedAmount === "number" ? (
                      <p>
                        <strong>Proposta enviada:</strong> {formatCurrencyMzn(job.quotedAmount)}
                      </p>
                    ) : null}
                    {job.pricingMode === "QUOTE_REQUEST" && job.quoteMessage ? (
                      <p>
                        <strong>Mensagem da proposta:</strong> {job.quoteMessage}
                      </p>
                    ) : null}
                    <p>
                      <strong>Cliente:</strong> {shortenId(job.clientId)}
                    </p>
                    <p>
                      <strong>Categoria:</strong> {shortenId(job.categoryId)}
                    </p>
                    <p>
                      <strong>Criado:</strong> {formatDate(job.createdAt)}
                    </p>
                    {job.completedAt ? (
                      <p>
                        <strong>Concluido:</strong> {formatDate(job.completedAt)}
                      </p>
                    ) : null}
                    <JobTimeline job={job} />
                    {shouldShowQuoteForm ? (
                      <div className="form" style={{ marginTop: "0.5rem" }}>
                        <label>
                          Valor da proposta (MZN)
                          <input
                            type="number"
                            value={quoteAmountInput}
                            onChange={(event) =>
                              onJobQuoteDraftAmountChange(job.id, event.target.value)
                            }
                            min={1}
                            max={100_000_000}
                            step={1}
                          />
                        </label>
                        <label>
                          Mensagem (opcional)
                          <textarea
                            value={quoteMessageInput}
                            onChange={(event) =>
                              onJobQuoteDraftMessageChange(job.id, event.target.value)
                            }
                            maxLength={280}
                          />
                        </label>
                        <button
                          type="button"
                          className="primary"
                          onClick={() => onProposeQuote(job.id)}
                          disabled={jobsLoading}
                        >
                          {actionPlan.primary.label}
                        </button>
                      </div>
                    ) : null}
                    {primaryStatusAction || actionPlan.primary.kind === "none" ? (
                      <div
                        className="actions"
                        style={{
                          marginTop: "0.5rem",
                          gridTemplateColumns: "1fr",
                        }}
                      >
                        {primaryStatusAction ? (
                          <button
                            type="button"
                            className={
                              primaryStatusAction.emphasis === "danger"
                                ? "is-danger"
                                : "primary"
                            }
                            onClick={() =>
                              onUpdateJobStatus(job.id, primaryStatusAction.nextStatus, "worker", {
                                quotedAmount: primaryStatusAction.options?.quotedAmount,
                              })
                            }
                            disabled={jobsLoading}
                          >
                            {primaryStatusAction.label}
                          </button>
                        ) : (
                          <button type="button" disabled>
                            {actionPlan.primary.label}
                          </button>
                        )}
                      </div>
                    ) : null}
                  </article>
                );
              })
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
