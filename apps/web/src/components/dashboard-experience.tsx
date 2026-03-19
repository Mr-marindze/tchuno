"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import {
  DashboardView,
  getDashboardSubtitle,
  getDashboardTitle,
} from "@/components/dashboard/dashboard-view";

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

  const navScope = (() => {
    if (pathname.startsWith("/app")) {
      return "customer";
    }

    if (pathname.startsWith("/pro")) {
      return "provider";
    }

    if (pathname.startsWith("/admin")) {
      return "admin";
    }

    return "legacy";
  })();

  const navPaths =
    navScope === "customer"
      ? {
          home: "/app",
          jobs: "/app/pedidos",
          workers: "/prestadores",
          reviews: "/app/pedidos",
          profile: "/app/perfil",
          categories: "/categorias",
          admin: "/admin",
        }
      : navScope === "provider"
        ? {
            home: "/pro/dashboard",
            jobs: "/pro/pedidos",
            workers: "/prestadores",
            reviews: "/pro/avaliacoes",
            profile: "/pro/perfil",
            categories: "/categorias",
            admin: "/admin",
          }
        : navScope === "admin"
          ? {
              home: "/admin",
              jobs: "/admin/orders",
              workers: "/admin/providers",
              reviews: "/admin/reports",
              profile: "/admin/users",
              categories: "/admin/categories",
              admin: "/admin",
            }
          : {
              home: "/dashboard",
              jobs: "/dashboard/jobs",
              workers: "/dashboard/workers",
              reviews: "/dashboard/reviews",
              profile: "/dashboard/profile",
              categories: "/dashboard/categories",
              admin: "/dashboard/admin",
            };

  const isHomeView = view === "home";
  const isJobsView = view === "jobs";
  const isWorkersView = view === "workers";
  const isProfileView = view === "profile";
  const isReviewsView = view === "reviews";
  const isCategoriesView = view === "categories";
  const isAdminView = view === "admin";

  return (
    <main className="shell">
      <section className="card card--wide dashboard-shell">
        <header className="header">
          <p className="kicker">Tchuno Dashboard</p>
          <h1>{getDashboardTitle(view)}</h1>
          <p className="subtitle">{getDashboardSubtitle(view)}</p>
        </header>

        <div className="dashboard-shell-nav">
          <nav className="dashboard-nav" aria-label="Dashboard principal">
            <Link href={navPaths.home} className={isHomeView ? "active" : undefined}>
              Início
            </Link>
            <Link href={navPaths.jobs} className={isJobsView ? "active" : undefined}>
              Jobs
            </Link>
            <Link
              href={navPaths.workers}
              className={isWorkersView ? "active" : undefined}
            >
              Profissionais
            </Link>
            <Link
              href={navPaths.reviews}
              className={isReviewsView ? "active" : undefined}
            >
              Reviews
            </Link>
            <Link
              href={navPaths.profile}
              className={isProfileView ? "active" : undefined}
            >
              Perfil
            </Link>
            <Link
              href={navPaths.categories}
              className={isCategoriesView ? "active" : undefined}
            >
              Categorias
            </Link>
          </nav>

          {isAdmin ? (
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

        <p className={`status status--${statusTone}`}>Status: {status}</p>

        <div className="dashboard-shell-content">{children}</div>

        <p className="status footer-link">
          <Link href="/login" className="nav-link">
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
