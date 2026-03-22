import axios from "axios";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  ArrowRight,
  BarChart3,
  Package,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { StatCards } from "../components/StatCards";
import { SpinnerBlock } from "../components/ui/Spinner";
import { getAuthState } from "../models/auth";
import { api } from "../services/api";
import { moduleConfigs } from "../services/module.service";

type DashboardData = {
  business: { name: string; currency: string };
  customers: number;
  suppliers: number;
  items: number;
  invoices: number;
  salesTotal: number;
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
  const [stockSortBy, setStockSortBy] = useState<"item" | "stock" | "reorder">("stock");
  const [stockSortDir, setStockSortDir] = useState<"asc" | "desc">("asc");
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
  }, [auth?.accessToken]);

  const fmtMoney = useMemo(() => {
    const currency = data?.business.currency ?? "LKR";
    return (n: number) =>
      new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
  }, [data?.business.currency]);

  const maxTrend = useMemo(() => Math.max(1, ...(data?.salesTrend.map((t) => t.total) ?? [1])), [data?.salesTrend]);
  const sortedLowStock = useMemo(() => {
    const rows = [...(data?.lowStockPreview ?? [])];
    rows.sort((a, b) => {
      const dir = stockSortDir === "asc" ? 1 : -1;
      const stockA = Number(a.currentStockPrimary ?? 0);
      const stockB = Number(b.currentStockPrimary ?? 0);
      const reorderA = Number(a.reorderLevelPrimary ?? 0);
      const reorderB = Number(b.reorderLevelPrimary ?? 0);
      if (stockSortBy === "item") return a.name.localeCompare(b.name) * dir;
      if (stockSortBy === "reorder") return (reorderA - reorderB) * dir;
      return (stockA - stockB) * dir;
    });
    return rows;
  }, [data?.lowStockPreview, stockSortBy, stockSortDir]);

  function toggleStockSort(next: "item" | "stock" | "reorder") {
    if (stockSortBy === next) setStockSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    else {
      setStockSortBy(next);
      setStockSortDir(next === "item" ? "asc" : "desc");
    }
  }

  const quickActions = useMemo(() => {
    const isOn = (path: string) => {
      const key = toToggleKey(path);
      if (!key || !moduleToggles) return true;
      return moduleToggles[key] !== false;
    };
    const quickActionPaths = new Set([
      "/pos",
      "/sales-invoices",
      "/quotations",
      "/sales-orders",
      "/purchases",
      "/sales-returns",
      "/payments",
      "/inventory",
      "/reports",
      "/roles",
      "/users",
      "/settings",
    ]);
    const rows = moduleConfigs
      .filter((m) => quickActionPaths.has(m.path))
      .map((m) => {
        let allowed = true;
        if (m.path === "/purchases") allowed = hasPermission(permissions, "purchases.view");
        else if (m.path === "/sales-returns") allowed = hasPermission(permissions, "returns.view");
        else if (m.path === "/payments") allowed = hasPermission(permissions, "payments.view");
        else if (m.path === "/inventory") allowed = hasPermission(permissions, "inventory.view");
        else if (m.path === "/reports") allowed = hasPermission(permissions, "reports.view");
        else if (m.path === "/settings") allowed = hasPermission(permissions, "settings.view");
        else if (m.path === "/roles") allowed = hasPermission(permissions, "roles.view");
        else if (m.path === "/users") allowed = hasPermission(permissions, "users.view");
        else allowed = hasPermission(permissions, "sales.view");
        return { label: m.title, path: m.path, allowed };
      });
    return rows.filter((r) => r.allowed && isOn(r.path));
  }, [moduleToggles, permissions]);

  if (!auth) return null;

  return (
    <main className="content">
      <PageHeader
        title="Dashboard"
        subtitle={
          data?.business.name ? `${data.business.name} · KPIs and quick actions` : "KPIs and quick actions"
        }
      />

      {error ? <p className="alert alert-error">{error}</p> : null}

      {data ? (
        <>
          <StatCards
            items={[
              { label: "Sales total", value: fmtMoney(data.salesTotal), icon: TrendingUp, tone: "blue" },
              { label: "Invoices", value: data.invoices, icon: BarChart3, tone: "green" },
              { label: "Receivables", value: fmtMoney(data.outstandingReceivables), icon: Wallet, tone: "purple" },
              { label: "Low stock SKUs", value: data.lowStockCount, icon: Package, tone: "orange" },
            ]}
          />

          <section className="panel panel--pad panel-section-top">
            <h3 className="section-title">
              Sales trend (last 7 days)
            </h3>
            <p className="page-desc">Respects tax visibility for your role.</p>
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

          <section className="panel panel--pad panel-section-top">
            <h3 className="section-title">
              Low stock preview
            </h3>
            {data.lowStockPreview.length === 0 ? (
              <p className="page-desc">No low-stock items.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>
                        <button type="button" className={`th-sort${stockSortBy === "item" ? " is-active" : ""}`} onClick={() => toggleStockSort("item")}>
                          ITEM
                          {stockSortDir === "asc" && stockSortBy === "item" ? <ArrowUpAZ size={14} /> : <ArrowDownAZ size={14} />}
                        </button>
                      </th>
                      <th>
                        <button type="button" className={`th-sort${stockSortBy === "stock" ? " is-active" : ""}`} onClick={() => toggleStockSort("stock")}>
                          STOCK
                          {stockSortDir === "asc" && stockSortBy === "stock" ? <ArrowUpAZ size={14} /> : <ArrowDownAZ size={14} />}
                        </button>
                      </th>
                      <th>
                        <button type="button" className={`th-sort${stockSortBy === "reorder" ? " is-active" : ""}`} onClick={() => toggleStockSort("reorder")}>
                          REORDER
                          {stockSortDir === "asc" && stockSortBy === "reorder" ? <ArrowUpAZ size={14} /> : <ArrowDownAZ size={14} />}
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedLowStock.map((row) => (
                      <tr key={row.id}>
                        <td>{row.name}</td>
                        <td>{String(row.currentStockPrimary)}</td>
                        <td>{String(row.reorderLevelPrimary ?? "—")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="panel panel--pad panel-section-top">
            <h3 className="section-title">
              Quick actions
            </h3>
            <div className="quick-actions">
              {quickActions.map((a) => (
                <button key={a.path} type="button" className="primary-btn" onClick={() => navigate(a.path)}>
                  {a.label}
                  <ArrowRight size={16} />
                </button>
              ))}
            </div>
            {quickActions.length === 0 ? (
              <p className="page-desc">No actions available for your role or disabled modules.</p>
            ) : null}
          </section>
        </>
      ) : !error ? (
        <SpinnerBlock label="Loading dashboard" />
      ) : null}
    </main>
  );
}
