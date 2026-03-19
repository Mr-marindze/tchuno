import { ProtectedPlaceholderPage } from "@/components/access/protected-placeholder-page";

export default function ProviderEarningsPage() {
  return (
    <ProtectedPlaceholderPage
      requiredAccess="provider"
      title="Ganhos"
      description="Resumo financeiro do prestador para apoiar gestão operacional no piloto."
      primaryCtaHref="/pro/pedidos"
      primaryCtaLabel="Ver pedidos"
      secondaryCtaHref="/pro/dashboard"
      secondaryCtaLabel="Voltar ao painel"
    />
  );
}
