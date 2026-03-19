import { ProtectedPlaceholderPage } from "@/components/access/protected-placeholder-page";

export default function AdminSettingsPage() {
  return (
    <ProtectedPlaceholderPage
      requiredAccess="admin"
      title="Configurações globais"
      description="Alterações sensíveis da plataforma devem ser auditadas e validadas por admin."
      primaryCtaHref="/admin"
      primaryCtaLabel="Voltar ao painel admin"
      secondaryCtaHref="/admin/audit-logs"
      secondaryCtaLabel="Ver auditoria"
    />
  );
}
