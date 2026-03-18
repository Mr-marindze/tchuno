import { Job, JobStatus } from "@/lib/jobs";

const timelineOrder: JobStatus[] = [
  "REQUESTED",
  "ACCEPTED",
  "IN_PROGRESS",
  "COMPLETED",
];

const jobStatusLabel: Record<JobStatus, string> = {
  REQUESTED: "Pedido criado",
  ACCEPTED: "Aceito",
  IN_PROGRESS: "Em progresso",
  COMPLETED: "Concluído",
  CANCELED: "Cancelado",
};

type TimelineStepState = "is-done" | "is-current" | "is-todo";

function formatTimelineDate(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-PT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatCurrencyMzn(value: number): string {
  return new Intl.NumberFormat("pt-MZ", {
    style: "currency",
    currency: "MZN",
    maximumFractionDigits: 0,
  }).format(value);
}

function getStepTimestamp(job: Job, step: JobStatus): string | null {
  if (step === "REQUESTED") {
    return job.createdAt;
  }

  if (step === "ACCEPTED") {
    return job.acceptedAt;
  }

  if (step === "IN_PROGRESS") {
    return job.startedAt;
  }

  if (step === "COMPLETED") {
    return job.completedAt;
  }

  return job.canceledAt;
}

function getTimelineStepState(job: Job, step: JobStatus): TimelineStepState {
  if (job.status === "CANCELED") {
    return getStepTimestamp(job, step) ? "is-done" : "is-todo";
  }

  const currentIndex = timelineOrder.indexOf(job.status);
  const stepIndex = timelineOrder.indexOf(step);

  if (stepIndex < currentIndex) {
    return "is-done";
  }

  if (stepIndex === currentIndex) {
    return "is-current";
  }

  return "is-todo";
}

function getRequestedNote(job: Job): string | null {
  if (job.pricingMode !== "QUOTE_REQUEST") {
    return null;
  }

  if (typeof job.quotedAmount === "number" && job.quotedAmount > 0) {
    if (job.quoteMessage && job.quoteMessage.trim().length > 0) {
      return `Proposta: ${formatCurrencyMzn(job.quotedAmount)}. ${job.quoteMessage}`;
    }

    return `Proposta enviada: ${formatCurrencyMzn(job.quotedAmount)}.`;
  }

  return "Aguardando proposta de cotação.";
}

function getTimelineNextStep(job: Job): string {
  if (job.status === "REQUESTED" && job.pricingMode === "QUOTE_REQUEST") {
    return typeof job.quotedAmount === "number" && job.quotedAmount > 0
      ? "Próximo: cliente aceitar proposta para avançar."
      : "Próximo: worker enviar proposta com valor.";
  }

  if (job.status === "REQUESTED") {
    return "Próximo: worker aceitar job.";
  }

  if (job.status === "ACCEPTED") {
    return "Próximo: worker iniciar trabalho.";
  }

  if (job.status === "IN_PROGRESS") {
    return "Próximo: worker concluir trabalho.";
  }

  if (job.status === "COMPLETED") {
    return "Fluxo concluído. Cliente pode publicar review.";
  }

  return "Fluxo encerrado por cancelamento.";
}

type JobTimelineProps = {
  job: Job;
};

export function JobTimeline({ job }: JobTimelineProps) {
  const requestedNote = getRequestedNote(job);

  return (
    <div>
      <ol className="job-timeline">
        {timelineOrder.map((step) => {
          const stepState = getTimelineStepState(job, step);
          const timestamp = formatTimelineDate(getStepTimestamp(job, step));
          const stepTime =
            timestamp ?? (stepState === "is-current" ? "Em curso" : "Pendente");

          return (
            <li key={`${job.id}-${step}`} className={`job-timeline-step ${stepState}`}>
              <p className="job-timeline-step-header">
                <span>{jobStatusLabel[step]}</span>
                <span className="job-timeline-step-time">{stepTime}</span>
              </p>
              {step === "REQUESTED" && requestedNote ? (
                <p className="job-timeline-step-note">{requestedNote}</p>
              ) : null}
            </li>
          );
        })}
        {job.status === "CANCELED" ? (
          <li className="job-timeline-step is-canceled">
            <p className="job-timeline-step-header">
              <span>{jobStatusLabel.CANCELED}</span>
              <span className="job-timeline-step-time">
                {formatTimelineDate(job.canceledAt) ?? "Sem data"}
              </span>
            </p>
            {job.cancelReason ? (
              <p className="job-timeline-step-note">
                Motivo: {job.cancelReason}
              </p>
            ) : null}
          </li>
        ) : null}
      </ol>
      <p className="job-timeline-next">{getTimelineNextStep(job)}</p>
    </div>
  );
}
