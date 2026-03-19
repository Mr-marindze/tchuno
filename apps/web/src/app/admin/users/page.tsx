import { ProtectedPlaceholderPage } from "@/components/access/protected-placeholder-page";

export default function AdminUsersPage() {
  return (
    <ProtectedPlaceholderPage
      requiredAccess="admin"
      title="Gestão de utilizadores"
      description="Operação administrativa para gestão de contas cliente e acesso da plataforma."
      primaryCtaHref="/admin"
      primaryCtaLabel="Voltar ao painel admin"
      secondaryCtaHref="/admin/audit-logs"
      secondaryCtaLabel="Abrir auditoria"
    />
  );
}
