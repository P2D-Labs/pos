import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { getAuthState } from "../models/auth";
import { api } from "../services/api";

type ModuleToggleKey =
  | "salesInvoices"
  | "quotations"
  | "purchases"
  | "salesReturns";

const printTargets: {
  id: string;
  label: string;
  format: "html" | "pdf";
  permission: string;
  moduleKey?: ModuleToggleKey;
  endpoint: (value: string) => string;
}[] = [
  {
    id: "invoice",
    label: "Sales Invoice (HTML)",
    format: "html",
    permission: "sales.view",
    moduleKey: "salesInvoices",
    endpoint: (value: string) => `/print/sales-invoices/${value}`,
  },
  {
    id: "return",
    label: "Sales Return (HTML)",
    format: "html",
    permission: "returns.view",
    moduleKey: "salesReturns",
    endpoint: (value: string) => `/print/sales-returns/${value}`,
  },
  {
    id: "returnPdf",
    label: "Sales Return (PDF)",
    format: "pdf",
    permission: "returns.view",
    moduleKey: "salesReturns",
    endpoint: (value: string) => `/print/pdf/sales-returns/${value}`,
  },
  {
    id: "quotation",
    label: "Quotation (HTML)",
    format: "html",
    permission: "sales.view",
    moduleKey: "quotations",
    endpoint: (value: string) => `/print/quotations/${value}`,
  },
  {
    id: "purchase",
    label: "Purchase (HTML)",
    format: "html",
    permission: "purchases.view",
    moduleKey: "purchases",
    endpoint: (value: string) => `/print/purchases/${value}`,
  },
  {
    id: "thermal",
    label: "Thermal Receipt (HTML)",
    format: "html",
    permission: "sales.view",
    moduleKey: "salesInvoices",
    endpoint: (value: string) => `/print/thermal-receipt/${value}`,
  },
  {
    id: "a4Tax",
    label: "A4 Tax Invoice (HTML)",
    format: "html",
    permission: "sales.view",
    moduleKey: "salesInvoices",
    endpoint: (value: string) => `/print/a4-tax-invoice/${value}`,
  },
  {
    id: "a4NonTax",
    label: "A4 Non-Tax Invoice (HTML)",
    format: "html",
    permission: "sales.view",
    moduleKey: "salesInvoices",
    endpoint: (value: string) => `/print/a4-non-tax-invoice/${value}`,
  },
  {
    id: "a4TaxPdf",
    label: "A4 Tax Invoice (PDF)",
    format: "pdf",
    permission: "sales.view",
    moduleKey: "salesInvoices",
    endpoint: (value: string) => `/print/pdf/a4-tax-invoice/${value}`,
  },
  {
    id: "a4NonTaxPdf",
    label: "A4 Non-Tax Invoice (PDF)",
    format: "pdf",
    permission: "sales.view",
    moduleKey: "salesInvoices",
    endpoint: (value: string) => `/print/pdf/a4-non-tax-invoice/${value}`,
  },
  {
    id: "quotationPdf",
    label: "Quotation (PDF)",
    format: "pdf",
    permission: "sales.view",
    moduleKey: "quotations",
    endpoint: (value: string) => `/print/pdf/quotations/${value}`,
  },
  {
    id: "purchasePdf",
    label: "Purchase (PDF)",
    format: "pdf",
    permission: "purchases.view",
    moduleKey: "purchases",
    endpoint: (value: string) => `/print/pdf/purchases/${value}`,
  },
];

