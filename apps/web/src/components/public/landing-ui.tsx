import Link from "next/link";
import type { ReactNode } from "react";

export type LandingIconName =
  | "menu"
  | "request"
  | "proposal"
  | "confidence"
  | "plumbing"
  | "electric"
  | "repairs"
  | "construction"
  | "painting"
  | "carpentry"
  | "workers"
  | "rating"
  | "clock"
  | "location"
  | "provider"
  | "arrow"
  | "spark";

type CardProps = {
  action?: ReactNode;
  children?: ReactNode;
  description?: string;
  eyebrow?: string;
  icon: LandingIconName;
  note?: string;
  title: string;
};

type FooterLinkGroupProps = {
  links: Array<{
    href: string;
    label: string;
  }>;
  title: string;
};

type QuickAreaChipProps = {
  icon: LandingIconName;
  label: string;
  onClick: () => void;
};

type StatCardProps = {
  icon: LandingIconName;
  label: string;
  note: string;
  value: string;
};

export function LandingIcon({ name }: { name: LandingIconName }) {
  switch (name) {
    case "menu":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7h16" />
          <path d="M4 12h16" />
          <path d="M4 17h16" />
        </svg>
      );
    case "request":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 5h10a2 2 0 0 1 2 2v12H5V7a2 2 0 0 1 2-2Z" />
          <path d="M9 4h6" />
          <path d="M9 11h6" />
          <path d="M9 15h4" />
        </svg>
      );
    case "proposal":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 8h11a3 3 0 0 1 3 3v5H7a3 3 0 0 1-3-3V8Z" />
          <path d="M8 12h5" />
          <path d="M8 15h3" />
          <path d="M18 10h1.5A2.5 2.5 0 0 1 22 12.5 2.5 2.5 0 0 1 19.5 15H18" />
        </svg>
      );
    case "confidence":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3 5 6v5c0 4.6 2.9 8 7 9 4.1-1 7-4.4 7-9V6l-7-3Z" />
          <path d="m9.5 12 1.7 1.7 3.3-3.7" />
        </svg>
      );
    case "plumbing":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3c2.7 3 4 5.2 4 7.1a4 4 0 1 1-8 0C8 8.2 9.3 6 12 3Z" />
          <path d="M9 15h6" />
        </svg>
      );
    case "electric":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M13 2 6 13h5l-1 9 8-12h-5V2Z" />
        </svg>
      );
    case "repairs":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m14 5 5 5" />
          <path d="m3 21 7-7" />
          <path d="m10 14 7-7a2 2 0 1 0-3-3l-7 7" />
          <path d="m8 16 2 2" />
        </svg>
      );
    case "construction":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 20V9l7-5 7 5v11" />
          <path d="M9 20v-5h6v5" />
        </svg>
      );
    case "painting":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 4h8a3 3 0 0 1 3 3v3H9a3 3 0 0 1-3-3V4Z" />
          <path d="M13 10v8" />
          <path d="M10 18h6" />
        </svg>
      );
    case "carpentry":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 19 19 4" />
          <path d="m6 6 12 12" />
          <path d="M4 12h4" />
          <path d="M12 20v-4" />
        </svg>
      );
    case "workers":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="8" r="3" />
          <path d="M6 18a6 6 0 0 1 12 0" />
          <path d="M16 18a4 4 0 0 1 4 4" />
          <path d="M8 18a4 4 0 0 0-4 4" />
        </svg>
      );
    case "rating":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m12 3 2.7 5.5 6 .9-4.3 4.2 1 5.9L12 16.7 6.6 19.5l1-5.9L3.3 9.4l6-.9L12 3Z" />
        </svg>
      );
    case "clock":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4l3 2" />
        </svg>
      );
    case "location":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 21c4-4.4 6-7.8 6-10.3a6 6 0 1 0-12 0C6 13.2 8 16.6 12 21Z" />
          <circle cx="12" cy="10.5" r="2.2" />
        </svg>
      );
    case "provider":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 21v-2a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case "arrow":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12h14" />
          <path d="m13 6 6 6-6 6" />
        </svg>
      );
    case "spark":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m12 3 1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3Z" />
          <path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z" />
        </svg>
      );
    default:
      return null;
  }
}

export function QuickAreaChip({ icon, label, onClick }: QuickAreaChipProps) {
  return (
    <button type="button" className="landing-quick-chip" onClick={onClick}>
      <span className="landing-quick-chip-icon">
        <LandingIcon name={icon} />
      </span>
      <span>{label}</span>
    </button>
  );
}

export function SpotlightCard({
  action,
  children,
  description,
  eyebrow,
  icon,
  note,
  title,
}: CardProps) {
  return (
    <article className="landing-spotlight-card">
      <div className="landing-card-head">
        <span className="landing-card-icon">
          <LandingIcon name={icon} />
        </span>
        <div className="landing-card-copy">
          {eyebrow ? <p className="landing-card-eyebrow">{eyebrow}</p> : null}
          <h3>{title}</h3>
        </div>
      </div>
      {description ? <p className="landing-card-description">{description}</p> : null}
      {children}
      {note ? <p className="landing-card-note">{note}</p> : null}
      {action ? <div className="landing-card-action">{action}</div> : null}
    </article>
  );
}

export function FlowCard({
  description,
  eyebrow,
  icon,
  note,
  title,
}: CardProps) {
  return (
    <article className="landing-flow-card">
      <div className="landing-card-head">
        <span className="landing-card-icon">
          <LandingIcon name={icon} />
        </span>
        <div className="landing-card-copy">
          {eyebrow ? <p className="landing-card-eyebrow">{eyebrow}</p> : null}
          <h3>{title}</h3>
        </div>
      </div>
      {description ? <p className="landing-card-description">{description}</p> : null}
      {note ? <p className="landing-card-note">{note}</p> : null}
    </article>
  );
}

export function StatCard({ icon, label, note, value }: StatCardProps) {
  return (
    <article className="landing-stat-card">
      <span className="landing-stat-icon">
        <LandingIcon name={icon} />
      </span>
      <p className="landing-stat-label">{label}</p>
      <p className="landing-stat-value">{value}</p>
      <p className="landing-stat-note">{note}</p>
    </article>
  );
}

export function FooterLinkGroup({ links, title }: FooterLinkGroupProps) {
  return (
    <div className="landing-footer-group">
      <h3>{title}</h3>
      <ul>
        {links.map((link) => (
          <li key={`${title}-${link.href}-${link.label}`}>
            <Link href={link.href}>{link.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
