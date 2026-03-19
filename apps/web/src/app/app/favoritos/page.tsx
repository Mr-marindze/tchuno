import { ProtectedPlaceholderPage } from "@/components/access/protected-placeholder-page";

export default function CustomerFavoritesPage() {
  return (
    <ProtectedPlaceholderPage
      requiredAccess="customer"
      title="Favoritos"
      description="Guarda e recupera prestadores favoritos sem perder contexto de contratação."
      primaryCtaHref="/prestadores"
      primaryCtaLabel="Explorar prestadores"
      secondaryCtaHref="/app"
      secondaryCtaLabel="Voltar ao início"
    />
  );
}
