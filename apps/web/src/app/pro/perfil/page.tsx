import { RouteGuard } from "@/components/access/route-guard";
import { ProfileDashboardView } from "@/components/dashboard/views/profile-dashboard-view";

export default function ProviderProfilePage() {
  return (
    <RouteGuard requiredAccess="provider">
      <ProfileDashboardView />
    </RouteGuard>
  );
}
