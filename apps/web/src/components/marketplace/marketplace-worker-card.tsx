import { ReactNode } from "react";
import type { StatusBadgeTone } from "@/components/dashboard/dashboard-formatters";

export type MarketplaceWorkerCardDetail = {
  label: string;
  value: ReactNode;
};

export type MarketplaceWorkerCardTrustSignal = {
  label: string;
  value: ReactNode;
};

export type MarketplaceWorkerCardRating = {
  stars: ReactNode;
  value: ReactNode;
  reviewCount: number;
};

export type MarketplaceWorkerCardComparisonItem = {
  label: string;
  value: ReactNode;
  tone?: StatusBadgeTone;
};

type MarketplaceWorkerCardProps = {
  title: ReactNode;
  availabilityLabel: string;
  availabilityTone?: "is-ok" | "is-muted" | "is-danger";
  responseTimeLabel?: string;
  relevanceLabel?: string;
  highlighted?: boolean;
  rating?: MarketplaceWorkerCardRating;
  comparisonItems?: MarketplaceWorkerCardComparisonItem[];
  trustSignals?: MarketplaceWorkerCardTrustSignal[];
  details: MarketplaceWorkerCardDetail[];
  badges?: ReactNode;
  note?: ReactNode;
  footer?: ReactNode;
  actions?: ReactNode;
  ctaHint?: ReactNode;
  className?: string;
};

export function MarketplaceWorkerCard({
  title,
  availabilityLabel,
  availabilityTone = "is-muted",
  responseTimeLabel,
  relevanceLabel,
  highlighted = false,
  rating,
  comparisonItems = [],
  trustSignals = [],
  details,
  badges,
  note,
  footer,
  actions,
  ctaHint,
  className,
}: MarketplaceWorkerCardProps) {
  return (
    <article
      className={[
        "worker-card",
        "marketplace-worker-card",
        highlighted ? "is-highlighted" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="marketplace-worker-card-head">
        <p className="item-title">{title}</p>
        <p className="pill-row marketplace-worker-topline">
          <span className={`status-pill ${availabilityTone}`}>{availabilityLabel}</span>
          {responseTimeLabel ? (
            <span className="status-pill is-muted">{responseTimeLabel}</span>
          ) : null}
        </p>
        {relevanceLabel ? (
          <p className="marketplace-worker-relevance">{relevanceLabel}</p>
        ) : null}
      </div>

      {rating ? (
        <div className="marketplace-worker-rating" aria-label="Resumo de reputação">
          <p className="marketplace-worker-rating-stars">{rating.stars}</p>
          <p className="marketplace-worker-rating-value">
            {rating.value}/5
            <span className="marketplace-worker-rating-count">
              {rating.reviewCount} avaliação(ões)
            </span>
          </p>
        </div>
      ) : null}

      {comparisonItems.length > 0 ? (
        <div className="marketplace-worker-compare-grid" aria-label="Comparação rápida">
          {comparisonItems.map((item) => (
            <article key={item.label} className="marketplace-worker-compare-item">
              <p className="metric-label">{item.label}</p>
              <p
                className={[
                  "marketplace-worker-compare-value",
                  item.tone ? `is-${item.tone.replace("is-", "")}` : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {item.value}
              </p>
            </article>
          ))}
        </div>
      ) : null}

      {trustSignals.length > 0 ? (
        <div className="marketplace-worker-trust-grid">
          {trustSignals.map((signal) => (
            <article key={signal.label} className="marketplace-worker-trust-item">
              <p className="metric-label">{signal.label}</p>
              <p className="marketplace-worker-trust-value">{signal.value}</p>
            </article>
          ))}
        </div>
      ) : null}

      {badges ? <div className="pill-row">{badges}</div> : null}

      {details.map((detail) => (
        <p key={detail.label}>
          <strong>{detail.label}:</strong> {detail.value}
        </p>
      ))}

      {note ? <p className="muted">{note}</p> : null}
      {footer ? <p className="muted">{footer}</p> : null}
      {actions ? (
        <div className="actions actions--inline marketplace-worker-actions">
          {actions}
        </div>
      ) : null}
      {ctaHint ? <p className="muted marketplace-worker-cta-hint">{ctaHint}</p> : null}
    </article>
  );
}
