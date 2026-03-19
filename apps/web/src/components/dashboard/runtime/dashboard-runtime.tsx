"use client";

import Link from "next/link";
import {
  DashboardExperience,
  DashboardScreenState,
} from "@/components/dashboard-experience";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { AdminDomainSection } from "@/components/dashboard/domains/admin-domain-section";
import { CategoriesDomainSection } from "@/components/dashboard/domains/categories-domain-section";
import { HomeDomainSection } from "@/components/dashboard/domains/home-domain-section";
import { JobsDomainSection } from "@/components/dashboard/domains/jobs-domain-section";
import { ProfileDomainSection } from "@/components/dashboard/domains/profile-domain-section";
import { ReviewsDomainSection } from "@/components/dashboard/domains/reviews-domain-section";
import { WorkersDomainSection } from "@/components/dashboard/domains/workers-domain-section";
import { useDashboardRuntime } from "@/components/dashboard/runtime/use-dashboard-runtime";

type DashboardRuntimeProps = {
  view: DashboardView;
};

export function DashboardRuntime({ view }: DashboardRuntimeProps) {
  const runtime = useDashboardRuntime({ view });

  if (runtime.loading) {
    return (
      <DashboardScreenState
        title="A validar sessão..."
        message={runtime.shellProps.status}
        tone="loading"
      />
    );
  }

  if (!runtime.state) {
    return null;
  }

  if (!runtime.isAuthenticated) {
    return (
      <DashboardScreenState
        title="Sessão inválida"
        message="Não foi possível validar permissões para abrir o dashboard."
        tone="error"
      >
        <p className="status">
          <Link href="/login" className="nav-link">
            Voltar ao login
          </Link>
        </p>
      </DashboardScreenState>
    );
  }

  if (runtime.isAdminView && !runtime.isAdmin) {
    return (
      <DashboardScreenState
        title="Acesso restrito"
        message="A área administrativa é exclusiva para contas com papel ADMIN."
        tone="error"
      >
        <nav className="dashboard-nav">
          <Link href="/app">Início</Link>
          <Link href="/app/pedidos">Jobs</Link>
          <Link href="/app/perfil">Perfil</Link>
        </nav>
      </DashboardScreenState>
    );
  }

  return (
    <DashboardExperience
      view={view}
      isAdmin={runtime.isAdmin}
      status={runtime.shellProps.status}
      statusTone={runtime.shellProps.statusTone}
      onRefreshNow={runtime.shellProps.onRefreshNow}
      onLogout={runtime.shellProps.onLogout}
      onLogoutAll={runtime.shellProps.onLogoutAll}
    >
      {runtime.isHomeView ? <HomeDomainSection {...runtime.homeProps} /> : null}
      {runtime.isAdminView ? <AdminDomainSection {...runtime.adminProps} /> : null}
      {runtime.isProfileView ? <ProfileDomainSection {...runtime.profileProps} /> : null}
      {runtime.isCategoriesView ? (
        <CategoriesDomainSection {...runtime.categoriesProps} />
      ) : null}
      {runtime.isWorkersView ? <WorkersDomainSection {...runtime.workersProps} /> : null}
      {runtime.isJobsView ? <JobsDomainSection {...runtime.jobsProps} /> : null}
      {runtime.isReviewsView ? <ReviewsDomainSection {...runtime.reviewsProps} /> : null}
    </DashboardExperience>
  );
}
