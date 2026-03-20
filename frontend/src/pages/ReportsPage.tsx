import axios from "axios";
import { useEffect, useState } from "react";
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
  { id: "refunds", label: "Refunds", endpoint: "/reports/refunds" },
  { id: "expenses", label: "Expenses", endpoint: "/reports/expenses" },
  { id: "audit", label: "Audit", endpoint: "/reports/audit" },
  { id: "quotationConversion", label: "Quotation Conversion", endpoint: "/reports/quotation-conversion" },
  { id: "userActivity", label: "User Activity", endpoint: "/reports/user-activity" },
];

export function ReportsPage() {
  const auth = getAuthState();
  const canViewNonTax = Boolean(auth?.permissions.includes("*") || auth?.permissions.includes("sales.non_tax.view"));
  const availableReports = reportEndpoints.filter((report) => canViewNonTax || report.id !== "nonTaxSales");
  const [selected, setSelected] = useState(availableReports[0] ?? reportEndpoints[0]);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState("");

  async function runReport() {
    if (!auth) return;
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
    }
  }

  useEffect(() => {
    if (!auth) return;
    void runReport();
  }, [selected.id, page]);

  return (
    <main className="content">
      <header className="content-header">
        <div>
          <h1>Reports</h1>
          <p>Run and inspect business reports</p>
        </div>
      </header>
      <section className="panel pad">
        <div className="inline-form">
          <select value={selected.id} onChange={(e) => setSelected(availableReports.find((r) => r.id === e.target.value) ?? availableReports[0])}>
            {availableReports.map((report) => (
              <option key={report.id} value={report.id}>
                {report.label}
              </option>
            ))}
          </select>
          <input placeholder="Search report rows..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <button onClick={runReport}>Run report</button>
          <button onClick={() => setPage((prev) => Math.max(1, prev - 1))}>Prev</button>
          <span>Page {page}</span>
          <button onClick={() => setPage((prev) => prev + 1)}>Next</button>
        </div>
        {error ? <p>{error}</p> : null}
      </section>
      <section className="panel">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Result</th>
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
