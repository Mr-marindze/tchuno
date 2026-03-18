import { ReactNode } from "react";
import {
  StatusBadgeTone,
  StatusTone,
} from "@/components/dashboard/dashboard-formatters";

type DashboardSectionHeaderProps = {
  title: string;
  subtitle: string;
  status?: string;
  statusTone?: StatusTone;
};

export function DashboardSectionHeader({
  title,
  subtitle,
  status,
  statusTone = "loading",
}: DashboardSectionHeaderProps) {
  return (
    <>
      <h2 className="section-title">{title}</h2>
      <p className="section-lead">{subtitle}</p>
      {status ? <p className={`status status--${statusTone}`}>{status}</p> : null}
    </>
  );
}

type DashboardSummaryCardProps = {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  className?: string;
};

export function DashboardSummaryCard({
  label,
  value,
  note,
  className = "metric-card",
}: DashboardSummaryCardProps) {
  return (
    <article className={className}>
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
      {note ? <p className="metric-note">{note}</p> : null}
    </article>
  );
}

type DashboardEmptyStateProps = {
  message: ReactNode;
  action?: ReactNode;
};

export function DashboardEmptyState({
  message,
  action,
}: DashboardEmptyStateProps) {
  return (
    <>
      <p className="empty-state">{message}</p>
      {action ? <div className="actions actions--inline">{action}</div> : null}
    </>
  );
}

type DashboardBadgeProps = {
  children: ReactNode;
  tone?: StatusBadgeTone;
  className?: string;
};

export function DashboardBadge({
  children,
  tone = "is-muted",
  className,
}: DashboardBadgeProps) {
  return (
    <span className={["status-pill", tone, className].filter(Boolean).join(" ")}>
      {children}
    </span>
  );
}

type DashboardActionPanelProps = {
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function DashboardActionPanel({
  title,
  description,
  children,
  actions,
  className,
}: DashboardActionPanelProps) {
  return (
    <div
      className={[
        "result",
        "dashboard-highlight-card",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <p className="item-title">{title}</p>
      {description ? <p className="muted">{description}</p> : null}
      {children}
      {actions ? <div className="actions actions--inline">{actions}</div> : null}
    </div>
  );
}

type DashboardPanelProps = {
  title: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function DashboardPanel({
  title,
  children,
  className,
}: DashboardPanelProps) {
  return (
    <div className={["result", className].filter(Boolean).join(" ")}>
      <p className="item-title">{title}</p>
      {children}
    </div>
  );
}

type DashboardMetaStatProps = {
  label: string;
  value: ReactNode;
};

export function DashboardMetaStat({ label, value }: DashboardMetaStatProps) {
  return (
    <p className="status">
      {label}: {value}
    </p>
  );
}

type DashboardPaginationRowProps = {
  onPrevious: () => void;
  onNext: () => void;
  previousDisabled?: boolean;
  nextDisabled?: boolean;
  previousLabel?: string;
  nextLabel?: string;
  children?: ReactNode;
};

export function DashboardPaginationRow({
  onPrevious,
  onNext,
  previousDisabled = false,
  nextDisabled = false,
  previousLabel = "Página anterior",
  nextLabel = "Próxima página",
  children,
}: DashboardPaginationRowProps) {
  return (
    <div className="meta-row">
      <button type="button" onClick={onPrevious} disabled={previousDisabled}>
        {previousLabel}
      </button>
      <button type="button" onClick={onNext} disabled={nextDisabled}>
        {nextLabel}
      </button>
      {children}
    </div>
  );
}
