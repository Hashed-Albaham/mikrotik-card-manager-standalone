export type Account = { id: string; username: string; role: "admin" | "user"; status: "pending" | "active" | "suspended" | "expired"; activationExpiresAt: string | null; createdAt: string; lastLoginAt: string | null };

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { credentials: "include", headers: { "content-type": "application/json", ...(init.headers ?? {}) }, ...init });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error ?? "تعذر إتمام الطلب.");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  login: (username: string, password: string) => request<{ user: Account }>("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  register: (username: string, password: string) => request<{ message: string }>("/api/auth/register", { method: "POST", body: JSON.stringify({ username, password }) }),
  me: () => request<{ user: Account }>("/api/auth/me"),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),
  list: <T>(kind: string) => request<{ records: T[] }>(`/api/resources/${kind}`),
  create: <T>(kind: string, payload: Record<string, unknown>) => request<T>(`/api/resources/${kind}`, { method: "POST", body: JSON.stringify({ payload }) }),
  update: <T>(kind: string, id: string, payload: Record<string, unknown>) => request<T>(`/api/resources/${kind}/${id}`, { method: "PUT", body: JSON.stringify({ payload }) }),
  remove: (kind: string, id: string) => request<void>(`/api/resources/${kind}/${id}`, { method: "DELETE" }),
  adminUsers: () => request<{ users: Account[] }>("/api/admin/users"),
  updateUser: (id: string, update: Partial<Pick<Account, "status" | "role" | "activationExpiresAt">>) => request<{ user: Account }>(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(update) })
};
