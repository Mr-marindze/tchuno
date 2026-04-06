import { PublicPageShell } from "@/components/public/public-page-shell";

export default function HowItWorksPage() {
  return (
    <PublicPageShell
      title="Como funciona"
      description="O Tchuno liga clientes e prestadores com fluxo simples, rastreável e seguro."
    >
      <div className="panel-grid">
        <article className="panel-card">
          <h2>1. Cria o pedido</h2>
          <p className="subtitle">
            Descreve o serviço, indica a tua zona e publica o pedido no Tchuno.
          </p>
        </article>
        <article className="panel-card">
          <h2>2. Recebe propostas</h2>
          <p className="subtitle">
            Prestadores reais respondem ao teu pedido e tu comparas com mais contexto.
          </p>
        </article>
        <article className="panel-card">
          <h2>3. Escolhe, acompanha e avalia</h2>
          <p className="subtitle">
            Escolhe a proposta certa, paga o sinal para desbloquear contacto, acompanha a execução e deixa review no final.
          </p>
        </article>
      </div>
    </PublicPageShell>
  );
}
