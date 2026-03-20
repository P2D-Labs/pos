import axios from "axios";
import { useEffect, useState } from "react";
import { getAuthState } from "../models/auth";
import { api } from "../services/api";

export function RefundsPage() {
  const auth = getAuthState();
  const canCreateRefunds = Boolean(auth?.permissions.includes("*") || auth?.permissions.includes("refunds.create"));
  const [referenceType, setReferenceType] = useState("SALES_RETURN");
  const [referenceId, setReferenceId] = useState("");
  const [method, setMethod] = useState("CASH");
  const [amount, setAmount] = useState("0");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    if (!auth) return;
    try {
      const response = await api.get("/refunds", {
        params: { search: search || undefined, page, pageSize },
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      setRows(response.data.data ?? []);
    } catch (loadError) {
      if (axios.isAxiosError(loadError)) setError(loadError.response?.data?.message ?? "Failed to load refunds");
      else setError("Failed to load refunds");
    }
  }

  async function submit() {
    if (!auth) return;
    try {
      await api.post(
        "/refunds",
        {
          referenceType,
          referenceId,
          method,
          amount: Number(amount || 0),
        },
        { headers: { Authorization: `Bearer ${auth.accessToken}` } },
      );
      setMessage("Refund saved");
      setError("");
      await load();
    } catch (submitError) {
      if (axios.isAxiosError(submitError)) setError(submitError.response?.data?.message ?? "Failed");
      else setError("Failed");
    }
  }

  useEffect(() => {
    if (!auth) return;
    void load();
  }, [auth, page]);

  return (
    <main className="content">
      <header className="content-header">
        <div>
          <h1>Refunds</h1>
          <p>Record issued refunds</p>
        </div>
      </header>
      <section className="panel pad">
        <div className="inline-form">
          <input value={referenceType} onChange={(e) => setReferenceType(e.target.value)} placeholder="Reference type" />
          <input value={referenceId} onChange={(e) => setReferenceId(e.target.value)} placeholder="Reference ID" />
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="CASH">CASH</option>
            <option value="CARD">CARD</option>
            <option value="BANK_TRANSFER">BANK_TRANSFER</option>
            <option value="WALLET">WALLET</option>
          </select>
          <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <button onClick={submit} disabled={!canCreateRefunds}>Save refund</button>
        </div>
        <div className="inline-form" style={{ marginTop: 8 }}>
          <input placeholder="Search refunds..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <button onClick={() => { setPage(1); void load(); }}>Search</button>
          <button onClick={() => setPage((prev) => Math.max(1, prev - 1))}>Prev</button>
          <span>Page {page}</span>
          <button onClick={() => setPage((prev) => prev + 1)}>Next</button>
        </div>
        {message ? <p>{message}</p> : null}
        {!canCreateRefunds ? <p>You have view-only access for refunds.</p> : null}
        {error ? <p>{error}</p> : null}
      </section>
      <section className="panel">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Refund</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
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
