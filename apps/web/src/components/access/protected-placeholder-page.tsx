"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { RouteGuard } from "@/components/access/route-guard";

type ProtectedPlaceholderPageProps = {
  requiredAccess: "authenticated" | "customer" | "provider" | "admin";
  title: string;
  description: string;
  primaryCtaHref?: string;
  primaryCtaLabel?: string;
  secondaryCtaHref?: string;
  secondaryCtaLabel?: string;
  children?: ReactNode;
};

export function ProtectedPlaceholderPage({
  requiredAccess,
  title,
  description,
  primaryCtaHref,
  primaryCtaLabel,
  secondaryCtaHref,
  secondaryCtaLabel,
  children,
}: ProtectedPlaceholderPageProps) {
  return (
    <RouteGuard requiredAccess={requiredAccess}>
      <main className="shell">
        <section className="card">
          <header className="header">
            <p className="kicker">Área protegida</p>
            <h1>{title}</h1>
            <p className="subtitle">{description}</p>
          </header>

          {children}

          <div className="actions actions--inline">
            {primaryCtaHref && primaryCtaLabel ? (
              <Link href={primaryCtaHref} className="primary">
                {primaryCtaLabel}
              </Link>
            ) : null}
            {secondaryCtaHref && secondaryCtaLabel ? (
              <Link href={secondaryCtaHref} className="primary primary--ghost">
                {secondaryCtaLabel}
              </Link>
            ) : null}
          </div>
        </section>
      </main>
    </RouteGuard>
  );
}
