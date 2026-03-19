import { ProtectedPlaceholderPage } from "@/components/access/protected-placeholder-page";

export default function ProviderAgendaPage() {
  return (
    <ProtectedPlaceholderPage
      requiredAccess="provider"
      title="Agenda"
      description="Planeamento operacional do prestador com foco na disponibilidade de trabalhos."
      primaryCtaHref="/pro/pedidos"
      primaryCtaLabel="Ver pedidos"
      secondaryCtaHref="/pro/dashboard"
      secondaryCtaLabel="Voltar ao painel"
    />
  );
}
