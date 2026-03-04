export type AuthResponse = {
  user: {
    id: string;
    email: string;
    name: string | null;
  };
  accessToken: string;
  refreshToken: string;
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

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const ACCESS_TOKEN_KEY = "tchuno_access_token";
const REFRESH_TOKEN_KEY = "tchuno_refresh_token";

type ApiErrorBody = {
  message?: string | string[];
};

async function readError(response: Response): Promise<string> {
  let detail = `Request failed with status ${response.status}`;

  try {
    const body = (await response.json()) as ApiErrorBody;
    if (Array.isArray(body.message)) {
      detail = body.message.join(", ");
    } else if (body.message) {
      detail = body.message;
    }
  } catch {
    // Keep fallback detail if API does not return JSON.
  }

  return detail;
}

async function postJson<T>(path: string, payload: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function getJson<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return (await response.json()) as T;
}

export function getStoredTokens(): {
  accessToken: string | null;
  refreshToken: string | null;
} {
  if (typeof window === "undefined") {
    return { accessToken: null, refreshToken: null };
  }

  return {
    accessToken: localStorage.getItem(ACCESS_TOKEN_KEY),
    refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY),
  };
}

export function saveTokens(auth: AuthResponse): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, auth.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, auth.refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export async function register(input: {
  email: string;
  password: string;
  name?: string;
}): Promise<AuthResponse> {
  return postJson<AuthResponse>("/auth/register", input);
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  return postJson<AuthResponse>("/auth/login", input);
}

export async function refresh(refreshToken: string): Promise<AuthResponse> {
  return postJson<AuthResponse>("/auth/refresh", { refreshToken });
}

export async function logout(refreshToken: string): Promise<void> {
  await postJson<void>("/auth/logout", { refreshToken });
}

export async function logoutAll(accessToken: string): Promise<void> {
  const response = await fetch(`${API_URL}/auth/logout-all`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }
}

export async function getMe(accessToken: string): Promise<unknown> {
  return getJson<unknown>("/auth/me", accessToken);
}

export async function listSessions(accessToken: string): Promise<DeviceSession[]> {
  return getJson<DeviceSession[]>("/auth/sessions", accessToken);
}

export async function revokeSession(
  accessToken: string,
  sessionId: string,
): Promise<void> {
  const response = await fetch(`${API_URL}/auth/sessions/${sessionId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }
}

export async function ensureSession(): Promise<SessionState | null> {
  const { accessToken, refreshToken } = getStoredTokens();

  if (!accessToken && !refreshToken) {
    return null;
  }

  if (accessToken) {
    try {
      const me = await getMe(accessToken);
      return {
        auth: {
          user: (me as { user?: AuthResponse["user"] }).user ?? {
            id: "",
            email: "",
            name: null,
          },
          accessToken,
          refreshToken: refreshToken ?? "",
        },
        me,
      };
    } catch {
      // Fallback to refresh flow.
    }
  }

  if (!refreshToken) {
    clearTokens();
    return null;
  }

  try {
    const auth = await refresh(refreshToken);
    saveTokens(auth);
    const me = await getMe(auth.accessToken);
    return { auth, me };
  } catch {
    clearTokens();
    return null;
  }
}

export function startAutoRefresh(onSuccess?: (auth: AuthResponse) => void): () => void {
  const timer = window.setInterval(async () => {
    const { refreshToken } = getStoredTokens();
    if (!refreshToken) {
      return;
    }

    try {
      const auth = await refresh(refreshToken);
      saveTokens(auth);
      onSuccess?.(auth);
    } catch {
      clearTokens();
    }
  }, 10 * 60 * 1000);

  return () => window.clearInterval(timer);
}

export { API_URL };
