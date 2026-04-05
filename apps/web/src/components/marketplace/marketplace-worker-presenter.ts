import type { StatusBadgeTone } from "@/components/dashboard/dashboard-formatters";
import {
  getWorkerRelevanceScore,
  type WorkerRankingDebugItem,
  type WorkerRelevanceScoreBreakdown,
} from "@/lib/tracking";
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
  rankingLabel?: string | null;
  scoreBreakdown?: WorkerRelevanceScoreBreakdown | null;
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

export function getWorkerPriceLabel(hourlyRate: number | null): string {
  if (typeof hourlyRate !== "number") {
    return "Valor negociado com o profissional";
  }

  return `Referência ${hourlyRate.toLocaleString("pt-MZ")} MZN/h (negociável)`;
}

export function getWorkerMainCategoryLabel(worker: WorkerProfile): string {
  return worker.categories[0]?.name ?? "Sem categoria definida";
}

export function getWorkerReviewLabel(count: number): string {
  if (count === 1) {
    return "1 avaliação";
  }

  return `${count} avaliações`;
}

export type WorkerRankingContext = {
  ratingRankById: Record<string, number>;
  priceRankById: Record<string, number>;
  relevanceRankById: Record<string, number>;
  relevanceScoreById: Record<string, number>;
  rankingLabelById: Record<string, string>;
  strongHighlightById: Record<string, boolean>;
  scoreBreakdownById: Record<string, WorkerRelevanceScoreBreakdown>;
  topWorkersDebug: WorkerRankingDebugItem[];
};

function normalizeRating(value: number | string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function resolveRankingLabel(input: {
  ratingRank: number | null;
  relevanceRank: number | null;
  scoreBreakdown: WorkerRelevanceScoreBreakdown;
}): string {
  const hasReliableEvidence = input.scoreBreakdown.confidenceLevel !== "low";

  if (
    (input.ratingRank ?? Number.MAX_SAFE_INTEGER) === 1 &&
    input.scoreBreakdown.qualityComponent >= 7.8 &&
    hasReliableEvidence
  ) {
    return "Melhor avaliação";
  }

  if (
    input.scoreBreakdown.conversionComponent >= 5.6 &&
    input.scoreBreakdown.conversions >= 2 &&
    hasReliableEvidence
  ) {
    return "Boa conversão";
  }

  if (
    input.scoreBreakdown.interestComponent +
      input.scoreBreakdown.intentionComponent >=
      2.6 &&
    input.scoreBreakdown.interactions >= 4 &&
    hasReliableEvidence
  ) {
    return "Mais procurado";
  }

  if ((input.relevanceRank ?? Number.MAX_SAFE_INTEGER) <= 3) {
    return "Relevante nesta lista";
  }

  return "Relevante nesta lista";
}

export function buildWorkerRankingContext(
  workers: WorkerProfile[],
  behaviorVersion?: number,
): WorkerRankingContext {
  void behaviorVersion;

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

  const ratingRankById = rated.reduce<Record<string, number>>(
    (acc, worker, index) => {
      acc[worker.id] = index + 1;
      return acc;
    },
    {},
  );

  const priceRankById = priced.reduce<Record<string, number>>(
    (acc, worker, index) => {
      acc[worker.id] = index + 1;
      return acc;
    },
    {},
  );

  const relevanceRows = workers
    .map((worker) => {
      const scoreBreakdown = getWorkerRelevanceScore({
        workerId: worker.id,
        ratingAvg: worker.ratingAvg,
        ratingCount: worker.ratingCount,
      });

      return {
        workerId: worker.id,
        score: scoreBreakdown.score,
        reasons: scoreBreakdown.reasons,
        scoreBreakdown,
        ratingValue: normalizeRating(worker.ratingAvg),
        ratingCount: worker.ratingCount,
      };
    })
    .sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (scoreDiff !== 0) {
        return scoreDiff;
      }

      const ratingDiff = b.ratingValue - a.ratingValue;
      if (ratingDiff !== 0) {
        return ratingDiff;
      }

      return b.ratingCount - a.ratingCount;
    });

  const relevanceRankById = relevanceRows.reduce<Record<string, number>>(
    (acc, row, index) => {
      acc[row.workerId] = index + 1;
      return acc;
    },
    {},
  );

  const relevanceScoreById = relevanceRows.reduce<Record<string, number>>(
    (acc, row) => {
      acc[row.workerId] = row.score;
      return acc;
    },
    {},
  );

  const scoreBreakdownById = relevanceRows.reduce<
    Record<string, WorkerRelevanceScoreBreakdown>
  >((acc, row) => {
    acc[row.workerId] = row.scoreBreakdown;
    return acc;
  }, {});

  const rankingLabelById = relevanceRows.reduce<Record<string, string>>(
    (acc, row, index) => {
      const relevanceRank = index + 1;
      const ratingRank = ratingRankById[row.workerId] ?? null;
      acc[row.workerId] = resolveRankingLabel({
        ratingRank,
        relevanceRank,
        scoreBreakdown: row.scoreBreakdown,
      });
      return acc;
    },
    {},
  );

  const strongHighlightById = relevanceRows.reduce<Record<string, boolean>>(
    (acc, row, index) => {
      const relevanceRank = index + 1;
      const confidenceLevel = row.scoreBreakdown.confidenceLevel;
      const confidenceReliable =
        confidenceLevel === "medium" || confidenceLevel === "high";
      const conversionStrong =
        row.scoreBreakdown.conversionComponent >= 5.6 &&
        row.scoreBreakdown.conversions >= 2 &&
        row.scoreBreakdown.qualityComponent >= 6 &&
        confidenceReliable;
      const strongByTopRank =
        relevanceRank <= 2 &&
        row.scoreBreakdown.score >= 8.4 &&
        row.scoreBreakdown.qualityComponent >= 6.5 &&
        confidenceReliable;

      acc[row.workerId] = conversionStrong || strongByTopRank;
      return acc;
    },
    {},
  );

  const topWorkersDebug: WorkerRankingDebugItem[] = relevanceRows
    .slice(0, 3)
    .map((row) => ({
      workerId: row.workerId,
      score: row.score,
      qualityComponent: row.scoreBreakdown.qualityComponent,
      interestComponent: row.scoreBreakdown.interestComponent,
      intentionComponent: row.scoreBreakdown.intentionComponent,
      conversionComponent: row.scoreBreakdown.conversionComponent,
      stabilityMultiplier: row.scoreBreakdown.stabilityMultiplier,
      temporalDecayMultiplier: row.scoreBreakdown.temporalDecayMultiplier,
      sessionBehaviorSignal: row.scoreBreakdown.sessionBehaviorSignal,
      historicalBehaviorSignal: row.scoreBreakdown.historicalBehaviorSignal,
      sessionSignalWeight: row.scoreBreakdown.sessionSignalWeight,
      historicalSignalWeight: row.scoreBreakdown.historicalSignalWeight,
      confidenceGuardMultiplier: row.scoreBreakdown.confidenceGuardMultiplier,
      reasons: row.reasons,
    }));

  return {
    ratingRankById,
    priceRankById,
    relevanceRankById,
    relevanceScoreById,
    rankingLabelById,
    strongHighlightById,
    scoreBreakdownById,
    topWorkersDebug,
  };
}

