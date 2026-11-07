import { supabase } from "./supabase";

const BACKEND_URL = ((import.meta.env.VITE_BACKEND_URL as string | undefined) || "http://localhost:8000").replace(/\/$/, "");

export type Provider = "nvidia_nim" | "openrouter" | "deepgram";

export interface KeyStatus {
  saved: boolean;
  /** The last four characters, e.g. "…a1b2". The key itself is never sent back. */
  hint: string | null;
  updated_at: string | null;
}

export interface KeysResponse {
  /** True when the server fills keys you have not saved with its own (private installs). */
  server_keys_allowed: boolean;
  keys: Record<Provider, KeyStatus>;
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

/** Calls the LeeView backend as the signed-in user. */
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ApiError("You are signed out", 401);

  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}${path}`, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
  } catch {
    throw new ApiError("Could not reach the LeeView server", 0);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(errorMessage(body, res.status), res.status);
  return body as T;
}

function errorMessage(body: unknown, status: number): string {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object" && typeof (detail as { message?: unknown }).message === "string") {
    return (detail as { message: string }).message;
  }
  // FastAPI validation errors: [{msg: "..."}]
  if (Array.isArray(detail) && typeof detail[0]?.msg === "string") return detail[0].msg.replace(/^Value error, /, "");
  return status >= 500 ? "The LeeView server had a problem" : "That request was not accepted";
}

export const keysApi = {
  list: () => request<KeysResponse>("/me/keys"),
  // Save and remove answer with the updated statuses only.
  save: (provider: Provider, key: string) =>
    request<Pick<KeysResponse, "keys">>(`/me/keys/${provider}`, { method: "PUT", body: JSON.stringify({ key }) }),
  remove: (provider: Provider) => request<Pick<KeysResponse, "keys">>(`/me/keys/${provider}`, { method: "DELETE" }),
};
