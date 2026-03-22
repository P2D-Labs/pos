import axios from "axios";
import { ArrowDownAZ, ArrowUpAZ, ArrowDownToLine, ArrowUpFromLine, Boxes, Plus, Search } from "lucide-react";
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

type ItemMeta = {
  id: string;
  primaryUnitId?: string;
};

export function InventoryPage() {
  const auth = getAuthState();
  const canAdjustInventory = Boolean(auth?.permissions.includes("*") || auth?.permissions.includes("inventory.adjust"));
  const canViewInventory = Boolean(auth?.permissions.includes("*") || auth?.permissions.includes("inventory.view"));
  const [itemId, setItemId] = useState("");
  const [direction, setDirection] = useState<"IN" | "OUT">("IN");
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [itemOptions, setItemOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [itemMetaById, setItemMetaById] = useState<Record<string, ItemMeta>>({});
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState<"item" | "reference" | "date" | "quantity" | "direction">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const totalPages = inferTotalPages(page, pageSize, rows.length);
  const hasInfoPanel = Boolean(message || error || !canAdjustInventory);

  const sortedRows = useMemo(() => {
    const cloned = [...rows];
    cloned.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortBy === "item") {
        const av = String(a.itemName ?? a.itemId ?? "");
        const bv = String(b.itemName ?? b.itemId ?? "");
        return av.localeCompare(bv) * dir;
      }
      if (sortBy === "reference") {
        const av = `${String(a.sourceType ?? "")}/${String(a.sourceId ?? "")}`;
        const bv = `${String(b.sourceType ?? "")}/${String(b.sourceId ?? "")}`;
        return av.localeCompare(bv) * dir;
      }
      if (sortBy === "quantity") {
        const av = Number(a.quantityPrimary ?? a.enteredQuantity ?? a.quantity ?? 0);
        const bv = Number(b.quantityPrimary ?? b.enteredQuantity ?? b.quantity ?? 0);
        return (av - bv) * dir;
      }
      if (sortBy === "direction") {
        const av = String(a.direction ?? "");
        const bv = String(b.direction ?? "");
        return av.localeCompare(bv) * dir;
      }
      const av = new Date(String(a.transactionDate ?? a.createdAt ?? 0)).getTime();
      const bv = new Date(String(b.transactionDate ?? b.createdAt ?? 0)).getTime();
      return (av - bv) * dir;
    });
    return cloned;
  }, [rows, sortBy, sortDir]);

  function toggleSort(next: "item" | "reference" | "date" | "quantity" | "direction") {
    if (sortBy === next) setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    else {
      setSortBy(next);
      setSortDir(next === "direction" || next === "item" || next === "reference" ? "asc" : "desc");
    }
  }

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  async function load() {
    if (!auth || !canViewInventory) return;
    setLoading(true);
    try {
      const response = await api.get("/stock-transactions", {
        params: { search: search || undefined, page, pageSize },
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      setRows(response.data.data ?? []);
      const opts = await getOptions(auth.accessToken, "/items");
      setItemOptions(opts);
      setError("");
    } catch (loadError) {
      if (axios.isAxiosError(loadError)) setError(loadError.response?.data?.message ?? "Failed to load stock transactions");
      else setError("Failed to load stock transactions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!auth || !canViewInventory) return;
    void load();
  }, [auth?.accessToken, page, pageSize]);

  async function submitAdjustment() {
    if (!auth || !itemId || !canAdjustInventory) return;
    setSaving(true);
    try {
      let itemMeta = itemMetaById[itemId];
      if (!itemMeta) {
        const itemResponse = await api.get(`/items/${itemId}`, {
          headers: { Authorization: `Bearer ${auth.accessToken}` },
        });
        itemMeta = itemResponse.data?.data as ItemMeta;
        if (itemMeta) setItemMetaById((prev) => ({ ...prev, [itemId]: itemMeta }));
      }
      const unitId = itemMeta?.primaryUnitId;
      if (!unitId) {
        setError("Primary unit is not configured for this item");
        setSaving(false);
        return;
      }
      await api.post(
        "/stock-adjustments",
        {
          itemId,
          enteredQuantity: Number(quantity || 0),
          unitType: "PRIMARY",
          unitId,
          direction,
          note,
        },
        { headers: { Authorization: `Bearer ${auth.accessToken}` } },
      );
      setMessage("Stock adjustment saved");
      setError("");
      setConfirmOpen(false);
      setFormOpen(false);
      await load();
    } catch (adjustError) {
      if (axios.isAxiosError(adjustError)) setError(adjustError.response?.data?.message ?? "Failed to save stock adjustment.");
      else setError("Failed to save stock adjustment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="content">
      <PageHeader
        title="Inventory Adjustment"
        subtitle="Manual stock in / out"
        actions={
          <button type="button" className="primary-btn" onClick={() => setFormOpen(true)}>
            <Plus size={16} />
            <span className="btn-label">Create Adjustment</span>
          </button>
        }
      />

      <StatCards
        items={[
          {
            label: "Direction",
            value: direction === "IN" ? "Stock in" : "Stock out",
            icon: direction === "IN" ? ArrowDownToLine : ArrowUpFromLine,
            tone: "blue",
          },
          { label: "Quantity", value: quantity || "—", icon: Boxes, tone: "green" },
          { label: "Item", value: itemId ? `${itemId.slice(0, 8)}…` : "—", icon: Boxes, tone: "purple" },
          { label: "Note", value: note ? "Yes" : "—", icon: Boxes, tone: "teal" },
        ]}
      />

      {hasInfoPanel ? (
        <section className="panel panel--pad panel-section">
          {message ? <p className="alert alert-success">{message}</p> : null}
          {!canAdjustInventory ? <p className="badge-muted">Read-only access</p> : null}
          {error ? <p className="alert alert-error">{error}</p> : null}
        </section>
      ) : null}

      <FormModal
        open={formOpen}
        title="Create Stock Adjustment"
        confirmLabel="Review"
        loading={saving}
        onCancel={() => setFormOpen(false)}
        onConfirm={() => setConfirmOpen(true)}
      >
        <div className="stack">
          <h3 className="form-section-title">ADJUSTMENT DETAILS</h3>
          <div className="form-grid">
            <label>
              Item
              <CustomSelect
                value={itemId}
                placeholder="Select item"
                options={itemOptions.map((opt) => ({ value: opt.id, label: opt.label }))}
                onChange={setItemId}
              />
            </label>
            <label>
              Direction
              <CustomSelect
                value={direction}
                placeholder="Select direction"
                options={[
                  { value: "IN", label: "Adjustment In" },
                  { value: "OUT", label: "Adjustment Out" },
                ]}
                onChange={(next) => setDirection(next as "IN" | "OUT")}
              />
            </label>
            <label>
              Quantity
              <input type="number" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </label>
            <label>
              Note
              <input value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
          </div>
        </div>
      </FormModal>

      <ConfirmModal
        open={confirmOpen}
        title="Post stock adjustment?"
        message="Inventory levels will update immediately."
        confirmLabel="Create Adjustment"
        loading={saving}
        onCancel={() => {
          setConfirmOpen(false);
          setFormOpen(true);
        }}
        onConfirm={() => void submitAdjustment()}
      />

      <section className="panel">
        <div className="panel-toolbar">
          <div className="search-field">
            <Search size={18} />
            <input
              placeholder="Search stock transactions…"
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

        {!canViewInventory ? (
          <p className="pad page-desc">No permission to view stock transactions.</p>
        ) : loading ? (
          <SpinnerBlock />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>
                    <button type="button" className={`th-sort${sortBy === "item" ? " is-active" : ""}`} onClick={() => toggleSort("item")}>
                      ITEM
                      {sortDir === "asc" && sortBy === "item" ? <ArrowUpAZ size={14} /> : <ArrowDownAZ size={14} />}
                    </button>
                  </th>
                  <th>
                    <button type="button" className={`th-sort${sortBy === "direction" ? " is-active" : ""}`} onClick={() => toggleSort("direction")}>
                      DIRECTION
                      {sortDir === "asc" && sortBy === "direction" ? <ArrowUpAZ size={14} /> : <ArrowDownAZ size={14} />}
                    </button>
                  </th>
                  <th>
                    <button type="button" className={`th-sort${sortBy === "quantity" ? " is-active" : ""}`} onClick={() => toggleSort("quantity")}>
                      QUANTITY
                      {sortDir === "asc" && sortBy === "quantity" ? <ArrowUpAZ size={14} /> : <ArrowDownAZ size={14} />}
                    </button>
                  </th>
                  <th>
                    <button type="button" className={`th-sort${sortBy === "date" ? " is-active" : ""}`} onClick={() => toggleSort("date")}>
                      DATE
                      {sortDir === "asc" && sortBy === "date" ? <ArrowUpAZ size={14} /> : <ArrowDownAZ size={14} />}
                    </button>
                  </th>
                  <th>
                    <button type="button" className={`th-sort${sortBy === "reference" ? " is-active" : ""}`} onClick={() => toggleSort("reference")}>
                      REFERENCE
                      {sortDir === "asc" && sortBy === "reference" ? <ArrowUpAZ size={14} /> : <ArrowDownAZ size={14} />}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="table-empty">No stock transactions found for the current filters.</td>
                  </tr>
                ) : (
                  sortedRows.map((row, index) => (
                    <tr key={String(row.id ?? `${index}-${String(row.itemId ?? "")}`)}>
                      <td>{String(row.itemId ?? "-")}</td>
                      <td>{String(row.direction ?? "-")}</td>
                      <td>{String(row.quantityPrimary ?? row.enteredQuantity ?? row.quantity ?? "-")}</td>
                      <td>{String(row.transactionDate ?? row.createdAt ?? "-")}</td>
                      <td>{String(row.sourceType ?? "-")} / {String(row.sourceId ?? "-")}</td>
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
