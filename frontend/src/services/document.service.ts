import { api } from "./api";

export async function getOptions(
  token: string,
  endpoint: "/customers" | "/suppliers" | "/items",
): Promise<Array<{ id: string; label: string }>> {
  const response = await api.get(endpoint, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return (response.data.data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    label: String(row.name ?? row.id),
  }));
}
