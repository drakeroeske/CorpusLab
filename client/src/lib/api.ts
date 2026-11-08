const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function api<T = any>(method: string, path: string, body?: unknown, opts: { timeoutMs?: number } = {}): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), opts.timeoutMs ?? 15000);
  let r: Response;
  try {
    r = await fetch(`${API_BASE}${path}`, {
      method, credentials: "include", cache: "no-store", signal: ctl.signal,
      headers: method === "GET" ? {} : { "Content-Type": "application/json" },
      body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection.");
  } finally { clearTimeout(timer); }
  const isJson = (r.headers.get("content-type") || "").includes("json");
  const data = isJson ? await r.json().catch(() => null) : null;
  if (!r.ok) throw new ApiError(r.status, data?.message || `Request failed (${r.status})`);
  if (!isJson) throw new ApiError(0, "Server unavailable");
  return data as T;
}
