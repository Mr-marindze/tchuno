import Link from "next/link";
import { getJobStatusBadgeTone } from "@/components/dashboard/dashboard-formatters";
import {
  DashboardActionPanel,
  DashboardBadge,
  DashboardEmptyState,
  DashboardSectionHeader,
  DashboardSummaryCard,
} from "@/components/dashboard/ui/dashboard-primitives";
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
  formatJobStatus: (status: JobStatus) => string;
  formatDate: (value: string) => string;
};

export function HomeDomainSection({
  homeAttentionItems,
  homeJobCounts,
  homePrimaryCta,
  formatJobStatus,
  formatDate,
}: HomeDomainSectionProps) {
  return (
    <section id="overview" className="dashboard-section">
      <DashboardSectionHeader
        title="Resumo Operacional"
        subtitle="Onde estás agora, o que está pendente e o próximo passo recomendado."
      />

      <DashboardActionPanel
        title="Próxima ação principal"
        description="Foca primeiro no que está pendente para reduzir atrasos no ciclo do job."
        actions={
          <>
            <Link href={homePrimaryCta.href} className="primary">
              {homePrimaryCta.label}
            </Link>
            <Link href="/dashboard/jobs" className="primary primary--ghost">
              Ver todos os jobs
            </Link>
          </>
        }
      />

      <div className="overview-grid">
        <DashboardSummaryCard
          label="Jobs com ação pendente"
          value={homeAttentionItems.length}
          note="Prioriza estes jobs primeiro."
        />
        <DashboardSummaryCard
          label="Em progresso"
          value={homeJobCounts.inProgress}
          note="Serviços ativos que precisam de acompanhamento."
        />
        <DashboardSummaryCard
          label="Pendentes de review"
          value={homeJobCounts.pendingReview}
          note="Fecha o ciclo de confiança com avaliação."
        />
        <DashboardSummaryCard
          label="Pedidos novos"
          value={homeJobCounts.requested}
          note="Novos pedidos a aguardar próxima ação."
        />
        <DashboardSummaryCard
          label="Cancelados"
          value={homeJobCounts.canceled}
          note="Acompanha motivos para evitar recorrência."
        />
      </div>

      <div className="result">
        <p className="item-title">Jobs que exigem atenção imediata</p>
        {homeAttentionItems.length === 0 ? (
          <DashboardEmptyState message="Sem bloqueios imediatos. Podes avançar para gestão completa de jobs." />
        ) : (
          homeAttentionItems.map((item) => (
            <article key={`${item.actor}-${item.job.id}`} className="list-item job-card">
              <p className="item-title">
                {item.job.title}
                <DashboardBadge tone={getJobStatusBadgeTone(item.job.status)}>
                  {formatJobStatus(item.job.status)}
                </DashboardBadge>
              </p>
              <p>
                <strong>Papel:</strong> {item.actor === "client" ? "Cliente" : "Worker"}
              </p>
              <p>
                <strong>Ação recomendada:</strong> {item.actionLabel}
              </p>
              <p className="muted">Atualizado em {formatDate(item.job.updatedAt)}</p>
            </article>
          ))
        )}
      </div>

      <div className="result">
        <p className="item-title">Atalhos rápidos</p>
        <nav className="dashboard-nav" aria-label="Atalhos operacionais">
          <Link href="/dashboard/jobs">Jobs</Link>
          <Link href="/dashboard/reviews">Reviews</Link>
          <Link href="/dashboard/workers">Profissionais</Link>
          <Link href="/dashboard/profile">Perfil</Link>
        </nav>
      </div>
    </section>
  );
}
