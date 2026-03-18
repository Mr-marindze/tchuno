export type SessionState = "guest" | "authenticated";
export type JobPricingMode = "FIXED_PRICE" | "QUOTE_REQUEST";
export type DropoffReason = "visibility_hidden" | "before_unload";

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
const eventQueue: AnyTrackingEvent[] = [];
let flushScheduled = false;
let trackingTransport: TrackingTransport = defaultTrackingTransport;
let sessionEventIndex = 0;
let lifecycleHooksInitialized = false;

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
