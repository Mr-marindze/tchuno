import { RouteGuard } from "@/components/access/route-guard";
import { AdminDashboardView } from "@/components/dashboard/views/admin-dashboard-view";

export default function AdminReportsPage() {
  return (
    <RouteGuard requiredAccess="admin">
      <AdminDashboardView />
    </RouteGuard>
  );
}
