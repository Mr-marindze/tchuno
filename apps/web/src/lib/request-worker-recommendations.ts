import { ServiceRequest } from "@/lib/service-requests";
import { WorkerProfile } from "@/lib/worker-profile";

export type RecommendationPoolScope =
  | "category-available"
  | "catalog-available";

export type RecommendationProximityTier =
  | "same-zone"
  | "nearby-zone"
  | "nearby-area"
  | "broader-area"
  | "location-pending";

export type RequestWorkerRecommendation = {
  worker: WorkerProfile;
  categoryScore: number;
  proximityScore: number;
  proximityTier: RecommendationProximityTier;
  proximityLabel: string;
  distanceMeters: number | null;
  shortComment: string;
};

export type RequestWorkerRecommendationResult = {
  items: RequestWorkerRecommendation[];
  statusMessage: string;
};

type RecommendationStage = "nearby" | "expanded" | "broad" | "no-location";

type ParsedLocation = {
  normalized: string;
  tokens: string[];
  municipality: string | null;
  municipalityGroup: string | null;
  subzone: string | null;
};

type LocationMatch = {
  score: number;
  tier: RecommendationProximityTier;
  label: string;
};

const locationStopwords = new Set([
  "a",
  "ao",
  "area",
  "bairro",
  "cidade",
  "da",
  "de",
  "do",
  "dos",
  "e",
  "em",
  "local",
  "municipio",
  "na",
  "no",
  "nos",
  "provincia",
  "rua",
  "zona",
]);

const knownMunicipalities = new Set([
  "beira",
  "bilene",
  "boane",
  "chimoio",
  "dondo",
  "inhambane",
  "lichinga",
  "manica",
  "maputo",
  "marracuene",
  "matola",
  "matutuine",
  "maxixe",
  "moatize",
  "nacala",
  "nampula",
  "pemba",
  "quelimane",
  "tete",
  "xai xai",
]);

