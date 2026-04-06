import { PublicPageShell } from "@/components/public/public-page-shell";

export default function PrivacyPage() {
  return (
    <PublicPageShell
      title="Privacidade"
      description="Tratamos os teus dados de forma simples, responsável e alinhada com o funcionamento do Tchuno."
    >
      <div className="panel-grid">
        <article className="panel-card">
          <h2>Dados do pedido</h2>
          <p className="subtitle">
            A informação que colocas no pedido serve para encontrar propostas
            relevantes, organizar o processo e apoiar o contacto no momento certo.
          </p>
        </article>
        <article className="panel-card">
          <h2>Conta e sessão</h2>
          <p className="subtitle">
            Guardamos os dados necessários para autenticação, acesso à tua conta e
            histórico básico de utilização da plataforma.
          </p>
        </article>
        <article className="panel-card">
          <h2>Uso responsável</h2>
          <p className="subtitle">
            O Tchuno usa estes dados para operar o produto, melhorar suporte e
            proteger o fluxo entre cliente e prestador.
          </p>
        </article>
      </div>
    </PublicPageShell>
  );
}
