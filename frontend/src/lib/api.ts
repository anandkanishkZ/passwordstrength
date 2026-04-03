export const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";

export function getStoredToken(): string | null {
  return localStorage.getItem("accessToken");
}

export function setStoredToken(token: string) {
  localStorage.setItem("accessToken", token);
}

export function clearStoredToken() {
  localStorage.removeItem("accessToken");
}

function authHeaders(): Record<string, string> {
  const t = getStoredToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/** For raw `fetch` calls (e.g. MFA setup) that need the access token. */
export function authHeadersJson(): HeadersInit {
  return {
    "Content-Type": "application/json",
    ...authHeaders(),
  };
}

function messageFromApiError(data: unknown): string {
  if (data === null || typeof data !== "object") return "Server error";
  const err = (data as { error?: unknown }).error;
  if (typeof err === "string") return err;
  // Zod's .format() returns a nested object — surface a readable line
  if (err !== null && typeof err === "object") {
    const flat = err as Record<string, unknown>;
    const root = flat._errors;
    if (Array.isArray(root) && root[0] && typeof root[0] === "string") return root[0];
    for (const key of Object.keys(flat)) {
      if (key.startsWith("_")) continue;
      const field = flat[key];
      if (field !== null && typeof field === "object" && "_errors" in field) {
        const fe = (field as { _errors?: string[] })._errors;
        if (Array.isArray(fe) && fe[0]) return `${key}: ${fe[0]}`;
      }
    }
    try {
      return JSON.stringify(err);
    } catch {
      return "Request validation failed";
    }
  }
  return "Server error";
}

async function apiPost(path: string, body: Record<string, any> = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(messageFromApiError(data));
  }
  return data;
}

async function apiGet(path: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...authHeaders() },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(messageFromApiError(data));
  }
  return data;
}

export async function registerUserRemote(email: string, password: string, username?: string, captchaToken?: string) {
  return apiPost("/api/auth/register", { email, password, username, captchaToken });
}

export async function loginUserRemote(email: string, password: string, captchaToken?: string) {
  return apiPost("/api/auth/login", { email, password, captchaToken });
}

export async function verifyMfa(userId: string, token: string) {
  return apiPost("/api/auth/mfa/verify", { userId, token });
}

export async function fetchSession() {
  return apiGet("/api/auth/me");
}

export async function requestLogout() {
  return apiPost("/api/auth/logout", {});
}

export async function changePassword(currentPassword: string, newPassword: string) {
  return apiPost("/api/auth/change-password", { currentPassword, newPassword });
}
