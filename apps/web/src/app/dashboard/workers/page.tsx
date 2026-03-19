import { RouteGuard } from "@/components/access/route-guard";
import { WorkersDashboardView } from "@/components/dashboard/views/workers-dashboard-view";

export default function DashboardWorkersPage() {
  return (
    <RouteGuard requiredAccess="authenticated">
      <WorkersDashboardView />
    </RouteGuard>
  );
}
