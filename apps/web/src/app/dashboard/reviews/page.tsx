import { RouteGuard } from "@/components/access/route-guard";
import { ReviewsDashboardView } from "@/components/dashboard/views/reviews-dashboard-view";

export default function DashboardReviewsPage() {
  return (
    <RouteGuard requiredAccess="authenticated">
      <ReviewsDashboardView />
    </RouteGuard>
  );
}
