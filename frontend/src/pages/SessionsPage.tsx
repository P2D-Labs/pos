import axios from "axios";
import { ArrowDownAZ, ArrowUpAZ, LogOut, Monitor, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { StatCards } from "../components/StatCards";
import { ConfirmModal } from "../components/ui/ConfirmModal";
import { PaginationBar } from "../components/ui/PaginationBar";
import { SpinnerBlock } from "../components/ui/Spinner";
import { listRangeLabel } from "../lib/listRangeLabel";
import { inferTotalPages } from "../lib/pagination";
import { getAuthState, setAuthState } from "../models/auth";
import { api } from "../services/api";

type SessionRow = {
  tokenId: string;
  createdAt: string;
  expiresAt: string;
};

export function SessionsPage() {
  const auth = getAuthState();
  const canManageSessions = Boolean(auth?.permissions.includes("*") || auth?.permissions.includes("sessions.manage"));
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [logoutAllOpen, setLogoutAllOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [sortBy, setSortBy] = useState<"token" | "created" | "expires">("created");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const totalPages = inferTotalPages(page, pageSize, sessions.length);
  const sortedSessions = useMemo(() => {
    const cloned = [...sessions];
    cloned.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortBy === "token") return a.tokenId.localeCompare(b.tokenId) * dir;
      if (sortBy === "created") return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
      return (new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime()) * dir;
    });
    return cloned;
  }, [sessions, sortBy, sortDir]);

  function toggleSort(next: "token" | "created" | "expires") {
    if (sortBy === next) setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    else {
      setSortBy(next);
      setSortDir(next === "token" ? "asc" : "desc");
    }
  }

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  async function load() {
    if (!auth) return;
    setLoading(true);
    try {
      const response = await api.get("/auth/sessions", {
        params: { search: search || undefined, page, pageSize },
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      setSessions(response.data.data ?? []);
      setError("");
    } catch {
      setError("Failed to load sessions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [page, pageSize, auth?.accessToken]);

  async function revoke(tokenId: string) {
    if (!auth) return;
    setActionLoading(true);
    try {
      await api.delete(`/auth/sessions/${tokenId}`, {
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      setMessage("Session revoked");
      setError("");
      setRevokeId(null);
      await load();
    } catch (revokeError) {
      if (axios.isAxiosError(revokeError)) setError(revokeError.response?.data?.message ?? "Failed to revoke session");
    } finally {
      setActionLoading(false);
    }
  }

  async function logoutAll() {
    if (!auth) return;
    setActionLoading(true);
    try {
      await api.post("/auth/logout-all", {}, { headers: { Authorization: `Bearer ${auth.accessToken}` } });
      setAuthState(null);
      setMessage("All sessions were revoked. Please log in again.");
      setLogoutAllOpen(false);
    } catch {
      setError("Failed to log out all devices.");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <main className="content">
      <PageHeader
        title="Device Sessions"
        subtitle="Manage active login sessions"
        actions={
          <button type="button" className="primary-btn" disabled={!canManageSessions} onClick={() => setLogoutAllOpen(true)}>
            <LogOut size={18} />
            Logout all
          </button>
        }
      />

      <StatCards
        items={[
          { label: "Sessions (page)", value: sessions.length, icon: Monitor, tone: "blue" },
          { label: "Page", value: `${page} / ${totalPages}`, icon: Monitor, tone: "green" },
          { label: "Rows / page", value: pageSize, icon: Monitor, tone: "purple" },
          { label: "Status", value: canManageSessions ? "Manage" : "View", icon: Monitor, tone: "teal" },
        ]}
      />

      <section className="panel panel--pad" style={{ marginBottom: 14 }}>
        <div className="inline-form">
          <input
            placeholder="Search token ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setPage(1);
                void load();
              }
            }}
          />
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
        {!canManageSessions ? <p className="badge-muted">Read-only access</p> : null}
        {message ? <p className="alert alert-success">{message}</p> : null}
        {error ? <p className="alert alert-error">{error}</p> : null}
      </section>

      <section className="panel">
        {loading ? (
          <SpinnerBlock />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>
                    <button type="button" className={`th-sort${sortBy === "token" ? " is-active" : ""}`} onClick={() => toggleSort("token")}>
                      TOKEN ID
                      {sortDir === "asc" && sortBy === "token" ? <ArrowUpAZ size={14} /> : <ArrowDownAZ size={14} />}
                    </button>
                  </th>
                  <th>
                    <button type="button" className={`th-sort${sortBy === "created" ? " is-active" : ""}`} onClick={() => toggleSort("created")}>
                      CREATED
                      {sortDir === "asc" && sortBy === "created" ? <ArrowUpAZ size={14} /> : <ArrowDownAZ size={14} />}
                    </button>
                  </th>
                  <th>
                    <button type="button" className={`th-sort${sortBy === "expires" ? " is-active" : ""}`} onClick={() => toggleSort("expires")}>
                      EXPIRES
                      {sortDir === "asc" && sortBy === "expires" ? <ArrowUpAZ size={14} /> : <ArrowDownAZ size={14} />}
                    </button>
                  </th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {sessions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="table-empty">No sessions found for the current filters.</td>
                  </tr>
                ) : (
                  sortedSessions.map((session) => (
                    <tr key={session.tokenId}>
                      <td>
                        <code>{session.tokenId}</code>
                      </td>
                      <td>{new Date(session.createdAt).toLocaleString()}</td>
                      <td>{new Date(session.expiresAt).toLocaleString()}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          disabled={!canManageSessions}
                          onClick={() => setRevokeId(session.tokenId)}
                        >
                          <Trash2 size={14} />
                          Revoke
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
          rangeLabel={listRangeLabel(page, pageSize, sessions.length)}
        />
      </section>

      <ConfirmModal
        open={Boolean(revokeId)}
        title="Revoke session?"
        message="The device will be signed out immediately."
        confirmLabel="Revoke"
        danger
        loading={actionLoading}
        onCancel={() => setRevokeId(null)}
        onConfirm={() => {
          if (revokeId) void revoke(revokeId);
        }}
      />

      <ConfirmModal
        open={logoutAllOpen}
        title="Logout all devices?"
        message="Every session including this browser will end. You will need to sign in again."
        confirmLabel="Logout all"
        danger
        loading={actionLoading}
        onCancel={() => setLogoutAllOpen(false)}
        onConfirm={() => void logoutAll()}
      />
    </main>
  );
}
