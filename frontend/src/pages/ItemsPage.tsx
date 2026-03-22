import axios from "axios";
import { ArrowDownAZ, ArrowUpAZ, Pencil, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { PaginationBar } from "../components/ui/PaginationBar";
import { SpinnerBlock } from "../components/ui/Spinner";
import { listRangeLabel } from "../lib/listRangeLabel";
import { inferTotalPages } from "../lib/pagination";
import { getAuthState } from "../models/auth";
import { api } from "../services/api";

type Option = { id: string; name: string };
type ItemRow = Record<string, unknown> & { id: string; name: string };
type SortKey = "name" | "category" | "subcategory" | "price";

export function ItemsPage() {
  const navigate = useNavigate();
  const auth = getAuthState();
  const canCreate = Boolean(auth?.permissions.includes("*") || auth?.permissions.includes("products.create"));
  const [rows, setRows] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [error, setError] = useState("");
  const [categories, setCategories] = useState<Option[]>([]);
  const [subCategories, setSubCategories] = useState<Option[]>([]);

  const totalPages = inferTotalPages(page, pageSize, rows.length);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  async function load() {
    if (!auth) return;
    setLoading(true);
    try {
      const [itemsRes, categoriesRes, subCategoriesRes] = await Promise.all([
        api.get("/items", { params: { search: search || undefined, page, pageSize }, headers: { Authorization: `Bearer ${auth.accessToken}` } }),
        api.get("/categories", { params: { page: 1, pageSize: 200 }, headers: { Authorization: `Bearer ${auth.accessToken}` } }),
        api.get("/subcategories", { params: { page: 1, pageSize: 200 }, headers: { Authorization: `Bearer ${auth.accessToken}` } }),
      ]);
      setRows((itemsRes.data?.data ?? []) as ItemRow[]);
      setCategories((categoriesRes.data?.data ?? []).map((r: Record<string, unknown>) => ({ id: String(r.id), name: String(r.name ?? r.id) })));
      setSubCategories((subCategoriesRes.data?.data ?? []).map((r: Record<string, unknown>) => ({ id: String(r.id), name: String(r.name ?? r.id) })));
      setError("");
    } catch (loadError) {
      if (axios.isAxiosError(loadError)) setError(loadError.response?.data?.message ?? "Failed to load items");
      else setError("Failed to load items");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [auth?.accessToken, page, pageSize]);

  const sortedRows = useMemo(() => {
    const categoryMap = new Map(categories.map((o) => [o.id, o.name]));
    const cloned = [...rows];
    cloned.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortBy === "price") return (Number(a.salesPricePrimary ?? 0) - Number(b.salesPricePrimary ?? 0)) * dir;
      if (sortBy === "category") {
        const av = categoryMap.get(String(a.categoryId ?? "")) ?? "";
        const bv = categoryMap.get(String(b.categoryId ?? "")) ?? "";
        return av.localeCompare(bv) * dir;
      }
      if (sortBy === "subcategory") {
        const subMap = new Map(subCategories.map((o) => [o.id, o.name]));
        const av = subMap.get(String(a.subCategoryId ?? "")) ?? "";
        const bv = subMap.get(String(b.subCategoryId ?? "")) ?? "";
        return av.localeCompare(bv) * dir;
      }
      return String(a.name ?? "").localeCompare(String(b.name ?? "")) * dir;
    });
    return cloned;
  }, [rows, categories, subCategories, sortBy, sortDir]);

  function sortToggle(next: SortKey) {
    if (sortBy === next) setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    else {
      setSortBy(next);
      setSortDir(next === "price" ? "desc" : "asc");
    }
  }

  function optionLabel(options: Option[], id: unknown) {
    const key = String(id ?? "");
    return options.find((o) => o.id === key)?.name ?? (key || "—");
  }

  return (
    <main className="content">
      <PageHeader
        title="Items"
        subtitle="Detailed item setup and editing"
        actions={
          <button type="button" className="primary-btn" onClick={() => navigate("/items/new")} disabled={!canCreate}>
            <Plus size={16} />
            <span className="btn-label">Create Item</span>
          </button>
        }
      />

      {error ? <p className="alert alert-error">{error}</p> : null}

      <section className="panel">
        <div className="panel-toolbar">
          <div className="search-field">
            <Search size={16} />
            <input
              placeholder="Search items…"
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
          <button type="button" className="btn btn-primary" onClick={() => { setPage(1); void load(); }}>
            <Search size={16} />
            Search
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
                    <button type="button" className={`th-sort${sortBy === "name" ? " is-active" : ""}`} onClick={() => sortToggle("name")}>
                      NAME {sortDir === "asc" && sortBy === "name" ? <ArrowUpAZ size={14} /> : <ArrowDownAZ size={14} />}
                    </button>
                  </th>
                  <th>
                    <button type="button" className={`th-sort${sortBy === "category" ? " is-active" : ""}`} onClick={() => sortToggle("category")}>
                      CATEGORY {sortDir === "asc" && sortBy === "category" ? <ArrowUpAZ size={14} /> : <ArrowDownAZ size={14} />}
                    </button>
                  </th>
                  <th>
                    <button type="button" className={`th-sort${sortBy === "subcategory" ? " is-active" : ""}`} onClick={() => sortToggle("subcategory")}>
                      SUBCATEGORY {sortDir === "asc" && sortBy === "subcategory" ? <ArrowUpAZ size={14} /> : <ArrowDownAZ size={14} />}
                    </button>
                  </th>
                  <th>
                    <button type="button" className={`th-sort${sortBy === "price" ? " is-active" : ""}`} onClick={() => sortToggle("price")}>
                      SALES PRICE {sortDir === "asc" && sortBy === "price" ? <ArrowUpAZ size={14} /> : <ArrowDownAZ size={14} />}
                    </button>
                  </th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="table-empty">No items found.</td>
                  </tr>
                ) : (
                  sortedRows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div className="cell-strong">{String(row.name ?? "-")}</div>
                        <p>{String(row.sku ?? row.code ?? "-")}</p>
                      </td>
                      <td>{optionLabel(categories, row.categoryId)}</td>
                      <td>{optionLabel(subCategories, row.subCategoryId)}</td>
                      <td>{String(row.salesPricePrimary ?? "-")}</td>
                      <td>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate(`/items/${row.id}/edit`)}>
                          <Pencil size={14} />
                          Edit
                        </button>
                      </td>
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
