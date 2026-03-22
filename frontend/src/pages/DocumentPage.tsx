import axios from "axios";
import { ArrowDownAZ, ArrowUpAZ, FilePlus, Hash, Layers, Plus, Printer, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
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
import type { LineDraft, SelectOption } from "../models/document.model";
import { api } from "../services/api";
import { getOptions } from "../services/document.service";

type DocumentKind = "quotation" | "sales-order" | "sales-invoice" | "purchase";
type ItemMeta = {
  id: string;
  primaryUnitId?: string;
  secondaryUnitId?: string;
};

function resolveUnitId(item: ItemMeta | null, unitType: "PRIMARY" | "SECONDARY") {
  if (!item) return "";
  if (unitType === "PRIMARY") return item.primaryUnitId ?? "";
  return item.secondaryUnitId ?? item.primaryUnitId ?? "";
}

function pick(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && `${value}` !== "") return String(value);
  }
  return "—";
}

async function openPrintHtml(authToken: string, path: string) {
  const res = await api.get(path, { headers: { Authorization: `Bearer ${authToken}` } });
  const html = res.data?.data?.html as string | undefined;
  if (!html) return;
  const w = window.open("", "_blank");
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}

async function openPrintPdf(authToken: string, path: string) {
  const res = await api.get(path, { responseType: "blob", headers: { Authorization: `Bearer ${authToken}` } });
  const blob = new Blob([res.data], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
}

export function DocumentPage({
  title,
  listEndpoint,
  createEndpoint,
  kind,
}: {
  title: string;
  listEndpoint: string;
  createEndpoint: string;
  kind: DocumentKind;
}) {
  const auth = getAuthState();
  const canCreateNonTax = Boolean(auth?.permissions.includes("*") || auth?.permissions.includes("sales.non_tax.create"));
  const canCreateDocument = Boolean(
    auth?.permissions.includes("*") ||
      (kind === "purchase" ? auth?.permissions.includes("purchases.create") : auth?.permissions.includes("sales.create")),
  );
  /** No manual create on these — invoices come from Till/POS; quotations/orders have their own flows. */
  const hideDocumentCreate = kind === "quotation" || kind === "sales-order" || kind === "sales-invoice";
  const showCreateButton = canCreateDocument && !hideDocumentCreate;
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [partyId, setPartyId] = useState("");
  const [taxMode, setTaxMode] = useState<"TAX" | "NON_TAX">("TAX");
  const [amountValue, setAmountValue] = useState("0");
  const [partyOptions, setPartyOptions] = useState<SelectOption[]>([]);
  const [itemOptions, setItemOptions] = useState<SelectOption[]>([]);
  const [itemMetaById, setItemMetaById] = useState<Record<string, ItemMeta>>({});
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [line, setLine] = useState<LineDraft>({
    itemId: "",
    unitType: "PRIMARY",
    unitId: "PRIMARY",
    quantity: 1,
    price: 0,
    discount: 0,
    taxRate: 0,
  });
  const [canEditPrice, setCanEditPrice] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sortBy, setSortBy] = useState<"document" | "party" | "total" | "date" | "status">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const totalPages = inferTotalPages(page, pageSize, rows.length);
  const hasInfoPanel = Boolean(!canCreateDocument || message || error);
  const showPrintActions = kind === "sales-invoice" || kind === "quotation";

  const printThermal = useCallback(
    async (row: Record<string, unknown>) => {
      if (!auth) return;
      const id = String(row.id ?? "");
      if (!id) return;
      try {
        if (kind === "quotation") {
          await openPrintHtml(auth.accessToken, `/print/quotations/${id}`);
        } else {
          await openPrintHtml(auth.accessToken, `/print/thermal-receipt/${id}`);
        }
      } catch {
        /* ignore */
      }
    },
    [auth, kind],
  );

  const printNormal = useCallback(
    async (row: Record<string, unknown>) => {
      if (!auth) return;
      const id = String(row.id ?? "");
      if (!id) return;
      try {
        if (kind === "quotation") {
          await openPrintPdf(auth.accessToken, `/print/pdf/quotations/${id}`);
          return;
        }
        const mode = String(row.documentTaxMode ?? "TAX");
        const path =
          mode === "NON_TAX" ? `/print/a4-non-tax-invoice/${id}` : `/print/a4-tax-invoice/${id}`;
        await openPrintHtml(auth.accessToken, path);
      } catch {
        /* ignore */
      }
    },
    [auth, kind],
  );
  const sortedRows = useMemo(() => {
    const cloned = [...rows];
    cloned.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const docA = pick(a, ["invoiceNo", "orderNo", "quotationNo", "purchaseNo", "id"]);
      const docB = pick(b, ["invoiceNo", "orderNo", "quotationNo", "purchaseNo", "id"]);
      const partyA = pick(a, ["customerName", "supplierName", "customerId", "supplierId"]);
      const partyB = pick(b, ["customerName", "supplierName", "customerId", "supplierId"]);
      const totalA = Number(pick(a, ["grandTotal", "netTotal", "total", "amountPaid", "amountReceived"]).replace(/[^\d.-]/g, ""));
      const totalB = Number(pick(b, ["grandTotal", "netTotal", "total", "amountPaid", "amountReceived"]).replace(/[^\d.-]/g, ""));
      const dateA = new Date(pick(a, ["invoiceDate", "orderDate", "quotationDate", "purchaseDate", "createdAt"])).getTime();
      const dateB = new Date(pick(b, ["invoiceDate", "orderDate", "quotationDate", "purchaseDate", "createdAt"])).getTime();
      const statusA = pick(a, ["status", "documentTaxMode"]);
      const statusB = pick(b, ["status", "documentTaxMode"]);
      if (sortBy === "document") return docA.localeCompare(docB) * dir;
      if (sortBy === "party") return partyA.localeCompare(partyB) * dir;
      if (sortBy === "total") return ((Number.isFinite(totalA) ? totalA : 0) - (Number.isFinite(totalB) ? totalB : 0)) * dir;
      if (sortBy === "status") return statusA.localeCompare(statusB) * dir;
      return (dateA - dateB) * dir;
    });
    return cloned;
  }, [rows, sortBy, sortDir]);

  function toggleSort(next: "document" | "party" | "total" | "date" | "status") {
    if (sortBy === next) setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    else {
      setSortBy(next);
      setSortDir(next === "date" || next === "total" ? "desc" : "asc");
    }
  }

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  async function load() {
    if (!auth) return;
    setLoading(true);
    try {
      const [listResponse, parties, items] = await Promise.all([
        api.get(listEndpoint, {
          params: {
            search: search || undefined,
            page,
            pageSize,
            documentTaxMode: kind === "sales-order" || kind === "sales-invoice" ? taxMode : undefined,
          },
          headers: { Authorization: `Bearer ${auth.accessToken}` },
        }),
        getOptions(auth.accessToken, kind === "purchase" ? "/suppliers" : "/customers"),
        getOptions(auth.accessToken, "/items"),
      ]);
      setRows(listResponse.data.data ?? []);
      setPartyOptions(parties);
      setItemOptions(items);
      setError("");
    } catch {
      setError("Failed to load page data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!auth) return;
    void load();
  }, [auth?.accessToken, listEndpoint, kind, page, pageSize, taxMode]);

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!auth || !partyId || !line.itemId) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const payload =
        kind === "purchase"
          ? {
              supplierId: partyId,
              amountPaid: Number(amountValue || 0),
              lines: [
                {
                  itemId: line.itemId,
                  enteredQuantity: line.quantity,
                  unitType: line.unitType,
                  unitId: line.unitId,
                  unitCost: line.price,
                  taxRate: line.taxRate,
                },
              ],
            }
          : {
              customerId: partyId,
              ...(kind !== "quotation" ? { documentTaxMode: taxMode } : {}),
              ...(kind === "sales-invoice" ? { amountReceived: Number(amountValue || 0) } : {}),
              lines: [
                {
                  itemId: line.itemId,
                  enteredQuantity: line.quantity,
                  unitType: line.unitType,
                  unitId: line.unitId,
                  unitPrice: line.price,
                  discountAmount: line.discount,
                  taxRate: line.taxRate,
                },
              ],
            };

      await api.post(createEndpoint, { ...payload }, {
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      setMessage("Document created successfully.");
      setFormOpen(false);
      setConfirmOpen(false);
      await load();
    } catch (submitError) {
      if (axios.isAxiosError(submitError)) setError(submitError.response?.data?.message ?? "Failed to create document.");
      else setError("Failed to create document.");
    } finally {
      setSaving(false);
    }
  }

  async function handleItemChange(nextItemId: string) {
    if (!auth || !nextItemId) {
      setLine((prev) => ({ ...prev, itemId: nextItemId }));
      return;
    }
    let itemMeta: ItemMeta | undefined = itemMetaById[nextItemId];
    if (!itemMeta) {
      try {
        const itemResponse = await api.get(`/items/${nextItemId}`, {
          headers: { Authorization: `Bearer ${auth.accessToken}` },
        });
        const loadedMeta = itemResponse.data?.data as ItemMeta | undefined;
        if (loadedMeta) {
          itemMeta = loadedMeta;
          setItemMetaById((prev) => ({ ...prev, [nextItemId]: loadedMeta }));
        }
      } catch {
        itemMeta = undefined;
      }
    }
    const resolvedUnitId = resolveUnitId(itemMeta ?? null, line.unitType);
    setLine((prev) => ({ ...prev, itemId: nextItemId, unitId: resolvedUnitId || prev.unitId }));
    if (!auth || !nextItemId || kind === "purchase") return;
    try {
      const response = await api.get(`/items/${nextItemId}/resolved-price`, {
        params: { unitType: line.unitType, unitId: resolvedUnitId || line.unitId },
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      const data = response.data?.data;
      setLine((prev) => ({ ...prev, price: Number(data?.price ?? prev.price) }));
      setCanEditPrice(Boolean(data?.canEdit));
    } catch {
      // keep form usable if price resolve fails
    }
  }

  return (
    <main className="content">
      <PageHeader
        title={title}
        subtitle="Search and browse recent documents"
        actions={
          showCreateButton ? (
            <button type="button" className="primary-btn" onClick={() => setFormOpen(true)}>
              <Plus size={16} />
              <span className="btn-label">Create</span>
            </button>
          ) : null
        }
      />

      <StatCards
        items={[
          { label: "Rows (page)", value: rows.length, icon: FilePlus, tone: "blue" },
          { label: "Page", value: `${page} / ${totalPages}`, icon: Hash, tone: "green" },
          { label: "Tax mode", value: kind === "purchase" || kind === "quotation" ? "—" : taxMode, icon: Layers, tone: "teal" },
        ]}
      />

      {hasInfoPanel ? (
        <section className="panel panel--pad panel-section">
          {!canCreateDocument ? <span className="badge-muted">Read-only access</span> : null}
          {message ? <p className="alert alert-success">{message}</p> : null}
          {error ? <p className="alert alert-error">{error}</p> : null}
        </section>
      ) : null}

      <FormModal
        open={formOpen && showCreateButton}
        title={`Create ${title}`}
        confirmLabel={saving ? "Saving…" : "Review"}
        loading={saving}
        onCancel={() => setFormOpen(false)}
        onConfirm={() => setConfirmOpen(true)}
      >
        <form className="stack" onSubmit={(e) => e.preventDefault()}>
          <h3 className="form-section-title">DOCUMENT DETAILS</h3>
          <div className="form-grid">
            <label>
              {kind === "purchase" ? "Supplier" : "Customer"}
              <CustomSelect
                value={partyId}
                placeholder={kind === "purchase" ? "Select supplier" : "Select customer"}
                options={partyOptions.map((option) => ({ value: option.id, label: option.label }))}
                onChange={setPartyId}
                searchable
              />
            </label>
            {kind !== "quotation" && kind !== "purchase" ? (
              <label>
                Tax Mode
                <CustomSelect
                  value={taxMode}
                  placeholder="Select tax mode"
                  options={[
                    { value: "TAX", label: "TAX" },
                    ...(canCreateNonTax ? [{ value: "NON_TAX", label: "NON_TAX" }] : []),
                  ]}
                  onChange={(next) => setTaxMode(next as "TAX" | "NON_TAX")}
                />
              </label>
            ) : null}
            <label>
              Item
              <CustomSelect
                value={line.itemId}
                placeholder="Select item"
                options={itemOptions.map((option) => ({ value: option.id, label: option.label }))}
                onChange={(next) => void handleItemChange(next)}
                searchable
              />
            </label>
            <label>
              Unit Type
              <CustomSelect
                value={line.unitType}
                placeholder="Select unit type"
                options={[
                  { value: "PRIMARY", label: "PRIMARY" },
                  { value: "SECONDARY", label: "SECONDARY" },
                ]}
                onChange={(next) => {
                  const nextUnitType = next as "PRIMARY" | "SECONDARY";
                  const currentMeta = itemMetaById[line.itemId] ?? null;
                  const nextUnitId = resolveUnitId(currentMeta, nextUnitType);
                  setLine((prev) => ({
                    ...prev,
                    unitType: nextUnitType,
                    unitId: nextUnitId || prev.unitId,
                  }));
                }}
              />
            </label>
            <label>
              Quantity
              <input
                type="number"
                step="0.01"
                value={line.quantity}
                onChange={(e) => setLine((prev) => ({ ...prev, quantity: Number(e.target.value || 0) }))}
              />
            </label>
            <label>
              {kind === "purchase" ? "Unit Cost" : "Unit Price"}
              <input
                type="number"
                step="0.01"
                value={line.price}
                disabled={kind !== "purchase" && !canEditPrice}
                onChange={(e) => setLine((prev) => ({ ...prev, price: Number(e.target.value || 0) }))}
              />
            </label>
            <label>
              Discount
              <input
                type="number"
                step="0.01"
                value={line.discount}
                onChange={(e) => setLine((prev) => ({ ...prev, discount: Number(e.target.value || 0) }))}
              />
            </label>
            <label>
              Tax %
              <input
                type="number"
                step="0.01"
                value={line.taxRate}
                onChange={(e) => setLine((prev) => ({ ...prev, taxRate: Number(e.target.value || 0) }))}
              />
            </label>
            {kind === "sales-invoice" || kind === "purchase" ? (
              <label>
                {kind === "sales-invoice" ? "Amount Received" : "Amount Paid"}
                <input type="number" step="0.01" value={amountValue} onChange={(e) => setAmountValue(e.target.value)} />
              </label>
            ) : null}
          </div>
          {kind !== "purchase" && !canEditPrice ? <span className="badge-muted">Price locked</span> : null}
        </form>
      </FormModal>
      <ConfirmModal
        open={confirmOpen && showCreateButton}
        title={`Create ${title}?`}
        message="This will post the transaction to your books."
        confirmLabel="Create"
        loading={saving}
        onCancel={() => {
          setConfirmOpen(false);
          setFormOpen(true);
        }}
        onConfirm={() => void submit()}
      />

      <section className="panel">
        <div className="panel-toolbar">
          <div className="search-field">
            <Search size={18} />
            <input
              placeholder="Search documents…"
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
                    <button type="button" className={`th-sort${sortBy === "document" ? " is-active" : ""}`} onClick={() => toggleSort("document")}>
                      DOCUMENT
                      {sortDir === "asc" && sortBy === "document" ? <ArrowUpAZ size={14} /> : <ArrowDownAZ size={14} />}
                    </button>
                  </th>
                  <th>
                    <button type="button" className={`th-sort${sortBy === "party" ? " is-active" : ""}`} onClick={() => toggleSort("party")}>
                      PARTY
                      {sortDir === "asc" && sortBy === "party" ? <ArrowUpAZ size={14} /> : <ArrowDownAZ size={14} />}
                    </button>
                  </th>
                  <th>
                    <button type="button" className={`th-sort${sortBy === "total" ? " is-active" : ""}`} onClick={() => toggleSort("total")}>
                      TOTAL
                      {sortDir === "asc" && sortBy === "total" ? <ArrowUpAZ size={14} /> : <ArrowDownAZ size={14} />}
                    </button>
                  </th>
                  <th>
                    <button type="button" className={`th-sort${sortBy === "date" ? " is-active" : ""}`} onClick={() => toggleSort("date")}>
                      DATE
                      {sortDir === "asc" && sortBy === "date" ? <ArrowUpAZ size={14} /> : <ArrowDownAZ size={14} />}
                    </button>
                  </th>
                  <th>
                    <button type="button" className={`th-sort${sortBy === "status" ? " is-active" : ""}`} onClick={() => toggleSort("status")}>
                      STATUS
                      {sortDir === "asc" && sortBy === "status" ? <ArrowUpAZ size={14} /> : <ArrowDownAZ size={14} />}
                    </button>
                  </th>
                  {showPrintActions ? (
                    <th>Print</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={showPrintActions ? 6 : 5} className="table-empty">No documents found for the current filters.</td>
                  </tr>
                ) : (
                  sortedRows.map((row, index) => (
                    <tr key={index}>
                      <td>{pick(row, ["invoiceNo", "orderNo", "quotationNo", "purchaseNo", "id"])}</td>
                      <td>{pick(row, ["customerName", "supplierName", "customerId", "supplierId"])}</td>
                      <td>{pick(row, ["grandTotal", "netTotal", "total", "amountPaid", "amountReceived"])}</td>
                      <td>{pick(row, ["invoiceDate", "orderDate", "quotationDate", "purchaseDate", "createdAt"])}</td>
                      <td>{pick(row, ["status", "documentTaxMode"])}</td>
                      {showPrintActions ? (
                        <td>
                          <div className="inline-form" style={{ gap: 6 }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              title={kind === "quotation" ? "HTML preview" : "Thermal receipt"}
                              onClick={() => void printThermal(row)}
                            >
                              <Printer size={14} />
                              {kind === "quotation" ? " HTML" : " Thermal"}
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              title={kind === "quotation" ? "PDF" : "A4 invoice"}
                              onClick={() => void printNormal(row)}
                            >
                              <Printer size={14} />
                              {kind === "quotation" ? " PDF" : " A4"}
                            </button>
                          </div>
                        </td>
                      ) : null}
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
