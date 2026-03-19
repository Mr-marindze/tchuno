import { ProtectedPlaceholderPage } from "@/components/access/protected-placeholder-page";

export default function CustomerPaymentsPage() {
  return (
    <ProtectedPlaceholderPage
      requiredAccess="customer"
      title="Pagamentos"
      description="Área autenticada para acompanhar estado financeiro dos pedidos."
      primaryCtaHref="/app/pedidos"
      primaryCtaLabel="Ver pedidos"
      secondaryCtaHref="/app"
      secondaryCtaLabel="Voltar ao início"
    />
  );
}
