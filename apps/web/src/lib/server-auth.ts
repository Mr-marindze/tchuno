import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthResponse } from "./auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const ACCESS_TOKEN_COOKIE = "tchuno_access_token";
const REFRESH_TOKEN_COOKIE = "tchuno_refresh_token";

type SessionResult = {
  auth: AuthResponse;
  me: unknown;
};

async function readCookieHeader(): Promise<{
  cookieHeader: string;
  accessToken: string | undefined;
  refreshToken: string | undefined;
}> {
  const store = await cookies();
  const parts: string[] = [];

  const accessToken = store.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = store.get(REFRESH_TOKEN_COOKIE)?.value;

  if (accessToken) {
    parts.push(`${ACCESS_TOKEN_COOKIE}=${accessToken}`);
  }

  if (refreshToken) {
    parts.push(`${REFRESH_TOKEN_COOKIE}=${refreshToken}`);
  }

  return {
    cookieHeader: parts.join("; "),
    accessToken,
    refreshToken,
  };
}

async function fetchMe(accessToken: string): Promise<unknown> {
  const response = await fetch(`${API_URL}/auth/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Invalid access token");
  }

  return (await response.json()) as unknown;
}

async function refreshWithCookies(cookieHeader: string): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
    },
    body: JSON.stringify({}),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Unable to refresh session");
  }

  return (await response.json()) as AuthResponse;
}

export async function requireServerSession(): Promise<SessionResult> {
  const { cookieHeader, accessToken, refreshToken } = await readCookieHeader();

  if (!cookieHeader) {
    redirect("/");
  }

  if (accessToken) {
    try {
      const me = await fetchMe(accessToken);
      return {
        auth: {
          accessToken,
          refreshToken: refreshToken ?? "",
          user: (me as { user?: AuthResponse["user"] }).user ?? {
            id: "",
            email: "",
            name: null,
          },
        },
        me,
      };
    } catch {
      // Fallback to refresh below.
    }
  }

  try {
    const auth = await refreshWithCookies(cookieHeader);
    const me = await fetchMe(auth.accessToken);
    return { auth, me };
  } catch {
    redirect("/");
  }
}
