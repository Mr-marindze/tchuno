import { RouteGuard } from "@/components/access/route-guard";
import { ProfileDashboardView } from "@/components/dashboard/views/profile-dashboard-view";

export default function DashboardProfilePage() {
  return (
    <RouteGuard requiredAccess="authenticated">
      <ProfileDashboardView />
    </RouteGuard>
  );
}
