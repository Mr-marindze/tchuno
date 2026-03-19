"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { DashboardScreenState } from "@/components/dashboard-experience";
import {
  buildAuthRoute,
  getRoleHomePath,
  resolveAppRole,
  resolveAppRoleFromMe,
  saveAuthIntent,
} from "@/lib/access-control";
import { ensureSession } from "@/lib/auth";
import { getMyWorkerProfile } from "@/lib/worker-profile";

type RequiredAccess = "authenticated" | "customer" | "provider" | "admin";

type RouteGuardProps = {
  requiredAccess: RequiredAccess;
  children: ReactNode;
};

type GuardState =
  | {
      status: "loading";
    }
  | {
      status: "allowed";
    }
  | {
      status: "forbidden";
      title: string;
      message: string;
      fallbackPath?: string;
    };

const adminRoles = new Set(["admin", "ops_admin", "support_admin", "super_admin"]);

export function RouteGuard({ requiredAccess, children }: RouteGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<GuardState>({ status: "loading" });

  const currentPath = useMemo(() => {
    if (typeof window === "undefined") {
      return pathname;
    }

    const query = window.location.search ?? "";
    return query.length > 0 ? `${pathname}${query}` : pathname;
  }, [pathname]);

  useEffect(() => {
    let active = true;

    async function runGuard() {
      const session = await ensureSession();

      if (!active) {
        return;
      }

      if (!session) {
        saveAuthIntent({
          nextPath: currentPath,
          sourcePath: currentPath,
        });

        router.replace(
          buildAuthRoute({
            mode: "login",
            nextPath: currentPath,
          }),
        );
        return;
      }

      if (requiredAccess === "authenticated") {
        setState({ status: "allowed" });
        return;
      }

      let role = resolveAppRoleFromMe(session.me);

      if (!role && session.auth.user.role === "ADMIN") {
        role =
          session.auth.user.adminSubrole === "SUPPORT_ADMIN"
            ? "support_admin"
            : session.auth.user.adminSubrole === "OPS_ADMIN"
              ? "ops_admin"
              : session.auth.user.adminSubrole === "SUPER_ADMIN"
                ? "super_admin"
                : "admin";
      }

      if (requiredAccess === "admin") {
        if (role && adminRoles.has(role)) {
          setState({ status: "allowed" });
          return;
        }

        setState({
          status: "forbidden",
          title: "403 · Acesso restrito",
          message:
            "Esta área é exclusiva para administração. Usa uma conta com permissões de admin.",
          fallbackPath: role ? getRoleHomePath(role) : "/",
        });
        return;
      }

      if (requiredAccess === "provider") {
        if (!role) {
          try {
            const workerProfile = await getMyWorkerProfile(session.auth.accessToken);
            if (!active) {
              return;
            }

            role = resolveAppRole({
              auth: session.auth,
              hasWorkerProfile: Boolean(workerProfile),
            });
          } catch {
            setState({
              status: "forbidden",
              title: "403 · Área de prestador",
              message:
                "Não foi possível validar o teu perfil profissional neste momento.",
              fallbackPath: "/app",
            });
            return;
          }
        }

        if (role === "provider" || adminRoles.has(role)) {
          setState({ status: "allowed" });
          return;
        }

        setState({
          status: "forbidden",
          title: "403 · Área de prestador",
          message:
            "Para aceder a esta área precisas de um perfil profissional ativo.",
          fallbackPath: getRoleHomePath(role),
        });
        return;
      }

      if (!role) {
        role = resolveAppRole({
          auth: session.auth,
          hasWorkerProfile: false,
        });
      }

      if (requiredAccess === "customer") {
        if (role === "customer" || adminRoles.has(role)) {
          setState({ status: "allowed" });
          return;
        }

        setState({
          status: "forbidden",
          title: "403 · Área de cliente",
          message:
            "Esta secção é reservada para contas cliente. Usa o espaço profissional para continuar.",
          fallbackPath: getRoleHomePath(role),
        });
        return;
      }

      setState({ status: "allowed" });
    }

    void runGuard();

    return () => {
      active = false;
    };
  }, [currentPath, requiredAccess, router]);

  if (state.status === "loading") {
    return (
      <DashboardScreenState
        title="A validar permissões..."
        message="Estamos a confirmar o teu acesso."
        tone="loading"
      />
    );
  }

  if (state.status === "forbidden") {
    return (
      <DashboardScreenState
        title={state.title}
        message={state.message}
        tone="error"
      >
        <p className="status">
          <Link href={state.fallbackPath ?? "/"} className="nav-link">
            Ir para área permitida
          </Link>
        </p>
      </DashboardScreenState>
    );
  }

  return <>{children}</>;
}
