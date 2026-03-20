import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAuthState } from "../models/auth";
import { api } from "../services/api";

type DashboardData = {
  business: { name: string; currency: string };
  customers: number;
  suppliers: number;
  items: number;
  invoices: number;
  salesTotal: number;
  expenseTotal: number;
  lowStockCount: number;
  lowStockPreview: Array<{
    id: string;
    name: string;
    currentStockPrimary: unknown;
    reorderLevelPrimary: unknown;
  }>;
  outstandingReceivables: number;
  outstandingPayables: number;
  salesTrend: Array<{ date: string; total: number }>;
};

function toToggleKey(pathname: string) {
  const trimmed = pathname.replace(/^\/+/, "");
  if (!trimmed) return "";
  return trimmed.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function hasPermission(permissions: string[], permission: string) {
  return permissions.includes("*") || permissions.includes(permission);
}

export function DashboardPage() {
  const navigate = useNavigate();
  const auth = getAuthState();
  const permissions = auth?.permissions ?? [];
  const [data, setData] = useState<DashboardData | null>(null);
  const [moduleToggles, setModuleToggles] = useState<Record<string, boolean> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      if (!auth) return;
      try {
        const [dashRes, custRes] = await Promise.all([
          api.get("/business/dashboard", {
            headers: { Authorization: `Bearer ${auth.accessToken}` },
          }),
          api.get("/settings/customization", {
            headers: { Authorization: `Bearer ${auth.accessToken}` },
          }).catch(() => ({ data: {} })),
        ]);
        setData(dashRes.data.data as DashboardData);
        const toggles = custRes.data?.data?.moduleToggles;
        setModuleToggles(
          toggles && typeof toggles === "object" && !Array.isArray(toggles) ? (toggles as Record<string, boolean>) : {},
        );
        setError("");
      } catch (e) {
        if (axios.isAxiosError(e)) setError(e.response?.data?.message ?? "Failed to load dashboard");
      }
    }
    void load();
  }, [auth]);

  const fmtMoney = useMemo(() => {
    const currency = data?.business.currency ?? "LKR";
    return (n: number) =>
      new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
  }, [data?.business.currency]);

  const maxTrend = useMemo(() => Math.max(1, ...(data?.salesTrend.map((t) => t.total) ?? [1])), [data?.salesTrend]);

  const quickActions = useMemo(() => {
    const isOn = (path: string) => {
      const key = toToggleKey(path);
      if (!key || !moduleToggles) return true;
      return moduleToggles[key] !== false;
    };
    const canPrintCenter =
      hasPermission(permissions, "sales.view") ||
      hasPermission(permissions, "returns.view") ||
      hasPermission(permissions, "purchases.view");
    const rows: { label: string; path: string; allowed: boolean }[] = [
      { label: "POS / Till", path: "/pos", allowed: hasPermission(permissions, "sales.view") },
      { label: "Quotations", path: "/quotations", allowed: hasPermission(permissions, "sales.view") },
      { label: "Sales invoices", path: "/sales-invoices", allowed: hasPermission(permissions, "sales.view") },
      { label: "Purchases", path: "/purchases", allowed: hasPermission(permissions, "purchases.view") },
      { label: "Sales returns", path: "/sales-returns", allowed: hasPermission(permissions, "returns.view") },
      { label: "Payments", path: "/payments", allowed: hasPermission(permissions, "payments.view") },
      { label: "Refunds", path: "/refunds", allowed: hasPermission(permissions, "refunds.view") },
      { label: "Expenses", path: "/expenses", allowed: hasPermission(permissions, "expenses.view") },
      { label: "Reports", path: "/reports", allowed: hasPermission(permissions, "reports.view") },
      { label: "Print center", path: "/print-center", allowed: canPrintCenter },
      { label: "Settings", path: "/settings", allowed: hasPermission(permissions, "settings.view") },
    ];
    return rows.filter((r) => r.allowed && isOn(r.path));
  }, [moduleToggles, permissions]);

  if (!auth) return null;

  return (
    <main className="content">
      <header className="content-header">
        <div>
          <h1>Dashboard</h1>
          <p>
            {data?.business.name ? `${data.business.name} · ` : null}
            KPIs and quick actions
          </p>
        </div>
      </header>

      {error ? <p className="pad">{error}</p> : null}

      {data ? (
        <>
          <section className="cards">
            <div className="card">
              <span>Sales total (all time)</span>
              <strong>{fmtMoney(data.salesTotal)}</strong>
            </div>
            <div className="card">
              <span>Invoices</span>
              <strong>{data.invoices}</strong>
            </div>
            <div className="card">
              <span>Expenses (all time)</span>
              <strong>{fmtMoney(data.expenseTotal)}</strong>
            </div>
            <div className="card">
              <span>Outstanding receivables</span>
              <strong>{fmtMoney(data.outstandingReceivables)}</strong>
            </div>
            <div className="card">
              <span>Outstanding payables</span>
              <strong>{fmtMoney(data.outstandingPayables)}</strong>
            </div>
            <div className="card">
              <span>Low stock SKUs</span>
              <strong>{data.lowStockCount}</strong>
            </div>
            <div className="card">
              <span>Customers</span>
              <strong>{data.customers}</strong>
            </div>
            <div className="card">
              <span>Suppliers</span>
              <strong>{data.suppliers}</strong>
            </div>
            <div className="card">
              <span>Items</span>
              <strong>{data.items}</strong>
            </div>
          </section>

          <section className="panel pad" style={{ marginTop: 14 }}>
            <h3>Sales trend (last 7 days)</h3>
            <p style={{ color: "var(--muted)", fontSize: 13 }}>
              Respects tax / non-tax visibility for your role (same as reports).
            </p>
            <div className="trend-bars">
              {data.salesTrend.map((row) => (
                <div key={row.date} className="trend-bar-wrap">
                  <div
                    className="trend-bar"
                    style={{ height: `${Math.max(8, (row.total / maxTrend) * 120)}px` }}
                    title={`${row.date}: ${fmtMoney(row.total)}`}
                  />
                  <span className="trend-label">{row.date.slice(5)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="panel pad" style={{ marginTop: 14 }}>
            <h3>Low stock preview</h3>
            {data.lowStockPreview.length === 0 ? (
              <p style={{ color: "var(--muted)" }}>No low-stock items.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Stock</th>
                    <th>Reorder</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lowStockPreview.map((row) => (
                    <tr key={row.id}>
                      <td>{row.name}</td>
                      <td>{String(row.currentStockPrimary)}</td>
                      <td>{String(row.reorderLevelPrimary ?? "—")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="panel pad" style={{ marginTop: 14 }}>
            <h3>Quick actions</h3>
            <div className="quick-actions">
              {quickActions.map((a) => (
                <button key={a.path} type="button" className="primary-btn" onClick={() => navigate(a.path)}>
                  {a.label}
                </button>
              ))}
            </div>
            {quickActions.length === 0 ? (
              <p style={{ color: "var(--muted)" }}>No actions available for your role or disabled modules.</p>
            ) : null}
          </section>
        </>
      ) : !error ? (
        <p className="pad">Loading…</p>
      ) : null}
    </main>
  );
}
