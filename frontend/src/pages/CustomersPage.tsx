import axios from "axios";
import { ArrowDownAZ, ArrowUpAZ, Pencil, Plus, Search, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { StatCards } from "../components/StatCards";
import { PaginationBar } from "../components/ui/PaginationBar";
import { SpinnerBlock } from "../components/ui/Spinner";
import { listRangeLabel } from "../lib/listRangeLabel";
import { inferTotalPages } from "../lib/pagination";
import { getAuthState } from "../models/auth";
import { api } from "../services/api";

type CustomerRow = Record<string, unknown> & { id: string };

export function CustomersPage() {
  const navigate = useNavigate();
  const auth = getAuthState();
  const canCreate = Boolean(auth?.permissions.includes("*") || auth?.permissions.includes("customers.create"));
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "type" | "balance">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const totalPages = inferTotalPages(page, pageSize, rows.length);
  const sortedRows = useMemo(() => {
    const cloned = [...rows];
    cloned.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortBy === "balance") return (Number(a.currentBalance ?? 0) - Number(b.currentBalance ?? 0)) * dir;
      if (sortBy === "type") return String(a.customerType ?? "").localeCompare(String(b.customerType ?? "")) * dir;
      return String(a.name ?? "").localeCompare(String(b.name ?? "")) * dir;
    });
    return cloned;
  }, [rows, sortBy, sortDir]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  async function load() {
    if (!auth) return;
    setLoading(true);
    try {
      const response = await api.get("/customers", {
        params: { search: search || undefined, page, pageSize },
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      setRows(response.data.data ?? []);
      setError("");
    } catch (loadError) {
      if (axios.isAxiosError(loadError)) setError(loadError.response?.data?.message ?? "Failed to load customers.");
      else setError("Failed to load customers.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [auth?.accessToken, page, pageSize]);

  function toggleSort(next: "name" | "type" | "balance") {
    if (sortBy === next) setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    else {
      setSortBy(next);
      setSortDir(next === "balance" ? "desc" : "asc");
    }
  }

  return (
    <main className="content">
      <PageHeader
        title="Customers"
        subtitle="Manage customers with complete profile details"
        actions={
          canCreate ? (
            <button type="button" className="primary-btn" onClick={() => navigate("/customers/new")}>
              <Plus size={16} />
              <span className="btn-label">Create Customer</span>
            </button>
          ) : null
        }
      />
      <StatCards items={[{ label: "Rows (page)", value: rows.length, icon: Users, tone: "blue" }]} />
      {error ? <p className="alert alert-error">{error}</p> : null}

      <section className="panel">
        <div className="panel-toolbar">
          <div className="search-field">
            <Search size={18} />
            <input
              placeholder="Search customers…"
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
                    <button type="button" className={`th-sort${sortBy === "name" ? " is-active" : ""}`} onClick={() => toggleSort("name")}>
                      NAME {sortBy === "name" && sortDir === "asc" ? <ArrowUpAZ size={14} /> : <ArrowDownAZ size={14} />}
                    </button>
                  </th>
                  <th>
                    <button type="button" className={`th-sort${sortBy === "type" ? " is-active" : ""}`} onClick={() => toggleSort("type")}>
                      TYPE {sortBy === "type" && sortDir === "asc" ? <ArrowUpAZ size={14} /> : <ArrowDownAZ size={14} />}
                    </button>
                  </th>
                  <th>
                    <button type="button" className={`th-sort${sortBy === "balance" ? " is-active" : ""}`} onClick={() => toggleSort("balance")}>
                      BALANCE {sortBy === "balance" && sortDir === "asc" ? <ArrowUpAZ size={14} /> : <ArrowDownAZ size={14} />}
                    </button>
                  </th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="table-empty">No customers found for the current filters.</td>
                  </tr>
                ) : (
                  sortedRows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div className="cell-strong">{String(row.name ?? "-")}</div>
                        <p>{String(row.phone ?? row.email ?? "-")}</p>
                      </td>
                      <td>{String(row.customerType ?? "-")}</td>
                      <td>{String(row.currentBalance ?? row.openingBalance ?? "-")}</td>
                      <td>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate(`/customers/${row.id}/edit`)}>
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