export function PrintCenterPage() {
  const auth = getAuthState();
  const [moduleToggles, setModuleToggles] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    async function loadToggles() {
      if (!auth) return;
      try {
        const response = await api.get("/settings/customization", {
          headers: { Authorization: `Bearer ${auth.accessToken}` },
        });
        const raw = response.data?.data?.moduleToggles;
        setModuleToggles(raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, boolean>) : {});
      } catch {
        setModuleToggles({});
      }
    }
    void loadToggles();
  }, [auth]);

  const hasPermission = (permission: string) =>
    Boolean(auth?.permissions.includes("*") || auth?.permissions.includes(permission));
  const canPrintNonTax = Boolean(auth?.permissions.includes("*") || auth?.permissions.includes("sales.non_tax.print"));
  const isModuleOn = (key?: ModuleToggleKey) => {
    if (!key) return true;
    if (!moduleToggles) return true;
    return moduleToggles[key] !== false;
  };

  const availableTargets = useMemo(() => {
    const perms = auth?.permissions ?? [];
    const hp = (p: string) => perms.includes("*") || perms.includes(p);
    const modOn = (key?: ModuleToggleKey) => {
      if (!key) return true;
      if (!moduleToggles) return true;
      return moduleToggles[key] !== false;
    };
    return printTargets.filter((target) => {
      if (!hp(target.permission)) return false;
      if (!modOn(target.moduleKey)) return false;
      if (!canPrintNonTax && target.id.toLowerCase().includes("nontax")) return false;
      return true;
    });
  }, [auth?.permissions, moduleToggles, canPrintNonTax]);

  const canUseReprintSearch = hasPermission("sales.view") && isModuleOn("salesInvoices");

  const [typeId, setTypeId] = useState(printTargets[0].id);
  const [documentId, setDocumentId] = useState("");
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [filterCustomerId, setFilterCustomerId] = useState("");
  const [filterCustomerName, setFilterCustomerName] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterAmountMin, setFilterAmountMin] = useState("");
  const [filterAmountMax, setFilterAmountMax] = useState("");
  const [filterItemId, setFilterItemId] = useState("");
  const [filterItemSearch, setFilterItemSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [html, setHtml] = useState("");
  const [reprintRows, setReprintRows] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState("");

  async function generate() {
    if (!auth || !documentId) return;
    const target = availableTargets.find((entry) => entry.id === typeId) ?? availableTargets[0];
    if (!target) return;
    try {
      if (target.format === "pdf") {
        const response = await api.get(target.endpoint(documentId), {
          headers: { Authorization: `Bearer ${auth.accessToken}` },
          responseType: "blob",
        });
        const blob = new Blob([response.data], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
        setTimeout(() => URL.revokeObjectURL(url), 30_000);
        setHtml("PDF generated and opened in a new tab.");
      } else {
        const response = await api.get(target.endpoint(documentId), {
          headers: { Authorization: `Bearer ${auth.accessToken}` },
        });
        setHtml(String(response.data.data.html ?? ""));
      }
      setError("");
    } catch (printError) {
      if (axios.isAxiosError(printError)) setError(printError.response?.data?.message ?? "Failed to generate print");
    }
  }

  async function reprintSearch() {
    if (!auth || !canUseReprintSearch) return;
    try {
      const response = await api.get("/print/reprint-search", {
        params: {
          search: invoiceSearch || undefined,
          customerId: filterCustomerId || undefined,
          customerName: filterCustomerName || undefined,
          dateFrom: filterDateFrom || undefined,
          dateTo: filterDateTo || undefined,
          grandTotalMin: filterAmountMin === "" ? undefined : Number(filterAmountMin),
          grandTotalMax: filterAmountMax === "" ? undefined : Number(filterAmountMax),
          itemId: filterItemId || undefined,
          itemSearch: filterItemSearch || undefined,
          page,
          pageSize,
        },
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      setReprintRows(response.data.data ?? []);
      setError("");
    } catch (searchError) {
      if (axios.isAxiosError(searchError)) setError(searchError.response?.data?.message ?? "Failed to search reprints");
    }
  }

  useEffect(() => {
    if (!availableTargets.length) return;
    setTypeId((prev) => (availableTargets.some((t) => t.id === prev) ? prev : availableTargets[0].id));
  }, [availableTargets]);

  useEffect(() => {
    if (!auth || !canUseReprintSearch) {
      setReprintRows([]);
      return;
    }
    void reprintSearch();
  }, [page, canUseReprintSearch, auth]);

  return (
    <main className="content">
      <header className="content-header">
        <div>
          <h1>Print / Reprint Center</h1>
          <p>Generate print HTML and search prior invoices</p>
        </div>
      </header>

      <section className="panel pad">
        <h3>Generate print</h3>
        {availableTargets.length === 0 ? (
          <p>No print formats are available for your role or disabled modules. Enable modules in Settings or ask for sales, returns, or purchases view access.</p>
        ) : (
          <div className="inline-form">
            <select value={typeId} onChange={(e) => setTypeId(e.target.value)}>
              {availableTargets.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.label}
                </option>
              ))}
            </select>
            <input
              placeholder="Document ID"
              value={documentId}
              onChange={(e) => setDocumentId(e.target.value)}
            />
            <button onClick={generate} disabled={availableTargets.length === 0}>
              Generate
            </button>
          </div>
        )}
      </section>

      <section className="panel pad">
        <h3>Reprint search</h3>
        {!canUseReprintSearch ? (
          <p>Invoice reprint search requires Sales Invoices module and <code>sales.view</code> permission.</p>
        ) : (
          <div className="stack">
            <div className="inline-form">
              <input
                placeholder="Invoice no. contains..."
                value={invoiceSearch}
                onChange={(e) => setInvoiceSearch(e.target.value)}
              />
              <input
                placeholder="Customer ID (exact)"
                value={filterCustomerId}
                onChange={(e) => setFilterCustomerId(e.target.value)}
              />
              <input
                placeholder="Customer name contains..."
                value={filterCustomerName}
                onChange={(e) => setFilterCustomerName(e.target.value)}
              />
              <input
                type="date"
                title="Invoice date from"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
              />
              <input
                type="date"
                title="Invoice date to"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
              />
            </div>
            <div className="inline-form">
              <input
                placeholder="Min amount"
                type="number"
                value={filterAmountMin}
                onChange={(e) => setFilterAmountMin(e.target.value)}
              />
              <input
                placeholder="Max amount"
                type="number"
                value={filterAmountMax}
                onChange={(e) => setFilterAmountMax(e.target.value)}
              />
              <input
                placeholder="Item ID (line contains)"
                value={filterItemId}
                onChange={(e) => setFilterItemId(e.target.value)}
              />
              <input
                placeholder="Item name / sku / barcode contains..."
                value={filterItemSearch}
                onChange={(e) => setFilterItemSearch(e.target.value)}
              />
              <button
                onClick={() => {
                  setPage(1);
                  void reprintSearch();
                }}
              >
                Search
              </button>
              <button onClick={() => setPage((prev) => Math.max(1, prev - 1))}>Prev</button>
              <span>Page {page}</span>
              <button onClick={() => setPage((prev) => prev + 1)}>Next</button>
            </div>
          </div>
        )}
      </section>

      {error ? <p>{error}</p> : null}

      <section className="panel pad">
        <h3>Generated HTML</h3>
        <code>{html || "No print generated yet."}</code>
      </section>

      {canUseReprintSearch ? (
        <section className="panel">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Mode</th>
                <th>Total</th>
                <th>ID</th>
              </tr>
            </thead>
            <tbody>
              {reprintRows.map((row, index) => (
                <tr key={index}>
                  <td>{index + 1}</td>
                  <td>{String(row.invoiceNo ?? "-")}</td>
                  <td>{String(row.customerId ?? "-")}</td>
                  <td>{String(row.invoiceDate ?? "-")}</td>
                  <td>{String(row.documentTaxMode ?? "-")}</td>
                  <td>{String(row.grandTotal ?? "-")}</td>
                  <td>
                    <code>{String(row.id ?? "-")}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </main>
  );
}
