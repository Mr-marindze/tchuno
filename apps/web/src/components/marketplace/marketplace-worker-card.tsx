import { ReactNode } from "react";

export type MarketplaceWorkerCardDetail = {
  label: string;
  value: ReactNode;
};

type MarketplaceWorkerCardProps = {
  title: ReactNode;
  availabilityLabel: string;
  availabilityTone?: "is-ok" | "is-muted" | "is-danger";
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
  details,
  badges,
  note,
  footer,
  actions,
  className,
}: MarketplaceWorkerCardProps) {
  return (
    <article className={["worker-card", "marketplace-worker-card", className].filter(Boolean).join(" ")}>
      <p className="item-title">
        {title}
        <span className={`status-pill ${availabilityTone}`}>{availabilityLabel}</span>
      </p>

      {badges ? <div className="pill-row">{badges}</div> : null}

      {details.map((detail) => (
        <p key={detail.label}>
          <strong>{detail.label}:</strong> {detail.value}
        </p>
      ))}

      {note ? <p className="muted">{note}</p> : null}
      {footer ? <p className="muted">{footer}</p> : null}
      {actions ? <div className="actions actions--inline marketplace-worker-actions">{actions}</div> : null}
    </article>
  );
}
