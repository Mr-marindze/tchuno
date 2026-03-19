import { PublicPageShell } from "@/components/public/public-page-shell";

export default function AboutPage() {
  return (
    <PublicPageShell
      title="Sobre o Tchuno"
      description="Plataforma moçambicana para contratação prática de serviços locais."
    >
      <p className="subtitle">
        O foco do MVP é clareza operacional: descoberta simples, contratação direta e
        acompanhamento de job com estados previsíveis.
      </p>
    </PublicPageShell>
  );
}
