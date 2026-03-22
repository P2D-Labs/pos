import axios from "axios";
import { Hash, Plus, Undo2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { StatCards } from "../components/StatCards";
import { CustomSelect } from "../components/ui/CustomSelect";
import { FormModal } from "../components/ui/FormModal";
import { PaginationBar } from "../components/ui/PaginationBar";
import { SpinnerBlock } from "../components/ui/Spinner";
import { listRangeLabel } from "../lib/listRangeLabel";
import { inferTotalPages } from "../lib/pagination";
import { getAuthState } from "../models/auth";
import { api } from "../services/api";
import { getOptions } from "../services/document.service";

type ReturnableLine = {
  salesInvoiceLineId: string;
  itemId: string;
  itemName: string;
  soldQuantityPrimary: number;
  alreadyReturnedQuantityPrimary: number;
  returnableQuantityPrimary: number;
};

type SalesReturnRow = {
  id: string;
  salesReturnNo: string;
  sourceInvoiceId: string;
  customerId: string;
  grandTotal: unknown;
  createdAt: string;
};

export function SalesReturnPage() {
  const auth = getAuthState();
  const canCreateReturns = Boolean(auth?.permissions.includes("*") || auth?.permissions.includes("returns.create"));
  const [customers, setCustomers] = useState<Array<{ id: string; label: string }>>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [invoiceOptions, setInvoiceOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [invoiceId, setInvoiceId] = useState("");
  const [lines, setLines] = useState<ReturnableLine[]>([]);
  const [qtyByLineId, setQtyByLineId] = useState<Record<string, string>>({});
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [loadingLines, setLoadingLines] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [listPage, setListPage] = useState(1);
  const listPageSize = 20;
  const [returnRows, setReturnRows] = useState<SalesReturnRow[]>([]);
  const [listLoading, setListLoading] = useState(true);

  const totalListPages = inferTotalPages(listPage, listPageSize, returnRows.length);

  const linePayload = useMemo(() => {
    const out: Array<{ salesInvoiceLineId: string; enteredQuantity: number }> = [];
    for (const line of lines) {
      const raw = qtyByLineId[line.salesInvoiceLineId] ?? "";
      const q = Number(String(raw).replace(/,/g, ""));
      if (!Number.isFinite(q) || q <= 0) continue;
      out.push({ salesInvoiceLineId: line.salesInvoiceLineId, enteredQuantity: q });
    }
    return out;
  }, [lines, qtyByLineId]);

  const lineErrors = useMemo(() => {
    const errs: string[] = [];
    for (const line of lines) {
      const raw = qtyByLineId[line.salesInvoiceLineId] ?? "";
      const q = Number(String(raw).replace(/,/g, ""));
      if (!raw.trim()) continue;
      if (!Number.isFinite(q) || q <= 0) {
        errs.push(`${line.itemName}: invalid quantity`);
        continue;
      }
      if (q > line.returnableQuantityPrimary + 0.0001) {
        errs.push(`${line.itemName}: exceeds returnable (${line.returnableQuantityPrimary})`);
      }
    }
    return errs;
  }, [lines, qtyByLineId]);

  useEffect(() => {
    if (!auth) return;
    void getOptions(auth.accessToken, "/customers").then(setCustomers).catch(() => setCustomers([]));
  }, [auth?.accessToken]);

  async function loadReturnList() {
    if (!auth) return;
    setListLoading(true);
    try {
      const res = await api.get("/sales-returns", {
        params: { page: listPage, pageSize: listPageSize },
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      setReturnRows((res.data.data ?? []) as SalesReturnRow[]);
      setError("");
    } catch (e) {
      if (axios.isAxiosError(e)) setError(e.response?.data?.message ?? "Failed to load returns");
      else setError("Failed to load returns");
    } finally {
      setListLoading(false);
    }
  }

  useEffect(() => {
    void loadReturnList();
  }, [auth?.accessToken, listPage]);

  function resetModal() {
    setCustomerId("");
    setInvoiceOptions([]);
    setInvoiceId("");
    setLines([]);
    setQtyByLineId({});
    setLoadingInvoices(false);
    setLoadingLines(false);
  }

  async function loadInvoicesForCustomer() {
    if (!auth || !customerId) return;
    setLoadingInvoices(true);
    setError("");
    try {
      const res = await api.get("/sales-invoices", {
        params: { customerId, page: 1, pageSize: 200 },
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      const rows = (res.data.data ?? []) as Array<{ id: string; invoiceNo?: string }>;
      setInvoiceOptions(rows.map((r) => ({ value: r.id, label: r.invoiceNo ? `${r.invoiceNo} · ${r.id}` : r.id })));
      setInvoiceId("");
      setLines([]);
      setQtyByLineId({});
    } catch (e) {
      if (axios.isAxiosError(e)) setError(e.response?.data?.message ?? "Failed to load invoices");
      else setError("Failed to load invoices");
    } finally {
      setLoadingInvoices(false);
    }
  }

  async function loadReturnableLines() {
    if (!auth || !invoiceId) return;
    setLoadingLines(true);
    setError("");
    try {
      const res = await api.get(`/sales-invoices/${invoiceId}/returnable-items`, {
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      const data = (res.data.data ?? []) as ReturnableLine[];
      setLines(data);
      const next: Record<string, string> = {};
      for (const row of data) next[row.salesInvoiceLineId] = "";
      setQtyByLineId(next);
    } catch (e) {
      if (axios.isAxiosError(e)) setError(e.response?.data?.message ?? "Failed to load lines");
      else setError("Failed to load lines");
      setLines([]);
      setQtyByLineId({});
    } finally {
      setLoadingLines(false);
    }
  }

  useEffect(() => {
    if (!modalOpen || !invoiceId) return;
    void loadReturnableLines();
  }, [modalOpen, invoiceId]);

  async function submitReturn() {
    if (!auth || !customerId || !invoiceId || linePayload.length === 0) {
      setError("Choose customer, invoice, and at least one line quantity.");
      return;
    }
    if (lineErrors.length > 0) {
      setError(lineErrors[0]);
      return;
    }
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await api.post(
        "/sales-returns",
        {
          sourceInvoiceId: invoiceId,
          customerId,
          lines: linePayload,
        },
        { headers: { Authorization: `Bearer ${auth.accessToken}` } },
      );
      setMessage("Sales return created. Customer store credit updated.");
      setModalOpen(false);
      resetModal();
      await loadReturnList();
    } catch (e) {
      if (axios.isAxiosError(e)) setError(e.response?.data?.message ?? "Failed to create return");
      else setError("Failed to create return");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="content">
      <PageHeader
        title="Sales Returns"
        subtitle="Pick a customer, choose an invoice, enter quantities per line. Credits post to the customer’s store balance — duplicate lines in one request are rejected."
        actions={
          canCreateReturns ? (
            <button
              type="button"
              className="primary-btn"
              onClick={() => {
                resetModal();
                setModalOpen(true);
              }}
            >
              <Plus size={16} />
              <span className="btn-label">New return</span>
            </button>
          ) : null
        }
      />

      <StatCards
        items={[
          { label: "Returns (page)", value: returnRows.length, icon: Undo2, tone: "blue" },
          { label: "Page", value: `${listPage} / ${totalListPages}`, icon: Hash, tone: "green" },
        ]}
      />

      {message ? (
        <section className="panel panel--pad panel-section">
          <p className="alert alert-success">{message}</p>
        </section>
      ) : null}
      {error && !modalOpen ? (
        <section className="panel panel--pad panel-section">
          <p className="alert alert-error">{error}</p>
        </section>
      ) : null}
      {!canCreateReturns ? (
        <section className="panel panel--pad panel-section">
          <p className="badge-muted">Read-only access</p>
        </section>
      ) : null}

      <section className="panel">
        {listLoading ? (
          <SpinnerBlock label="Loading returns" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Return #</th>
                  <th>Customer</th>
                  <th>Source invoice</th>
                  <th>Total</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {returnRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="table-empty">
                      No returns yet.
                    </td>
                  </tr>
                ) : (
                  returnRows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.salesReturnNo}</td>
                      <td>{r.customerId}</td>
                      <td>{r.sourceInvoiceId}</td>
                      <td>{String(r.grandTotal ?? "")}</td>
                      <td>{r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        <PaginationBar
          page={listPage}
          totalPages={totalListPages}
          onPageChange={setListPage}
          rangeLabel={listRangeLabel(listPage, listPageSize, returnRows.length)}
        />
      </section>

      <FormModal
        open={modalOpen}
        title="New sales return"
        confirmLabel="Create return"
        loading={saving}
        onCancel={() => {
          if (!saving) {
            setModalOpen(false);
            resetModal();
          }
        }}
        onConfirm={() => void submitReturn()}
      >
        <div className="stack" style={{ gap: 14 }}>
          {error && modalOpen ? <p className="alert alert-error">{error}</p> : null}
          <div className="form-grid">
            <label>
              Customer
              <CustomSelect
                value={customerId}
                placeholder="Select customer"
                options={customers.map((c) => ({ value: c.id, label: c.label }))}
                onChange={(id) => {
                  setCustomerId(id);
                  setInvoiceId("");
                  setInvoiceOptions([]);
                  setLines([]);
                  setQtyByLineId({});
                }}
                searchable
              />
            </label>
          </div>
          {customerId ? (
            <button type="button" className="btn btn-secondary" disabled={loadingInvoices} onClick={() => void loadInvoicesForCustomer()}>
              {loadingInvoices ? "Loading…" : "Load this customer’s invoices"}
            </button>
          ) : null}
          {invoiceOptions.length > 0 ? (
            <div className="form-grid">
              <label>
                Invoice
                <CustomSelect
                  value={invoiceId}
                  placeholder="Select invoice"
                  options={invoiceOptions}
                  onChange={setInvoiceId}
                  searchable
                />
              </label>
            </div>
          ) : null}
          {loadingLines ? <SpinnerBlock label="Loading invoice lines" /> : null}
          {lines.length > 0 ? (
            <div className="table-wrap" style={{ maxHeight: 320, overflow: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Returnable</th>
                    <th>Qty to return</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.salesInvoiceLineId}>
                      <td>{line.itemName}</td>
                      <td>{line.returnableQuantityPrimary}</td>
                      <td>
                        <input
                          className="input-control"
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="0"
                          value={qtyByLineId[line.salesInvoiceLineId] ?? ""}
                          onChange={(e) =>
                            setQtyByLineId((prev) => ({ ...prev, [line.salesInvoiceLineId]: e.target.value }))
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {lineErrors.length > 0 ? (
            <ul className="page-desc" style={{ color: "var(--danger)", margin: 0 }}>
              {lineErrors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </FormModal>
    </main>
  );
}
