import axios from "axios";
import { useEffect, useState } from "react";
import { getAuthState } from "../models/auth";
import { api } from "../services/api";

type ReturnableLine = {
  salesInvoiceLineId: string;
  itemId: string;
  soldQuantityPrimary: number;
  alreadyReturnedQuantityPrimary: number;
  returnableQuantityPrimary: number;
};

export function SalesReturnPage() {
  const auth = getAuthState();
  const canCreateReturns = Boolean(auth?.permissions.includes("*") || auth?.permissions.includes("returns.create"));
  const [invoiceId, setInvoiceId] = useState("");
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoicePage, setInvoicePage] = useState(1);
  const pageSize = 20;
  const [invoiceOptions, setInvoiceOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [customerId, setCustomerId] = useState("");
  const [returnMethod, setReturnMethod] = useState<"CASH_REFUND" | "EXCHANGE">("CASH_REFUND");
  const [lines, setLines] = useState<ReturnableLine[]>([]);
  const [selectedLineId, setSelectedLineId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const selectedLine = lines.find((line) => line.salesInvoiceLineId === selectedLineId);
  const quantityNumber = Number(quantity || 0);
  const quantityError =
    !selectedLineId
      ? "Select an invoice line"
      : !Number.isFinite(quantityNumber) || quantityNumber <= 0
        ? "Return quantity must be greater than 0"
        : selectedLine && quantityNumber > selectedLine.returnableQuantityPrimary
          ? `Return quantity exceeds allowed (${selectedLine.returnableQuantityPrimary})`
          : "";

  async function searchInvoices() {
    if (!auth) return;
    try {
      const response = await api.get("/sales-invoices", {
        params: {
          search: invoiceSearch || undefined,
          page: invoicePage,
          pageSize,
        },
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      const rows = (response.data.data ?? []) as Array<{ id: string; invoiceNo?: string; customerId?: string }>;
      setInvoiceOptions(
        rows.map((row) => ({
          id: row.id,
          label: row.invoiceNo ? `${row.invoiceNo} (${row.id})` : row.id,
        })),
      );
    } catch (loadError) {
      if (axios.isAxiosError(loadError)) setError(loadError.response?.data?.message ?? "Failed to search invoices");
      else setError("Failed to search invoices");
    }
  }

  async function loadReturnableItems() {
    if (!auth || !invoiceId) return;
    setMessage("");
    setError("");
    try {
      const invoiceResponse = await api.get(`/sales-invoices/${invoiceId}`, {
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      setCustomerId(String(invoiceResponse.data.data.customerId));

      const response = await api.get(`/sales-invoices/${invoiceId}/returnable-items`, {
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      const data = response.data.data as ReturnableLine[];
      setLines(data);
      if (data[0]) setSelectedLineId(data[0].salesInvoiceLineId);
    } catch (loadError) {
      if (axios.isAxiosError(loadError)) setError(loadError.response?.data?.message ?? "Failed to load invoice items");
      else setError("Failed to load invoice items");
    }
  }

  async function submitReturn() {
    if (!auth || !invoiceId || !customerId || !selectedLineId) return;
    if (quantityError) {
      setError(quantityError);
      return;
    }
    setMessage("");
    setError("");
    try {
      await api.post(
        "/sales-returns",
        {
          sourceInvoiceId: invoiceId,
          customerId,
          returnMethod,
          lines: [{ salesInvoiceLineId: selectedLineId, enteredQuantity: Number(quantity || 0) }],
        },
        { headers: { Authorization: `Bearer ${auth.accessToken}` } },
      );
      setMessage("Sales return created");
      await loadReturnableItems();
    } catch (submitError) {
      if (axios.isAxiosError(submitError)) setError(submitError.response?.data?.message ?? "Failed to create return");
      else setError("Failed to create return");
    }
  }

  useEffect(() => {
    if (!auth) return;
    void searchInvoices();
  }, [auth, invoicePage]);

  return (
    <main className="content">
      <header className="content-header">
        <div>
          <h1>Sales Returns</h1>
          <p>Invoice-linked return flow only</p>
        </div>
      </header>

      <section className="panel pad">
        <div className="inline-form">
          <input placeholder="Search invoice no / id" value={invoiceSearch} onChange={(e) => setInvoiceSearch(e.target.value)} />
          <button
            onClick={() => {
              setInvoicePage(1);
              void searchInvoices();
            }}
          >
            Search invoices
          </button>
          <button onClick={() => setInvoicePage((prev) => Math.max(1, prev - 1))}>Prev</button>
          <span>Page {invoicePage}</span>
          <button onClick={() => setInvoicePage((prev) => prev + 1)}>Next</button>
        </div>
        <div className="inline-form" style={{ marginTop: 8 }}>
          <select value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)}>
            <option value="">Select source invoice</option>
            {invoiceOptions.map((invoice) => (
              <option key={invoice.id} value={invoice.id}>
                {invoice.label}
              </option>
            ))}
          </select>
          <button onClick={loadReturnableItems}>Load returnable items</button>
        </div>

        <div className="inline-form" style={{ marginTop: 8 }}>
          <select value={selectedLineId} onChange={(e) => setSelectedLineId(e.target.value)}>
            <option value="">Select line</option>
            {lines.map((line) => (
              <option key={line.salesInvoiceLineId} value={line.salesInvoiceLineId}>
                {line.itemId} (returnable: {line.returnableQuantityPrimary})
              </option>
            ))}
          </select>
          <input
            type="number"
            step="0.01"
            placeholder="Quantity"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          <select
            value={returnMethod}
            onChange={(e) => setReturnMethod(e.target.value as "CASH_REFUND" | "EXCHANGE")}
          >
            <option value="CASH_REFUND">Cash refund</option>
            <option value="EXCHANGE">Exchange</option>
          </select>
          <button onClick={submitReturn} disabled={Boolean(quantityError) || !canCreateReturns}>Create return</button>
        </div>
        {selectedLine ? (
          <p>
            Returnable quantity for selected line: {selectedLine.returnableQuantityPrimary}
          </p>
        ) : null}
        {quantityError ? <p>{quantityError}</p> : null}
        {!canCreateReturns ? <p>You have view-only access for returns.</p> : null}

        {message ? <p>{message}</p> : null}
        {error ? <p>{error}</p> : null}
      </section>

      <section className="panel">
        <table>
          <thead>
            <tr>
              <th>Invoice Line</th>
              <th>Item</th>
              <th>Sold Qty</th>
              <th>Already Returned</th>
              <th>Returnable</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.salesInvoiceLineId}>
                <td>{line.salesInvoiceLineId}</td>
                <td>{line.itemId}</td>
                <td>{line.soldQuantityPrimary}</td>
                <td>{line.alreadyReturnedQuantityPrimary}</td>
                <td>{line.returnableQuantityPrimary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
