import { readApiError } from "@/lib/http-errors";
import { PaginatedResponse } from "@/lib/pagination";

export type AuthResponse = {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: "USER" | "ADMIN";
    adminSubrole?: "SUPPORT_ADMIN" | "OPS_ADMIN" | "SUPER_ADMIN" | null;
  };
  accessToken: string;
  refreshToken: string;
};

export type ReauthResponse = {
  reauthToken: string;
  expiresAt: string;
};

export type SessionState = {
  auth: AuthResponse;
  me: unknown;
};

export type DeviceSession = {
  id: string;
  deviceId: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  lastUsedAt: string;
  revokedAt: string | null;
};

export type SessionListQuery = {
  status?: "active" | "revoked" | "all";
  limit?: number;
  offset?: number;
  sort?: "lastUsedAt:asc" | "lastUsedAt:desc" | "createdAt:asc" | "createdAt:desc";
};

export type SessionListMeta = {
  total: number;
  limit: number;
  offset: number;
  page: number;
  pageCount: number;
  hasNext: boolean;
  hasPrev: boolean;
};

export type SessionListResponse = {
  data: DeviceSession[];
  meta: SessionListMeta;
};

export type PasswordRecoveryRequestStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "CANCELED";

export type PasswordRecoveryRequest = {
  id: string;
  email: string;
  userId: string | null;
  status: PasswordRecoveryRequestStatus;
  note: string | null;
  requestedAt: string;
  startedAt: string | null;
  resolvedAt: string | null;
  resolvedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    email: string;
    isActive: boolean;
  } | null;
  resolvedBy?: {
    id: string;
    email: string;
    name: string | null;
  } | null;
};

export type PasswordRecoveryRequestResponse = {
  accepted: boolean;
  message: string;
};

export type ListPasswordRecoveryRequestsQuery = {
  status?: PasswordRecoveryRequestStatus;
  page?: number;
  limit?: number;
};

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const DEVICE_ID_KEY = "tchuno_device_id";
const SESSION_MARKER_COOKIE = "tchuno_session_present";

type ApiFetchOptions = RequestInit & {
  accessToken?: string | null;
  retryOnUnauthorized?: boolean;
};

let currentAuth: AuthResponse | null = null;
let refreshPromise: Promise<AuthResponse | null> | null = null;

function sanitizeAuthResponse(auth: AuthResponse): AuthResponse {
  return {
    ...auth,
    refreshToken: "",
  };
}

function rememberSessionMarker(): void {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${SESSION_MARKER_COOKIE}=1; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax`;
}

function clearSessionMarker(): void {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${SESSION_MARKER_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

function hasSessionMarker(): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .some((part) => part === `${SESSION_MARKER_COOKIE}=1`);
}

function buildHeaders(
  headersInit?: HeadersInit,
  accessToken?: string | null,
): Headers {
  const headers = new Headers(headersInit);
  const resolvedToken = accessToken?.trim();

  if (resolvedToken) {
    headers.set("Authorization", `Bearer ${resolvedToken}`);
  } else {
    headers.delete("Authorization");
  }

  if (typeof window !== "undefined" && !headers.has("x-device-id")) {
    headers.set("x-device-id", getOrCreateDeviceId());
  }

  return headers;
}

export async function apiFetch(
  input: string,
  init: ApiFetchOptions = {},
): Promise<Response> {
  const {
    accessToken,
    retryOnUnauthorized = true,
    headers: headersInit,
    credentials,
    ...rest
  } = init;

  const resolvedToken = currentAuth?.accessToken ?? accessToken ?? undefined;
  const response = await fetch(input, {
    ...rest,
    credentials: credentials ?? "include",
    headers: buildHeaders(headersInit, resolvedToken),
  });

  if (response.status !== 401 || !retryOnUnauthorized) {
    return response;
  }

  const refreshedAuth = await refreshSession();
  if (!refreshedAuth?.accessToken) {
    return response;
  }

  return fetch(input, {
    ...rest,
    credentials: credentials ?? "include",
    headers: buildHeaders(headersInit, refreshedAuth.accessToken),
  });
}

async function postJson<T>(
  path: string,
  payload: unknown,
  options?: {
    accessToken?: string | null;
    retryOnUnauthorized?: boolean;
  },
): Promise<T> {
  const response = await apiFetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    accessToken: options?.accessToken,
    retryOnUnauthorized: options?.retryOnUnauthorized ?? false,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function getJson<T>(
  path: string,
  accessToken?: string | null,
): Promise<T> {
  const response = await apiFetch(`${API_URL}${path}`, {
    accessToken,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as T;
}

export function getStoredTokens(): {
  accessToken: string | null;
  refreshToken: string | null;
} {
  return {
    accessToken: currentAuth?.accessToken ?? null,
    refreshToken:
      currentAuth?.refreshToken && currentAuth.refreshToken.trim().length > 0
        ? currentAuth.refreshToken
        : null,
  };
}

export function hasStoredSessionTokens(): boolean {
  const { accessToken, refreshToken } = getStoredTokens();
  return Boolean(accessToken || refreshToken || hasSessionMarker());
}

export function saveTokens(auth: AuthResponse): void {
  currentAuth = sanitizeAuthResponse(auth);
  rememberSessionMarker();
}

export function clearTokens(): void {
  currentAuth = null;
  clearSessionMarker();
}

function createFallbackDeviceId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `web-${ts}-${rand}`;
}

export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") {
    return "server";
  }

  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing && existing.trim().length > 0) {
    return existing;
  }

  const generated =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : createFallbackDeviceId();

  localStorage.setItem(DEVICE_ID_KEY, generated);
  return generated;
}

export async function register(input: {
  email: string;
  password: string;
  name?: string;
}): Promise<AuthResponse> {
  return sanitizeAuthResponse(
    await postJson<AuthResponse>("/auth/register", input),
  );
}

function buildPasswordRecoveryQuery(
  query?: ListPasswordRecoveryRequestsQuery,
): string {
  const params = new URLSearchParams();

  if (query?.status) {
    params.set("status", query.status);
  }

  if (typeof query?.page === "number") {
    params.set("page", String(query.page));
  }

  if (typeof query?.limit === "number") {
    params.set("limit", String(query.limit));
  }

  return params.size > 0 ? `?${params.toString()}` : "";
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  return sanitizeAuthResponse(await postJson<AuthResponse>("/auth/login", input));
}

export async function confirmReauth(input: {
  accessToken: string;
  password: string;
  purpose?: string;
}): Promise<ReauthResponse> {
  const response = await apiFetch(`${API_URL}/auth/reauth/confirm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      password: input.password,
      purpose: input.purpose,
    }),
    accessToken: input.accessToken,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as ReauthResponse;
}

