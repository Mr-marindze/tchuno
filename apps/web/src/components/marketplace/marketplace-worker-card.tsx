import { MouseEvent, ReactNode } from "react";
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
  details?: MarketplaceWorkerCardDetail[];
  badges?: ReactNode;
  note?: ReactNode;
  footer?: ReactNode;
  actions?: ReactNode;
  ctaHint?: ReactNode;
  onCardClick?: () => void;
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
  details = [],
  badges,
  note,
  footer,
  actions,
  ctaHint,
  onCardClick,
  className,
}: MarketplaceWorkerCardProps) {
  const ratingCountLabel =
    rating?.reviewCount === 1
      ? "1 avaliação"
      : `${rating?.reviewCount ?? 0} avaliações`;

  function handleCardClick(event: MouseEvent<HTMLElement>) {
    if (!onCardClick) {
      return;
    }

    const target = event.target as HTMLElement | null;
    if (target?.closest("a, button, input, select, textarea, label")) {
      return;
    }

    onCardClick();
  }

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
      onClick={onCardClick ? handleCardClick : undefined}
    >
      <div className="marketplace-worker-card-head">
        <h3 className="item-title marketplace-worker-name">{title}</h3>
        <p className="pill-row marketplace-worker-topline">
          <span className={`status-pill ${availabilityTone}`}>
            {availabilityLabel}
          </span>
          {responseTimeLabel ? (
            <span className="status-pill is-muted">{responseTimeLabel}</span>
          ) : null}
        </p>
        {relevanceLabel ? (
          <p className="marketplace-worker-relevance">{relevanceLabel}</p>
        ) : null}
      </div>

      {rating ? (
        <div
          className="marketplace-worker-rating"
          aria-label="Resumo de reputação"
        >
          <p className="marketplace-worker-rating-stars">{rating.stars}</p>
          <p className="marketplace-worker-rating-value">
            {rating.value}/5
            <span className="marketplace-worker-rating-count">
              {ratingCountLabel}
            </span>
          </p>
        </div>
      ) : null}

      {comparisonItems.length > 0 ? (
        <div
          className="marketplace-worker-compare-grid"
          aria-label="Comparação rápida"
        >
          {comparisonItems.map((item) => (
            <article
              key={item.label}
              className="marketplace-worker-compare-item"
            >
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
            <article
              key={signal.label}
              className="marketplace-worker-trust-item"
            >
              <p className="metric-label">{signal.label}</p>
              <p className="marketplace-worker-trust-value">{signal.value}</p>
            </article>
          ))}
        </div>
      ) : null}

      {badges ? <div className="pill-row">{badges}</div> : null}

      {details.length > 0 ? (
        <dl className="marketplace-worker-details">
          {details.map((detail) => (
            <div key={detail.label} className="marketplace-worker-detail-row">
              <dt>{detail.label}</dt>
              <dd>{detail.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {note ? <p className="muted">{note}</p> : null}
      {footer ? <p className="muted">{footer}</p> : null}
      {actions ? (
        <div className="actions actions--inline marketplace-worker-actions">
          {actions}
        </div>
      ) : null}
      {ctaHint ? (
        <p className="muted marketplace-worker-cta-hint">{ctaHint}</p>
      ) : null}
    </article>
  );
}
