export type TrackingEventName =
  | "marketplace_cta_clicked"
  | "marketplace_worker_card_clicked"
  | "marketplace_search_used"
  | "marketplace_category_selected"
  | "job_create_submitted"
  | "job_create_step_changed"
  | "worker_highlight_labels_applied"
  | "worker_ranking_applied"
  | "worker_contextual_cta_changed";

export type TrackingMetadata = Record<string, unknown>;

export type TrackingEvent = {
  name: TrackingEventName;
  metadata: TrackingMetadata;
  timestamp: string;
};

type BrowserWindow = Window & {
  __tchunoTrackingBuffer__?: TrackingEvent[];
};

const eventQueue: TrackingEvent[] = [];
let flushScheduled = false;

function flushTrackingQueue() {
  flushScheduled = false;
  const batch = eventQueue.splice(0, eventQueue.length);
  if (batch.length === 0) {
    return;
  }

  if (typeof window !== "undefined") {
    const browserWindow = window as BrowserWindow;
    if (!browserWindow.__tchunoTrackingBuffer__) {
      browserWindow.__tchunoTrackingBuffer__ = [];
    }
    browserWindow.__tchunoTrackingBuffer__.push(...batch);
  }

  batch.forEach((event) => {
    console.info("[tchuno-track]", event);
  });
}

function scheduleTrackingFlush() {
  if (flushScheduled) {
    return;
  }

  flushScheduled = true;
  setTimeout(flushTrackingQueue, 0);
}

export function trackEvent(
  name: TrackingEventName,
  metadata: TrackingMetadata = {},
) {
  eventQueue.push({
    name,
    metadata,
    timestamp: new Date().toISOString(),
  });
  scheduleTrackingFlush();
}
