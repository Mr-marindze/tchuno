import Link from "next/link";
import { getJobStatusBadgeTone } from "@/components/dashboard/dashboard-formatters";
import {
  DashboardActionPanel,
  DashboardBadge,
  DashboardEmptyState,
  DashboardSectionHeader,
  DashboardSummaryCard,
} from "@/components/dashboard/ui/dashboard-primitives";
import { DashboardRouteMap } from "@/lib/dashboard-routes";
import { Job, JobStatus } from "@/lib/jobs";

type HomeAttentionItem = {
  job: Job;
  actor: "client" | "worker";
  actionLabel: string;
};

type HomeJobCounts = {
  inProgress: number;
  requested: number;
  pendingReview: number;
  canceled: number;
};

type HomePrimaryCta = {
  href: string;
  label: string;
};

type HomeDomainSectionProps = {
  homeAttentionItems: HomeAttentionItem[];
  homeJobCounts: HomeJobCounts;
  homePrimaryCta: HomePrimaryCta;
  dashboardRoutes: DashboardRouteMap;
  showActorLabel: boolean;
  formatJobStatus: (status: JobStatus) => string;
  formatDate: (value: string) => string;
};

export function HomeDomainSection({
  homeAttentionItems,
  homeJobCounts,
  homePrimaryCta,
  dashboardRoutes,
  showActorLabel,
  formatJobStatus,
  formatDate,
}: HomeDomainSectionProps) {
  return (
    <section id="overview" className="dashboard-section">
      <DashboardSectionHeader
        title="Resumo de hoje"
        subtitle="Estado atual dos teus jobs."
      />

      <DashboardActionPanel
        title="Próxima ação principal"
        description="Prioriza o que exige ação agora."
        actions={
          <>
            <Link href={homePrimaryCta.href} className="primary">
              {homePrimaryCta.label}
            </Link>
            <Link href={dashboardRoutes.jobs} className="primary primary--ghost">
              Ver todos
            </Link>
          </>
        }
      />

      <div className="overview-grid">
        <DashboardSummaryCard
          label="Com ação"
          value={homeAttentionItems.length}
          note="Prioriza estes jobs."
        />
        <DashboardSummaryCard
          label="Em progresso"
          value={homeJobCounts.inProgress}
          note="Serviços ativos."
        />
        <DashboardSummaryCard
          label="Sem review"
          value={homeJobCounts.pendingReview}
          note="Fecha o ciclo com avaliação."
        />
        <DashboardSummaryCard
          label="Novos"
          value={homeJobCounts.requested}
          note="Pedidos a aguardar ação."
        />
        <DashboardSummaryCard
          label="Cancelados"
          value={homeJobCounts.canceled}
          note="Acompanha os motivos."
        />
      </div>

      <div className="result">
        <p className="item-title">Jobs que exigem atenção imediata</p>
        {homeAttentionItems.length === 0 ? (
          <DashboardEmptyState message="Sem bloqueios agora. Podes avançar." />
        ) : (
          homeAttentionItems.map((item) => (
            <article key={`${item.actor}-${item.job.id}`} className="list-item job-card">
              <p className="item-title">
                {item.job.title}
                <DashboardBadge tone={getJobStatusBadgeTone(item.job.status)}>
                  {formatJobStatus(item.job.status)}
                </DashboardBadge>
              </p>
              {showActorLabel ? (
                <p>
                  <strong>Papel:</strong> {item.actor === "client" ? "Cliente" : "Prestador"}
                </p>
              ) : null}
              <p>
                <strong>Ação recomendada:</strong> {item.actionLabel}
              </p>
              <p className="muted">Atualizado em {formatDate(item.job.updatedAt)}</p>
            </article>
          ))
        )}
      </div>

      <div className="result">
        <p className="item-title">Atalhos</p>
        <nav className="dashboard-nav" aria-label="Atalhos operacionais">
          <Link href={dashboardRoutes.jobs}>Jobs</Link>
          <Link href={dashboardRoutes.reviews}>Reviews</Link>
          <Link href={dashboardRoutes.workers}>Profissionais</Link>
          <Link href={dashboardRoutes.profile}>Perfil</Link>
        </nav>
      </div>
    </section>
  );
}
