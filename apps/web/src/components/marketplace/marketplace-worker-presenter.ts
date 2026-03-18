import type { StatusBadgeTone } from "@/components/dashboard/dashboard-formatters";
import type { WorkerProfile } from "@/lib/worker-profile";

type WorkerCtaInput = {
  isOwnProfile?: boolean;
  isAvailable: boolean;
  hasHourlyRate: boolean;
};

export type WorkerCtaCopy = {
  primaryLabel: string;
  secondaryLabel: string;
  helperText: string;
};

type WorkerRelevanceInput = {
  isAvailable: boolean;
  ratingValue: number;
  ratingCount: number;
};

type WorkerDecisionInput = {
  isAvailable: boolean;
  ratingValue: number;
  ratingCount: number;
  experienceYears: number;
  hourlyRate: number | null;
  ratingRank?: number | null;
  priceRank?: number | null;
};

export type WorkerRelevance = {
  highlighted: boolean;
  label: string | null;
};

export type WorkerDecisionBadge = {
  label: string;
  tone: StatusBadgeTone;
};

export type WorkerComparisonItem = {
  label: string;
  value: string;
  tone: StatusBadgeTone;
};

export type WorkerRankingContext = {
  ratingRankById: Record<string, number>;
  priceRankById: Record<string, number>;
};

function normalizeRating(value: number | string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildWorkerRankingContext(
  workers: WorkerProfile[],
): WorkerRankingContext {
  const rated = [...workers]
    .filter((worker) => worker.ratingCount > 0)
    .sort((a, b) => {
      const diff = normalizeRating(b.ratingAvg) - normalizeRating(a.ratingAvg);
      if (diff !== 0) {
        return diff;
      }

      return b.ratingCount - a.ratingCount;
    });

  const priced = [...workers]
    .filter((worker) => typeof worker.hourlyRate === "number")
    .sort((a, b) => (a.hourlyRate ?? 0) - (b.hourlyRate ?? 0));

  const ratingRankById = rated.reduce<Record<string, number>>((acc, worker, index) => {
    acc[worker.id] = index + 1;
    return acc;
  }, {});

  const priceRankById = priced.reduce<Record<string, number>>((acc, worker, index) => {
    acc[worker.id] = index + 1;
    return acc;
  }, {});

  return {
    ratingRankById,
    priceRankById,
  };
}

export function getWorkerCtaCopy(input: WorkerCtaInput): WorkerCtaCopy {
  if (input.isOwnProfile) {
    return {
      primaryLabel: "Gerir meu perfil",
      secondaryLabel: "Criar job de teste",
      helperText:
        "Mantém disponibilidade, bio e tarifa atualizadas para receber pedidos mais rápidos.",
    };
  }

  if (!input.isAvailable) {
    return {
      primaryLabel: "Pedir disponibilidade",
      secondaryLabel: "Ver fluxo de contratação",
      helperText:
        "Sem compromisso: envia o pedido e confirma agenda antes de avançar.",
    };
  }

  if (!input.hasHourlyRate) {
    return {
      primaryLabel: "Pedir orçamento",
      secondaryLabel: "Ver fluxo de contratação",
      helperText:
        "Partilha o serviço e recebe proposta antes de aceitar o job.",
    };
  }

  return {
    primaryLabel: "Pedir serviço",
    secondaryLabel: "Pedir orçamento",
    helperText: "Confirma em poucos passos e acompanha o progresso no dashboard.",
  };
}

export function getWorkerRelevance(input: WorkerRelevanceInput): WorkerRelevance {
  if (!input.isAvailable) {
    return {
      highlighted: false,
      label: "Agenda por confirmar",
    };
  }

  if (input.ratingValue >= 4.7 && input.ratingCount >= 8) {
    return {
      highlighted: true,
      label: "Destaque em reputação",
    };
  }

  if (input.ratingValue >= 4.3 && input.ratingCount >= 4) {
    return {
      highlighted: true,
      label: "Boa confiança",
    };
  }

  if (input.ratingCount >= 1) {
    return {
      highlighted: false,
      label: "Com histórico de clientes",
    };
  }

  return {
    highlighted: false,
    label: "Novo no marketplace",
  };
}

export function getWorkerResponseEtaLabel(input: WorkerDecisionInput): string {
  if (!input.isAvailable) {
    return "Resposta (estimativa): até 24h";
  }

  if (input.ratingCount >= 10 || input.experienceYears >= 8) {
    return "Resposta (estimativa): ~10 min";
  }

  if (input.ratingCount >= 4 || input.experienceYears >= 4) {
    return "Resposta (estimativa): ~30 min";
  }

  return "Resposta (estimativa): ~1h";
}

export function getWorkerDecisionBadges(
  input: WorkerDecisionInput,
): WorkerDecisionBadge[] {
  const badges: WorkerDecisionBadge[] = [];

  if ((input.ratingRank ?? 0) === 1 && input.ratingCount >= 4) {
    badges.push({ label: "Melhor avaliação", tone: "is-ok" });
  }

  if ((input.priceRank ?? 0) === 1 && typeof input.hourlyRate === "number") {
    badges.push({ label: "Preço competitivo", tone: "is-ok" });
  }

  if (input.ratingCount >= 12) {
    badges.push({ label: "Mais procurado", tone: "is-ok" });
  }

  badges.push(
    input.isAvailable
      ? { label: "Disponível hoje", tone: "is-muted" }
      : { label: "Agenda limitada", tone: "is-danger" },
  );

  return badges.slice(0, 3);
}

export function getWorkerComparisonItems(
  input: WorkerDecisionInput,
): WorkerComparisonItem[] {
  const ratingTone: StatusBadgeTone =
    input.ratingCount === 0
      ? "is-muted"
      : input.ratingValue >= 4.5
        ? "is-ok"
        : input.ratingValue >= 3.5
          ? "is-muted"
          : "is-danger";

  const experienceTone: StatusBadgeTone =
    input.experienceYears >= 8
      ? "is-ok"
      : input.experienceYears >= 3
        ? "is-muted"
        : "is-danger";

  const priceTone: StatusBadgeTone =
    typeof input.hourlyRate !== "number"
      ? "is-muted"
      : (input.priceRank ?? 0) === 1
        ? "is-ok"
        : "is-muted";

  const ratingValue =
    input.ratingCount > 0 ? `${input.ratingValue.toFixed(1)}/5` : "Sem avaliações";
  const priceValue =
    typeof input.hourlyRate === "number"
      ? `${input.hourlyRate.toLocaleString("pt-MZ")} MZN/h`
      : "Sob cotação";

  return [
    {
      label: "Rating",
      value: ratingValue,
      tone: ratingTone,
    },
    {
      label: "Preço",
      value: priceValue,
      tone: priceTone,
    },
    {
      label: "Experiência",
      value: `${input.experienceYears} anos`,
      tone: experienceTone,
    },
  ];
}
