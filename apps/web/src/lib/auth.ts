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

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

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

async function postJson<T>(path: string, payload?: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: payload ? JSON.stringify(payload) : undefined,
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
    credentials: "include",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return (await response.json()) as T;
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

export async function refresh(refreshToken?: string): Promise<AuthResponse> {
  if (refreshToken) {
    return postJson<AuthResponse>("/auth/refresh", { refreshToken });
  }

  return postJson<AuthResponse>("/auth/refresh", {});
}

export async function logout(refreshToken?: string): Promise<void> {
  if (refreshToken) {
    await postJson<void>("/auth/logout", { refreshToken });
    return;
  }

  await postJson<void>("/auth/logout", {});
}

export async function getMe(accessToken: string): Promise<unknown> {
  return getJson<unknown>("/auth/me", accessToken);
}

export async function ensureSession(): Promise<SessionState | null> {
  try {
    const auth = await refresh();
    const me = await getMe(auth.accessToken);
    return { auth, me };
  } catch {
    return null;
  }
}

export function startAutoRefresh(onSuccess?: (auth: AuthResponse) => void): () => void {
  const timer = window.setInterval(async () => {
    try {
      const auth = await refresh();
      onSuccess?.(auth);
    } catch {
      // Ignore transient refresh failures; dashboard handles invalid sessions.
    }
  }, 10 * 60 * 1000);

  return () => window.clearInterval(timer);
}

export { API_URL };
