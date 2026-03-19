import { ProtectedPlaceholderPage } from "@/components/access/protected-placeholder-page";

export default function CustomerMessagesPage() {
  return (
    <ProtectedPlaceholderPage
      requiredAccess="customer"
      title="Mensagens"
      description="Área reservada para conversa com prestadores após autenticação do cliente."
      primaryCtaHref="/app/pedidos"
      primaryCtaLabel="Ir para pedidos"
      secondaryCtaHref="/app"
      secondaryCtaLabel="Voltar ao início"
    />
  );
}
