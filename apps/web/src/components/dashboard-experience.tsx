"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import {
  DashboardView,
  getDashboardSubtitle,
  getDashboardTitle,
} from "@/components/dashboard/dashboard-view";
import {
  buildDashboardRouteMap,
  resolveDashboardScope,
} from "@/lib/dashboard-routes";

type StatusTone = "loading" | "success" | "error";

type DashboardExperienceProps = {
  view: DashboardView;
  isAdmin: boolean;
  status: string;
  statusTone: StatusTone;
  onRefreshNow: () => void;
  onLogout: () => void;
  onLogoutAll: () => void;
  children: ReactNode;
};

type DashboardScreenStateProps = {
  title: string;
  message: string;
  tone?: StatusTone;
  children?: ReactNode;
};

export function DashboardExperience({
  view,
  isAdmin,
  status,
  statusTone,
  onRefreshNow,
  onLogout,
  onLogoutAll,
  children,
}: DashboardExperienceProps) {
  const pathname = usePathname();
  const dashboardScope = resolveDashboardScope(pathname);
  const navPaths = buildDashboardRouteMap(dashboardScope);

  const isHomeView = view === "home";
  const isJobsView = view === "jobs";
  const isWorkersView = view === "workers";
  const isProfileView = view === "profile";
  const isReviewsView = view === "reviews";
  const isCategoriesView = view === "categories";
  const isAdminView = view === "admin";
  const navItems =
    dashboardScope === "customer"
      ? [
          { href: navPaths.home, label: "Início", active: isHomeView },
          { href: navPaths.jobs, label: "Pedidos", active: isJobsView },
          { href: navPaths.workers, label: "Profissionais", active: isWorkersView },
          { href: navPaths.profile, label: "Perfil", active: isProfileView },
        ]
      : dashboardScope === "provider"
        ? [
            { href: navPaths.home, label: "Início", active: isHomeView },
            { href: navPaths.jobs, label: "Pedidos recebidos", active: isJobsView },
            { href: navPaths.reviews, label: "Avaliações", active: isReviewsView },
            {
              href: navPaths.profile,
              label: "Perfil profissional",
              active: isProfileView,
            },
          ]
        : dashboardScope === "admin"
          ? [
              { href: navPaths.home, label: "Painel", active: isAdminView },
              { href: navPaths.workers, label: "Prestadores", active: isWorkersView },
              { href: navPaths.categories, label: "Categorias", active: isCategoriesView },
            ]
          : [
              { href: navPaths.home, label: "Início", active: isHomeView },
              { href: navPaths.jobs, label: "Jobs", active: isJobsView },
              { href: navPaths.workers, label: "Profissionais", active: isWorkersView },
              { href: navPaths.reviews, label: "Reviews", active: isReviewsView },
              { href: navPaths.profile, label: "Perfil", active: isProfileView },
              { href: navPaths.categories, label: "Categorias", active: isCategoriesView },
            ];
  const shellKicker =
    dashboardScope === "customer"
      ? "Tchuno Cliente"
      : dashboardScope === "provider"
        ? "Tchuno Profissional"
        : dashboardScope === "admin"
          ? "Tchuno Admin"
          : "Tchuno Dashboard";

  return (
    <main className="shell">
      <section className="card card--wide dashboard-shell">
        <header className="header">
          <p className="kicker">{shellKicker}</p>
          <h1>{getDashboardTitle(view)}</h1>
          <p className="subtitle">{getDashboardSubtitle(view)}</p>
        </header>

        <div className="dashboard-shell-nav">
          <nav className="dashboard-nav" aria-label="Dashboard principal">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={item.active ? "active" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {isAdmin && dashboardScope !== "admin" ? (
            <nav className="dashboard-nav dashboard-nav--admin" aria-label="Admin">
              <Link
                href={navPaths.admin}
                className={isAdminView ? "active" : undefined}
              >
                Administração
              </Link>
            </nav>
          ) : null}
        </div>

        {isProfileView ? (
          <div className="actions cta-actions dashboard-session-actions">
            <button type="button" onClick={onRefreshNow}>
              Renovar sessão
            </button>
            <button type="button" onClick={onLogout}>
              Terminar sessão
            </button>
            <button type="button" onClick={onLogoutAll}>
              Terminar todas
            </button>
          </div>
        ) : null}

        <p className={`status status--${statusTone}`}>Status: {status}</p>

        <div className="dashboard-shell-content">{children}</div>

        <p className="status footer-link">
          <Link href="/login?force=1" className="nav-link">
            Voltar ao login
          </Link>
        </p>
      </section>
    </main>
  );
}

export function DashboardScreenState({
  title,
  message,
  tone = "loading",
  children,
}: DashboardScreenStateProps) {
  return (
    <main className="shell">
      <section className="card state-card">
        <h1>{title}</h1>
        <p className={`status status--${tone}`}>{message}</p>
        {children}
      </section>
    </main>
  );
}
