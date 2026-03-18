export type SessionState = "guest" | "authenticated";
export type JobPricingMode = "FIXED_PRICE" | "QUOTE_REQUEST";
export type DropoffReason = "visibility_hidden" | "before_unload";
export type WorkerRankingDebugItem = {
  workerId: string;
  score: number;
  qualityComponent: number;
  interestComponent: number;
  intentionComponent: number;
  conversionComponent: number;
  stabilityMultiplier: number;
  reasons: string[];
};

export type TrackingEventMap = {
  "marketplace.cta.click": {
    source: "landing.hero" | "landing.worker_card";
    view: "landing";
    label: string;
    ctaType: "primary" | "secondary";
    sessionState: SessionState;
    workerId?: string;
    pricingContext?: "fixed-price-or-quote" | "quote-first";
  };
  "marketplace.worker.card.click": {
    source: "landing.worker_card";
    view: "landing";
    workerId: string;
    highlighted: boolean;
    relevanceLabel: string | null;
  };
  "marketplace.search.change": {
    source: "landing.discovery";
    view: "landing";
    queryLength: number;
    hasCategoryFilter: boolean;
    resultCount: number;
  };
  "marketplace.category.select": {
    source: "landing.discovery";
    view: "landing";
    categorySlug: string | null;
    previousCategorySlug: string | null;
    categoryCount: number;
    resultCount: number;
  };
  "marketplace.heuristic.ranking.apply": {
    source: "landing.featured_workers";
    view: "landing";
    workerCount: number;
    workersWithRatingRank: number;
    workersWithPriceRank: number;
    topWorkers?: WorkerRankingDebugItem[];
  };
  "marketplace.heuristic.highlight.apply": {
    source: "landing.featured_workers";
    view: "landing";
    workerCount: number;
    highlightedCount: number;
    labels: string[];
  };
  "marketplace.heuristic.cta.apply": {
    source: "landing.featured_workers";
    view: "landing";
    workerCount: number;
    labels: string[];
  };
  "dashboard.cta.click": {
    source: "dashboard.workers.card";
    view: "dashboard.workers";
    workerId: string;
    isOwnProfile: boolean;
    label: string;
    ctaType: "primary" | "secondary";
  };
  "dashboard.worker.card.click": {
    source: "dashboard.workers.card";
    view: "dashboard.workers";
    workerId: string;
    isOwnProfile: boolean;
    highlighted: boolean;
    relevanceLabel: string | null;
  };
  "dashboard.heuristic.ranking.apply": {
    source: "dashboard.workers";
    view: "dashboard.workers";
    workerCount: number;
    workersWithRatingRank: number;
    workersWithPriceRank: number;
    topWorkers?: WorkerRankingDebugItem[];
  };
  "dashboard.heuristic.highlight.apply": {
    source: "dashboard.workers";
    view: "dashboard.workers";
    workerCount: number;
    highlightedCount: number;
    labels: string[];
  };
  "dashboard.heuristic.cta.apply": {
    source: "dashboard.workers";
    view: "dashboard.workers";
    workerCount: number;
    labels: string[];
  };
  "job.create.submit": {
    source: "dashboard.jobs.create";
    view: "dashboard.jobs";
    pricingMode: JobPricingMode;
    hasBudget: boolean;
    hasScheduledFor: boolean;
    titleLength: number;
    descriptionLength: number;
    workerProfileId: string;
    categoryId: string;
  };
  "job.create.step.change": {
    source: "dashboard.jobs.create";
    view: "dashboard.jobs";
    stepIndex: number;
    stepLabel: string;
    readySteps: number;
    totalSteps: number;
    pricingMode: JobPricingMode;
  };
  "job.create.dropoff.visible": {
    source: "dashboard.jobs.create";
    view: "dashboard.jobs";
    reason: DropoffReason;
    highestStepIndex: number;
    highestStepLabel: string | null;
    pricingMode: JobPricingMode | null;
  };
};

