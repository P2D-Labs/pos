import axios from "axios";
import { ArrowDownAZ, ArrowUpAZ, BarChart3, ChevronDown, ChevronRight, Hash, Layers, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { PageHeader } from "../components/PageHeader";
import { StatCards } from "../components/StatCards";
import { CustomSelect } from "../components/ui/CustomSelect";
import { ConfirmModal } from "../components/ui/ConfirmModal";
import { FormModal } from "../components/ui/FormModal";
import { ImageField } from "../components/ui/ImageField";
import { PaginationBar } from "../components/ui/PaginationBar";
import { SpinnerBlock } from "../components/ui/Spinner";
import { listRangeLabel } from "../lib/listRangeLabel";
import { inferTotalPages } from "../lib/pagination";
import { getAuthState } from "../models/auth";
import type { FormField } from "../models/module.model";
import { api } from "../services/api";

type Option = { value: string; label: string };
type CategorySubcategoryDraft = {
  key: number;
  title: string;
  description: string;
  imageUrl: string;
  expanded: boolean;
};

const enumFieldOptions: Record<string, Option[]> = {
  customerType: [
    { value: "REGULAR", label: "REGULAR" },
    { value: "WALK_IN", label: "WALK_IN" },
  ],
  type: [
    { value: "PRODUCT", label: "PRODUCT" },
    { value: "SERVICE", label: "SERVICE" },
  ],
  status: [
    { value: "ACTIVE", label: "ACTIVE" },
    { value: "INACTIVE", label: "INACTIVE" },
  ],
};

function rowTitle(row: Record<string, unknown>): string {
  for (const key of ["name", "title", "invoiceNo", "label", "category"]) {
    const v = row[key];
    if (typeof v === "string" && v.trim()) return v;
  }
  if (typeof row.id === "string") return row.id;
  return "Record";
}

function rowSubtitle(row: Record<string, unknown>): string | null {
  const email = row.email;
  const phone = row.phone;
  if (typeof email === "string" && email) return email;
  if (typeof phone === "string" && phone) return phone;
  return null;
}

function toDisplayPairs(row: Record<string, unknown>, maxFields = 4) {
  const hidden = new Set(["id", "businessId", "createdAt", "updatedAt", "passwordHash"]);
  return Object.entries(row)
    .filter(([k, v]) => !hidden.has(k) && v !== null && v !== undefined && `${v}` !== "")
    .slice(0, maxFields)
    .map(([k, v]) => ({
      key: k,
      value: Array.isArray(v) ? v.join(", ") : String(v),
    }));
}

export function ModulePage({
  title,
  endpoint,
  createFields,
}: {
  title: string;
  endpoint: string;
  createFields?: FormField[];
}) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [categorySubcategories, setCategorySubcategories] = useState<CategorySubcategoryDraft[]>([]);
  const [subcategoryDraftKey, setSubcategoryDraftKey] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<Record<string, unknown> | null>(null);
  const [fieldOptions, setFieldOptions] = useState<Record<string, Option[]>>({});
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState<"summary" | "details">("summary");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const auth = getAuthState();
  const canCreate = Boolean(
    auth?.permissions.includes("*") ||
      (endpoint === "/customers" ? auth?.permissions.includes("customers.create") : false) ||
      (endpoint === "/suppliers" ? auth?.permissions.includes("suppliers.create") : false) ||
      (endpoint === "/items" ? auth?.permissions.includes("products.create") : false) ||
      (endpoint === "/products" ? auth?.permissions.includes("products.create") : false) ||
      (endpoint === "/units" ? auth?.permissions.includes("units.create") : false) ||
      (endpoint === "/categories" ? auth?.permissions.includes("categories.create") : false) ||
      (endpoint === "/brands" ? auth?.permissions.includes("brands.create") : false) ||
      (endpoint === "/tax-rates" ? auth?.permissions.includes("taxRates.create") : false),
  );

  const totalPages = inferTotalPages(page, pageSize, rows.length);
  const hasInfoPanel = Boolean(message || !canCreate);
  const canManageRows = canCreate && ["/units", "/categories", "/brands", "/tax-rates"].includes(endpoint);
  const detailFieldCount =
    endpoint === "/items" || endpoint === "/products" || endpoint === "/customers" || endpoint === "/suppliers"
      ? 12
      : 4;
  const sortedRows = useMemo(() => {
    const cloned = [...rows];
    cloned.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortBy === "details") return JSON.stringify(a).localeCompare(JSON.stringify(b)) * dir;
      return rowTitle(a).localeCompare(rowTitle(b)) * dir;
    });
    return cloned;
  }, [rows, sortBy, sortDir]);

  function toggleSort(next: "summary" | "details") {
    if (sortBy === next) setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    else {
      setSortBy(next);
      setSortDir("asc");
    }
  }

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  async function load() {
    if (!auth) return;
    setLoading(true);
    try {
      const responsePromise = api.get(endpoint, {
        params: { search: search || undefined, page, pageSize },
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      const optionRequests: Promise<unknown>[] = [];
      if (endpoint === "/items") {
        optionRequests.push(
          api.get("/categories", { params: { page: 1, pageSize: 200 }, headers: { Authorization: `Bearer ${auth.accessToken}` } }),
          api.get("/subcategories", { params: { page: 1, pageSize: 200 }, headers: { Authorization: `Bearer ${auth.accessToken}` } }),
          api.get("/brands", { params: { page: 1, pageSize: 200 }, headers: { Authorization: `Bearer ${auth.accessToken}` } }),
          api.get("/units", { params: { page: 1, pageSize: 200 }, headers: { Authorization: `Bearer ${auth.accessToken}` } }),
          api.get("/tax-rates", { params: { page: 1, pageSize: 200 }, headers: { Authorization: `Bearer ${auth.accessToken}` } }),
        );
      }

      const [response, ...optionResponses] = await Promise.all([responsePromise, ...optionRequests]);
      setRows(response.data.data ?? []);
      if (endpoint === "/items" && optionResponses.length === 5) {
        const [categoriesRes, subCategoriesRes, brandsRes, unitsRes, taxRatesRes] = optionResponses as Array<{ data?: { data?: Array<Record<string, unknown>> } }>;
        setFieldOptions({
          categoryId: (categoriesRes.data?.data ?? []).map((r) => ({ value: String(r.id ?? ""), label: String(r.name ?? r.id ?? "") })),
          subCategoryId: (subCategoriesRes.data?.data ?? []).map((r) => ({ value: String(r.id ?? ""), label: String(r.name ?? r.id ?? "") })),
          brandId: (brandsRes.data?.data ?? []).map((r) => ({ value: String(r.id ?? ""), label: String(r.name ?? r.id ?? "") })),
          primaryUnitId: (unitsRes.data?.data ?? []).map((r) => ({ value: String(r.id ?? ""), label: String(r.name ?? r.id ?? "") })),
          secondaryUnitId: (unitsRes.data?.data ?? []).map((r) => ({ value: String(r.id ?? ""), label: String(r.name ?? r.id ?? "") })),
          defaultTaxRateId: (taxRatesRes.data?.data ?? []).map((r) => ({ value: String(r.id ?? ""), label: String(r.name ?? r.id ?? "") })),
        });
      } else {
        setFieldOptions({});
      }
      setError("");
    } catch (loadError) {
      if (axios.isAxiosError(loadError)) setError(loadError.response?.data?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [auth?.accessToken, endpoint, page, pageSize]);

  async function saveRecord(event?: FormEvent) {
    event?.preventDefault();
    if (!auth || !createFields || !canCreate) return;
    setSaving(true);
    setMessage("");
    try {
      const payload: Record<string, unknown> = {};
      for (const field of createFields) {
        const value = form[field.name];
        if (value === undefined || value === "") continue;
        if (endpoint === "/categories" && field.name === "subcategories") continue;
        if (field.type === "number") payload[field.name] = Number(value);
        else if (field.type === "boolean") payload[field.name] = value === "true";
        else payload[field.name] = value;
      }
      if (endpoint === "/categories") {
        payload.subcategories = categorySubcategories
          .map((entry) => ({
            title: entry.title.trim(),
            description: entry.description.trim(),
            imageUrl: entry.imageUrl.trim(),
          }))
          .filter((entry) => Boolean(entry.title))
          .map((entry) => ({
            title: entry.title,
            ...(entry.description ? { description: entry.description } : {}),
            ...(entry.imageUrl ? { imageUrl: entry.imageUrl } : {}),
          }));
      }
      if (endpoint === "/items" && payload.type === undefined) payload.type = "PRODUCT";
      if (editingId) {
        await api.patch(`${endpoint}/${editingId}`, payload, {
          headers: { Authorization: `Bearer ${auth.accessToken}` },
        });
      } else {
        await api.post(endpoint, payload, {
          headers: { Authorization: `Bearer ${auth.accessToken}` },
        });
      }
      setEditingId(null);
      setForm({});
      setCategorySubcategories([]);
      setSubcategoryDraftKey(1);
      setMessage(editingId ? "Record updated successfully." : "Record created successfully.");
      setFormOpen(false);
      await load();
    } catch (saveError) {
      if (axios.isAxiosError(saveError)) setMessage(saveError.response?.data?.message ?? "Failed to save record.");
      else setMessage("Failed to save record.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRecord() {
    if (!auth || !deleteTarget || typeof deleteTarget.id !== "string") return;
    setSaving(true);
    setMessage("");
    try {
      await api.delete(`${endpoint}/${deleteTarget.id}`, {
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      setDeleteTarget(null);
      setMessage("Record deleted successfully.");
      await load();
    } catch (deleteError) {
      if (axios.isAxiosError(deleteError)) setMessage(deleteError.response?.data?.message ?? "Failed to delete record.");
      else setMessage("Failed to delete record.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="content">
      <PageHeader
        title={title}
        subtitle="Manage records connected to the API"
        actions={
          createFields && canCreate ? (
            <button
              type="button"
              className="primary-btn"
              onClick={() => {
                setEditingId(null);
                setForm({});
                setCategorySubcategories([]);
                setSubcategoryDraftKey(1);
                setFormOpen(true);
              }}
            >
              <Plus size={16} />
              <span className="btn-label">Create</span>
            </button>
          ) : null
        }
      />

      <StatCards
        items={[
          { label: "On this page", value: rows.length, icon: BarChart3, tone: "blue" },
          { label: "Page", value: `${page} / ${totalPages}`, icon: Hash, tone: "green" },
          { label: "Module", value: title.split(" ")[0] ?? title, icon: Layers, tone: "teal" },
        ]}
      />

      {hasInfoPanel ? (
        <section className="panel panel--pad panel-section">
          {message ? <p className="alert alert-success">{message}</p> : null}
          {!canCreate ? <p className="badge-muted">Read-only access</p> : null}
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-toolbar">
          <div className="search-field">
            <Search size={18} />
            <input
              placeholder="Search by name, phone, email, or id…"
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

        {error ? <p className="pad alert alert-error">{error}</p> : null}

        {loading ? (
          <SpinnerBlock label="Loading data" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>
                    <button type="button" className={`th-sort${sortBy === "summary" ? " is-active" : ""}`} onClick={() => toggleSort("summary")}>
                      NAME / SUMMARY
                      {sortDir === "asc" && sortBy === "summary" ? <ArrowUpAZ size={14} /> : <ArrowDownAZ size={14} />}
                    </button>
                  </th>
                  <th>
                    <button type="button" className={`th-sort${sortBy === "details" ? " is-active" : ""}`} onClick={() => toggleSort("details")}>
                      DETAILS
                      {sortDir === "asc" && sortBy === "details" ? <ArrowUpAZ size={14} /> : <ArrowDownAZ size={14} />}
                    </button>
                  </th>
                  {canManageRows ? <th>ACTIONS</th> : null}
                </tr>
              </thead>
              <tbody>
                {sortedRows.length === 0 ? (
                  <tr>
                    <td colSpan={canManageRows ? 3 : 2} className="table-empty">No records found for the current filters.</td>
                  </tr>
                ) : (
                  sortedRows.map((row, index) => (
                    <tr key={`${String(row.id ?? index)}-${index}`}>
                      <td>
                        <div className="row-user">
                          <div className="avatar" aria-hidden>
                            {(rowTitle(row).slice(0, 1) || "?").toUpperCase()}
                          </div>
                          <div>
                            <div className="cell-strong">{rowTitle(row)}</div>
                            {rowSubtitle(row) ? <p>{rowSubtitle(row)}</p> : null}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="stack">
                          {toDisplayPairs(row, detailFieldCount).map((pair) => (
                            <p key={pair.key}>
                              <strong>{pair.key}: </strong>
                              {pair.value}
                            </p>
                          ))}
                          {toDisplayPairs(row, detailFieldCount).length === 0 ? <p className="page-desc">No additional details available.</p> : null}
                        </div>
                      </td>
                      {canManageRows ? (
                        <td>
                          <div className="inline-form">
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                const next: Record<string, string> = {};
                                for (const field of createFields ?? []) {
                                  const value = row[field.name];
                                  if (value === null || value === undefined) continue;
                                  if (endpoint === "/categories" && field.name === "subcategories" && Array.isArray(value)) {
                                    const mapped = value
                                      .map((entry, idx) => {
                                        if (!entry || typeof entry !== "object") return null;
                                        const rowEntry = entry as Record<string, unknown>;
                                        const title = String(rowEntry.title ?? "");
                                        if (!title) return null;
                                        return {
                                          key: idx + 1,
                                          title,
                                          description: String(rowEntry.description ?? ""),
                                          imageUrl: String(rowEntry.imageUrl ?? ""),
                                          expanded: false,
                                        };
                                      })
                                      .filter((entry): entry is CategorySubcategoryDraft => Boolean(entry));
                                    setCategorySubcategories(mapped);
                                    setSubcategoryDraftKey(mapped.length + 1);
                                    next[field.name] = "";
                                  } else {
                                    next[field.name] = String(value);
                                  }
                                }
                                setEditingId(typeof row.id === "string" ? row.id : null);
                                setForm(next);
                                setFormOpen(true);
                              }}
                            >
                              <Pencil size={14} />
                              Edit
                            </button>
                            <button type="button" className="btn btn-danger btn-sm" onClick={() => setDeleteTarget(row)}>
                              <Trash2 size={14} />
                              Delete
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
      {createFields ? (
        <FormModal
          open={formOpen}
          title={`Create ${title}`}
          confirmLabel={saving ? "Saving..." : editingId ? "Update" : "Create"}
          loading={saving}
          onCancel={() => {
            setFormOpen(false);
            setEditingId(null);
            setCategorySubcategories([]);
            setSubcategoryDraftKey(1);
          }}
          onConfirm={() => void saveRecord()}
        >
          {endpoint === "/categories" ? (
            <div className="stack" style={{ gap: 14 }}>
              <div className="inline-form">
                <input
                  placeholder="Category name"
                  value={form.name ?? ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                />
                <input
                  placeholder="Category description (optional)"
                  value={form.description ?? ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                />
              </div>
              <ImageField
                label="Category image"
                value={form.imageUrl ?? ""}
                onChange={(next) => setForm((prev) => ({ ...prev, imageUrl: next }))}
                hint="Use URL, paste, or drag-drop."
              />
              <div className="stack" style={{ gap: 10 }}>
                <div className="inline-form" style={{ justifyContent: "space-between", width: "100%" }}>
                  <strong>Subcategories (optional)</strong>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setCategorySubcategories((prev) => [
                        ...prev,
                        { key: subcategoryDraftKey, title: "", description: "", imageUrl: "", expanded: true },
                      ]);
                      setSubcategoryDraftKey((k) => k + 1);
                    }}
                  >
                    <Plus size={14} />
                    Add Subcategory
                  </button>
                </div>
                {categorySubcategories.length === 0 ? (
                  <p className="page-desc">No subcategories added.</p>
                ) : (
                  categorySubcategories.map((entry, index) => (
                    <div
                      key={`subcategory-${entry.key}`}
                      className="panel panel--pad stack"
                      style={{ gap: 10, width: "100%", borderStyle: "dashed" }}
                    >
                      <div className="inline-form subcategory-header-row">
                        <button
                          type="button"
                          className="subcategory-toggle-icon"
                          aria-label={entry.expanded ? "Collapse subcategory" : "Expand subcategory"}
                          onClick={() =>
                            setCategorySubcategories((prev) =>
                              prev.map((row) =>
                                row.key === entry.key ? { ...row, expanded: !row.expanded } : row,
                              ),
                            )
                          }
                        >
                          {entry.expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                        <strong className="subcategory-header-title">
                          {entry.title.trim() ? entry.title : `Subcategory ${index + 1}`}
                        </strong>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() =>
                            setCategorySubcategories((prev) => prev.filter((row) => row.key !== entry.key))
                          }
                        >
                          <Trash2 size={14} />
                          Remove
                        </button>
                      </div>
                      {entry.expanded ? (
                        <>
                          <label className="stack" style={{ gap: 6, width: "100%" }}>
                            <span>Title</span>
                            <input
                              placeholder="Title"
                              value={entry.title}
                              onChange={(e) =>
                                setCategorySubcategories((prev) =>
                                  prev.map((row) =>
                                    row.key === entry.key ? { ...row, title: e.target.value } : row,
                                  ),
                                )
                              }
                            />
                          </label>
                          <label className="stack" style={{ gap: 6, width: "100%" }}>
                            <span>Description (optional)</span>
                            <textarea
                              placeholder="Description (optional)"
                              rows={3}
                              value={entry.description}
                              onChange={(e) =>
                                setCategorySubcategories((prev) =>
                                  prev.map((row) =>
                                    row.key === entry.key ? { ...row, description: e.target.value } : row,
                                  ),
                                )
                              }
                            />
                          </label>
                          <ImageField
                            label="Subcategory image"
                            value={entry.imageUrl}
                            onChange={(next) =>
                              setCategorySubcategories((prev) =>
                                prev.map((row) =>
                                  row.key === entry.key ? { ...row, imageUrl: next } : row,
                                ),
                              )
                            }
                            hint="Optional image. Use URL, paste, or drag-drop."
                          />
                        </>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="inline-form">
              {createFields.map((field) => (
                field.type === "boolean" ? (
                  <CustomSelect
                    key={field.name}
                    value={form[field.name] ?? ""}
                    onChange={(next) => setForm((prev) => ({ ...prev, [field.name]: next }))}
                    placeholder={field.label}
                    options={[
                      { value: "true", label: `${field.label}: Yes` },
                      { value: "false", label: `${field.label}: No` },
                    ]}
                  />
                ) : fieldOptions[field.name]?.length ? (
                  <CustomSelect
                    key={field.name}
                    value={form[field.name] ?? ""}
                    onChange={(next) => setForm((prev) => ({ ...prev, [field.name]: next }))}
                    placeholder={field.label}
                    options={fieldOptions[field.name].map((option) => ({ value: option.value, label: option.label }))}
                  />
                ) : enumFieldOptions[field.name]?.length ? (
                  <CustomSelect
                    key={field.name}
                    value={form[field.name] ?? ""}
                    onChange={(next) => setForm((prev) => ({ ...prev, [field.name]: next }))}
                    placeholder={field.label}
                    options={enumFieldOptions[field.name].map((option) => ({ value: option.value, label: option.label }))}
                  />
                ) : field.name.toLowerCase().includes("imageurl") ? (
                  <ImageField
                    key={field.name}
                    label={field.label}
                    value={form[field.name] ?? ""}
                    onChange={(next) => setForm((prev) => ({ ...prev, [field.name]: next }))}
                    hint="Tip: use 1:1 images around 800x800 and max 2MB."
                  />
                ) : (
                  <input
                    key={field.name}
                    placeholder={field.label}
                    type={field.type === "number" ? "number" : "text"}
                    value={form[field.name] ?? ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, [field.name]: e.target.value }))}
                  />
                )
              ))}
            </div>
          )}
        </FormModal>
      ) : null}
      <ConfirmModal
        open={Boolean(deleteTarget)}
        title={`Delete ${title.split(" ")[0] ?? "record"}?`}
        message={deleteTarget ? `This will permanently delete "${rowTitle(deleteTarget)}".` : ""}
        loading={saving}
        confirmLabel="Delete"
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void deleteRecord()}
      />
    </main>
  );
}
