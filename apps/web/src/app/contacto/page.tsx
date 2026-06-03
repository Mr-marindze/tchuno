import Link from "next/link";
import { PublicPageShell } from "@/components/public/public-page-shell";

export default function ContactPage() {
  return (
    <PublicPageShell
      title="Contacto e suporte"
      description="Apoio para acesso à conta e acompanhamento operacional do Tchuno."
    >
      <div className="panel-grid">
        <article className="panel-card">
          <h2>Suporte de conta</h2>
          <p className="subtitle">
            Se perdeste o acesso, usa a recuperação de senha para abrir o fluxo
            certo com a equipa.
          </p>
          <Link href="/recuperar-senha" className="marketplace-inline-link">
            Recuperar senha
          </Link>
        </article>

        <article className="panel-card">
          <h2>Suporte operacional</h2>
          <p className="subtitle">
            Pedidos, mensagens e pagamentos ficam acompanhados dentro do produto,
            com histórico organizado por fluxo.
          </p>
          <Link href="/login?force=1" className="marketplace-inline-link">
            Entrar no Tchuno
          </Link>
        </article>

        <article className="panel-card">
          <h2>Base operacional</h2>
          <p className="subtitle">Maputo, Moçambique</p>
          <p className="subtitle">
            Os canais públicos estão a ser alinhados para a próxima fase do
            produto.
          </p>
        </article>
      </div>
    </PublicPageShell>
  );
}
