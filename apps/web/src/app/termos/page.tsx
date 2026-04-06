import { PublicPageShell } from "@/components/public/public-page-shell";

export default function TermsPage() {
  return (
    <PublicPageShell
      title="Termos"
      description="Regras base para usar o Tchuno com clareza, confiança e respeito pelo fluxo da plataforma."
    >
      <div className="panel-grid">
        <article className="panel-card">
          <h2>Pedido primeiro</h2>
          <p className="subtitle">
            O Tchuno funciona a partir da criação de pedido, receção de propostas e
            escolha informada antes do avanço para a execução.
          </p>
        </article>
        <article className="panel-card">
          <h2>Uso da plataforma</h2>
          <p className="subtitle">
            Clientes e prestadores devem usar a conta, propostas e etapas do sistema
            de forma responsável e coerente com o processo oficial do produto.
          </p>
        </article>
        <article className="panel-card">
          <h2>Acompanhamento e suporte</h2>
          <p className="subtitle">
            O Tchuno pode rever atividade operacional, apoiar suporte e ajustar regras
            conforme o produto evolui.
          </p>
        </article>
      </div>
    </PublicPageShell>
  );
}
