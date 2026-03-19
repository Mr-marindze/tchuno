export type DashboardScope = "customer" | "provider" | "admin" | "legacy";

export type DashboardRouteMap = {
  home: string;
  jobs: string;
  workers: string;
  reviews: string;
  profile: string;
  categories: string;
  admin: string;
};

export function resolveDashboardScope(pathname: string): DashboardScope {
  if (pathname.startsWith("/app")) {
    return "customer";
  }

  if (pathname.startsWith("/pro")) {
    return "provider";
  }

  if (pathname.startsWith("/admin")) {
    return "admin";
  }

  return "legacy";
}

export function buildDashboardRouteMap(scope: DashboardScope): DashboardRouteMap {
  if (scope === "customer") {
    return {
      home: "/app",
      jobs: "/app/pedidos",
      workers: "/prestadores",
      reviews: "/app/pedidos",
      profile: "/app/perfil",
      categories: "/categorias",
      admin: "/admin",
    };
  }

  if (scope === "provider") {
    return {
      home: "/pro/dashboard",
      jobs: "/pro/pedidos",
      workers: "/prestadores",
      reviews: "/pro/avaliacoes",
      profile: "/pro/perfil",
      categories: "/categorias",
      admin: "/admin",
    };
  }

  if (scope === "admin") {
    return {
      home: "/admin",
      jobs: "/admin/orders",
      workers: "/admin/providers",
      reviews: "/admin/reports",
      profile: "/admin/users",
      categories: "/admin/categories",
      admin: "/admin",
    };
  }

  return {
    home: "/dashboard",
    jobs: "/dashboard/jobs",
    workers: "/dashboard/workers",
    reviews: "/dashboard/reviews",
    profile: "/dashboard/profile",
    categories: "/dashboard/categories",
    admin: "/dashboard/admin",
  };
}

