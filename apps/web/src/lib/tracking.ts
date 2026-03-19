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
  temporalDecayMultiplier: number;
  sessionBehaviorSignal: number;
  historicalBehaviorSignal: number;
  sessionSignalWeight: number;
  historicalSignalWeight: number;
  confidenceGuardMultiplier: number;
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
  sessionInteractions: number;
  sessionClicks: number;
  sessionCtaClicks: number;
  sessionConversions: number;
  historicalInteractions: number;
  historicalClicks: number;
  historicalCtaClicks: number;
  historicalConversions: number;
  historyLastUpdatedAt: number | null;
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
  temporalDecayMultiplier: number;
  sessionBehaviorSignal: number;
  historicalBehaviorSignal: number;
  sessionSignalWeight: number;
  historicalSignalWeight: number;
  confidenceGuardMultiplier: number;
  clicks: number;
  conversions: number;
  ctaClicks: number;
  interactions: number;
  lastInteractionEventIndex: number;
  confidenceLevel: "low" | "medium" | "high";
  reasons: string[];
};

export type SharedWorkerBehaviorSignalInput = {
  workerProfileId: string;
  interactions: number;
  clicks: number;
  ctaClicks: number;
  conversions: number;
  lastEventAt: string | null;
};

type SharedWorkerBehaviorSignal = {
  interactions: number;
  clicks: number;
  ctaClicks: number;
  conversions: number;
  lastEventAtMs: number | null;
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
const LEGACY_BEHAVIOR_AGGREGATION_STORAGE_VERSION = 1;
const BEHAVIOR_AGGREGATION_STORAGE_VERSION = 2;
const BEHAVIOR_AGGREGATION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const TRACKING_API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type PersistedWorkerBehaviorAggregate = {
  interactions: number;
  clicks: number;
  ctaClicks: number;
  conversions: number;
  lastUpdatedAt: number;
};

type PersistedBehaviorAggregationSnapshot = {
  version: number;
  savedAt: string;
  expiresAt: number;
  workersById: Record<string, PersistedWorkerBehaviorAggregate>;
  categoriesBySlug: Record<string, number>;
};

type LegacyPersistedWorkerBehaviorAggregate = {
  interactions: number;
  clicks: number;
  ctaClicks: number;
  conversions: number;
};

type LegacyPersistedBehaviorAggregationSnapshot = {
  version: 1;
  savedAt: string;
  expiresAt: number;
  workersById: Record<string, LegacyPersistedWorkerBehaviorAggregate>;
  categoriesBySlug: Record<string, number>;
};

const eventQueue: AnyTrackingEvent[] = [];
let flushScheduled = false;
let trackingTransport: TrackingTransport = defaultTrackingTransport;
let sessionEventIndex = 0;
let lifecycleHooksInitialized = false;
let behaviorAggregationHydrated = false;
let behaviorPersistenceScheduled = false;
let trackingBackendForwardingWarned = false;

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
const sharedWorkerBehaviorById: Record<string, SharedWorkerBehaviorSignal> = {};
const behaviorAggregationListeners = new Set<() => void>();
let behaviorAggregationVersion = 0;

const CLICK_WEIGHT = 0.42;
const CTA_CLICK_WEIGHT = 0.58;
const CONVERSION_WEIGHT = 2.9;
const RATING_VALUE_WEIGHT = 1.65;
const RATING_COUNT_WEIGHT = 0.22;
const RECENCY_EVENT_WINDOW = 35;
const MIN_CONFIDENCE_EVIDENCE = 12;
const HISTORY_SIGNAL_WEIGHT = 0.55;
const SESSION_SIGNAL_WEIGHT = 1;
const HISTORY_DECAY_HALF_LIFE_MS = 1000 * 60 * 60 * 24 * 2;
const HISTORY_DECAY_MIN_MULTIPLIER = 0.1;
const LOW_CONFIDENCE_INTERACTION_FLOOR = 3;
const LOW_CONFIDENCE_GUARD_MULTIPLIER = 0.72;
const VERY_LOW_CONFIDENCE_GUARD_MULTIPLIER = 0.52;
const SHARED_SIGNAL_WEIGHT = 0.65;
const FORWARDED_TRACKING_EVENTS = new Set<TrackingEventName>([
  "marketplace.worker.card.click",
  "dashboard.worker.card.click",
  "marketplace.cta.click",
  "dashboard.cta.click",
  "marketplace.category.select",
  "job.create.submit",
]);

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
      sessionInteractions: 0,
      sessionClicks: 0,
      sessionCtaClicks: 0,
      sessionConversions: 0,
      historicalInteractions: 0,
      historicalClicks: 0,
      historicalCtaClicks: 0,
      historicalConversions: 0,
      historyLastUpdatedAt: null,
    };
  }

  return workerBehaviorById[workerId];
}

