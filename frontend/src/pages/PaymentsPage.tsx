import axios from "axios";
import { ArrowDownAZ, ArrowUpAZ, CreditCard, Hash, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { StatCards } from "../components/StatCards";
import { ConfirmModal } from "../components/ui/ConfirmModal";
import { CustomSelect } from "../components/ui/CustomSelect";
import { FormModal } from "../components/ui/FormModal";
import { PaginationBar } from "../components/ui/PaginationBar";
import { SpinnerBlock } from "../components/ui/Spinner";
import { listRangeLabel } from "../lib/listRangeLabel";
import { inferTotalPages } from "../lib/pagination";
import { getAuthState } from "../models/auth";
import { api } from "../services/api";
import { getOptions } from "../services/document.service";

type OpenInvoice = {
  id: string;
  invoiceNo: string;
  grandTotal: number;
  amountReceived: number;
  balanceDue: number;
};

export function PaymentsPage() {
  const auth = getAuthState();
  const canCreatePayments = Boolean(auth?.permissions.includes("*") || auth?.permissions.includes("payments.create"));
  const [customers, setCustomers] = useState<Array<{ id: string; label: string }>>([]);
  const [customerId, setCustomerId] = useState("");
  const [method, setMethod] = useState("CASH");
  const [amountTendered, setAmountTendered] = useState("");
  const [openInvoices, setOpenInvoices] = useState<OpenInvoice[]>([]);
  const [allocByInvoiceId, setAllocByInvoiceId] = useState<Record<string, string>>({});
  const [loadingOpen, setLoadingOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [sortBy, setSortBy] = useState<"reference" | "date" | "amount" | "method">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const totalPages = inferTotalPages(page, pageSize, rows.length);
  const hasInfoPanel = Boolean(message || error || !canCreatePayments);
  const sortedRows = useMemo(() => {
    const cloned = [...rows];
    cloned.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortBy === "reference") {
        const av = `${String(a.referenceType ?? "")}/${String(a.referenceId ?? "")}`;
        const bv = `${String(b.referenceType ?? "")}/${String(b.referenceId ?? "")}`;
        return av.localeCompare(bv) * dir;
      }
      if (sortBy === "amount") {
        const av = Number(a.amount ?? a.paidAmount ?? 0);
        const bv = Number(b.amount ?? b.paidAmount ?? 0);
        return (av - bv) * dir;
      }
      if (sortBy === "method") {
        const av = String(a.method ?? "");
        const bv = String(b.method ?? "");
        return av.localeCompare(bv) * dir;
      }
      const av = new Date(String(a.createdAt ?? a.paymentDate ?? 0)).getTime();
      const bv = new Date(String(b.createdAt ?? b.paymentDate ?? 0)).getTime();
      return (av - bv) * dir;
    });
    return cloned;
  }, [rows, sortBy, sortDir]);

  const sumAllocated = useMemo(() => {
    let s = 0;
    for (const inv of openInvoices) {
      const n = Number(String(allocByInvoiceId[inv.id] ?? "").replace(/,/g, ""));
      if (Number.isFinite(n) && n > 0) s += n;
    }
    return s;
  }, [openInvoices, allocByInvoiceId]);

  const tenderNum = Number(String(amountTendered).replace(/,/g, ""));
  const changePreview = Number.isFinite(tenderNum) ? Math.max(0, tenderNum - sumAllocated) : 0;

  function toggleSort(next: "reference" | "date" | "amount" | "method") {
    if (sortBy === next) setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    else {
      setSortBy(next);
      setSortDir(next === "method" || next === "reference" ? "asc" : "desc");
    }
  }

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    if (!auth) return;
    void getOptions(auth.accessToken, "/customers").then(setCustomers).catch(() => setCustomers([]));
  }, [auth?.accessToken]);

  async function load() {
    if (!auth) return;
    setLoading(true);
    try {
      const response = await api.get("/payments", {
        params: { search: search || undefined, page, pageSize },
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      setRows(response.data.data ?? []);
      setError("");
    } catch (loadError) {
      if (axios.isAxiosError(loadError)) setError(loadError.response?.data?.message ?? "Failed to load payments");
      else setError("Failed to load payments");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!auth) return;
    void load();
  }, [auth?.accessToken, page, pageSize]);

  async function loadOpenInvoices() {
    if (!auth || !customerId) return;
    setLoadingOpen(true);
    setError("");
    try {
      const res = await api.get("/sales-invoices", {
        params: { customerId, openOnly: true, page: 1, pageSize: 200 },
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      const raw = (res.data.data ?? []) as Array<{
        id: string;
        invoiceNo: string;
        grandTotal: unknown;
        amountReceived: unknown;
        balanceDue: unknown;
      }>;
      const mapped: OpenInvoice[] = raw.map((r) => ({
        id: r.id,
        invoiceNo: r.invoiceNo,
        grandTotal: Number(r.grandTotal ?? 0),
        amountReceived: Number(r.amountReceived ?? 0),
        balanceDue: Number(r.balanceDue ?? 0),
      }));
      setOpenInvoices(mapped);
      const next: Record<string, string> = {};
      for (const inv of mapped) next[inv.id] = "";
      setAllocByInvoiceId(next);
    } catch (e) {
      if (axios.isAxiosError(e)) setError(e.response?.data?.message ?? "Failed to load open invoices");
      else setError("Failed to load open invoices");
      setOpenInvoices([]);
      setAllocByInvoiceId({});
    } finally {
      setLoadingOpen(false);
    }
  }

  useEffect(() => {
    if (!formOpen || !customerId) return;
    void loadOpenInvoices();
  }, [formOpen, customerId]);

  function resetPaymentForm() {
    setCustomerId("");
    setMethod("CASH");
    setAmountTendered("");
    setOpenInvoices([]);
    setAllocByInvoiceId({});
  }

  function validateAllocations(): string | null {
    if (!customerId) return "Select a customer";
    if (!Number.isFinite(tenderNum) || tenderNum < 0) return "Enter amount tendered";
    if (tenderNum + 0.0001 < sumAllocated) return "Allocated total cannot exceed amount tendered";
    if (sumAllocated <= 0) return "Allocate at least one invoice";
    for (const inv of openInvoices) {
      const raw = allocByInvoiceId[inv.id] ?? "";
      const n = Number(String(raw).replace(/,/g, ""));
      if (!raw.trim() || n <= 0) continue;
      if (!Number.isFinite(n)) return `Invalid amount for ${inv.invoiceNo}`;
      if (n - inv.balanceDue > 0.0001) return `Amount for ${inv.invoiceNo} exceeds balance due`;
    }
    if (method === "STORE_CREDIT") {
      // backend validates store credit vs allocations
    }
    return null;
  }

  async function submit() {
    if (!auth) return;
    const err = validateAllocations();
    if (err) {
      setError(err);
      return;
    }
    const allocations = openInvoices
      .map((inv) => {
        const n = Number(String(allocByInvoiceId[inv.id] ?? "").replace(/,/g, ""));
        if (!Number.isFinite(n) || n <= 0) return null;
        return { salesInvoiceId: inv.id, amount: n };
      })
      .filter((x): x is { salesInvoiceId: string; amount: number } => x !== null);
    if (allocations.length === 0) {
      setError("Enter amounts against at least one invoice.");
      return;
    }
    setSaving(true);
    try {
      await api.post(
        "/payments/customer-invoice-batch",
        {
          customerId,
          method,
          amountTendered: tenderNum,
          allocations,
        },
        { headers: { Authorization: `Bearer ${auth.accessToken}` } },
      );
      setMessage(
        changePreview > 0.0001
          ? `Payment recorded. Change not stored as credit: ${changePreview.toFixed(2)}`
          : "Payment recorded.",
      );
      setError("");
      setConfirmOpen(false);
      setFormOpen(false);
      resetPaymentForm();
      await load();
    } catch (submitError) {
      if (axios.isAxiosError(submitError)) setError(submitError.response?.data?.message ?? "Failed to save payment.");
      else setError("Failed to save payment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="content">
      <PageHeader
        title="Payments"
        subtitle="Create payment: choose customer, enter tender, split across unpaid or partially paid invoices. Any change is settled immediately and is not saved as customer credit."
        actions={
          canCreatePayments ? (
            <button
              type="button"
              className="primary-btn"
              onClick={() => {
                resetPaymentForm();
                setFormOpen(true);
              }}
            >
              <Plus size={16} />
              <span className="btn-label">Create Payment</span>
            </button>
          ) : null
        }
      />

      <StatCards
        items={[
          { label: "Rows (page)", value: rows.length, icon: CreditCard, tone: "blue" },
          { label: "Page", value: `${page} / ${totalPages}`, icon: Hash, tone: "green" },
        ]}
      />

      {hasInfoPanel ? (
        <section className="panel panel--pad panel-section">
          {message ? <p className="alert alert-success">{message}</p> : null}
          {!canCreatePayments ? <p className="badge-muted">Read-only access</p> : null}
          {error ? <p className="alert alert-error">{error}</p> : null}
        </section>
      ) : null}
      <FormModal
        open={formOpen}
        title="Record customer payment"
        confirmLabel="Review"
        loading={saving}
        onCancel={() => {
          if (!saving) {
            setFormOpen(false);
            resetPaymentForm();
          }
        }}
        onConfirm={() => {
          const err = validateAllocations();
          if (err) {
            setError(err);
            return;
          }
          setConfirmOpen(true);
        }}
      >
        <div className="stack" style={{ gap: 14 }}>
          <h3 className="form-section-title">Customer & tender</h3>
          <div className="form-grid">
            <label>
              Customer
              <CustomSelect
                value={customerId}
                placeholder="Select customer"
                options={customers.map((c) => ({ value: c.id, label: c.label }))}
                onChange={setCustomerId}
                searchable
              />
            </label>
            <label>
              Method
              <CustomSelect
                value={method}
                placeholder="Select method"
                options={[
                  { value: "CASH", label: "CASH" },
                  { value: "CARD", label: "CARD" },
                  { value: "BANK_TRANSFER", label: "BANK_TRANSFER" },
                  { value: "WALLET", label: "WALLET" },
                  { value: "CHEQUE", label: "CHEQUE" },
                  { value: "STORE_CREDIT", label: "STORE_CREDIT" },
                ]}
                onChange={setMethod}
              />
            </label>
            <label>
              Amount tendered
              <input
                className="input-control"
                type="number"
                step="0.01"
                min={0}
                value={amountTendered}
                onChange={(e) => setAmountTendered(e.target.value)}
                placeholder="0"
              />
            </label>
          </div>
          {customerId ? (
            loadingOpen ? (
              <SpinnerBlock label="Loading open invoices" />
            ) : openInvoices.length === 0 ? (
              <p className="page-desc">No open invoices for this customer.</p>
            ) : (
              <>
                <h3 className="form-section-title">Allocate to invoices</h3>
                <div className="table-wrap" style={{ maxHeight: 280, overflow: "auto" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Invoice</th>
                        <th>Balance due</th>
                        <th>Pay now</th>
                      </tr>
                    </thead>
                    <tbody>
                      {openInvoices.map((inv) => (
                        <tr key={inv.id}>
                          <td>{inv.invoiceNo}</td>
                          <td>{inv.balanceDue.toFixed(2)}</td>
                          <td>
                            <input
                              className="input-control"
                              type="number"
                              step="0.01"
                              min={0}
                              placeholder="0"
                              value={allocByInvoiceId[inv.id] ?? ""}
                              onChange={(e) =>
                                setAllocByInvoiceId((prev) => ({ ...prev, [inv.id]: e.target.value }))
                              }
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="page-desc">
                  Allocated: <strong>{sumAllocated.toFixed(2)}</strong>
                  {" · "}
                  Change (not stored): <strong>{changePreview.toFixed(2)}</strong>
                </p>
              </>
            )
          ) : null}
        </div>
      </FormModal>

      <section className="panel">
        <div className="panel-toolbar">
          <div className="search-field">
            <Search size={18} />
            <input
              placeholder="Search payments…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setPage(1);
                  void load();
                }
              }}
            />
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setPage(1);
              void load();
            }}
          >
            <Search size={16} />
            <span className="btn-label">Search</span>
          </button>
        </div>
        {loading ? (
          <SpinnerBlock />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>
                    <button type="button" className={`th-sort${sortBy === "reference" ? " is-active" : ""}`} onClick={() => toggleSort("reference")}>
                      REFERENCE
                      {sortDir === "asc" && sortBy === "reference" ? <ArrowUpAZ size={14} /> : <ArrowDownAZ size={14} />}
                    </button>
                  </th>
                  <th>
                    <button type="button" className={`th-sort${sortBy === "method" ? " is-active" : ""}`} onClick={() => toggleSort("method")}>
                      METHOD
                      {sortDir === "asc" && sortBy === "method" ? <ArrowUpAZ size={14} /> : <ArrowDownAZ size={14} />}
                    </button>
                  </th>
                  <th>
                    <button type="button" className={`th-sort${sortBy === "amount" ? " is-active" : ""}`} onClick={() => toggleSort("amount")}>
                      AMOUNT
                      {sortDir === "asc" && sortBy === "amount" ? <ArrowUpAZ size={14} /> : <ArrowDownAZ size={14} />}
                    </button>
                  </th>
                  <th>
                    <button type="button" className={`th-sort${sortBy === "date" ? " is-active" : ""}`} onClick={() => toggleSort("date")}>
                      DATE
                      {sortDir === "asc" && sortBy === "date" ? <ArrowUpAZ size={14} /> : <ArrowDownAZ size={14} />}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="table-empty">
                      No payments found for the current filters.
                    </td>
                  </tr>
                ) : (
                  sortedRows.map((row, index) => (
                    <tr key={index}>
                      <td>
                        {String(row.referenceType ?? "-")} / {String(row.referenceId ?? "-")}
                      </td>
                      <td>{String(row.method ?? "-")}</td>
                      <td>{String(row.amount ?? row.paidAmount ?? "-")}</td>
                      <td>{String(row.createdAt ?? row.paymentDate ?? "-")}</td>
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
      <ConfirmModal
        open={confirmOpen}
        title="Post payment?"
        message={`Allocate ${sumAllocated.toFixed(2)} across invoices. Tender ${tenderNum.toFixed(2)}. Change ${changePreview.toFixed(2)} is not stored as credit.`}
        confirmLabel="Create Payment"
        loading={saving}
        onCancel={() => {
          setConfirmOpen(false);
          setFormOpen(true);
        }}
        onConfirm={() => void submit()}
      />
    </main>
  );
}
