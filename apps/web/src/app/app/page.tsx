import { RouteGuard } from "@/components/access/route-guard";
import { HomeDashboardView } from "@/components/dashboard/views/home-dashboard-view";

export default function CustomerAppHomePage() {
  return (
    <RouteGuard requiredAccess="customer">
      <HomeDashboardView />
    </RouteGuard>
  );
}
