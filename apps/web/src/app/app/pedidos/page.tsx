import { RouteGuard } from "@/components/access/route-guard";
import { JobsDashboardView } from "@/components/dashboard/views/jobs-dashboard-view";

export default function CustomerOrdersPage() {
  return (
    <RouteGuard requiredAccess="customer">
      <JobsDashboardView />
    </RouteGuard>
  );
}
