import { RouteGuard } from "@/components/access/route-guard";
import { HomeDashboardView } from "@/components/dashboard/views/home-dashboard-view";

export default function ProviderDashboardPage() {
  return (
    <RouteGuard requiredAccess="provider">
      <HomeDashboardView />
    </RouteGuard>
  );
}
