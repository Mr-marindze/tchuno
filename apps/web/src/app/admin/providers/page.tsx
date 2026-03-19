import { RouteGuard } from "@/components/access/route-guard";
import { WorkersDashboardView } from "@/components/dashboard/views/workers-dashboard-view";

export default function AdminProvidersPage() {
  return (
    <RouteGuard requiredAccess="admin">
      <WorkersDashboardView />
    </RouteGuard>
  );
}
