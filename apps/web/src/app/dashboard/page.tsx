import { RouteGuard } from "@/components/access/route-guard";
import { HomeDashboardView } from "@/components/dashboard/views/home-dashboard-view";

export default function DashboardPage() {
  return (
    <RouteGuard requiredAccess="authenticated">
      <HomeDashboardView />
    </RouteGuard>
  );
}
