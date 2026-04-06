import { PublicPageShell } from "@/components/public/public-page-shell";

export default function AboutPage() {
  return (
    <PublicPageShell
      title="Sobre o Tchuno"
      description="Plataforma moçambicana para pedir serviços locais com propostas, seleção e execução acompanhada."
    >
      <p className="subtitle">
        O foco do Tchuno é tornar o processo mais simples: fazes o pedido,
        recebes propostas, escolhes com mais contexto e acompanhas o serviço até
        ao fim.
      </p>
    </PublicPageShell>
  );
}
