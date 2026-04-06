import { ServiceRequest } from "@/lib/service-requests";
import { WorkerProfile } from "@/lib/worker-profile";

export type RecommendationPoolScope =
  | "category-available"
  | "catalog-available";

export type RequestWorkerRecommendation = {
  worker: WorkerProfile;
  proximityScore: number;
  distanceLabel: string;
  shortComment: string;
};

export type RequestWorkerRecommendationResult = {
  items: RequestWorkerRecommendation[];
  statusMessage: string;
};

type RecommendationStage = "nearby" | "expanded" | "broad" | "no-location";

const locationStopwords = new Set([
  "a",
  "ao",
  "area",
  "bairro",
  "da",
  "de",
  "do",
  "dos",
  "e",
  "em",
  "local",
  "na",
  "no",
  "nos",
  "rua",
  "zona",
]);

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getLocationTokens(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length >= 3 && !locationStopwords.has(token));
}

function getSharedLocationTokenCount(
  requestLocation: string | null | undefined,
  workerLocation: string | null | undefined,
): number {
  const requestTokens = new Set(getLocationTokens(requestLocation));
  const workerTokens = new Set(getLocationTokens(workerLocation));

  let shared = 0;
  requestTokens.forEach((token) => {
    if (workerTokens.has(token)) {
      shared += 1;
    }
  });

  return shared;
}

function getProximityScore(
  requestLocation: string | null | undefined,
  workerLocation: string | null | undefined,
): number {
  if (!requestLocation || !workerLocation) {
    return 0;
  }

  const normalizedRequest = normalizeText(requestLocation);
  const normalizedWorker = normalizeText(workerLocation);

  if (normalizedRequest.length === 0 || normalizedWorker.length === 0) {
    return 0;
  }

  if (normalizedRequest === normalizedWorker) {
    return 3;
  }

  if (
    normalizedRequest.includes(normalizedWorker) ||
    normalizedWorker.includes(normalizedRequest)
  ) {
    return 3;
  }

  const sharedTokens = getSharedLocationTokenCount(requestLocation, workerLocation);
  if (sharedTokens >= 2) {
    return 2;
  }

  if (sharedTokens >= 1) {
    return 1;
  }

  return 0;
}

function getDistanceLabel(
  requestLocation: string | null | undefined,
  workerLocation: string | null | undefined,
  proximityScore: number,
): string {
  if (!requestLocation || !workerLocation) {
    return "Distância a confirmar";
  }

  if (proximityScore >= 3) {
    return "0-2 km (estimado)";
  }

  if (proximityScore >= 2) {
    return "2-5 km (estimado)";
  }

  if (proximityScore >= 1) {
    return "5-12 km (estimado)";
  }

  return "Mais de 12 km (estimado)";
}

function getShortComment(worker: WorkerProfile): string {
  const bio = worker.bio?.trim();
  if (!bio) {
    return "Perfil pronto para avaliar o pedido e enviar proposta.";
  }

  const firstSentence = bio.split(/(?<=[.!?])\s+/)[0]?.trim() ?? bio;
  const baseText = firstSentence.length > 0 ? firstSentence : bio;

  if (baseText.length <= 110) {
    return baseText;
  }

  return `${baseText.slice(0, 107).trimEnd()}...`;
}

function matchesRequestCategory(request: ServiceRequest, worker: WorkerProfile): boolean {
  if (request.category?.slug) {
    return worker.categories.some((category) => category.slug === request.category?.slug);
  }

  return worker.categories.some((category) => category.id === request.categoryId);
}

function buildStatusMessage(input: {
  request: ServiceRequest;
  scope: RecommendationPoolScope;
  stage: RecommendationStage;
}): string {
  if (!input.request.location) {
    return "Sem localização definida no pedido. Mostramos profissionais relevantes desta área por reputação e disponibilidade.";
  }

  if (input.stage === "nearby") {
    return "Mostramos primeiro profissionais na tua zona com melhor encaixe para este pedido.";
  }

  if (input.stage === "expanded") {
    return "Não encontrámos perfis na mesma zona. Expandimos a procura para áreas próximas.";
  }

  if (input.scope === "category-available") {
    return "Ainda não encontrámos profissionais próximos. Continuamos a procurar na tua zona.";
  }

  return "Ainda não encontrámos profissionais próximos. Mostramos opções mais amplas para acelerar propostas.";
}

export function buildRequestWorkerRecommendations(
  request: ServiceRequest,
  workers: WorkerProfile[],
  scope: RecommendationPoolScope,
): RequestWorkerRecommendationResult {
  const existingProviderIds = new Set(
    (request.proposals ?? []).map((proposal) => proposal.providerId),
  );
  const categoryMatches = workers.filter((worker) => matchesRequestCategory(request, worker));
  const basePool = categoryMatches.length > 0 ? categoryMatches : workers;
  const eligibleWorkers = basePool.filter(
    (worker) => !existingProviderIds.has(worker.userId),
  );

  if (eligibleWorkers.length === 0) {
    return {
      items: [],
      statusMessage:
        existingProviderIds.size > 0
          ? "Os perfis mais relevantes para este pedido já enviaram proposta."
          : "Ainda não encontrámos profissionais relevantes para este pedido.",
    };
  }

  const scoredWorkers = eligibleWorkers.map((worker) => {
    const proximityScore = getProximityScore(request.location, worker.location);

    return {
      worker,
      proximityScore,
      distanceLabel: getDistanceLabel(
        request.location,
        worker.location,
        proximityScore,
      ),
      shortComment: getShortComment(worker),
    };
  });

  const nearbyWorkers = scoredWorkers.filter((worker) => worker.proximityScore >= 2);
  const expandedWorkers = scoredWorkers.filter((worker) => worker.proximityScore >= 1);

  let selectedWorkers = scoredWorkers;
  let stage: RecommendationStage = request.location ? "broad" : "no-location";

  if (request.location) {
    if (nearbyWorkers.length > 0) {
      selectedWorkers = nearbyWorkers;
      stage = "nearby";
    } else if (expandedWorkers.length > 0) {
      selectedWorkers = expandedWorkers;
      stage = "expanded";
    }
  }

  const orderedWorkers = [...selectedWorkers].sort((left, right) => {
    const proximityDiff = right.proximityScore - left.proximityScore;
    if (proximityDiff !== 0) {
      return proximityDiff;
    }

    const ratingDiff =
      Number(right.worker.ratingAvg || 0) - Number(left.worker.ratingAvg || 0);
    if (ratingDiff !== 0) {
      return ratingDiff;
    }

    const availabilityDiff =
      Number(right.worker.isAvailable) - Number(left.worker.isAvailable);
    if (availabilityDiff !== 0) {
      return availabilityDiff;
    }

    const ratingCountDiff = right.worker.ratingCount - left.worker.ratingCount;
    if (ratingCountDiff !== 0) {
      return ratingCountDiff;
    }

    return right.worker.experienceYears - left.worker.experienceYears;
  });

  return {
    items: orderedWorkers.slice(0, 6),
    statusMessage: buildStatusMessage({
      request,
      scope,
      stage,
    }),
  };
}
