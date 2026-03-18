import { FormEvent } from "react";
import {
  getRatingBadgeTone,
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
import { Job } from "@/lib/jobs";
import { PaginationMeta } from "@/lib/pagination";
import { Review } from "@/lib/reviews";
import { WorkerProfile } from "@/lib/worker-profile";

type ReviewSortMode = "createdAt:desc" | "rating:desc" | "rating:asc";
type ReviewRatingFilter = "all" | "5" | "4" | "3" | "2" | "1";

type ReviewsDomainSectionProps = {
  reviewsStatus: string;
  getStatusTone: (message: string) => StatusTone;
  completedClientJobs: Job[];
  myReviews: Review[];
  myReviewsMeta: PaginationMeta | null;
  reviewableJobs: Job[];
  reviewWorkerOptions: WorkerProfile[];
  reviewWorkerProfileId: string;
  onReviewWorkerProfileIdChange: (value: string) => void;
  reviewRatingFilter: ReviewRatingFilter;
  onReviewRatingFilterChange: (value: ReviewRatingFilter) => void;
  reviewLimit: number;
  onReviewLimitChange: (value: number) => void;
  reviewSortMode: ReviewSortMode;
  onReviewSortModeChange: (value: ReviewSortMode) => void;
  onReloadReviews: () => void;
  reviewsLoading: boolean;
  reviewPage: number;
  onReviewPreviousPage: () => void;
  onReviewNextPage: () => void;
  workerReviewsMeta: PaginationMeta | null;
  visibleMyReviews: Review[];
  visibleWorkerReviews: Review[];
  selectedWorkerReviewAverage: string;
  onCreateReview: (event: FormEvent<HTMLFormElement>) => void;
  reviewJobId: string;
  onReviewJobIdChange: (value: string) => void;
  reviewRating: string;
  onReviewRatingChange: (value: string) => void;
  reviewComment: string;
  onReviewCommentChange: (value: string) => void;
  formatStars: (rating: number | string) => string;
  shortenId: (value: string) => string;
  formatDate: (value: string) => string;
};

export function ReviewsDomainSection({
  reviewsStatus,
  getStatusTone,
  completedClientJobs,
  myReviews,
  myReviewsMeta,
  reviewableJobs,
  reviewWorkerOptions,
  reviewWorkerProfileId,
  onReviewWorkerProfileIdChange,
  reviewRatingFilter,
  onReviewRatingFilterChange,
  reviewLimit,
  onReviewLimitChange,
  reviewSortMode,
  onReviewSortModeChange,
  onReloadReviews,
  reviewsLoading,
  reviewPage,
  onReviewPreviousPage,
  onReviewNextPage,
  workerReviewsMeta,
  visibleMyReviews,
  visibleWorkerReviews,
  selectedWorkerReviewAverage,
  onCreateReview,
  reviewJobId,
  onReviewJobIdChange,
  reviewRating,
  onReviewRatingChange,
  reviewComment,
  onReviewCommentChange,
  formatStars,
  shortenId,
  formatDate,
}: ReviewsDomainSectionProps) {
  const selectedWorkerRatingTone = getRatingBadgeTone(selectedWorkerReviewAverage);

  return (
    <section id="reviews" className="dashboard-section">
      <DashboardSectionHeader
        title="Reviews"
        subtitle="Feedback visível gera confiança. Usa linguagem objetiva e avalia apenas jobs concluídos."
        status={reviewsStatus}
        statusTone={getStatusTone(reviewsStatus)}
      />

      <DashboardActionPanel
        title="Ação principal em reviews"
        description={
          reviewableJobs.length > 0
            ? `Tens ${reviewableJobs.length} avaliação(ões) pendente(s). Fecha o ciclo agora.`
            : "Sem pendências. Mantém monitoria das reviews do worker selecionado."
        }
        actions={
          <>
            <a href="#review-form" className="primary">
              {reviewableJobs.length > 0
                ? "Publicar review pendente"
                : "Abrir formulário"}
            </a>
            <button type="button" onClick={onReloadReviews} disabled={reviewsLoading}>
              Recarregar reviews
            </button>
          </>
        }
      />

      <DashboardPanel title="Handoff de conclusão -> review">
        <div className="flow-summary">
          <DashboardSummaryCard
            className="flow-summary-item"
            label="Jobs concluídos"
            value={completedClientJobs.length}
          />
          <DashboardSummaryCard
            className="flow-summary-item"
            label="Reviews já criadas"
            value={myReviewsMeta?.total ?? myReviews.length}
          />
          <DashboardSummaryCard
            className="flow-summary-item"
            label="Pendentes de review"
            value={reviewableJobs.length}
          />
        </div>
        {reviewableJobs.length === 0 ? (
          <p className="muted">
            Sem pendências. O fluxo está fechado para os teus jobs concluídos.
          </p>
        ) : (
          <p className="flow-hint">
            Seleciona um job concluído no formulário abaixo para fechar o ciclo
            com avaliação.
          </p>
        )}
      </DashboardPanel>

      <div className="section-toolbar">
        <label>
          Worker
          <select
            value={reviewWorkerProfileId}
            onChange={(event) => onReviewWorkerProfileIdChange(event.target.value)}
          >
            {reviewWorkerOptions.length === 0 ? (
              <option value="">Sem workers para consultar reviews</option>
            ) : (
              reviewWorkerOptions.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {shortenId(profile.userId)} ({profile.location ?? "n/a"})
                </option>
              ))
            )}
          </select>
        </label>
        <label>
          Filtro rating
          <select
            value={reviewRatingFilter}
            onChange={(event) =>
              onReviewRatingFilterChange(
                event.target.value as "all" | "5" | "4" | "3" | "2" | "1",
              )
            }
          >
            <option value="all">Todos</option>
            <option value="5">5</option>
            <option value="4">4</option>
            <option value="3">3</option>
            <option value="2">2</option>
            <option value="1">1</option>
          </select>
        </label>
        <label>
          Limite API
          <select
            value={String(reviewLimit)}
            onChange={(event) => onReviewLimitChange(Number(event.target.value))}
          >
            <option value="5">5</option>
            <option value="10">10</option>
            <option value="20">20</option>
          </select>
        </label>
        <label>
          Ordenar
          <select
            value={reviewSortMode}
            onChange={(event) =>
              onReviewSortModeChange(
                event.target.value as "createdAt:desc" | "rating:desc" | "rating:asc",
              )
            }
          >
            <option value="createdAt:desc">Data (desc)</option>
            <option value="rating:desc">Rating (desc)</option>
            <option value="rating:asc">Rating (asc)</option>
          </select>
        </label>
        <button type="button" onClick={onReloadReviews} disabled={reviewsLoading}>
          Recarregar
        </button>
      </div>

      <DashboardPaginationRow
        onPrevious={onReviewPreviousPage}
        onNext={onReviewNextPage}
        previousDisabled={reviewsLoading || reviewPage <= 1}
        nextDisabled={
          reviewsLoading || !(myReviewsMeta?.hasNext || workerReviewsMeta?.hasNext)
        }
      >
        <DashboardMetaStat label="Página" value={myReviewsMeta?.page ?? reviewPage} />
        <DashboardMetaStat
          label="Minhas"
          value={`${visibleMyReviews.length}/${myReviewsMeta?.total ?? 0}`}
        />
        <DashboardMetaStat
          label="Worker"
          value={`${visibleWorkerReviews.length}/${workerReviewsMeta?.total ?? 0}`}
        />
        <DashboardMetaStat
          label="Média worker filtrado"
          value={
            <>
              {selectedWorkerReviewAverage}/5{" "}
              <DashboardBadge tone={selectedWorkerRatingTone}>
                {formatStars(selectedWorkerReviewAverage)}
              </DashboardBadge>
            </>
          }
        />
      </DashboardPaginationRow>

      <form onSubmit={onCreateReview} className="form" id="review-form">
        <label>
          Job completo para avaliar
          <select
            value={reviewJobId}
            onChange={(event) => onReviewJobIdChange(event.target.value)}
            required
          >
            {reviewableJobs.length === 0 ? (
              <option value="">Sem jobs completos pendentes de review</option>
            ) : (
              reviewableJobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title} ({shortenId(job.id)})
                </option>
              ))
            )}
          </select>
        </label>
        <label>
          Rating
          <select
            value={reviewRating}
            onChange={(event) => onReviewRatingChange(event.target.value)}
          >
            <option value="5">5</option>
            <option value="4">4</option>
            <option value="3">3</option>
            <option value="2">2</option>
            <option value="1">1</option>
          </select>
        </label>
        <label>
          Comentário (opcional)
          <textarea
            value={reviewComment}
            onChange={(event) => onReviewCommentChange(event.target.value)}
            maxLength={1000}
          />
        </label>
        <button
          type="submit"
          className="primary"
          disabled={reviewsLoading || reviewableJobs.length === 0}
        >
          {reviewsLoading ? "Aguarda..." : "Publicar review"}
        </button>
      </form>

      <div className="panel-grid">
        <DashboardPanel title="Minhas reviews">
          {reviewsLoading && myReviews.length === 0 ? (
            <p>A carregar reviews...</p>
          ) : visibleMyReviews.length === 0 ? (
            <DashboardEmptyState
              message={
                reviewRatingFilter !== "all"
                  ? "Sem reviews com esse rating."
                  : "Ainda não criaste reviews. Quando terminares um job, volta aqui para avaliar."
              }
            />
          ) : (
            visibleMyReviews.map((review) => (
              <article key={review.id} className="list-item review-card">
                <p className="item-title">
                  <DashboardBadge tone={getRatingBadgeTone(review.rating)}>
                    {formatStars(review.rating)} {review.rating}/5
                  </DashboardBadge>
                </p>
                <p>
                  <strong>Job:</strong> {shortenId(review.jobId)}
                </p>
                <p>
                  <strong>Worker:</strong> {shortenId(review.workerProfileId)}
                </p>
                <p>{review.comment ?? "Sem comentário textual."}</p>
                <p className="muted">Criada em {formatDate(review.createdAt)}</p>
              </article>
            ))
          )}
        </DashboardPanel>

        <DashboardPanel title="Reviews do worker selecionado">
          {reviewsLoading && visibleWorkerReviews.length === 0 ? (
            <p>A carregar reviews do worker...</p>
          ) : visibleWorkerReviews.length === 0 ? (
            <DashboardEmptyState
              message={
                reviewRatingFilter !== "all"
                  ? "Sem reviews do worker com esse rating."
                  : "Sem reviews para o worker selecionado. Escolhe outro worker ou remove filtros."
              }
            />
          ) : (
            visibleWorkerReviews.map((review) => (
              <article key={review.id} className="list-item review-card">
                <p className="item-title">
                  <DashboardBadge tone={getRatingBadgeTone(review.rating)}>
                    {formatStars(review.rating)} {review.rating}/5
                  </DashboardBadge>
                </p>
                <p>
                  <strong>Job:</strong> {shortenId(review.jobId)}
                </p>
                <p>
                  <strong>Reviewer:</strong> {shortenId(review.reviewerId)}
                </p>
                <p>{review.comment ?? "Sem comentário textual."}</p>
                <p className="muted">Criada em {formatDate(review.createdAt)}</p>
              </article>
            ))
          )}
        </DashboardPanel>
      </div>
    </section>
  );
}
