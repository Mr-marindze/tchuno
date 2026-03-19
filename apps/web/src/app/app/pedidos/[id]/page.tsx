import { ProtectedPlaceholderPage } from "@/components/access/protected-placeholder-page";

type OrderDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function OrderDetailsPage({ params }: OrderDetailsPageProps) {
  const { id } = await params;

  return (
    <ProtectedPlaceholderPage
      requiredAccess="customer"
      title={`Pedido ${id}`}
      description="Consulta e acompanhamento detalhado do pedido no fluxo de jobs."
      primaryCtaHref="/app/pedidos"
      primaryCtaLabel="Voltar aos pedidos"
      secondaryCtaHref="/app"
      secondaryCtaLabel="Ir para início"
    />
  );
}
