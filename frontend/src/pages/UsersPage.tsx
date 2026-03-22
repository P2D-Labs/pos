import axios from "axios";
import { ArrowDownAZ, ArrowUpAZ, Pencil, Plus, Search, Trash2, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { StatCards } from "../components/StatCards";
import { ConfirmModal } from "../components/ui/ConfirmModal";
import { CustomSelect } from "../components/ui/CustomSelect";
import { FormModal } from "../components/ui/FormModal";
import { PaginationBar } from "../components/ui/PaginationBar";
import { SpinnerBlock } from "../components/ui/Spinner";
import { inferTotalPages } from "../lib/pagination";
import { getAuthState } from "../models/auth";
import { api } from "../services/api";

type RoleOption = { id: string; name: string };
type UserRow = {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  role?: { id: string; name: string } | null;
};

export function UsersPage() {
  const auth = getAuthState();
  const canCreate = Boolean(auth?.permissions.includes("*") || auth?.permissions.includes("users.create"));
  const [rows, setRows] = useState<UserRow[]>([]);
  const [roleOptions, setRoleOptions] = useState<RoleOption[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [roleId, setRoleId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"user" | "role">("user");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const totalPages = inferTotalPages(page, pageSize, rows.length);
  const hasInfoPanel = Boolean(!canCreate || message || error);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  async function load() {
    if (!auth) return;
    setLoading(true);
    try {
      const [usersRes, rolesRes] = await Promise.all([
        api.get("/users", {
          params: { search: search || undefined, page, pageSize },
          headers: { Authorization: `Bearer ${auth.accessToken}` },
        }),
        api.get("/roles", {
          params: { page: 1, pageSize: 200 },
          headers: { Authorization: `Bearer ${auth.accessToken}` },
        }),
      ]);
      const users = (usersRes.data.data ?? []) as UserRow[];
      const roles = (rolesRes.data.data ?? []) as Array<{ id: string; name: string }>;
      setRows(users);
      setRoleOptions(roles.map((r) => ({ id: r.id, name: r.name })));
      if (!roleId && roles[0]) setRoleId(roles[0].id);
      setError("");
    } catch (loadError) {
      if (axios.isAxiosError(loadError)) setError(loadError.response?.data?.message ?? "Failed to load users");
      else setError("Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [auth?.accessToken, page, pageSize]);

  const activeRoleName = useMemo(
    () => roleOptions.find((r) => r.id === roleId)?.name ?? "Not selected",
    [roleOptions, roleId],
  );
  const sortedRows = useMemo(() => {
    const cloned = [...rows];
    cloned.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortBy === "role") return String(a.role?.name ?? "").localeCompare(String(b.role?.name ?? "")) * dir;
      return a.fullName.localeCompare(b.fullName) * dir;
    });
    return cloned;
  }, [rows, sortBy, sortDir]);

  function toggleSort(next: "user" | "role") {
    if (sortBy === next) setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    else {
      setSortBy(next);
      setSortDir("asc");
    }
  }

  async function saveUser() {
    if (!auth || !canCreate || !roleId) return;
    setSaving(true);
    try {
      if (editingUserId) {
        await api.patch(
          `/users/${editingUserId}`,
          {
            fullName: fullName.trim(),
            email: email.trim(),
            ...(password ? { password } : {}),
            phone: phone.trim() || undefined,
            roleId,
          },
          { headers: { Authorization: `Bearer ${auth.accessToken}` } },
        );
        setMessage("User updated");
      } else {
        await api.post(
          "/users",
          {
            fullName: fullName.trim(),
            email: email.trim(),
            password,
            phone: phone.trim() || undefined,
            roleId,
          },
          { headers: { Authorization: `Bearer ${auth.accessToken}` } },
        );
        setMessage("User created");
      }
      setFullName("");
      setEmail("");
      setPassword("");
      setPhone("");
      setEditingUserId(null);
      setError("");
      setFormOpen(false);
      setConfirmSaveOpen(false);
      await load();
    } catch (createError) {
      if (axios.isAxiosError(createError)) setError(createError.response?.data?.message ?? "Failed to create user");
      else setError("Failed to create user");
    } finally {
      setSaving(false);
    }
  }

  async function removeUser() {
    if (!auth || !deleteUserId) return;
    setSaving(true);
    try {
      await api.delete(`/users/${deleteUserId}`, {
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      setDeleteUserId(null);
      setMessage("User deleted");
      setError("");
      await load();
    } catch (deleteError) {
      if (axios.isAxiosError(deleteError)) setError(deleteError.response?.data?.message ?? "Failed to delete user");
      else setError("Failed to delete user");
    } finally {
      setSaving(false);
    }
  }

  function beginEditUser(user: UserRow) {
    setEditingUserId(user.id);
    setFullName(user.fullName);
    setEmail(user.email);
    setPhone(user.phone ?? "");
    setPassword("");
    if (user.role?.id) setRoleId(user.role.id);
    setFormOpen(true);
  }

  const canSubmit =
    canCreate &&
    fullName.trim() &&
    email.trim() &&
    roleId &&
    (editingUserId ? true : password.length >= 6);

  return (
    <main className="content">
      <PageHeader
        title="Users"
        subtitle="Create and assign users to roles"
        actions={
          canCreate ? (
            <button
              type="button"
              className="primary-btn"
              onClick={() => {
                setEditingUserId(null);
                setFullName("");
                setEmail("");
                setPassword("");
                setPhone("");
                setFormOpen(true);
              }}
            >
              <Plus size={16} />
              <span className="btn-label">Create User</span>
            </button>
          ) : null
        }
      />

      <StatCards
        items={[
          { label: "Users (page)", value: rows.length, icon: UserRound, tone: "blue" },
          { label: "Selected role", value: activeRoleName, icon: UserRound, tone: "teal" },
        ]}
      />

      {hasInfoPanel ? (
        <section className="panel panel--pad panel-section">
          {!canCreate ? <p className="badge-muted">Read-only access</p> : null}
          {message ? <p className="alert alert-success">{message}</p> : null}
          {error ? <p className="alert alert-error">{error}</p> : null}
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-toolbar">
          <div className="search-field">
            <Search size={18} />
            <input
              placeholder="Search users…"
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
                    <button type="button" className={`th-sort${sortBy === "user" ? " is-active" : ""}`} onClick={() => toggleSort("user")}>
                      USER
                      {sortDir === "asc" && sortBy === "user" ? <ArrowUpAZ size={14} /> : <ArrowDownAZ size={14} />}
                    </button>
                  </th>
                  <th>
                    <button type="button" className={`th-sort${sortBy === "role" ? " is-active" : ""}`} onClick={() => toggleSort("role")}>
                      ROLE
                      {sortDir === "asc" && sortBy === "role" ? <ArrowUpAZ size={14} /> : <ArrowDownAZ size={14} />}
                    </button>
                  </th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="table-empty">No users found for the current filters.</td>
                  </tr>
                ) : (
                  sortedRows.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div className="cell-strong">{user.fullName}</div>
                        <p>{user.email}</p>
                        {user.phone ? <p>{user.phone}</p> : null}
                      </td>
                      <td>{user.role?.name ?? "—"}</td>
                      <td>
                        <div className="inline-form">
                          <button type="button" className="btn btn-secondary btn-sm" disabled={!canCreate} onClick={() => beginEditUser(user)}>
                            <Pencil size={14} />
                            Edit
                          </button>
                          <button type="button" className="btn btn-danger btn-sm" disabled={!canCreate} onClick={() => setDeleteUserId(user.id)}>
                            <Trash2 size={14} />
                            Delete
                          </button>
                        </div>
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
        />
      </section>

      <FormModal
        open={formOpen}
        title={editingUserId ? "Edit user" : "Create user"}
        confirmLabel={editingUserId ? "Review update" : "Review create"}
        loading={saving}
        onCancel={() => setFormOpen(false)}
        onConfirm={() => setConfirmSaveOpen(true)}
      >
        <div className="inline-form">
          <input placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input
            placeholder={editingUserId ? "New password (optional)" : "Password (min 6 chars)"}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <input placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <CustomSelect
            value={roleId}
            placeholder="Select role"
            options={roleOptions.map((role) => ({ value: role.id, label: role.name }))}
            onChange={setRoleId}
          />
        </div>
        {!canSubmit ? <p className="page-desc">Fill required fields to continue.</p> : null}
      </FormModal>
      <ConfirmModal
        open={confirmSaveOpen}
        title={editingUserId ? "Update user?" : "Create user?"}
        message="Login access and role permissions will be updated immediately."
        confirmLabel={editingUserId ? "Update" : "Create"}
        loading={saving}
        onCancel={() => {
          setConfirmSaveOpen(false);
          setFormOpen(true);
        }}
        onConfirm={() => void saveUser()}
      />
      <ConfirmModal
        open={Boolean(deleteUserId)}
        title="Delete user?"
        message="This action cannot be undone."
        confirmLabel="Delete"
        danger
        loading={saving}
        onCancel={() => setDeleteUserId(null)}
        onConfirm={() => void removeUser()}
      />
    </main>
  );
}
