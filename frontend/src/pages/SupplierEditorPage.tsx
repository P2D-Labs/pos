import axios from "axios";
import { ArrowLeft, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { CustomSelect } from "../components/ui/CustomSelect";
import { SpinnerBlock } from "../components/ui/Spinner";
import { getAuthState } from "../models/auth";
import { api } from "../services/api";

const defaultForm: Record<string, string> = {
  code: "",
  name: "",
  contactPerson: "",
  phone: "",
  email: "",
  billingAddress: "",
  taxNo: "",
  paymentTermsDays: "",
  openingBalance: "",
  isActive: "true",
  notes: "",
};

export function SupplierEditorPage() {
  const navigate = useNavigate();
  const params = useParams();
  const supplierId = params.id ?? "";
  const isEdit = Boolean(supplierId);
  const auth = getAuthState();
  const canCreate = Boolean(auth?.permissions.includes("*") || auth?.permissions.includes("suppliers.create"));
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      if (!auth) return;
      if (!isEdit) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const response = await api.get(`/suppliers/${supplierId}`, {
          headers: { Authorization: `Bearer ${auth.accessToken}` },
        });
        const row = (response.data?.data ?? null) as Record<string, unknown> | null;
        if (row) {
          setForm({
            code: String(row.code ?? ""),
            name: String(row.name ?? ""),
            contactPerson: String(row.contactPerson ?? ""),
            phone: String(row.phone ?? ""),
            email: String(row.email ?? ""),
            billingAddress: String(row.billingAddress ?? ""),
            taxNo: String(row.taxNo ?? ""),
            paymentTermsDays: String(row.paymentTermsDays ?? ""),
            openingBalance: String(row.openingBalance ?? ""),
            isActive: String(row.isActive ?? true),
            notes: String(row.notes ?? ""),
          });
        }
      } catch (loadError) {
        if (axios.isAxiosError(loadError)) setError(loadError.response?.data?.message ?? "Failed to load supplier.");
        else setError("Failed to load supplier.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [auth?.accessToken, isEdit, supplierId]);

  async function submit() {
    if (!auth || !canCreate || !form.name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const payload: Record<string, unknown> = {
        ...form,
        paymentTermsDays: form.paymentTermsDays === "" ? undefined : Number(form.paymentTermsDays),
        openingBalance: form.openingBalance === "" ? undefined : Number(form.openingBalance),
        isActive: form.isActive === "true",
      };
      Object.keys(payload).forEach((key) => {
        if (payload[key] === "") delete payload[key];
      });
      if (isEdit) {
        await api.patch(`/suppliers/${supplierId}`, payload, { headers: { Authorization: `Bearer ${auth.accessToken}` } });
      } else {
        await api.post("/suppliers", payload, { headers: { Authorization: `Bearer ${auth.accessToken}` } });
      }
      navigate("/suppliers");
    } catch (saveError) {
      if (axios.isAxiosError(saveError)) setError(saveError.response?.data?.message ?? "Failed to save supplier.");
      else setError("Failed to save supplier.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="content">
        <PageHeader title={isEdit ? "Edit Supplier" : "Create Supplier"} subtitle="Supplier details" />
        <SpinnerBlock label="Loading supplier form" />
      </main>
    );
  }

  return (
    <main className="content">
      <PageHeader
        title={isEdit ? "Edit Supplier" : "Create Supplier"}
        subtitle="Supplier details and payable profile"
        actions={
          <button type="button" className="btn btn-secondary" onClick={() => navigate("/suppliers")}>
            <ArrowLeft size={16} />
            Back to Suppliers
          </button>
        }
      />
      {error ? <p className="alert alert-error">{error}</p> : null}
      <section className="panel panel--pad">
        <div className="form-grid">
          <label>Supplier Code<input value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} /></label>
          <label>Supplier Name<input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} /></label>
          <label>Contact Person<input value={form.contactPerson} onChange={(e) => setForm((p) => ({ ...p, contactPerson: e.target.value }))} /></label>
          <label>Phone<input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} /></label>
          <label>Email<input value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} /></label>
          <label>Billing Address<input value={form.billingAddress} onChange={(e) => setForm((p) => ({ ...p, billingAddress: e.target.value }))} /></label>
          <label>Tax Number<input value={form.taxNo} onChange={(e) => setForm((p) => ({ ...p, taxNo: e.target.value }))} /></label>
          <label>Payment Terms (Days)<input type="number" value={form.paymentTermsDays} onChange={(e) => setForm((p) => ({ ...p, paymentTermsDays: e.target.value }))} /></label>
          <label>Opening Balance<input type="number" value={form.openingBalance} onChange={(e) => setForm((p) => ({ ...p, openingBalance: e.target.value }))} /></label>
          <label>Active
            <CustomSelect value={form.isActive} placeholder="Select active state" options={[{ value: "true", label: "Yes" }, { value: "false", label: "No" }]} onChange={(next) => setForm((p) => ({ ...p, isActive: next }))} />
          </label>
          <label>Notes<textarea rows={3} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} /></label>
        </div>
        <div className="modal-card__actions" style={{ justifyContent: "flex-start" }}>
          <button type="button" className="primary-btn" onClick={() => void submit()} disabled={!canCreate || saving || !form.name.trim()}>
            <Save size={16} />
            {saving ? "Saving..." : isEdit ? "Update Supplier" : "Create Supplier"}
          </button>
        </div>
      </section>
    </main>
  );
}
