import { RouteGuard } from "@/components/access/route-guard";
import { ReviewsDashboardView } from "@/components/dashboard/views/reviews-dashboard-view";

export default function ProviderReviewsPage() {
  return (
    <RouteGuard requiredAccess="provider">
      <ReviewsDashboardView />
    </RouteGuard>
  );
}