export type TrackingEventName = keyof TrackingEventMap;

export type TrackingSessionContext = {
  sessionId: string;
  sessionStartedAt: string;
  eventIndex: number;
  pagePath: string | null;
};

export type TrackingEvent<Name extends TrackingEventName = TrackingEventName> = {
  name: Name;
  metadata: TrackingEventMap[Name];
  timestamp: string;
  context: TrackingSessionContext;
};

export type AnyTrackingEvent = {
  [Name in TrackingEventName]: TrackingEvent<Name>;
}[TrackingEventName];

export type TrackingTransport = (
  events: AnyTrackingEvent[],
) => void | Promise<void>;

export type TrackingFunnelSummary = {
  heroCtaClicks: number;
  workerCardClicks: number;
  categorySelects: number;
  searchInteractions: number;
  jobStepChanges: number;
  jobCreateSubmits: number;
  jobVisibleDropoffs: number;
  maxJobStepReached: number;
};

export type WorkerBehaviorAggregate = {
  interactions: number;
  clicks: number;
  ctaClicks: number;
  conversions: number;
  lastInteractionEventIndex: number;
};

export type BehaviorAggregationSnapshot = {
  version: number;
  workersById: Record<string, WorkerBehaviorAggregate>;
  categoriesBySlug: Record<string, number>;
};

export type WorkerRelevanceScoreBreakdown = {
  score: number;
  qualityComponent: number;
  interestComponent: number;
  intentionComponent: number;
  conversionComponent: number;
  behaviorSignal: number;
  stabilityMultiplier: number;
  clicks: number;
  conversions: number;
  ctaClicks: number;
  interactions: number;
  lastInteractionEventIndex: number;
  confidenceLevel: "low" | "medium" | "high";
  reasons: string[];
};

type JobFlowSessionState = {
  active: boolean;
  submitted: boolean;
  highestStepIndex: number;
  highestStepLabel: string | null;
  pricingMode: JobPricingMode | null;
  visibleDropoffDetected: boolean;
};

type BrowserWindow = Window & {
  __tchunoTrackingBuffer__?: AnyTrackingEvent[];
  __TCHUNO_TRACK_DEBUG__?: boolean;
  __TCHUNO_TRACK_HANDLER__?: TrackingTransport;
};

const TRACK_DEBUG_STORAGE_KEY = "tchuno_track_debug";
const BEHAVIOR_AGGREGATION_STORAGE_KEY = "tchuno_behavior_aggregation_v1";
const BEHAVIOR_AGGREGATION_STORAGE_VERSION = 1;
const BEHAVIOR_AGGREGATION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

type PersistedWorkerBehaviorAggregate = {
  interactions: number;
  clicks: number;
  ctaClicks: number;
  conversions: number;
};

type PersistedBehaviorAggregationSnapshot = {
  version: number;
  savedAt: string;
  expiresAt: number;
  workersById: Record<string, PersistedWorkerBehaviorAggregate>;
  categoriesBySlug: Record<string, number>;
};

const eventQueue: AnyTrackingEvent[] = [];
let flushScheduled = false;
let trackingTransport: TrackingTransport = defaultTrackingTransport;
let sessionEventIndex = 0;
let lifecycleHooksInitialized = false;
let behaviorAggregationHydrated = false;
let behaviorPersistenceScheduled = false;

const trackingSessionId = createTrackingSessionId();
const trackingSessionStartedAt = nowIso();
const sessionFunnelSummary = createEmptyFunnelSummary();
const jobFlowSessionState: JobFlowSessionState = {
  active: false,
  submitted: false,
  highestStepIndex: 0,
  highestStepLabel: null,
  pricingMode: null,
  visibleDropoffDetected: false,
};
const workerBehaviorById: Record<string, WorkerBehaviorAggregate> = {};
const categoryInteractionBySlug: Record<string, number> = {};
const behaviorAggregationListeners = new Set<() => void>();
let behaviorAggregationVersion = 0;

