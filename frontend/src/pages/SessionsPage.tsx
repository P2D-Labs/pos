import axios from "axios";
import { useEffect, useState } from "react";
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
  const pageSize = 20;
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    if (!auth) return;
    const response = await api.get("/auth/sessions", {
      params: { search: search || undefined, page, pageSize },
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    });
    setSessions(response.data.data ?? []);
  }

  useEffect(() => {
    load().catch(() => setError("Failed to load sessions"));
  }, [page]);

  async function revoke(tokenId: string) {
    if (!auth) return;
    try {
      await api.delete(`/auth/sessions/${tokenId}`, {
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      setMessage("Session revoked");
      setError("");
      await load();
    } catch (revokeError) {
      if (axios.isAxiosError(revokeError)) setError(revokeError.response?.data?.message ?? "Failed to revoke session");
    }
  }

  async function logoutAll() {
    if (!auth) return;
    try {
      await api.post(
        "/auth/logout-all",
        {},
        { headers: { Authorization: `Bearer ${auth.accessToken}` } },
      );
      setAuthState(null);
      setMessage("All sessions revoked. Please login again.");
    } catch {
      setError("Failed to logout from all devices");
    }
  }

  return (
    <main className="content">
      <header className="content-header">
        <div>
          <h1>Device Sessions</h1>
          <p>Manage active login sessions</p>
        </div>
      </header>
      <section className="panel pad">
        <button onClick={logoutAll} disabled={!canManageSessions}>Logout all devices</button>
        <input
          placeholder="Search token ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button onClick={() => { setPage(1); void load(); }}>Search</button>
        <button onClick={() => setPage((prev) => Math.max(1, prev - 1))}>Prev</button>
        <span>Page {page}</span>
        <button onClick={() => setPage((prev) => prev + 1)}>Next</button>
        {!canManageSessions ? <p>You have view-only access for sessions.</p> : null}
        {message ? <p>{message}</p> : null}
        {error ? <p>{error}</p> : null}
      </section>
      <section className="panel">
        <table>
          <thead>
            <tr>
              <th>Token ID</th>
              <th>Created</th>
              <th>Expires</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => (
              <tr key={session.tokenId}>
                <td>{session.tokenId}</td>
                <td>{new Date(session.createdAt).toLocaleString()}</td>
                <td>{new Date(session.expiresAt).toLocaleString()}</td>
                <td>
                  <button onClick={() => revoke(session.tokenId)} disabled={!canManageSessions}>Revoke</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