export function getWorkerCtaCopy(input: WorkerCtaInput): WorkerCtaCopy {
  if (input.isOwnProfile) {
    return {
      primaryLabel: "Gerir meu perfil",
      secondaryLabel: "Criar pedido",
      helperText:
        "Mantém disponibilidade, bio e tarifa atualizadas para receber pedidos mais rápidos.",
    };
  }

  if (!input.isAvailable) {
    return {
      primaryLabel: "Ver perfil",
      secondaryLabel: "Pedir serviço",
      helperText:
        "A agenda pode estar limitada. Vê o perfil e envia um pedido para combinar disponibilidade.",
    };
  }

  if (!input.hasHourlyRate) {
    return {
      primaryLabel: "Pedir serviço",
      secondaryLabel: "Ver perfil",
      helperText:
        "Partilha o que precisas e negocia o valor diretamente na plataforma.",
    };
  }

  return {
    primaryLabel: "Pedir serviço",
    secondaryLabel: "Ver perfil",
    helperText:
      "O valor final é combinado entre cliente e profissional dentro do Tchuno.",
  };
}

export function getWorkerRelevance(
  input: WorkerRelevanceInput,
): WorkerRelevance {
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
  const rankingLabel = input.rankingLabel ?? null;
  const scoreBreakdown = input.scoreBreakdown ?? null;

  if (
    rankingLabel === "Melhor avaliação" ||
    ((input.ratingRank ?? 0) === 1 && input.ratingCount >= 4)
  ) {
    badges.push({ label: "Melhor avaliação", tone: "is-ok" });
  }

  if (
    rankingLabel === "Boa conversão" ||
    (scoreBreakdown &&
      scoreBreakdown.conversions >= 2 &&
      scoreBreakdown.conversionComponent >= 5.6 &&
      scoreBreakdown.confidenceLevel !== "low")
  ) {
    badges.push({ label: "Boa conversão", tone: "is-ok" });
  }

  if ((input.priceRank ?? 0) === 1 && typeof input.hourlyRate === "number") {
    badges.push({ label: "Preço de referência", tone: "is-ok" });
  }

  if (
    rankingLabel === "Mais procurado" ||
    (scoreBreakdown &&
      scoreBreakdown.interactions >= 4 &&
      scoreBreakdown.interestComponent + scoreBreakdown.intentionComponent >=
        2.6 &&
      scoreBreakdown.confidenceLevel !== "low")
  ) {
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
    input.ratingCount > 0
      ? `${input.ratingValue.toFixed(1)}/5`
      : "Sem avaliações";
  const priceValue = getWorkerPriceLabel(input.hourlyRate);

  return [
    {
      label: "Avaliação",
      value: ratingValue,
      tone: ratingTone,
    },
    {
      label: "Preço ref.",
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
