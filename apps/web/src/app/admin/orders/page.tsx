import { ProtectedPlaceholderPage } from "@/components/access/protected-placeholder-page";

export default function AdminOrdersPage() {
  return (
    <ProtectedPlaceholderPage
      requiredAccess="admin"
      title="Gestão de pedidos"
      description="Supervisão administrativa de pedidos, estados e incidentes operacionais."
      primaryCtaHref="/admin"
      primaryCtaLabel="Voltar ao painel admin"
      secondaryCtaHref="/admin/reports"
      secondaryCtaLabel="Ir para relatórios"
    />
  );
}