export async function refresh(refreshToken?: string): Promise<AuthResponse> {
  return sanitizeAuthResponse(
    await postJson<AuthResponse>(
      "/auth/refresh",
      refreshToken ? { refreshToken } : {},
    ),
  );
}

export async function requestPasswordRecovery(
  email: string,
): Promise<PasswordRecoveryRequestResponse> {
  return postJson<PasswordRecoveryRequestResponse>("/auth/password-recovery/request", {
    email,
  });
}

export async function logout(refreshToken?: string): Promise<void> {
  await postJson<void>(
    "/auth/logout",
    refreshToken ? { refreshToken } : {},
  );
}

export async function logoutAll(accessToken: string): Promise<void> {
  const response = await apiFetch(`${API_URL}/auth/logout-all`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
    accessToken,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
}

export async function getMe(accessToken?: string | null): Promise<unknown> {
  return getJson<unknown>("/auth/me", accessToken);
}

export async function listSessions(
  accessToken: string,
  query?: SessionListQuery,
): Promise<SessionListResponse> {
  const params = new URLSearchParams();

  if (query?.status) {
    params.set("status", query.status);
  }

  if (typeof query?.limit === "number") {
    params.set("limit", String(query.limit));
  }

  if (typeof query?.offset === "number") {
    params.set("offset", String(query.offset));
  }

  if (query?.sort) {
    params.set("sort", query.sort);
  }

  const path = params.size > 0 ? `/auth/sessions?${params.toString()}` : "/auth/sessions";

  return getJson<SessionListResponse>(path, accessToken);
}

export async function listPasswordRecoveryRequests(
  accessToken: string,
  query?: ListPasswordRecoveryRequestsQuery,
): Promise<PaginatedResponse<PasswordRecoveryRequest>> {
  const response = await apiFetch(
    `${API_URL}/auth/password-recovery/requests${buildPasswordRecoveryQuery(query)}`,
    {
      accessToken,
    },
  );

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as PaginatedResponse<PasswordRecoveryRequest>;
}

export async function updatePasswordRecoveryRequest(
  accessToken: string,
  id: string,
  input: {
    status: Exclude<PasswordRecoveryRequestStatus, "OPEN">;
    note?: string;
  },
): Promise<PasswordRecoveryRequest> {
  const response = await apiFetch(`${API_URL}/auth/password-recovery/requests/${id}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
    accessToken,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as PasswordRecoveryRequest;
}

export async function revokeSession(
  accessToken: string,
  sessionId: string,
): Promise<void> {
  const response = await apiFetch(`${API_URL}/auth/sessions/${sessionId}`, {
    method: "DELETE",
    accessToken,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
}

export async function ensureSession(): Promise<SessionState | null> {
  if (currentAuth?.accessToken) {
    try {
      const me = await getMe(currentAuth.accessToken);
      return {
        auth: {
          user: (me as { user?: AuthResponse["user"] }).user ?? {
            id: "",
            email: "",
            name: null,
            role: "USER",
          },
          accessToken: currentAuth.accessToken,
          refreshToken: currentAuth.refreshToken,
        },
        me,
      };
    } catch {
      // Fallback to refresh flow.
    }
  }

  if (!hasStoredSessionTokens()) {
    clearTokens();
    return null;
  }

  try {
    const auth = await refreshSession();
    if (!auth) {
      clearTokens();
      return null;
    }

    const me = await getMe(auth.accessToken);
    return { auth, me };
  } catch {
    clearTokens();
    return null;
  }
}

export function startAutoRefresh(onSuccess?: (auth: AuthResponse) => void): () => void {
  const timer = window.setInterval(async () => {
    if (!hasStoredSessionTokens()) {
      return;
    }

    const auth = await refreshSession();
    if (auth) {
      onSuccess?.(auth);
    }
  }, 10 * 60 * 1000);

  return () => window.clearInterval(timer);
}

export async function refreshSession(): Promise<AuthResponse | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const auth = await refresh(currentAuth?.refreshToken);
      saveTokens(auth);
      return currentAuth;
    } catch {
      clearTokens();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}
