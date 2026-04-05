import Link from "next/link";
import { formatRatingValue, formatStars } from "@/components/dashboard/dashboard-formatters";
import { PublicPageShell } from "@/components/public/public-page-shell";
import { listWorkerReviews } from "@/lib/reviews";
import {
  getWorkerProfileByUserId,
  resolveWorkerDisplayName,
  resolveWorkerInitials,
} from "@/lib/worker-profile";

type ProviderDetailsPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function ProviderDetailsPage({
  params,
}: ProviderDetailsPageProps) {
  const { slug } = await params;

  try {
    const profile = await getWorkerProfileByUserId(slug);
    const publicName = resolveWorkerDisplayName(profile);
    const profileInitials = resolveWorkerInitials(profile);
    const reviews = await listWorkerReviews(profile.id, {
      page: 1,
      limit: 5,
      sort: "createdAt:desc",
    });

    return (
      <PublicPageShell
        title={publicName}
        description="Perfil público com reputação, disponibilidade e contexto para decisão rápida."
      >
        <article className="panel-card provider-identity">
          <div className="provider-identity-avatar" aria-hidden="true">
            <span>{profileInitials}</span>
          </div>
          <div className="provider-identity-content">
            <h2>{publicName}</h2>
            <p className="subtitle">
              {profile.categories[0]?.name ?? "Profissional verificado"}
            </p>
            <p className="subtitle">
              {profile.location ?? "Localização não indicada"}
            </p>
          </div>
        </article>

        <div className="panel-grid">
          <article className="panel-card">
            <h2>Identidade profissional</h2>
            <p className="subtitle">{profile.bio ?? "Biografia não disponível."}</p>
            <p className="subtitle">Localização: {profile.location ?? "Não indicada"}</p>
            <p className="subtitle">
              Categoria principal: {profile.categories[0]?.name ?? "Não indicada"}
            </p>
          </article>

          <article className="panel-card">
            <h2>Reputação</h2>
            <p className="subtitle">
              Rating: {formatRatingValue(profile.ratingAvg)} ({formatStars(profile.ratingAvg)})
            </p>
            <p className="subtitle">Avaliações: {profile.ratingCount}</p>
            <p className="subtitle">
              Preço de referência:{" "}
              {typeof profile.hourlyRate === "number"
                ? `${profile.hourlyRate} MZN/h`
                : "Valor negociado com o profissional"}
            </p>
            <p className="subtitle">
              Disponibilidade: {profile.isAvailable ? "Disponível" : "Agenda limitada"}
            </p>
            <p className="subtitle">
              O valor final é acordado por propostas dentro do pedido no Tchuno.
            </p>
          </article>
        </div>

        <article className="marketplace-section">
          <h2 className="section-title">Avaliações públicas</h2>
          {reviews.data.length === 0 ? (
            <p className="empty-state">Ainda sem avaliações públicas para este prestador.</p>
          ) : (
            <div className="panel-grid">
              {reviews.data.map((review) => (
                <article key={review.id} className="panel-card">
                  <p className="subtitle">Rating: {review.rating}/5</p>
                  <p className="subtitle">{review.comment ?? "Sem comentário."}</p>
                </article>
              ))}
            </div>
          )}
        </article>

        <div className="actions actions--inline">
          <Link
            href="/login?next=%2Fapp%2Fpedidos%23novo-pedido"
            className="primary"
          >
            Pedir serviço
          </Link>
          <Link href="/prestadores" className="primary primary--ghost">
            Voltar à lista
          </Link>
        </div>
      </PublicPageShell>
    );
  } catch {
    return (
      <PublicPageShell
        title="Profissional não encontrado"
        description="Não foi possível carregar este perfil público."
      >
        <div className="actions actions--inline">
          <Link href="/prestadores" className="primary">
            Ver profissionais
          </Link>
          <Link href="/" className="primary primary--ghost">
            Voltar ao início
          </Link>
        </div>
      </PublicPageShell>
    );
  }
}