const CLICK_WEIGHT = 0.42;
const CTA_CLICK_WEIGHT = 0.58;
const CONVERSION_WEIGHT = 2.9;
const RATING_VALUE_WEIGHT = 1.65;
const RATING_COUNT_WEIGHT = 0.22;
const RECENCY_EVENT_WINDOW = 35;
const MIN_CONFIDENCE_EVIDENCE = 12;

function nowIso(): string {
  return new Date().toISOString();
}

function createTrackingSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `sess_${crypto.randomUUID()}`;
  }

  const random = Math.random().toString(36).slice(2, 10);
  return `sess_${Date.now().toString(36)}_${random}`;
}

function getBrowserWindow(): BrowserWindow | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window as BrowserWindow;
}

function resolvePagePath(): string | null {
  const browserWindow = getBrowserWindow();
  if (!browserWindow) {
    return null;
  }

  return `${browserWindow.location.pathname}${browserWindow.location.search}${browserWindow.location.hash}`;
}

function createEmptyFunnelSummary(): TrackingFunnelSummary {
  return {
    heroCtaClicks: 0,
    workerCardClicks: 0,
    categorySelects: 0,
    searchInteractions: 0,
    jobStepChanges: 0,
    jobCreateSubmits: 0,
    jobVisibleDropoffs: 0,
    maxJobStepReached: 0,
  };
}

function getOrCreateWorkerBehavior(workerId: string): WorkerBehaviorAggregate {
  if (!workerBehaviorById[workerId]) {
    workerBehaviorById[workerId] = {
      interactions: 0,
      clicks: 0,
      ctaClicks: 0,
      conversions: 0,
      lastInteractionEventIndex: 0,
    };
  }

  return workerBehaviorById[workerId];
}

function normalizeCounter(value: unknown, max = 10_000): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.min(max, Math.floor(parsed)));
}

function removePersistedBehaviorAggregation() {
  const browserWindow = getBrowserWindow();
  if (!browserWindow) {
    return;
  }

  try {
    localStorage.removeItem(BEHAVIOR_AGGREGATION_STORAGE_KEY);
  } catch {
    // ignore storage issues in restricted environments
  }
}

function persistBehaviorAggregation() {
  behaviorPersistenceScheduled = false;

  const browserWindow = getBrowserWindow();
  if (!browserWindow) {
    return;
  }

  const workersById = Object.entries(workerBehaviorById).reduce<
    Record<string, PersistedWorkerBehaviorAggregate>
  >((acc, [workerId, stats]) => {
    const interactions = normalizeCounter(stats.interactions);
    const clicks = normalizeCounter(stats.clicks);
    const ctaClicks = normalizeCounter(stats.ctaClicks);
    const conversions = normalizeCounter(stats.conversions);
    if (interactions === 0 && clicks === 0 && ctaClicks === 0 && conversions === 0) {
      return acc;
    }

    acc[workerId] = {
      interactions,
      clicks,
      ctaClicks,
      conversions,
    };
    return acc;
  }, {});

  const categoriesBySlug = Object.entries(categoryInteractionBySlug).reduce<
    Record<string, number>
  >((acc, [categorySlug, interactions]) => {
    const normalizedInteractions = normalizeCounter(interactions);
    if (normalizedInteractions === 0) {
      return acc;
    }

    acc[categorySlug] = normalizedInteractions;
    return acc;
  }, {});

  const payload: PersistedBehaviorAggregationSnapshot = {
    version: BEHAVIOR_AGGREGATION_STORAGE_VERSION,
    savedAt: nowIso(),
    expiresAt: Date.now() + BEHAVIOR_AGGREGATION_TTL_MS,
    workersById,
    categoriesBySlug,
  };

  try {
    localStorage.setItem(
      BEHAVIOR_AGGREGATION_STORAGE_KEY,
      JSON.stringify(payload),
    );
  } catch (error) {
    if (isDebugModeEnabled()) {
      console.error("[tchuno-track] behavior persistence error", error);
    }
  }
}

