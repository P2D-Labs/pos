import axios from "axios";
import { ArrowDownAZ, ArrowUpAZ, BarChart3, Hash, Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { StatCards } from "../components/StatCards";
import { CustomSelect } from "../components/ui/CustomSelect";
import { PaginationBar } from "../components/ui/PaginationBar";
import { SpinnerBlock } from "../components/ui/Spinner";
import { listRangeLabel } from "../lib/listRangeLabel";
import { inferTotalPages } from "../lib/pagination";
import { getAuthState } from "../models/auth";
import { api } from "../services/api";

const reportEndpoints = [
  { id: "dashboard", label: "Dashboard", endpoint: "/reports/dashboard" },
  { id: "taxSales", label: "Tax Sales", endpoint: "/reports/tax-sales" },
  { id: "nonTaxSales", label: "Non-Tax Sales", endpoint: "/reports/non-tax-sales" },
  { id: "salesByItem", label: "Sales by Item", endpoint: "/reports/sales-by-item" },
  { id: "salesByCustomer", label: "Sales by Customer", endpoint: "/reports/sales-by-customer" },
  { id: "purchasesBySupplier", label: "Purchases by Supplier", endpoint: "/reports/purchases-by-supplier" },
  { id: "stockSummary", label: "Stock Summary", endpoint: "/reports/stock-summary" },
  { id: "stockMovement", label: "Stock Movement", endpoint: "/reports/stock-movement" },
  { id: "lowStock", label: "Low Stock", endpoint: "/reports/low-stock" },
  { id: "receivables", label: "Receivables", endpoint: "/reports/receivables" },
  { id: "payables", label: "Payables", endpoint: "/reports/payables" },
  { id: "salesReturns", label: "Sales Returns", endpoint: "/reports/sales-returns" },
  { id: "dailySales", label: "Daily Sales", endpoint: "/reports/daily-sales" },
  { id: "profitSummary", label: "Profit Summary", endpoint: "/reports/profit-summary" },
  { id: "audit", label: "Audit", endpoint: "/reports/audit" },
  { id: "quotationConversion", label: "Quotation Conversion", endpoint: "/reports/quotation-conversion" },
  { id: "userActivity", label: "User Activity", endpoint: "/reports/user-activity" },
];

function summarizeRow(row: Record<string, unknown>) {
  const hidden = new Set(["id", "businessId"]);
  return Object.entries(row)
    .filter(([k, v]) => !hidden.has(k) && v !== null && v !== undefined)
    .slice(0, 4)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
    .join(" | ");
}

export function ReportsPage() {
  const auth = getAuthState();
  const canViewNonTax = Boolean(auth?.permissions.includes("*") || auth?.permissions.includes("sales.non_tax.view"));
  const availableReports = reportEndpoints.filter((report) => canViewNonTax || report.id !== "nonTaxSales");
  const [selected, setSelected] = useState(availableReports[0] ?? reportEndpoints[0]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const totalPages = inferTotalPages(page, pageSize, rows.length);
  const sortedRows = useMemo(() => {
    const cloned = [...rows];
    cloned.sort((a, b) => summarizeRow(a).localeCompare(summarizeRow(b)) * (sortDir === "asc" ? 1 : -1));
    return cloned;
  }, [rows, sortDir]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  async function runReport() {
    if (!auth) return;
    setLoading(true);
    try {
      const response = await api.get(selected.endpoint, {
        params: { search: search || undefined, page, pageSize },
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      const data = response.data.data;
      setRows(Array.isArray(data) ? data : [data]);
      setError("");
    } catch (runError) {
      if (axios.isAxiosError(runError)) setError(runError.response?.data?.message ?? "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!auth) return;
    void runReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runReport closes over search
  }, [selected.id, page, pageSize, auth?.accessToken]);

  return (
    <main className="content">
      <PageHeader title="Reports" subtitle="Run and inspect business reports" />

      <StatCards
        items={[
          { label: "Rows (page)", value: rows.length, icon: BarChart3, tone: "blue" },
          { label: "Page", value: `${page} / ${totalPages}`, icon: Hash, tone: "green" },
          { label: "Report", value: selected.label, icon: Play, tone: "teal" },
        ]}
      />

      <section className="panel panel--pad panel-section">
        <div className="inline-form">
          <CustomSelect
            value={selected.id}
            placeholder="Select report"
            options={availableReports.map((report) => ({ value: report.id, label: report.label }))}
            onChange={(next) => setSelected(availableReports.find((r) => r.id === next) ?? availableReports[0])}
          />
          <div className="search-field">
            <input
              placeholder="Search report rows…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void runReport();
              }}
            />
          </div>
          <button type="button" className="primary-btn" onClick={runReport}>
            <Play size={16} />
            Run
          </button>
        </div>
        {error ? <p className="alert alert-error">{error}</p> : null}
      </section>

      <section className="panel">
        {loading ? (
          <SpinnerBlock label="Running report" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>
                    <button
                      type="button"
                      className="th-sort is-active"
                      onClick={() => setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))}
                    >
                      SUMMARY
                      {sortDir === "asc" ? <ArrowUpAZ size={14} /> : <ArrowDownAZ size={14} />}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.length === 0 ? (
                  <tr>
                    <td className="table-empty">No report rows found for the current filters.</td>
                  </tr>
                ) : (
                  sortedRows.map((row, index) => (
                    <tr key={index}>
                      <td>{summarizeRow(row) || "No data"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <PaginationBar
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          pageSize={pageSize}
          onPageSizeChange={(n) => {
            setPage(1);
            setPageSize(n);
          }}
          rangeLabel={listRangeLabel(page, pageSize, rows.length)}
        />
      </section>
    </main>
  );
}
