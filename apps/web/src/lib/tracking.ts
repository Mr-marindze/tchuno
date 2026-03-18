export type SessionState = "guest" | "authenticated";

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
    pricingMode: "FIXED_PRICE" | "QUOTE_REQUEST";
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
    pricingMode: "FIXED_PRICE" | "QUOTE_REQUEST";
  };
};

export type TrackingEventName = keyof TrackingEventMap;

export type TrackingEvent<Name extends TrackingEventName = TrackingEventName> = {
  name: Name;
  metadata: TrackingEventMap[Name];
  timestamp: string;
};

export type TrackingTransport = (
  events: TrackingEvent[],
) => void | Promise<void>;

type BrowserWindow = Window & {
  __tchunoTrackingBuffer__?: TrackingEvent[];
  __TCHUNO_TRACK_DEBUG__?: boolean;
  __TCHUNO_TRACK_HANDLER__?: TrackingTransport;
};

const TRACK_DEBUG_STORAGE_KEY = "tchuno_track_debug";
const eventQueue: TrackingEvent[] = [];
let flushScheduled = false;
let trackingTransport: TrackingTransport = defaultTrackingTransport;

function getBrowserWindow(): BrowserWindow | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window as BrowserWindow;
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

function defaultTrackingTransport(events: TrackingEvent[]): void {
  const browserWindow = getBrowserWindow();
  if (!browserWindow) {
    return;
  }

  if (!browserWindow.__tchunoTrackingBuffer__) {
    browserWindow.__tchunoTrackingBuffer__ = [];
  }
  browserWindow.__tchunoTrackingBuffer__.push(...events);
}

function emitDebugLogs(events: TrackingEvent[]): void {
  if (!isDebugModeEnabled()) {
    return;
  }

  const debugHeader = `[tchuno-track] batch(${events.length})`;
  console.groupCollapsed(debugHeader);
  events.forEach((event) => {
    console.info(event.name, event.metadata, event.timestamp);
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
  void Promise.resolve(transport(batch)).finally(() => {
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
  eventQueue.push({
    name,
    metadata,
    timestamp: new Date().toISOString(),
  });
  scheduleTrackingFlush();
}
