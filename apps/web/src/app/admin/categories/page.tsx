import { RouteGuard } from "@/components/access/route-guard";
import { CategoriesDashboardView } from "@/components/dashboard/views/categories-dashboard-view";

export default function AdminCategoriesPage() {
  return (
    <RouteGuard requiredAccess="admin">
      <CategoriesDashboardView />
    </RouteGuard>
  );
}
