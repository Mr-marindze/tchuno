import { RouteGuard } from "@/components/access/route-guard";
import { JobsDashboardView } from "@/components/dashboard/views/jobs-dashboard-view";

export default function DashboardJobsPage() {
  return (
    <RouteGuard requiredAccess="authenticated">
      <JobsDashboardView />
    </RouteGuard>
  );
}