function syncWorkerBehaviorTotals(workerStats: WorkerBehaviorAggregate) {
  workerStats.interactions = Math.max(
    0,
    workerStats.sessionInteractions + workerStats.historicalInteractions,
  );
  workerStats.clicks = Math.max(
    0,
    workerStats.sessionClicks + workerStats.historicalClicks,
  );
  workerStats.ctaClicks = Math.max(
    0,
    workerStats.sessionCtaClicks + workerStats.historicalCtaClicks,
  );
  workerStats.conversions = Math.max(
    0,
    workerStats.sessionConversions + workerStats.historicalConversions,
  );
}

function normalizeCounter(value: unknown, max = 10_000): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.min(max, Math.floor(parsed)));
}

function parseTimestamp(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function getTemporalDecayMultiplier(
  historyLastUpdatedAt: number | null,
  now = Date.now(),
): number {
  if (!historyLastUpdatedAt || historyLastUpdatedAt <= 0) {
    return HISTORY_DECAY_MIN_MULTIPLIER;
  }

  const ageMs = Math.max(0, now - historyLastUpdatedAt);
  const halfLives = ageMs / HISTORY_DECAY_HALF_LIFE_MS;
  const decay = Math.pow(0.5, halfLives);
  return Math.max(HISTORY_DECAY_MIN_MULTIPLIER, Math.min(1, decay));
}

function normalizeSharedWorkerSignalItem(
  item: SharedWorkerBehaviorSignalInput,
): SharedWorkerBehaviorSignal | null {
  const workerProfileId = item.workerProfileId?.trim();
  if (!workerProfileId || workerProfileId.length > 64) {
    return null;
  }

  const lastEventAtMs = parseTimestamp(item.lastEventAt);

  return {
    interactions: normalizeCounter(item.interactions),
    clicks: normalizeCounter(item.clicks),
    ctaClicks: normalizeCounter(item.ctaClicks),
    conversions: normalizeCounter(item.conversions),
    lastEventAtMs,
  };
}

export function setSharedWorkerBehaviorSignals(
  items: SharedWorkerBehaviorSignalInput[],
) {
  const nextSignals: Record<string, SharedWorkerBehaviorSignal> = {};

  items.forEach((item) => {
    const normalized = normalizeSharedWorkerSignalItem(item);
    const workerProfileId = item.workerProfileId?.trim();
    if (!normalized || !workerProfileId) {
      return;
    }

    nextSignals[workerProfileId] = normalized;
  });

  Object.keys(sharedWorkerBehaviorById).forEach((key) => {
    delete sharedWorkerBehaviorById[key];
  });

  Object.entries(nextSignals).forEach(([workerProfileId, signal]) => {
    sharedWorkerBehaviorById[workerProfileId] = signal;
  });

  notifyBehaviorAggregationChanged();
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

  const now = Date.now();
  const workersById = Object.entries(workerBehaviorById).reduce<
    Record<string, PersistedWorkerBehaviorAggregate>
  >((acc, [workerId, stats]) => {
    const interactions = normalizeCounter(
      stats.historicalInteractions + stats.sessionInteractions,
    );
    const clicks = normalizeCounter(stats.historicalClicks + stats.sessionClicks);
    const ctaClicks = normalizeCounter(
      stats.historicalCtaClicks + stats.sessionCtaClicks,
    );
    const conversions = normalizeCounter(
      stats.historicalConversions + stats.sessionConversions,
    );
    if (interactions === 0 && clicks === 0 && ctaClicks === 0 && conversions === 0) {
      return acc;
    }

    acc[workerId] = {
      interactions,
      clicks,
      ctaClicks,
      conversions,
      lastUpdatedAt: now,
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
    expiresAt: now + BEHAVIOR_AGGREGATION_TTL_MS,
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

    const parsedPayload = JSON.parse(rawPayload) as
      | PersistedBehaviorAggregationSnapshot
      | LegacyPersistedBehaviorAggregationSnapshot;
    if (
      !parsedPayload ||
      (parsedPayload.version !== BEHAVIOR_AGGREGATION_STORAGE_VERSION &&
        parsedPayload.version !== LEGACY_BEHAVIOR_AGGREGATION_STORAGE_VERSION) ||
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

      const historyLastUpdatedAt =
        parsedPayload.version === BEHAVIOR_AGGREGATION_STORAGE_VERSION
          ? parseTimestamp((rawStats as PersistedWorkerBehaviorAggregate).lastUpdatedAt)
          : parseTimestamp(parsedPayload.savedAt);

      const workerStats = getOrCreateWorkerBehavior(workerId);
      workerStats.historicalClicks += clicks;
      workerStats.historicalConversions += conversions;
      workerStats.historicalCtaClicks += ctaClicks;
      workerStats.historicalInteractions += interactions;
      workerStats.historyLastUpdatedAt = historyLastUpdatedAt;
      syncWorkerBehaviorTotals(workerStats);
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
      scheduleBehaviorPersistence();
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
      workerStats.sessionInteractions += 1;
      workerStats.sessionClicks += 1;
      workerStats.lastInteractionEventIndex = event.context.eventIndex;
      syncWorkerBehaviorTotals(workerStats);
      changed = true;
      break;
    }
    case "marketplace.cta.click": {
      if (!event.metadata.workerId) {
        break;
      }

      const workerStats = getOrCreateWorkerBehavior(event.metadata.workerId);
      workerStats.sessionInteractions += 1;
      workerStats.sessionCtaClicks += 1;
      workerStats.lastInteractionEventIndex = event.context.eventIndex;
      syncWorkerBehaviorTotals(workerStats);
      changed = true;
      break;
    }
    case "dashboard.cta.click": {
      const workerStats = getOrCreateWorkerBehavior(event.metadata.workerId);
      workerStats.sessionInteractions += 1;
      workerStats.sessionCtaClicks += 1;
      workerStats.lastInteractionEventIndex = event.context.eventIndex;
      syncWorkerBehaviorTotals(workerStats);
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

      workerStats.sessionConversions += 1;
      workerStats.lastInteractionEventIndex = event.context.eventIndex;
      syncWorkerBehaviorTotals(workerStats);
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
  void forwardTrackingEventsToBackend(events);
}

function shouldForwardEvent(name: TrackingEventName): boolean {
  return FORWARDED_TRACKING_EVENTS.has(name);
}

function pickForwardableMetadata(
  event: AnyTrackingEvent,
): Record<string, unknown> | undefined {
  const metadata = event.metadata as Record<string, unknown>;
  const picked: Record<string, unknown> = {};

  if (typeof metadata.workerId === "string") {
    picked.workerId = metadata.workerId;
  }
  if (typeof metadata.workerProfileId === "string") {
    picked.workerProfileId = metadata.workerProfileId;
  }
  if (typeof metadata.categorySlug === "string") {
    picked.categorySlug = metadata.categorySlug;
  }
  if (typeof metadata.source === "string") {
    picked.source = metadata.source;
  }

  return Object.keys(picked).length > 0 ? picked : undefined;
}

async function forwardTrackingEventsToBackend(events: AnyTrackingEvent[]) {
  const browserWindow = getBrowserWindow();
  if (!browserWindow || typeof fetch !== "function") {
    return;
  }

  const eventsToForward = events
    .filter((event) => shouldForwardEvent(event.name))
    .map((event) => ({
      name: event.name,
      timestamp: event.timestamp,
      metadata: pickForwardableMetadata(event),
    }));

  if (eventsToForward.length === 0) {
    return;
  }

  try {
    await fetch(`${TRACKING_API_URL}/tracking/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      keepalive: true,
      body: JSON.stringify({
        sessionId: trackingSessionId,
        sentAt: nowIso(),
        events: eventsToForward,
      }),
    });
  } catch (error) {
    if (isDebugModeEnabled() && !trackingBackendForwardingWarned) {
      trackingBackendForwardingWarned = true;
      console.warn("[tchuno-track] backend forwarding unavailable", error);
    }
  }
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
    sessionInteractions: 0,
    sessionClicks: 0,
    sessionCtaClicks: 0,
    sessionConversions: 0,
    historicalInteractions: 0,
    historicalClicks: 0,
    historicalCtaClicks: 0,
    historicalConversions: 0,
    historyLastUpdatedAt: null,
  };

  const ratingValue = parseRating(input.ratingAvg);
  const ratingCount = Math.max(0, input.ratingCount);
  const qualityComponent =
    ratingValue * RATING_VALUE_WEIGHT +
    Math.log1p(Math.min(60, ratingCount)) * RATING_COUNT_WEIGHT;

  const temporalDecayMultiplier = getTemporalDecayMultiplier(
    behavior.historyLastUpdatedAt,
  );
  const sharedBehavior = sharedWorkerBehaviorById[input.workerId] ?? null;
  const sharedDecayMultiplier = getTemporalDecayMultiplier(
    sharedBehavior?.lastEventAtMs ?? null,
  );

  const eventsSinceInteraction = Math.max(
    0,
    sessionEventIndex - behavior.lastInteractionEventIndex,
  );
  const sessionRecencyMultiplier =
    behavior.lastInteractionEventIndex > 0
      ? 1 - clamp01(eventsSinceInteraction / RECENCY_EVENT_WINDOW) * 0.45
      : 1;

  const weightedSessionClicks = behavior.sessionClicks * SESSION_SIGNAL_WEIGHT;
  const weightedSessionCtaClicks =
    behavior.sessionCtaClicks * SESSION_SIGNAL_WEIGHT;
  const weightedSessionConversions =
    behavior.sessionConversions * SESSION_SIGNAL_WEIGHT;

  const weightedHistoricalClicks =
    behavior.historicalClicks *
    temporalDecayMultiplier *
    HISTORY_SIGNAL_WEIGHT;
  const weightedHistoricalCtaClicks =
    behavior.historicalCtaClicks *
    temporalDecayMultiplier *
    HISTORY_SIGNAL_WEIGHT;
  const weightedHistoricalConversions =
    behavior.historicalConversions *
    temporalDecayMultiplier *
    HISTORY_SIGNAL_WEIGHT;
  const weightedSharedInteractions =
    (sharedBehavior?.interactions ?? 0) *
    sharedDecayMultiplier *
    SHARED_SIGNAL_WEIGHT;
  const weightedSharedClicks =
    (sharedBehavior?.clicks ?? 0) *
    sharedDecayMultiplier *
    SHARED_SIGNAL_WEIGHT;
  const weightedSharedCtaClicks =
    (sharedBehavior?.ctaClicks ?? 0) *
    sharedDecayMultiplier *
    SHARED_SIGNAL_WEIGHT;
  const weightedSharedConversions =
    (sharedBehavior?.conversions ?? 0) *
    sharedDecayMultiplier *
    SHARED_SIGNAL_WEIGHT;

  const sessionInterestComponent =
    Math.min(24, weightedSessionClicks) *
    CLICK_WEIGHT *
    sessionRecencyMultiplier;
  const localHistoricalInterestComponent =
    Math.min(24, weightedHistoricalClicks) * CLICK_WEIGHT;
  const sharedInterestComponent =
    Math.min(24, weightedSharedClicks) * CLICK_WEIGHT;
  const historicalInterestComponent =
    localHistoricalInterestComponent + sharedInterestComponent;
  const interestComponent = sessionInterestComponent + historicalInterestComponent;

  const sessionIntentionComponent =
    Math.min(18, weightedSessionCtaClicks) *
    CTA_CLICK_WEIGHT *
    sessionRecencyMultiplier;
  const localHistoricalIntentionComponent =
    Math.min(18, weightedHistoricalCtaClicks) * CTA_CLICK_WEIGHT;
  const sharedIntentionComponent =
    Math.min(18, weightedSharedCtaClicks) * CTA_CLICK_WEIGHT;
  const historicalIntentionComponent =
    localHistoricalIntentionComponent + sharedIntentionComponent;
  const intentionComponent =
    sessionIntentionComponent + historicalIntentionComponent;

  const sessionConversionComponent =
    Math.min(10, weightedSessionConversions) * CONVERSION_WEIGHT;
  const localHistoricalConversionComponent =
    Math.min(10, weightedHistoricalConversions) * CONVERSION_WEIGHT;
  const sharedConversionComponent =
    Math.min(10, weightedSharedConversions) * CONVERSION_WEIGHT;
  const historicalConversionComponent =
    localHistoricalConversionComponent + sharedConversionComponent;
  const conversionComponent =
    sessionConversionComponent + historicalConversionComponent;

  const sessionBehaviorSignal =
    sessionInterestComponent +
    sessionIntentionComponent +
    sessionConversionComponent;
  const historicalBehaviorSignal =
    historicalInterestComponent +
    historicalIntentionComponent +
    historicalConversionComponent;
  const behaviorSignal = sessionBehaviorSignal + historicalBehaviorSignal;

  const effectiveInteractions =
    behavior.sessionInteractions * SESSION_SIGNAL_WEIGHT +
    behavior.historicalInteractions *
      temporalDecayMultiplier *
      HISTORY_SIGNAL_WEIGHT +
    weightedSharedInteractions;
  const effectiveConversions =
    weightedSessionConversions +
    weightedHistoricalConversions +
    weightedSharedConversions;

  const evidenceScore = Math.min(20, ratingCount) + effectiveInteractions * 1.1 + effectiveConversions * 4;
  const baseStabilityMultiplier =
    0.45 + clamp01(evidenceScore / MIN_CONFIDENCE_EVIDENCE) * 0.55;

  let confidenceGuardMultiplier = 1;
  if (
    effectiveInteractions < 1.5 &&
    effectiveConversions < 0.5 &&
    ratingCount < 2
  ) {
    confidenceGuardMultiplier = VERY_LOW_CONFIDENCE_GUARD_MULTIPLIER;
  } else if (
    effectiveInteractions < LOW_CONFIDENCE_INTERACTION_FLOOR &&
    effectiveConversions < 1 &&
    ratingCount < 4
  ) {
    confidenceGuardMultiplier = LOW_CONFIDENCE_GUARD_MULTIPLIER;
  }

  const stabilityMultiplier = baseStabilityMultiplier * confidenceGuardMultiplier;
  const score = qualityComponent + behaviorSignal * stabilityMultiplier;

  let confidenceLevel: "low" | "medium" | "high" = "low";
  if (stabilityMultiplier >= 0.85) {
    confidenceLevel = "high";
  } else if (stabilityMultiplier >= 0.65) {
    confidenceLevel = "medium";
  }

  const reasons: string[] = [];
  if (effectiveConversions >= 2) {
    reasons.push("Boa conversão");
  } else if (effectiveConversions > 0) {
    reasons.push("Conversão inicial");
  }
  const effectiveClicks =
    weightedSessionClicks + weightedHistoricalClicks + weightedSharedClicks;
  const effectiveCtaClicks =
    weightedSessionCtaClicks +
    weightedHistoricalCtaClicks +
    weightedSharedCtaClicks;
  if (effectiveCtaClicks >= 3 || effectiveClicks >= 5) {
    reasons.push("Mais procurado");
  } else if (effectiveCtaClicks > 0 || effectiveClicks > 0) {
    reasons.push("Relevante nesta lista");
  }
  if (ratingCount >= 8 && ratingValue >= 4.6) {
    reasons.push("Melhor avaliação");
  } else {
    reasons.push(`Qualidade base: rating ${ratingValue.toFixed(1)} (${ratingCount})`);
  }
  if (temporalDecayMultiplier < 0.85) {
    reasons.push("Histórico com decay temporal");
  }
  if (sharedBehavior && sharedDecayMultiplier < 0.85) {
    reasons.push("Sinal global com decay temporal");
  }
  if (sessionBehaviorSignal >= historicalBehaviorSignal) {
    reasons.push("Sessão atual com maior peso");
  } else {
    reasons.push("Histórico ainda influencia ranking");
  }
  if (sharedBehavior && historicalBehaviorSignal > sessionBehaviorSignal) {
    reasons.push("Ranking global reforça decisão");
  }
  if (confidenceGuardMultiplier < 1) {
    reasons.push("Amostra reduzida com proteção de confiança");
  }

  return {
    score: roundScore(score),
    qualityComponent: roundScore(qualityComponent),
    interestComponent: roundScore(interestComponent),
    intentionComponent: roundScore(intentionComponent),
    conversionComponent: roundScore(conversionComponent),
    behaviorSignal: roundScore(behaviorSignal),
    stabilityMultiplier: roundScore(stabilityMultiplier),
    temporalDecayMultiplier: roundScore(temporalDecayMultiplier),
    sessionBehaviorSignal: roundScore(sessionBehaviorSignal),
    historicalBehaviorSignal: roundScore(historicalBehaviorSignal),
    sessionSignalWeight: SESSION_SIGNAL_WEIGHT,
    historicalSignalWeight: HISTORY_SIGNAL_WEIGHT,
    confidenceGuardMultiplier: roundScore(confidenceGuardMultiplier),
    clicks: roundScore(effectiveClicks),
    conversions: roundScore(effectiveConversions),
    ctaClicks: roundScore(effectiveCtaClicks),
    interactions: roundScore(effectiveInteractions),
    lastInteractionEventIndex: behavior.lastInteractionEventIndex,
    confidenceLevel,
    reasons,
  };
}

function getTopBehaviorWorkers(limit = 5) {
  const now = Date.now();
  const workerIds = new Set([
    ...Object.keys(workerBehaviorById),
    ...Object.keys(sharedWorkerBehaviorById),
  ]);

  return Array.from(workerIds)
    .map((workerId) => {
      const stats = workerBehaviorById[workerId] ?? {
        interactions: 0,
        clicks: 0,
        ctaClicks: 0,
        conversions: 0,
        lastInteractionEventIndex: 0,
        sessionInteractions: 0,
        sessionClicks: 0,
        sessionCtaClicks: 0,
        sessionConversions: 0,
        historicalInteractions: 0,
        historicalClicks: 0,
        historicalCtaClicks: 0,
        historicalConversions: 0,
        historyLastUpdatedAt: null,
      };
      const shared = sharedWorkerBehaviorById[workerId] ?? {
        interactions: 0,
        clicks: 0,
        ctaClicks: 0,
        conversions: 0,
        lastEventAtMs: null,
      };

      return {
      workerId,
      totalClicks: stats.clicks,
      totalCtaClicks: stats.ctaClicks,
      totalConversions: stats.conversions,
      sessionClicks: stats.sessionClicks,
      sessionCtaClicks: stats.sessionCtaClicks,
      sessionConversions: stats.sessionConversions,
      historicalClicks: stats.historicalClicks,
      historicalCtaClicks: stats.historicalCtaClicks,
      historicalConversions: stats.historicalConversions,
      sharedClicks: shared.clicks,
      sharedCtaClicks: shared.ctaClicks,
      sharedConversions: shared.conversions,
      temporalDecayMultiplier: getTemporalDecayMultiplier(
        stats.historyLastUpdatedAt,
        now,
      ),
      sharedDecayMultiplier: getTemporalDecayMultiplier(shared.lastEventAtMs, now),
      };
    })
    .map((item) => {
      const historicalDecayWeight =
        item.temporalDecayMultiplier * HISTORY_SIGNAL_WEIGHT;
      const sharedDecayWeight =
        item.sharedDecayMultiplier * SHARED_SIGNAL_WEIGHT;
      const weightedClicks =
        item.sessionClicks * SESSION_SIGNAL_WEIGHT +
        item.historicalClicks * historicalDecayWeight +
        item.sharedClicks * sharedDecayWeight;
      const weightedCtaClicks =
        item.sessionCtaClicks * SESSION_SIGNAL_WEIGHT +
        item.historicalCtaClicks * historicalDecayWeight +
        item.sharedCtaClicks * sharedDecayWeight;
      const weightedConversions =
        item.sessionConversions * SESSION_SIGNAL_WEIGHT +
        item.historicalConversions * historicalDecayWeight +
        item.sharedConversions * sharedDecayWeight;

      return {
        ...item,
        weightedClicks: roundScore(weightedClicks),
        weightedCtaClicks: roundScore(weightedCtaClicks),
        weightedConversions: roundScore(weightedConversions),
        sessionSignalWeight: SESSION_SIGNAL_WEIGHT,
        historicalSignalWeight: HISTORY_SIGNAL_WEIGHT,
        sharedSignalWeight: SHARED_SIGNAL_WEIGHT,
        behaviorScore: roundScore(
          weightedClicks * CLICK_WEIGHT +
            weightedCtaClicks * CTA_CLICK_WEIGHT +
            weightedConversions * CONVERSION_WEIGHT,
        ),
      };
    })
    .sort((a, b) => b.behaviorScore - a.behaviorScore)
    .slice(0, limit);
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
  console.info("behavior.balance", {
    sessionSignalWeight: SESSION_SIGNAL_WEIGHT,
    historicalSignalWeight: HISTORY_SIGNAL_WEIGHT,
    decayHalfLifeHours: HISTORY_DECAY_HALF_LIFE_MS / (1000 * 60 * 60),
  });
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
