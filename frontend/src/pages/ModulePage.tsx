import axios from "axios";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { getAuthState } from "../models/auth";
import type { FormField } from "../models/module.model";
import { api } from "../services/api";

export function ModulePage({
  title,
  endpoint,
  createFields,
}: {
  title: string;
  endpoint: string;
  createFields?: FormField[];
}) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const auth = getAuthState();
  const canCreate = Boolean(
    auth?.permissions.includes("*") ||
      (endpoint === "/customers" ? auth?.permissions.includes("customers.create") : false) ||
      (endpoint === "/suppliers" ? auth?.permissions.includes("suppliers.create") : false) ||
      (endpoint === "/items" ? auth?.permissions.includes("products.create") : false) ||
      (endpoint === "/products" ? auth?.permissions.includes("products.create") : false) ||
      (endpoint === "/expenses" ? auth?.permissions.includes("expenses.create") : false) ||
      (endpoint === "/units" ? auth?.permissions.includes("units.create") : false) ||
      (endpoint === "/categories" ? auth?.permissions.includes("categories.create") : false) ||
      (endpoint === "/brands" ? auth?.permissions.includes("brands.create") : false) ||
      (endpoint === "/tax-rates" ? auth?.permissions.includes("taxRates.create") : false),
  );

  async function load() {
    if (!auth) return;
    try {
      const response = await api.get(endpoint, {
        params: { search: search || undefined, page, pageSize },
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      setRows(response.data.data ?? []);
    } catch (loadError) {
      if (axios.isAxiosError(loadError)) setError(loadError.response?.data?.message ?? "Failed to load");
    }
  }

  useEffect(() => {
    void load();
  }, [auth, endpoint, page]);

  async function createRecord(event: FormEvent) {
    event.preventDefault();
    if (!auth || !createFields || !canCreate) return;
    setLoading(true);
    setMessage("");
    try {
      const payload: Record<string, unknown> = {};
      for (const field of createFields) {
        const value = form[field.name];
        if (value === undefined || value === "") continue;
        payload[field.name] = field.type === "number" ? Number(value) : value;
      }
      if (endpoint === "/items") {
        payload.type = "PRODUCT";
        payload.trackInventory = true;
        payload.taxable = true;
      }
      await api.post(endpoint, payload, {
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      setForm({});
      setMessage("Saved");
      await load();
    } catch (saveError) {
      if (axios.isAxiosError(saveError)) setMessage(saveError.response?.data?.message ?? "Save failed");
      else setMessage("Save failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="content">
      <header className="content-header">
        <div>
          <h1>{title}</h1>
          <p>API-connected module view</p>
        </div>
      </header>
      {createFields ? (
        <section className="panel pad">
          <form className="inline-form" onSubmit={createRecord}>
            {createFields.map((field) => (
              <input
                key={field.name}
                placeholder={field.label}
                type={field.type === "number" ? "number" : "text"}
                value={form[field.name] ?? ""}
                onChange={(e) => setForm((prev) => ({ ...prev, [field.name]: e.target.value }))}
              />
            ))}
            <button disabled={loading || !canCreate}>{loading ? "Saving..." : "Add"}</button>
            {message ? <span>{message}</span> : null}
            {!canCreate ? <span>You have view-only access for this module.</span> : null}
          </form>
        </section>
      ) : null}
      <section className="panel">
        {error ? <p className="pad">{error}</p> : null}
        <div className="toolbar">
          <input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <button onClick={() => { setPage(1); void load(); }}>Search</button>
          <button onClick={() => setPage((prev) => Math.max(1, prev - 1))}>Prev</button>
          <span>Page {page}</span>
          <button onClick={() => setPage((prev) => prev + 1)}>Next</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Data</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                <td>{index + 1}</td>
                <td>
                  <code>{JSON.stringify(row)}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
