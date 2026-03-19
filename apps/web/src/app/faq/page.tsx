import { PublicPageShell } from "@/components/public/public-page-shell";

export default function FaqPage() {
  return (
    <PublicPageShell
      title="Perguntas frequentes"
      description="Respostas rápidas para começar no Tchuno sem fricção."
    >
      <div className="panel-grid">
        <article className="panel-card">
          <h2>Preciso de conta para explorar?</h2>
          <p className="subtitle">
            Não. Podes pesquisar serviços, categorias e perfis de prestadores sem login.
          </p>
        </article>
        <article className="panel-card">
          <h2>Quando é obrigatório login?</h2>
          <p className="subtitle">
            Para ações sensíveis como pedir serviço, avaliar ou gerir histórico e mensagens.
          </p>
        </article>
        <article className="panel-card">
          <h2>Como acompanho o pedido?</h2>
          <p className="subtitle">
            Após login, acompanha estados no dashboard com timeline e ação principal por etapa.
          </p>
        </article>
      </div>
    </PublicPageShell>
  );
}
