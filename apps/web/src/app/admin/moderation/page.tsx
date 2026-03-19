import { ProtectedPlaceholderPage } from "@/components/access/protected-placeholder-page";

export default function AdminModerationPage() {
  return (
    <ProtectedPlaceholderPage
      requiredAccess="admin"
      title="Moderação"
      description="Área para tratar denúncias e decisões de moderação com segurança."
      primaryCtaHref="/admin"
      primaryCtaLabel="Voltar ao painel admin"
      secondaryCtaHref="/admin/audit-logs"
      secondaryCtaLabel="Ver auditoria"
    />
  );
}
