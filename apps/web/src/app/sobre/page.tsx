import { PublicPageShell } from "@/components/public/public-page-shell";

export default function AboutPage() {
  return (
    <PublicPageShell
      title="Sobre o Tchuno"
      description="Plataforma moçambicana para pedir serviços locais com propostas, seleção e execução acompanhada."
    >
      <p className="subtitle">
        O foco do MVP é clareza operacional: pedido, propostas, seleção, sinal,
        desbloqueio de contacto, execução e avaliação final.
      </p>
    </PublicPageShell>
  );
}