const municipalityGroups = new Map<string, string>([
  ["maputo", "greater-maputo"],
  ["matola", "greater-maputo"],
  ["boane", "greater-maputo"],
  ["marracuene", "greater-maputo"],
  ["matutuine", "greater-maputo"],
  ["beira", "beira-corridor"],
  ["dondo", "beira-corridor"],
  ["nampula", "nampula-corridor"],
  ["nacala", "nampula-corridor"],
  ["inhambane", "inhambane-bay"],
  ["maxixe", "inhambane-bay"],
  ["xai xai", "xai-xai-coast"],
  ["bilene", "xai-xai-coast"],
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

function getLocationTokensFromNormalized(value: string): string[] {
  return value
    .split(" ")
    .filter((token) => token.length >= 3 && !locationStopwords.has(token));
}

function splitLocationSegments(value: string): string[] {
  return value
    .split(/[-,;/|]+/)
    .map((segment) => normalizeText(segment))
    .filter((segment) => segment.length > 0);
}

function resolveKnownMunicipality(tokens: string[]): {
  municipality: string | null;
  tokenCount: number;
} {
  const maxSpan = Math.min(tokens.length, 3);

  for (let span = maxSpan; span >= 1; span -= 1) {
    const candidate = tokens.slice(0, span).join(" ");
    if (knownMunicipalities.has(candidate)) {
      return {
        municipality: candidate,
        tokenCount: span,
      };
    }
  }

  return {
    municipality: null,
    tokenCount: 0,
  };
}

function parseLocation(value: string | null | undefined): ParsedLocation | null {
  if (!value) {
    return null;
  }

  const normalized = normalizeText(value);
  if (normalized.length === 0) {
    return null;
  }

  const tokens = getLocationTokensFromNormalized(normalized);
  const segments = splitLocationSegments(value);
  const firstSegmentTokens =
    segments.length > 0 ? getLocationTokensFromNormalized(segments[0]) : [];
  const segmentMunicipality = resolveKnownMunicipality(firstSegmentTokens);
  const fallbackMunicipality = resolveKnownMunicipality(tokens);
  const municipality =
    segmentMunicipality.municipality ?? fallbackMunicipality.municipality;
  const municipalityTokenCount =
    segmentMunicipality.municipality !== null
      ? segmentMunicipality.tokenCount
      : fallbackMunicipality.tokenCount;

  let subzone: string | null = null;
  if (segments.length > 1) {
    const restSegments = segments.slice(1).filter((segment) => segment.length > 0);
    subzone = restSegments.length > 0 ? restSegments.join(" ") : null;
  } else if (municipality && tokens.length > municipalityTokenCount) {
    subzone = tokens.slice(municipalityTokenCount).join(" ");
  }

  return {
    normalized,
    tokens,
    municipality,
    municipalityGroup: municipality ? municipalityGroups.get(municipality) ?? null : null,
    subzone: subzone && subzone.length > 0 ? subzone : null,
  };
}

function getSharedLocationTokenCount(
  requestLocation: ParsedLocation,
  workerLocation: ParsedLocation,
): number {
  const requestTokens = new Set(requestLocation.tokens);
  const workerTokens = new Set(workerLocation.tokens);

  let shared = 0;
  requestTokens.forEach((token) => {
    if (workerTokens.has(token)) {
      shared += 1;
    }
  });

  return shared;
}

function buildLocationMatch(
  requestLocation: string | null | undefined,
  workerLocation: string | null | undefined,
): LocationMatch {
  const parsedRequest = parseLocation(requestLocation);
  const parsedWorker = parseLocation(workerLocation);

  if (!parsedRequest || !parsedWorker) {
    return {
      score: 0,
      tier: "location-pending",
      label: "Localização por confirmar",
    };
  }

  if (parsedRequest.normalized === parsedWorker.normalized) {
    return {
      score: 4,
      tier: "same-zone",
      label: "Mesma zona",
    };
  }

  if (
    parsedRequest.municipality &&
    parsedRequest.municipality === parsedWorker.municipality
  ) {
    if (
      parsedRequest.subzone &&
      parsedWorker.subzone &&
      parsedRequest.subzone === parsedWorker.subzone
    ) {
      return {
        score: 4,
        tier: "same-zone",
        label: "Mesma zona",
      };
    }

    return {
      score: 3,
      tier: "nearby-zone",
      label: "Mesma cidade",
    };
  }

  if (
    parsedRequest.municipalityGroup &&
    parsedRequest.municipalityGroup === parsedWorker.municipalityGroup
  ) {
    return {
      score: 2,
      tier: "nearby-area",
      label: "Área próxima",
    };
  }

  const sharedTokens = getSharedLocationTokenCount(parsedRequest, parsedWorker);
  if (sharedTokens >= 2) {
    return {
      score: 2,
      tier: "nearby-area",
      label: "Área próxima",
    };
  }

  if (sharedTokens >= 1) {
    return {
      score: 1,
      tier: "broader-area",
      label: "Correspondência parcial",
    };
  }

  return {
    score: 0,
    tier: "broader-area",
    label: "Mais amplo",
  };
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
    return "O pedido ainda não tem localização suficiente para medir proximidade. Mostramos profissionais relevantes desta área por reputação e disponibilidade.";
  }

  if (input.stage === "nearby") {
    return "Mostramos primeiro profissionais da mesma cidade ou zona do pedido, ordenados por correspondência de localidade, avaliação e disponibilidade.";
  }

  if (input.stage === "expanded") {
    return "Não encontrámos perfis na mesma cidade ou zona. Alargámos a procura para áreas próximas.";
  }

  if (input.scope === "category-available") {
    return "Ainda não encontrámos correspondência forte de localidade. Mantemos uma procura mais ampla dentro desta área.";
  }

  return "Ainda não encontrámos correspondência forte de localidade. Mostramos opções mais amplas para acelerar propostas.";
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
    const locationMatch = buildLocationMatch(request.location, worker.location);
    const categoryScore = matchesRequestCategory(request, worker) ? 1 : 0;

    return {
      worker,
      categoryScore,
      proximityScore: locationMatch.score,
      proximityTier: locationMatch.tier,
      proximityLabel: locationMatch.label,
      distanceMeters: null,
      shortComment: getShortComment(worker),
    };
  });

  const nearbyWorkers = scoredWorkers.filter((worker) => worker.proximityScore >= 3);
  const expandedWorkers = scoredWorkers.filter((worker) => worker.proximityScore >= 2);

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
    const categoryDiff = right.categoryScore - left.categoryScore;
    if (categoryDiff !== 0) {
      return categoryDiff;
    }

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
