import axios from "axios";
import { useState } from "react";
import { getAuthState } from "../models/auth";
import { api } from "../services/api";

export function PricingPage() {
  const auth = getAuthState();
  const [itemId, setItemId] = useState("");
  const [unitId, setUnitId] = useState("PRIMARY");
  const [resolved, setResolved] = useState<Record<string, unknown> | null>(null);
  const [history, setHistory] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState("");

  async function resolvePrice() {
    if (!auth || !itemId) return;
    try {
      const response = await api.get(`/items/${itemId}/resolved-price`, {
        params: { unitType: "PRIMARY", unitId },
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      setResolved(response.data.data ?? null);
      setError("");
    } catch (resolveError) {
      if (axios.isAxiosError(resolveError)) setError(resolveError.response?.data?.message ?? "Failed to resolve price");
    }
  }

  async function loadHistory() {
    if (!auth || !itemId) return;
    try {
      const response = await api.get(`/items/${itemId}/price-history`, {
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      setHistory(response.data.data ?? []);
      setError("");
    } catch (historyError) {
      if (axios.isAxiosError(historyError)) setError(historyError.response?.data?.message ?? "Failed to load history");
    }
  }

  return (
    <main className="content">
      <header className="content-header">
        <div>
          <h1>Pricing Engine</h1>
          <p>Resolve price and inspect item price history</p>
        </div>
      </header>
      <section className="panel pad">
        <div className="inline-form">
          <input placeholder="Item ID" value={itemId} onChange={(e) => setItemId(e.target.value)} />
          <input placeholder="Unit ID" value={unitId} onChange={(e) => setUnitId(e.target.value)} />
          <button onClick={resolvePrice}>Resolve price</button>
          <button onClick={loadHistory}>Load history</button>
        </div>
        {error ? <p>{error}</p> : null}
      </section>
      <section className="panel pad">
        <h3>Resolved Price</h3>
        <code>{resolved ? JSON.stringify(resolved) : "No resolved price loaded."}</code>
      </section>
      <section className="panel">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>History Row</th>
            </tr>
          </thead>
          <tbody>
            {history.map((row, index) => (
              <tr key={index}>
                <td>{index + 1}</td>
                <td><code>{JSON.stringify(row)}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