function scheduleBehaviorPersistence() {
  if (behaviorPersistenceScheduled) {
    return;
  }

  if (!getBrowserWindow()) {
    return;
  }

  behaviorPersistenceScheduled = true;
  setTimeout(persistBehaviorAggregation, 150);
}

function ensureBehaviorAggregationHydrated() {
  if (behaviorAggregationHydrated) {
    return;
  }

  behaviorAggregationHydrated = true;

  const browserWindow = getBrowserWindow();
  if (!browserWindow) {
    return;
  }

  try {
    const rawPayload = localStorage.getItem(BEHAVIOR_AGGREGATION_STORAGE_KEY);
    if (!rawPayload) {
      return;
    }

    const parsedPayload = JSON.parse(
      rawPayload,
    ) as PersistedBehaviorAggregationSnapshot;
    if (
      !parsedPayload ||
      parsedPayload.version !== BEHAVIOR_AGGREGATION_STORAGE_VERSION ||
      typeof parsedPayload.expiresAt !== "number" ||
      parsedPayload.expiresAt <= Date.now()
    ) {
      removePersistedBehaviorAggregation();
      return;
    }

    let changed = false;

    const persistedWorkers = parsedPayload.workersById ?? {};
    Object.entries(persistedWorkers).forEach(([workerId, rawStats]) => {
      if (!rawStats || typeof rawStats !== "object") {
        return;
      }

      const clicks = normalizeCounter(rawStats.clicks);
      const conversions = normalizeCounter(rawStats.conversions);
      const ctaClicks = normalizeCounter(rawStats.ctaClicks);
      const interactions = normalizeCounter(rawStats.interactions);
      if (clicks === 0 && conversions === 0 && ctaClicks === 0 && interactions === 0) {
        return;
      }

      const workerStats = getOrCreateWorkerBehavior(workerId);
      workerStats.clicks += clicks;
      workerStats.conversions += conversions;
      workerStats.ctaClicks += ctaClicks;
      workerStats.interactions += interactions;
      changed = true;
    });

    const persistedCategories = parsedPayload.categoriesBySlug ?? {};
    Object.entries(persistedCategories).forEach(([categorySlug, interactions]) => {
      const normalizedInteractions = normalizeCounter(interactions);
      if (normalizedInteractions === 0) {
        return;
      }

      categoryInteractionBySlug[categorySlug] =
        (categoryInteractionBySlug[categorySlug] ?? 0) + normalizedInteractions;
      changed = true;
    });

    if (changed) {
      notifyBehaviorAggregationChanged();
      if (isDebugModeEnabled()) {
        console.info("[tchuno-track] behavior hydrated", {
          workerCount: Object.keys(persistedWorkers).length,
          categoryCount: Object.keys(persistedCategories).length,
          expiresAt: new Date(parsedPayload.expiresAt).toISOString(),
        });
      }
    }
  } catch (error) {
    removePersistedBehaviorAggregation();
    if (isDebugModeEnabled()) {
      console.error("[tchuno-track] behavior hydration error", error);
    }
  }
}

function notifyBehaviorAggregationChanged() {
  behaviorAggregationVersion += 1;
  behaviorAggregationListeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      if (isDebugModeEnabled()) {
        console.error("[tchuno-track] behavior listener error", error);
      }
    }
  });
}

