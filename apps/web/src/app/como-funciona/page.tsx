import { PublicPageShell } from "@/components/public/public-page-shell";

export default function HowItWorksPage() {
  return (
    <PublicPageShell
      title="Como funciona"
      description="O Tchuno liga clientes e prestadores com fluxo simples, rastreável e seguro."
    >
      <div className="panel-grid">
        <article className="panel-card">
          <h2>1. Explora e escolhe</h2>
          <p className="subtitle">
            Pesquisa por categoria, localização e reputação para encontrar o profissional certo.
          </p>
        </article>
        <article className="panel-card">
          <h2>2. Pede serviço</h2>
          <p className="subtitle">
            Cria um pedido aberto, recebe propostas de prestadores e seleciona a melhor opção.
          </p>
        </article>
        <article className="panel-card">
          <h2>3. Conclui e avalia</h2>
          <p className="subtitle">
            Paga o sinal para desbloquear contacto, acompanha a execução e deixa review no final.
          </p>
        </article>
      </div>
    </PublicPageShell>
  );
}
