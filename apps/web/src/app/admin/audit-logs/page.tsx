import { ProtectedPlaceholderPage } from "@/components/access/protected-placeholder-page";

export default function AdminAuditLogsPage() {
  return (
    <ProtectedPlaceholderPage
      requiredAccess="admin"
      title="Logs de auditoria"
      description="Registo de acessos e ações administrativas críticas para operação segura do MVP."
      primaryCtaHref="/admin"
      primaryCtaLabel="Voltar ao painel admin"
      secondaryCtaHref="/admin/settings"
      secondaryCtaLabel="Abrir configurações"
    />
  );
}