function updateBehaviorAggregation(event: AnyTrackingEvent) {
  ensureBehaviorAggregationHydrated();
  let changed = false;

  switch (event.name) {
    case "marketplace.worker.card.click":
    case "dashboard.worker.card.click": {
      const workerStats = getOrCreateWorkerBehavior(event.metadata.workerId);
      workerStats.interactions += 1;
      workerStats.clicks += 1;
      workerStats.lastInteractionEventIndex = event.context.eventIndex;
      changed = true;
      break;
    }
    case "marketplace.cta.click": {
      if (!event.metadata.workerId) {
        break;
      }

      const workerStats = getOrCreateWorkerBehavior(event.metadata.workerId);
      workerStats.interactions += 1;
      workerStats.ctaClicks += 1;
      workerStats.lastInteractionEventIndex = event.context.eventIndex;
      changed = true;
      break;
    }
    case "dashboard.cta.click": {
      const workerStats = getOrCreateWorkerBehavior(event.metadata.workerId);
      workerStats.interactions += 1;
      workerStats.ctaClicks += 1;
      workerStats.lastInteractionEventIndex = event.context.eventIndex;
      changed = true;
      break;
    }
    case "marketplace.category.select": {
      if (!event.metadata.categorySlug) {
        break;
      }

      categoryInteractionBySlug[event.metadata.categorySlug] =
        (categoryInteractionBySlug[event.metadata.categorySlug] ?? 0) + 1;
      changed = true;
      break;
    }
    case "job.create.submit": {
      const workerStats = workerBehaviorById[event.metadata.workerProfileId];
      if (!workerStats || workerStats.interactions === 0) {
        break;
      }

      workerStats.conversions += 1;
      workerStats.lastInteractionEventIndex = event.context.eventIndex;
      changed = true;
      break;
    }
    default: {
      break;
    }
  }

  if (changed) {
    notifyBehaviorAggregationChanged();
    scheduleBehaviorPersistence();
  }
}

function summarizeEventInto(
  event: AnyTrackingEvent,
  summary: TrackingFunnelSummary,
) {
  switch (event.name) {
    case "marketplace.cta.click": {
      if (event.metadata.source === "landing.hero") {
        summary.heroCtaClicks += 1;
      }
      break;
    }
    case "marketplace.worker.card.click":
    case "dashboard.worker.card.click": {
      summary.workerCardClicks += 1;
      break;
    }
    case "marketplace.category.select": {
      summary.categorySelects += 1;
      break;
    }
    case "marketplace.search.change": {
      summary.searchInteractions += 1;
      break;
    }
    case "job.create.step.change": {
      summary.jobStepChanges += 1;
      summary.maxJobStepReached = Math.max(
        summary.maxJobStepReached,
        event.metadata.stepIndex,
      );
      break;
    }
    case "job.create.submit": {
      summary.jobCreateSubmits += 1;
      break;
    }
    case "job.create.dropoff.visible": {
      summary.jobVisibleDropoffs += 1;
      summary.maxJobStepReached = Math.max(
        summary.maxJobStepReached,
        event.metadata.highestStepIndex,
      );
      break;
    }
    default: {
      break;
    }
  }
}

function updateJobFlowSessionState(event: AnyTrackingEvent) {
  if (event.name === "job.create.step.change") {
    const isNewAttempt = !jobFlowSessionState.active || jobFlowSessionState.submitted;
    if (isNewAttempt) {
      jobFlowSessionState.active = true;
      jobFlowSessionState.submitted = false;
      jobFlowSessionState.visibleDropoffDetected = false;
      jobFlowSessionState.highestStepIndex = event.metadata.stepIndex;
      jobFlowSessionState.highestStepLabel = event.metadata.stepLabel;
      jobFlowSessionState.pricingMode = event.metadata.pricingMode;
      return;
    }

    if (event.metadata.stepIndex >= jobFlowSessionState.highestStepIndex) {
      jobFlowSessionState.highestStepIndex = event.metadata.stepIndex;
      jobFlowSessionState.highestStepLabel = event.metadata.stepLabel;
      jobFlowSessionState.pricingMode = event.metadata.pricingMode;
    }
    return;
  }

  if (event.name === "job.create.submit") {
    jobFlowSessionState.active = true;
    jobFlowSessionState.submitted = true;
    jobFlowSessionState.visibleDropoffDetected = false;
    jobFlowSessionState.pricingMode = event.metadata.pricingMode;
    return;
  }

  if (event.name === "job.create.dropoff.visible") {
    jobFlowSessionState.active = true;
    jobFlowSessionState.submitted = false;
    jobFlowSessionState.visibleDropoffDetected = true;
    jobFlowSessionState.highestStepIndex = event.metadata.highestStepIndex;
    jobFlowSessionState.highestStepLabel = event.metadata.highestStepLabel;
    jobFlowSessionState.pricingMode = event.metadata.pricingMode;
  }
}

