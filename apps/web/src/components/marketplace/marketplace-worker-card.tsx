import { ReactNode } from "react";

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

type MarketplaceWorkerCardProps = {
  title: ReactNode;
  availabilityLabel: string;
  availabilityTone?: "is-ok" | "is-muted" | "is-danger";
  relevanceLabel?: string;
  highlighted?: boolean;
  rating?: MarketplaceWorkerCardRating;
  trustSignals?: MarketplaceWorkerCardTrustSignal[];
  details: MarketplaceWorkerCardDetail[];
  badges?: ReactNode;
  note?: ReactNode;
  footer?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function MarketplaceWorkerCard({
  title,
  availabilityLabel,
  availabilityTone = "is-muted",
  relevanceLabel,
  highlighted = false,
  rating,
  trustSignals = [],
  details,
  badges,
  note,
  footer,
  actions,
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
        <p className="item-title">
          {title}
          <span className={`status-pill ${availabilityTone}`}>{availabilityLabel}</span>
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
    </article>
  );
}
