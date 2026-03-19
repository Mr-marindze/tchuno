import { FormEvent, useEffect, useMemo, useRef } from "react";
import {
  getJobStatusBadgeTone,
  StatusTone,
} from "@/components/dashboard/dashboard-formatters";
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
import { buildJobActionPlan } from "@/lib/job-cta";
import { JobTimeline } from "@/components/job-timeline";
import { Job, JobStatus } from "@/lib/jobs";
import { PaginationMeta } from "@/lib/pagination";
import { trackEvent } from "@/lib/tracking";
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
  showJourneySwitch: boolean;
  canCreateJobs: boolean;
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
  showJourneySwitch,
  canCreateJobs,
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
  const isWorkerOnlyContext = !canCreateJobs;
  const hasDualJourney = showClientJourney && showWorkerJourney;
  const jobsSectionSubtitle = isWorkerOnlyContext
    ? "Foco no prestador: responde pedidos recebidos, envia cotações quando necessário e mantém o estado dos trabalhos em dia."
    : "Criação guiada: confirma pré-requisitos, publica o pedido e acompanha as transições de estado.";
  const nextPageAvailable = hasDualJourney
    ? Boolean(clientJobsMeta?.hasNext || workerJobsMeta?.hasNext)
    : showClientJourney
      ? Boolean(clientJobsMeta?.hasNext)
      : Boolean(workerJobsMeta?.hasNext);
  const activeJourneyLabel = hasDualJourney
    ? "Cliente e prestador"
    : showClientJourney
      ? "Só cliente"
      : "Só prestador";
  const creationSteps = useMemo(
    () => [
      {
        label: "Profissional selecionado",
        ready: jobWorkerProfileId.length > 0,
      },
      {
        label: "Categoria definida",
        ready: jobCategoryId.length > 0,
      },
      {
        label: "Título e descrição completos",
        ready: jobTitle.trim().length >= 3 && jobDescription.trim().length >= 10,
      },
      {
        label:
          jobPricingMode === "FIXED_PRICE"
            ? "Orçamento obrigatório definido"
            : "Modo de cotação confirmado",
        ready:
          jobPricingMode === "FIXED_PRICE"
            ? Number(jobBudget) > 0
            : true,
      },
    ],
    [
      jobWorkerProfileId,
      jobCategoryId,
      jobTitle,
      jobDescription,
      jobPricingMode,
      jobBudget,
    ],
  );
  const creationStepReadyCount = creationSteps.filter((item) => item.ready).length;
  const creationProgressPercent = Math.round(
    (creationStepReadyCount / creationSteps.length) * 100,
  );
  const createJobCtaLabel =
    jobPricingMode === "QUOTE_REQUEST"
      ? "Criar job e pedir cotação"
      : "Criar job de preço fixo";
  const setupChecklistItems = useMemo(
    () => jobCreationChecklist.map((item) => ({ label: item.label, ready: item.ready })),
    [jobCreationChecklist],
  );
  const requestChecklistItems = useMemo(
    () => creationSteps.map((item) => ({ label: item.label, ready: item.ready })),
    [creationSteps],
  );
  const creationStepState = useMemo(() => {
    const pendingStepIndex = creationSteps.findIndex((item) => !item.ready);

    if (pendingStepIndex === -1) {
      return {
        index: creationSteps.length + 1,
        label: "Pronto para submissão",
      };
    }

    return {
      index: pendingStepIndex + 1,
      label: creationSteps[pendingStepIndex].label,
    };
  }, [creationSteps]);
  const previousCreationStepRef = useRef<string | null>(null);

  useEffect(() => {
    const currentStepKey = `${creationStepState.index}:${creationStepState.label}:${jobPricingMode}`;
    if (previousCreationStepRef.current === currentStepKey) {
      return;
    }

    trackEvent("job.create.step.change", {
      source: "dashboard.jobs.create",
      view: "dashboard.jobs",
      stepIndex: creationStepState.index,
      stepLabel: creationStepState.label,
      readySteps: creationStepReadyCount,
      totalSteps: creationSteps.length,
      pricingMode: jobPricingMode,
    });

    previousCreationStepRef.current = currentStepKey;
  }, [creationStepReadyCount, creationStepState, creationSteps.length, jobPricingMode]);

  return (
    <section id="jobs" className="dashboard-section">
      <DashboardSectionHeader
        title="Jobs"
        subtitle={jobsSectionSubtitle}
        status={jobsStatus}
        statusTone={getStatusTone(jobsStatus)}
      />

      <DashboardActionPanel
        title="Ação recomendada agora"
        description={
          isWorkerOnlyContext
            ? visibleWorkerJobs.length > 0
              ? "Prioriza os pedidos recebidos com ação pendente para evitar atrasos."
              : "Ainda não recebeste pedidos. Mantém disponibilidade ativa e acompanha novas entradas."
            : hasReviewBacklog
              ? `Tens ${reviewableJobs.length} job(s) concluído(s) sem review. Fecha o ciclo de confiança primeiro.`
              : "Sem backlog de reviews. Foca em pedidos novos e execução em curso."
        }
        actions={
          <>
            {isWorkerOnlyContext ? (
              <a href="#worker-journey" className="primary">
                Ver pedidos recebidos
              </a>
            ) : (
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
              </>
            )}
            <button type="button" onClick={onReloadJobs} disabled={jobsLoading}>
              Recarregar lista
            </button>
          </>
        }
      />

      {canCreateJobs ? (
        <>
          <DashboardPanel title="Fluxo do pedido (cliente -> prestador -> review)">
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
                Tens {reviewableJobs.length} job(s) prontos para avaliação.{" "}
                <a href="#reviews" className="nav-link">Ir para reviews</a>
              </p>
            ) : (
              <p className="muted">
                Quando um job chega a concluído, ele aparece automaticamente em
                Reviews.
              </p>
            )}
          </DashboardPanel>

          <DashboardPanel title="Criação guiada de pedido">
            <div className="flow-summary">
              <DashboardSummaryCard
                className="flow-summary-item"
                label="Passos prontos"
                value={`${creationStepReadyCount}/${creationSteps.length}`}
              />
              <DashboardSummaryCard
                className="flow-summary-item"
                label="Progresso"
                value={`${creationProgressPercent}%`}
              />
              <DashboardSummaryCard
                className="flow-summary-item"
                label="Profissional selecionado"
                value={
                  selectedJobWorkerProfile
                    ? shortenId(selectedJobWorkerProfile.userId)
                    : "Nenhum"
                }
              />
              <DashboardSummaryCard
                className="flow-summary-item"
                label="Categorias compatíveis"
                value={availableJobCategories.length}
              />
            </div>
            <div className="dashboard-progress">
              <div
                className="dashboard-progress-fill"
                style={{ width: `${creationProgressPercent}%` }}
              />
            </div>
            <p className="checklist-heading">Dependências base</p>
            <ul className="checklist">
              {setupChecklistItems.map((item) => (
                <li key={`setup-${item.label}`} className={item.ready ? "is-ready" : "is-blocked"}>
                  <strong>{item.ready ? "Pronto" : "Pendente"}:</strong> {item.label}
                </li>
              ))}
            </ul>
            <p className="checklist-heading">Passos do pedido</p>
            <ul className="checklist">
              {requestChecklistItems.map((item) => (
                <li key={`step-${item.label}`} className={item.ready ? "is-ready" : "is-blocked"}>
                  <strong>{item.ready ? "Pronto" : "Pendente"}:</strong> {item.label}
                </li>
              ))}
            </ul>
            <p className="muted">
              Profissional selecionado:{" "}
              {selectedJobWorkerProfile
                ? `${shortenId(selectedJobWorkerProfile.userId)} (${selectedJobWorkerProfile.location ?? "n/a"})`
                : "Nenhum"}
            </p>
            <p className="muted">
              Categorias compatíveis com o profissional: {availableJobCategories.length}
            </p>
          </DashboardPanel>
        </>
      ) : null}

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

      <DashboardPaginationRow
        onPrevious={onJobPreviousPage}
        onNext={onJobNextPage}
        previousDisabled={jobsLoading || jobPage <= 1}
        nextDisabled={jobsLoading || !nextPageAvailable}
      >
        <DashboardMetaStat
          label="Página"
          value={clientJobsMeta?.page ?? workerJobsMeta?.page ?? jobPage}
        />
        {showClientJourney ? (
          <DashboardMetaStat
            label={hasDualJourney ? "Cliente" : "Pedidos"}
            value={`${visibleClientJobs.length}/${clientJobsMeta?.total ?? 0}`}
          />
        ) : null}
        {showWorkerJourney ? (
          <DashboardMetaStat
            label={hasDualJourney ? "Prestador" : "Recebidos"}
            value={`${visibleWorkerJobs.length}/${workerJobsMeta?.total ?? 0}`}
          />
        ) : null}
      </DashboardPaginationRow>

      {canCreateJobs ? (
        <form onSubmit={onCreateJob} className="form job-create-form" id="job-create">
        <fieldset className="form-step">
          <legend>Passo 1 · Selecionar profissional e categoria</legend>
          <label>
            Profissional
            <select
              value={jobWorkerProfileId}
              onChange={(event) => onJobWorkerProfileIdChange(event.target.value)}
              required
            >
              {jobWorkerOptions.length === 0 ? (
                <option value="">Sem profissionais disponíveis</option>
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
                <option value="">Sem categoria compatível</option>
              ) : (
                availableJobCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))
              )}
            </select>
          </label>
        </fieldset>

        <fieldset className="form-step">
          <legend>Passo 2 · Definir tipo de preço e contexto</legend>
          <label>
            Modo de preço
            <select
              value={jobPricingMode}
              onChange={(event) =>
                onJobPricingModeChange(event.target.value as "FIXED_PRICE" | "QUOTE_REQUEST")
              }
            >
              <option value="FIXED_PRICE">Preço fixo</option>
              <option value="QUOTE_REQUEST">Sob cotação</option>
            </select>
          </label>
          <label>
            {jobPricingMode === "FIXED_PRICE"
              ? "Orçamento (obrigatório)"
              : "Orçamento máximo (opcional)"}
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
        </fieldset>

        <fieldset className="form-step">
          <legend>Passo 3 · Descrever o pedido</legend>
          <label>
            Título
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
            Descrição
            <textarea
              value={jobDescription}
              onChange={(event) => onJobDescriptionChange(event.target.value)}
              maxLength={2000}
              minLength={10}
              required
            />
          </label>
        </fieldset>

          <button
            type="submit"
            className="primary"
            disabled={
              jobsLoading ||
              jobWorkerOptions.length === 0 ||
              availableJobCategories.length === 0
            }
          >
            {jobsLoading ? "Aguarda..." : createJobCtaLabel}
          </button>
        </form>
      ) : null}

      {showJourneySwitch ? (
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
            Jornada prestador
          </button>
        </div>
      ) : null}
      <p className="muted">
        Foco ativo: {activeJourneyLabel}.
      </p>

      <div className={`panel-grid ${hasDualJourney ? "" : "panel-grid--single"}`}>
        {showClientJourney ? (
          <DashboardPanel title="Acompanhamento de pedidos (cliente)">
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
                      <strong>Modo de preço:</strong>{" "}
                      {job.pricingMode === "QUOTE_REQUEST" ? "Sob cotação" : "Preço fixo"}
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
          </DashboardPanel>
        ) : null}

        {showWorkerJourney ? (
          <div id="worker-journey">
            <DashboardPanel title="Acompanhamento de pedidos (prestador)">
            {jobsLoading && visibleWorkerJobs.length === 0 ? (
              <p>A carregar pedidos do prestador...</p>
            ) : visibleWorkerJobs.length === 0 ? (
              <DashboardEmptyState
                message={
                  jobSearch.trim().length > 0
                    ? "Nenhum pedido recebido corresponde à pesquisa atual."
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
                      <strong>Modo de preço:</strong>{" "}
                      {job.pricingMode === "QUOTE_REQUEST" ? "Sob cotação" : "Preço fixo"}
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
                        <strong>Concluído:</strong> {formatDate(job.completedAt)}
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
            </DashboardPanel>
          </div>
        ) : null}
      </div>
    </section>
  );
}