function applyEventToSessionState(event: AnyTrackingEvent) {
  summarizeEventInto(event, sessionFunnelSummary);
  updateJobFlowSessionState(event);
  updateBehaviorAggregation(event);
}

function createTrackingEvent<Name extends TrackingEventName>(
  name: Name,
  metadata: TrackingEventMap[Name],
): TrackingEvent<Name> {
  sessionEventIndex += 1;

  return {
    name,
    metadata,
    timestamp: nowIso(),
    context: {
      sessionId: trackingSessionId,
      sessionStartedAt: trackingSessionStartedAt,
      eventIndex: sessionEventIndex,
      pagePath: resolvePagePath(),
    },
  };
}

function enqueueTrackingEvent<Name extends TrackingEventName>(
  name: Name,
  metadata: TrackingEventMap[Name],
) {
  const event = createTrackingEvent(name, metadata) as AnyTrackingEvent;
  applyEventToSessionState(event);
  eventQueue.push(event);
  scheduleTrackingFlush();
}

function maybeTrackJobVisibleDropoff(reason: DropoffReason) {
  if (!jobFlowSessionState.active) {
    return;
  }

  if (jobFlowSessionState.submitted) {
    return;
  }

  if (jobFlowSessionState.visibleDropoffDetected) {
    return;
  }

  enqueueTrackingEvent("job.create.dropoff.visible", {
    source: "dashboard.jobs.create",
    view: "dashboard.jobs",
    reason,
    highestStepIndex: jobFlowSessionState.highestStepIndex,
    highestStepLabel: jobFlowSessionState.highestStepLabel,
    pricingMode: jobFlowSessionState.pricingMode,
  });
}

function ensureLifecycleHooks() {
  if (lifecycleHooksInitialized) {
    return;
  }

  const browserWindow = getBrowserWindow();
  if (!browserWindow || typeof document === "undefined") {
    return;
  }

  lifecycleHooksInitialized = true;

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      maybeTrackJobVisibleDropoff("visibility_hidden");
      flushTrackingQueue();
    }
  });

  browserWindow.addEventListener("beforeunload", () => {
    maybeTrackJobVisibleDropoff("before_unload");
    flushTrackingQueue();
  });
}

