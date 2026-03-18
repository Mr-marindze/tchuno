import { Job, JobStatus } from "@/lib/jobs";

export type JobActor = "client" | "worker";

type StatusAction = {
  kind: "status";
  label: string;
  nextStatus: JobStatus;
  options?: {
    quotedAmount?: number;
  };
  emphasis?: "primary" | "danger";
};

type QuoteAction = {
  kind: "quote";
  label: string;
};

type ReviewAction = {
  kind: "review";
  label: string;
};

type NoneAction = {
  kind: "none";
  label: string;
};

export type JobAction = StatusAction | QuoteAction | ReviewAction | NoneAction;

export type JobActionPlan = {
  primary: JobAction;
  secondary?: JobAction;
};

type BuildJobActionPlanInput = {
  actor: JobActor;
  job: Job;
  canReview: boolean;
};

function canClientCancel(status: JobStatus): boolean {
  return status !== "COMPLETED" && status !== "CANCELED";
}

export function buildJobActionPlan(input: BuildJobActionPlanInput): JobActionPlan {
  const { actor, job, canReview } = input;

  if (actor === "worker") {
    if (job.status === "REQUESTED" && job.pricingMode === "FIXED_PRICE") {
      return {
        primary: {
          kind: "status",
          label: "Aceitar job",
          nextStatus: "ACCEPTED",
        },
      };
    }

    if (job.status === "REQUESTED" && job.pricingMode === "QUOTE_REQUEST") {
      return {
        primary: {
          kind: "quote",
          label:
            typeof job.quotedAmount === "number"
              ? "Atualizar proposta"
              : "Enviar proposta",
        },
      };
    }

    if (job.status === "ACCEPTED") {
      return {
        primary: {
          kind: "status",
          label: "Iniciar trabalho",
          nextStatus: "IN_PROGRESS",
        },
      };
    }

    if (job.status === "IN_PROGRESS") {
      return {
        primary: {
          kind: "status",
          label: "Concluir trabalho",
          nextStatus: "COMPLETED",
        },
      };
    }

    return {
      primary: {
        kind: "none",
        label: "Sem ação disponível neste estado",
      },
    };
  }

  if (
    job.status === "REQUESTED" &&
    job.pricingMode === "QUOTE_REQUEST" &&
    typeof job.quotedAmount === "number" &&
    job.quotedAmount > 0
  ) {
    return {
      primary: {
        kind: "status",
        label: "Aceitar proposta",
        nextStatus: "ACCEPTED",
        options: {
          quotedAmount: job.quotedAmount,
        },
      },
      ...(canClientCancel(job.status)
        ? {
            secondary: {
              kind: "status",
              label: "Cancelar job",
              nextStatus: "CANCELED",
              emphasis: "danger",
            },
          }
        : {}),
    };
  }

  if (job.status === "COMPLETED" && canReview) {
    return {
      primary: {
        kind: "review",
        label: "Avaliar agora",
      },
    };
  }

  if (canClientCancel(job.status)) {
    return {
      primary: {
        kind: "status",
        label: "Cancelar job",
        nextStatus: "CANCELED",
        emphasis: "danger",
      },
    };
  }

  return {
    primary: {
      kind: "none",
      label: "Fluxo finalizado",
    },
  };
}
