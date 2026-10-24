import { API_URL } from "@/lib/api";

export async function adminMutation<T>(path: string, method: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { method, credentials: "include", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.errors ? Object.values(data.errors).flat().join(" ") : data?.message ?? `HTTP ${response.status}`);
  }
  return response.json();
}
