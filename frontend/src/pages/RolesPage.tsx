import axios from "axios";
import { ArrowDownAZ, ArrowUpAZ, KeyRound, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { StatCards } from "../components/StatCards";
import { ConfirmModal } from "../components/ui/ConfirmModal";
import { FormModal } from "../components/ui/FormModal";
import { PaginationBar } from "../components/ui/PaginationBar";
import { SpinnerBlock } from "../components/ui/Spinner";
import { inferTotalPages } from "../lib/pagination";
import { getAuthState } from "../models/auth";
import { api } from "../services/api";

type RoleRow = {
  id: string;
  name: string;
  description?: string | null;
  permissions: string[];
};

export function RolesPage() {
  const auth = getAuthState();
  const canCreate = Boolean(auth?.permissions.includes("*") || auth?.permissions.includes("roles.create"));
  const [rows, setRows] = useState<RoleRow[]>([]);
  const [permissionSuggestions, setPermissionSuggestions] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [deleteRoleId, setDeleteRoleId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"role" | "permissions">("role");
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
      const [rolesRes, permsRes] = await Promise.all([
        api.get("/roles", {
          params: { search: search || undefined, page, pageSize },
          headers: { Authorization: `Bearer ${auth.accessToken}` },
        }),
        api
          .get("/permissions/suggestions", {
            headers: { Authorization: `Bearer ${auth.accessToken}` },
          })
          .catch(() => ({ data: { data: [] } })),
      ]);
      setRows((rolesRes.data.data ?? []) as RoleRow[]);
      const perms = (permsRes.data?.data ?? []) as string[];
      setPermissionSuggestions(perms);
      setError("");
    } catch (loadError) {
      if (axios.isAxiosError(loadError)) setError(loadError.response?.data?.message ?? "Failed to load roles");
      else setError("Failed to load roles");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [auth?.accessToken, page, pageSize]);

  const selectedCount = useMemo(
    () => Object.values(selectedPermissions).filter(Boolean).length,
    [selectedPermissions],
  );
  const sortedRows = useMemo(() => {
    const cloned = [...rows];
    cloned.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortBy === "permissions") return (a.permissions.length - b.permissions.length) * dir;
      return a.name.localeCompare(b.name) * dir;
    });
    return cloned;
  }, [rows, sortBy, sortDir]);

  function toggleSort(next: "role" | "permissions") {
    if (sortBy === next) setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    else {
      setSortBy(next);
      setSortDir(next === "role" ? "asc" : "desc");
    }
  }

  async function saveRole() {
    if (!auth || !canCreate || !name.trim()) return;
    setSaving(true);
    try {
      const permissions = Object.entries(selectedPermissions)
        .filter(([, checked]) => checked)
        .map(([permission]) => permission);
      if (editingRoleId) {
        await api.patch(
          `/roles/${editingRoleId}`,
          {
            name: name.trim(),
            description: description.trim() || undefined,
            permissions,
          },
          { headers: { Authorization: `Bearer ${auth.accessToken}` } },
        );
        setMessage("Role updated");
      } else {
        await api.post(
          "/roles",
          {
            name: name.trim(),
            description: description.trim() || undefined,
            permissions,
          },
          { headers: { Authorization: `Bearer ${auth.accessToken}` } },
        );
        setMessage("Role created");
      }
      setName("");
      setDescription("");
      setSelectedPermissions({});
      setEditingRoleId(null);
      setError("");
      setFormOpen(false);
      setConfirmSaveOpen(false);
      await load();
    } catch (saveError) {
      if (axios.isAxiosError(saveError)) setError(saveError.response?.data?.message ?? "Failed to save role");
      else setError("Failed to save role");
    } finally {
      setSaving(false);
    }
  }

  function beginEditRole(role: RoleRow) {
    setEditingRoleId(role.id);
    setName(role.name);
    setDescription(role.description ?? "");
    const next: Record<string, boolean> = {};
    role.permissions.forEach((permission) => {
      next[permission] = true;
    });
    setSelectedPermissions(next);
    setFormOpen(true);
  }

  async function removeRole() {
    if (!auth || !deleteRoleId) return;
    setSaving(true);
    try {
      await api.delete(`/roles/${deleteRoleId}`, {
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      setDeleteRoleId(null);
      setMessage("Role deleted");
      setError("");
      await load();
    } catch (deleteError) {
      if (axios.isAxiosError(deleteError)) setError(deleteError.response?.data?.message ?? "Failed to delete role");
      else setError("Failed to delete role");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="content">
      <PageHeader
        title="Roles"
        subtitle="Define permissions and role templates"
        actions={
          canCreate ? (
            <button
              type="button"
              className="primary-btn"
              onClick={() => {
                setEditingRoleId(null);
                setName("");
                setDescription("");
                setSelectedPermissions({});
                setFormOpen(true);
              }}
            >
              <Plus size={16} />
              <span className="btn-label">Create Role</span>
            </button>
          ) : null
        }
      />

      <StatCards
        items={[
          { label: "Roles (page)", value: rows.length, icon: KeyRound, tone: "blue" },
          { label: "Selected permissions", value: selectedCount, icon: KeyRound, tone: "teal" },
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
              placeholder="Search roles…"
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
                    <button type="button" className={`th-sort${sortBy === "role" ? " is-active" : ""}`} onClick={() => toggleSort("role")}>
                      ROLE
                      {sortDir === "asc" && sortBy === "role" ? <ArrowUpAZ size={14} /> : <ArrowDownAZ size={14} />}
                    </button>
                  </th>
                  <th>
                    <button type="button" className={`th-sort${sortBy === "permissions" ? " is-active" : ""}`} onClick={() => toggleSort("permissions")}>
                      PERMISSIONS
                      {sortDir === "asc" && sortBy === "permissions" ? <ArrowUpAZ size={14} /> : <ArrowDownAZ size={14} />}
                    </button>
                  </th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="table-empty">No roles found for the current filters.</td>
                  </tr>
                ) : (
                  sortedRows.map((role) => (
                    <tr key={role.id}>
                      <td>
                        <div className="cell-strong">{role.name}</div>
                        {role.description ? <p>{role.description}</p> : null}
                      </td>
                      <td>
                        {role.permissions.length === 0 ? (
                          <span className="badge-muted">No permissions</span>
                        ) : (
                          <div className="toggle-grid">
                            {role.permissions.slice(0, 6).map((permission) => (
                              <span key={permission} className="badge-muted">
                                {permission}
                              </span>
                            ))}
                            {role.permissions.length > 6 ? <span className="badge-muted">+{role.permissions.length - 6} more</span> : null}
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="inline-form">
                          <button type="button" className="btn btn-secondary btn-sm" disabled={!canCreate} onClick={() => beginEditRole(role)}>
                            <Pencil size={14} />
                            Edit
                          </button>
                          <button type="button" className="btn btn-danger btn-sm" disabled={!canCreate} onClick={() => setDeleteRoleId(role.id)}>
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
        title={editingRoleId ? "Edit role" : "Create role"}
        confirmLabel={editingRoleId ? "Review update" : "Review create"}
        loading={saving}
        onCancel={() => setFormOpen(false)}
        onConfirm={() => setConfirmSaveOpen(true)}
      >
        <div className="stack">
          <div className="inline-form">
            <input placeholder="Role name" value={name} onChange={(e) => setName(e.target.value)} />
            <input
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="toggle-grid">
            {permissionSuggestions.map((permission) => (
              <label key={permission} className="toggle-chip">
                <input
                  type="checkbox"
                  checked={selectedPermissions[permission] === true}
                  onChange={(e) =>
                    setSelectedPermissions((prev) => ({
                      ...prev,
                      [permission]: e.target.checked,
                    }))
                  }
                />
                {permission}
              </label>
            ))}
          </div>
        </div>
      </FormModal>
      <ConfirmModal
        open={confirmSaveOpen}
        title={editingRoleId ? "Update role?" : "Create role?"}
        message="Role permissions will be applied immediately to assigned users."
        confirmLabel={editingRoleId ? "Update" : "Create"}
        loading={saving}
        onCancel={() => {
          setConfirmSaveOpen(false);
          setFormOpen(true);
        }}
        onConfirm={() => void saveRole()}
      />
      <ConfirmModal
        open={Boolean(deleteRoleId)}
        title="Delete role?"
        message="This cannot be undone. Roles assigned to users cannot be deleted."
        confirmLabel="Delete"
        danger
        loading={saving}
        onCancel={() => setDeleteRoleId(null)}
        onConfirm={() => void removeRole()}
      />
    </main>
  );
}