function isDebugModeEnabled(): boolean {
  const browserWindow = getBrowserWindow();
  if (!browserWindow) {
    return false;
  }

  if (browserWindow.__TCHUNO_TRACK_DEBUG__ === true) {
    return true;
  }

  try {
    return localStorage.getItem(TRACK_DEBUG_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function defaultTrackingTransport(events: AnyTrackingEvent[]): void {
  const browserWindow = getBrowserWindow();
  if (!browserWindow) {
    return;
  }

  if (!browserWindow.__tchunoTrackingBuffer__) {
    browserWindow.__tchunoTrackingBuffer__ = [];
  }

  browserWindow.__tchunoTrackingBuffer__.push(...events);
}

function parseRating(rating: number | string): number {
  const parsed = typeof rating === "number" ? rating : Number(rating);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.min(5, parsed));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function roundScore(value: number): number {
  return Number(value.toFixed(3));
}

export function getWorkerRelevanceScore(input: {
  workerId: string;
  ratingAvg: number | string;
  ratingCount: number;
}): WorkerRelevanceScoreBreakdown {
  ensureBehaviorAggregationHydrated();
  const behavior = workerBehaviorById[input.workerId] ?? {
    interactions: 0,
    clicks: 0,
    ctaClicks: 0,
    conversions: 0,
    lastInteractionEventIndex: 0,
  };

  const ratingValue = parseRating(input.ratingAvg);
  const ratingCount = Math.max(0, input.ratingCount);
  const qualityComponent =
    ratingValue * RATING_VALUE_WEIGHT +
    Math.log1p(Math.min(60, ratingCount)) * RATING_COUNT_WEIGHT;

  const eventsSinceInteraction = Math.max(
    0,
    sessionEventIndex - behavior.lastInteractionEventIndex,
  );
  const recencyMultiplier =
    behavior.lastInteractionEventIndex > 0
      ? 1 - clamp01(eventsSinceInteraction / RECENCY_EVENT_WINDOW) * 0.45
      : 0.6;

  const interestComponent =
    Math.min(24, behavior.clicks) * CLICK_WEIGHT * recencyMultiplier;
  const intentionComponent =
    Math.min(18, behavior.ctaClicks) * CTA_CLICK_WEIGHT * recencyMultiplier;
  const conversionComponent =
    Math.min(10, behavior.conversions) * CONVERSION_WEIGHT;
  const behaviorSignal =
    interestComponent + intentionComponent + conversionComponent;

  const evidenceScore =
    Math.min(20, ratingCount) +
    behavior.interactions * 1.1 +
    behavior.conversions * 4;
  const stabilityMultiplier = 0.45 + clamp01(evidenceScore / MIN_CONFIDENCE_EVIDENCE) * 0.55;
  const score = qualityComponent + behaviorSignal * stabilityMultiplier;

  let confidenceLevel: "low" | "medium" | "high" = "low";
  if (stabilityMultiplier >= 0.85) {
    confidenceLevel = "high";
  } else if (stabilityMultiplier >= 0.65) {
    confidenceLevel = "medium";
  }

  const reasons: string[] = [];
  if (behavior.conversions >= 2) {
    reasons.push("Boa conversão");
  } else if (behavior.conversions > 0) {
    reasons.push("Conversão inicial");
  }
  if (behavior.ctaClicks >= 3 || behavior.clicks >= 5) {
    reasons.push("Mais procurado");
  } else if (behavior.ctaClicks > 0 || behavior.clicks > 0) {
    reasons.push("Relevante nesta lista");
  }
  if (ratingCount >= 8 && ratingValue >= 4.6) {
    reasons.push("Melhor avaliação");
  } else {
    reasons.push(`Qualidade base: rating ${ratingValue.toFixed(1)} (${ratingCount})`);
  }

  return {
    score: roundScore(score),
    qualityComponent: roundScore(qualityComponent),
    interestComponent: roundScore(interestComponent),
    intentionComponent: roundScore(intentionComponent),
    conversionComponent: roundScore(conversionComponent),
    behaviorSignal: roundScore(behaviorSignal),
    stabilityMultiplier: roundScore(stabilityMultiplier),
    clicks: behavior.clicks,
    conversions: behavior.conversions,
    ctaClicks: behavior.ctaClicks,
    interactions: behavior.interactions,
    lastInteractionEventIndex: behavior.lastInteractionEventIndex,
    confidenceLevel,
    reasons,
  };
}

function getTopBehaviorWorkers(limit = 5) {
  return Object.entries(workerBehaviorById)
    .map(([workerId, stats]) => ({
      workerId,
      ...stats,
      behaviorScore:
        stats.clicks * CLICK_WEIGHT +
        stats.ctaClicks * CTA_CLICK_WEIGHT +
        stats.conversions * CONVERSION_WEIGHT,
    }))
    .sort((a, b) => b.behaviorScore - a.behaviorScore)
    .slice(0, limit)
    .map((item) => ({
      ...item,
      behaviorScore: Number(item.behaviorScore.toFixed(3)),
    }));
}

function getTopCategoryInteractions(limit = 5) {
  return Object.entries(categoryInteractionBySlug)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([categorySlug, interactions]) => ({
      categorySlug,
      interactions,
    }));
}

function emitDebugLogs(events: AnyTrackingEvent[]): void {
  if (!isDebugModeEnabled()) {
    return;
  }

  const batchSummary = createEmptyFunnelSummary();
  events.forEach((event) => summarizeEventInto(event, batchSummary));

  console.groupCollapsed(
    `[tchuno-track] session=${trackingSessionId} batch=${events.length}`,
  );
  console.info("funnel.batch", batchSummary);
  console.info("funnel.session", { ...sessionFunnelSummary });
  console.info("behavior.topWorkers", getTopBehaviorWorkers());
  console.info("behavior.topCategories", getTopCategoryInteractions());
  if (jobFlowSessionState.active) {
    console.info("funnel.jobFlow", { ...jobFlowSessionState });
  }

  events.forEach((event) => {
    console.info(
      `${event.context.eventIndex}. ${event.name}`,
      event.metadata,
      {
        timestamp: event.timestamp,
        pagePath: event.context.pagePath,
      },
    );
  });
  console.groupEnd();
}

function flushTrackingQueue() {
  flushScheduled = false;
  const batch = eventQueue.splice(0, eventQueue.length);
  if (batch.length === 0) {
    return;
  }

  const browserWindow = getBrowserWindow();
  const externalHandler = browserWindow?.__TCHUNO_TRACK_HANDLER__;
  const transport = externalHandler ?? trackingTransport;

  void Promise.resolve(transport(batch))
    .catch((error) => {
      if (isDebugModeEnabled()) {
        console.error("[tchuno-track] transport error", error);
      }
    })
    .finally(() => {
      emitDebugLogs(batch);
    });
}

function scheduleTrackingFlush() {
  if (flushScheduled) {
    return;
  }

  flushScheduled = true;
  setTimeout(flushTrackingQueue, 0);
}

export function setTrackingTransport(nextTransport: TrackingTransport) {
  trackingTransport = nextTransport;
}

export function resetTrackingTransport() {
  trackingTransport = defaultTrackingTransport;
}

export function setTrackingDebugMode(enabled: boolean) {
  const browserWindow = getBrowserWindow();
  if (!browserWindow) {
    return;
  }

  browserWindow.__TCHUNO_TRACK_DEBUG__ = enabled;
  try {
    localStorage.setItem(TRACK_DEBUG_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // ignore storage issues in private mode / restricted environments
  }
}

export function trackEvent<Name extends TrackingEventName>(
  name: Name,
  metadata: TrackingEventMap[Name],
) {
  ensureLifecycleHooks();
  enqueueTrackingEvent(name, metadata);
}

export function getTrackingSessionId(): string {
  return trackingSessionId;
}

export function getTrackingSessionSummary(): TrackingFunnelSummary {
  return { ...sessionFunnelSummary };
}

export function getBehaviorAggregationVersion(): number {
  ensureBehaviorAggregationHydrated();
  return behaviorAggregationVersion;
}

export function getBehaviorAggregationSnapshot(): BehaviorAggregationSnapshot {
  ensureBehaviorAggregationHydrated();
  const workersById = Object.entries(workerBehaviorById).reduce<
    Record<string, WorkerBehaviorAggregate>
  >((acc, [workerId, stats]) => {
    acc[workerId] = { ...stats };
    return acc;
  }, {});

  return {
    version: behaviorAggregationVersion,
    workersById,
    categoriesBySlug: { ...categoryInteractionBySlug },
  };
}

export function subscribeBehaviorAggregation(
  listener: () => void,
): () => void {
  ensureBehaviorAggregationHydrated();
  behaviorAggregationListeners.add(listener);
  return () => {
    behaviorAggregationListeners.delete(listener);
  };
}
