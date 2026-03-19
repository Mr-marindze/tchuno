import { PublicPageShell } from "@/components/public/public-page-shell";

export default function ContactPage() {
  return (
    <PublicPageShell
      title="Contacto"
      description="Fala com a equipa para suporte operacional do piloto."
    >
      <div className="panel-card">
        <p className="subtitle">Email: suporte@tchuno.local</p>
        <p className="subtitle">Maputo, Moçambique</p>
      </div>
    </PublicPageShell>
  );
}
