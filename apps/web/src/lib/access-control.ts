import { AuthResponse } from "@/lib/auth";

export type AppRole =
  | "guest"
  | "customer"
  | "provider"
  | "admin"
  | "support_admin"
  | "ops_admin"
  | "super_admin";

export type AuthIntent = {
  nextPath: string;
  sourcePath: string;
  selectedService?: string;
  selectedProviderId?: string;
  locationHint?: string;
  draft?: Record<string, string>;
  createdAt: string;
};

const AUTH_INTENT_KEY = "tchuno_auth_intent_v1";
const AUTH_INTENT_MAX_AGE_MS = 30 * 60 * 1000;

function getBrowserWindow(): Window | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window;
}

export function resolveAppRole(input: {
  auth: AuthResponse | null;
  hasWorkerProfile?: boolean;
}): AppRole {
  if (!input.auth) {
    return "guest";
  }

  if (input.auth.user.role === "ADMIN") {
    if (input.auth.user.adminSubrole === "SUPPORT_ADMIN") {
      return "support_admin";
    }

    if (input.auth.user.adminSubrole === "OPS_ADMIN") {
      return "ops_admin";
    }

    if (input.auth.user.adminSubrole === "SUPER_ADMIN") {
      return "super_admin";
    }

    return "admin";
  }

  if (input.hasWorkerProfile) {
    return "provider";
  }

  return "customer";
}

export function resolveAppRoleFromMe(me: unknown): AppRole | null {
  if (!me || typeof me !== "object") {
    return null;
  }

  const payload = me as {
    access?: {
      appRole?: AppRole;
    };
  };

  const appRole = payload.access?.appRole;
  if (!appRole) {
    return null;
  }

  return appRole;
}

export function getRoleHomePath(role: AppRole): string {
  if (role === "admin" || role === "ops_admin" || role === "support_admin" || role === "super_admin") {
    return "/admin";
  }

  if (role === "provider") {
    return "/pro/dashboard";
  }

  if (role === "customer") {
    return "/app";
  }

  return "/";
}

export function isSafeInternalPath(path: string | null | undefined): boolean {
  if (!path) {
    return false;
  }

  const normalized = path.trim();
  if (normalized.length === 0) {
    return false;
  }

  if (!normalized.startsWith("/")) {
    return false;
  }

  if (normalized.startsWith("//")) {
    return false;
  }

  return true;
}

export function resolvePostLoginPath(input?: {
  nextPath?: string | null;
  fallbackPath?: string;
}): string {
  const fallbackPath = input?.fallbackPath ?? "/app";
  const nextPath = input?.nextPath ?? null;

  if (!isSafeInternalPath(nextPath)) {
    return fallbackPath;
  }

  return nextPath as string;
}

export function buildAuthRoute(input?: {
  mode?: "login" | "register";
  nextPath?: string;
}): string {
  const mode = input?.mode ?? "login";
  const base = mode === "register" ? "/registo" : "/login";
  const nextPath = input?.nextPath;

  if (!isSafeInternalPath(nextPath)) {
    return base;
  }

  const params = new URLSearchParams();
  params.set("next", nextPath as string);
  return `${base}?${params.toString()}`;
}

export function saveAuthIntent(input: Omit<AuthIntent, "createdAt">): void {
  const browserWindow = getBrowserWindow();
  if (!browserWindow) {
    return;
  }

  const payload: AuthIntent = {
    ...input,
    createdAt: new Date().toISOString(),
  };

  try {
    browserWindow.sessionStorage.setItem(AUTH_INTENT_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage failures
  }
}

export function readAuthIntent(): AuthIntent | null {
  const browserWindow = getBrowserWindow();
  if (!browserWindow) {
    return null;
  }

  try {
    const raw = browserWindow.sessionStorage.getItem(AUTH_INTENT_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as AuthIntent;
    if (!isSafeInternalPath(parsed.nextPath)) {
      return null;
    }

    const createdAt = new Date(parsed.createdAt).getTime();
    if (!Number.isFinite(createdAt)) {
      return null;
    }

    if (Date.now() - createdAt > AUTH_INTENT_MAX_AGE_MS) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function consumeAuthIntent(): AuthIntent | null {
  const browserWindow = getBrowserWindow();
  if (!browserWindow) {
    return null;
  }

  const payload = readAuthIntent();
  try {
    browserWindow.sessionStorage.removeItem(AUTH_INTENT_KEY);
  } catch {
    // ignore storage failures
  }
  return payload;
}
