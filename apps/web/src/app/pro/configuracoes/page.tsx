import { ProtectedPlaceholderPage } from "@/components/access/protected-placeholder-page";

export default function ProviderSettingsPage() {
  return (
    <ProtectedPlaceholderPage
      requiredAccess="provider"
      title="Configurações do prestador"
      description="Gere preferências operacionais e prepara o perfil para receber novos pedidos."
      primaryCtaHref="/pro/perfil"
      primaryCtaLabel="Abrir perfil"
      secondaryCtaHref="/pro/dashboard"
      secondaryCtaLabel="Voltar ao painel"
    />
  );
}
