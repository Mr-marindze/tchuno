import { ProtectedPlaceholderPage } from "@/components/access/protected-placeholder-page";

export default function CustomerSettingsPage() {
  return (
    <ProtectedPlaceholderPage
      requiredAccess="customer"
      title="Configurações"
      description="Gere preferências da conta cliente e opções operacionais básicas."
      primaryCtaHref="/app/perfil"
      primaryCtaLabel="Abrir perfil"
      secondaryCtaHref="/app"
      secondaryCtaLabel="Voltar ao início"
    />
  );
}
