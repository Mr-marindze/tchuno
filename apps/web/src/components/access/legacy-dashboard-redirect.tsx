"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { DashboardScreenState } from "@/components/dashboard-experience";
import {
  buildAuthRoute,
  resolveAppRoleFromMe,
  saveAuthIntent,
} from "@/lib/access-control";
import { ensureSession } from "@/lib/auth";
import { buildDashboardRouteMap } from "@/lib/dashboard-routes";

type LegacyDashboardTarget =
  | "home"
  | "jobs"
  | "workers"
  | "reviews"
  | "profile"
  | "categories"
  | "admin";

type LegacyDashboardRedirectProps = {
  target: LegacyDashboardTarget;
};

function resolveScopeFromRole(role: string | null): "customer" | "provider" | "admin" {
  if (role === "provider") {
    return "provider";
  }

  if (
    role === "admin" ||
    role === "support_admin" ||
    role === "ops_admin" ||
    role === "super_admin"
  ) {
    return "admin";
  }

  return "customer";
}

export function LegacyDashboardRedirect({ target }: LegacyDashboardRedirectProps) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let active = true;

    async function redirect() {
      const session = await ensureSession();

      if (!active) {
        return;
      }

      const browserPath =
        typeof window === "undefined"
          ? pathname
          : `${window.location.pathname}${window.location.search}${window.location.hash}`;

      if (!session) {
        saveAuthIntent({
          nextPath: browserPath,
          sourcePath: browserPath,
        });
        router.replace(
          buildAuthRoute({
            mode: "login",
            nextPath: browserPath,
          }),
        );
        return;
      }

      const role =
        resolveAppRoleFromMe(session.me) ??
        (session.auth.user.role === "ADMIN" ? "admin" : "customer");

      const scope = resolveScopeFromRole(role);
      const routes = buildDashboardRouteMap(scope);

      const targetPath = routes[target];
      const hash =
        typeof window !== "undefined" && window.location.hash
          ? window.location.hash
          : "";
      const search =
        typeof window !== "undefined" && window.location.search
          ? window.location.search
          : "";

      router.replace(`${targetPath}${search}${hash}`);
    }

    void redirect();

    return () => {
      active = false;
    };
  }, [pathname, router, target]);

  return (
    <DashboardScreenState
      title="A redirecionar..."
      message="Estamos a abrir a rota certa para a nova arquitetura de acesso."
      tone="loading"
    />
  );
}

