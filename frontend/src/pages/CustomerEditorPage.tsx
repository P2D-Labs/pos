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
  customerType: "REGULAR",
  contactPerson: "",
  phone: "",
  email: "",
  billingAddress: "",
  shippingAddress: "",
  taxNo: "",
  creditLimit: "",
  paymentTermsDays: "",
  openingBalance: "",
  isActive: "true",
  notes: "",
};

export function CustomerEditorPage() {
  const navigate = useNavigate();
  const params = useParams();
  const customerId = params.id ?? "";
  const isEdit = Boolean(customerId);
  const auth = getAuthState();
  const canCreate = Boolean(auth?.permissions.includes("*") || auth?.permissions.includes("customers.create"));
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
        const response = await api.get(`/customers/${customerId}`, {
          headers: { Authorization: `Bearer ${auth.accessToken}` },
        });
        const row = (response.data?.data ?? null) as Record<string, unknown> | null;
        if (row) {
          setForm({
            code: String(row.code ?? ""),
            name: String(row.name ?? ""),
            customerType: String(row.customerType ?? "REGULAR"),
            contactPerson: String(row.contactPerson ?? ""),
            phone: String(row.phone ?? ""),
            email: String(row.email ?? ""),
            billingAddress: String(row.billingAddress ?? ""),
            shippingAddress: String(row.shippingAddress ?? ""),
            taxNo: String(row.taxNo ?? ""),
            creditLimit: String(row.creditLimit ?? ""),
            paymentTermsDays: String(row.paymentTermsDays ?? ""),
            openingBalance: String(row.openingBalance ?? ""),
            isActive: String(row.isActive ?? true),
            notes: String(row.notes ?? ""),
          });
        }
      } catch (loadError) {
        if (axios.isAxiosError(loadError)) setError(loadError.response?.data?.message ?? "Failed to load customer.");
        else setError("Failed to load customer.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [auth?.accessToken, isEdit, customerId]);

  async function submit() {
    if (!auth || !canCreate || !form.name.trim()) return;
    setSaving(true);
    setError("");
    try {
      if (isEdit && form.customerType === "WALK_IN") {
        setError("The walk-in customer is a protected system record and cannot be edited.");
        setSaving(false);
        return;
      }
      const payload: Record<string, unknown> = {
        ...form,
        creditLimit: form.creditLimit === "" ? undefined : Number(form.creditLimit),
        paymentTermsDays: form.paymentTermsDays === "" ? undefined : Number(form.paymentTermsDays),
        openingBalance: form.openingBalance === "" ? undefined : Number(form.openingBalance),
        isActive: form.isActive === "true",
      };
      if (!isEdit) {
        delete payload.customerType;
      }
      Object.keys(payload).forEach((key) => {
        if (payload[key] === "") delete payload[key];
      });
      if (isEdit) {
        await api.patch(`/customers/${customerId}`, payload, { headers: { Authorization: `Bearer ${auth.accessToken}` } });
      } else {
        await api.post("/customers", payload, { headers: { Authorization: `Bearer ${auth.accessToken}` } });
      }
      navigate("/customers");
    } catch (saveError) {
      if (axios.isAxiosError(saveError)) setError(saveError.response?.data?.message ?? "Failed to save customer.");
      else setError("Failed to save customer.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="content">
        <PageHeader title={isEdit ? "Edit Customer" : "Create Customer"} subtitle="Customer details" />
        <SpinnerBlock label="Loading customer form" />
      </main>
    );
  }

  return (
    <main className="content">
      <PageHeader
        title={isEdit ? "Edit Customer" : "Create Customer"}
        subtitle="Customer details and credit profile"
        actions={
          <button type="button" className="btn btn-secondary" onClick={() => navigate("/customers")}>
            <ArrowLeft size={16} />
            Back to Customers
          </button>
        }
      />
      {error ? <p className="alert alert-error">{error}</p> : null}
      <section className="panel panel--pad">
        <div className="form-grid">
          <label>Customer Code<input value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} /></label>
          <label>Customer Name<input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} /></label>
          {isEdit ? (
            <label>Customer Type
              <CustomSelect
                value={form.customerType}
                placeholder="Select customer type"
                options={[{ value: "REGULAR", label: "REGULAR" }, { value: "WALK_IN", label: "WALK_IN" }]}
                onChange={(next) => setForm((p) => ({ ...p, customerType: next }))}
                disabled={form.customerType === "WALK_IN"}
              />
            </label>
          ) : null}
          <label>Contact Person<input value={form.contactPerson} onChange={(e) => setForm((p) => ({ ...p, contactPerson: e.target.value }))} /></label>
          <label>Phone<input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} /></label>
          <label>Email<input value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} /></label>
          <label>Billing Address<input value={form.billingAddress} onChange={(e) => setForm((p) => ({ ...p, billingAddress: e.target.value }))} /></label>
          <label>Shipping Address<input value={form.shippingAddress} onChange={(e) => setForm((p) => ({ ...p, shippingAddress: e.target.value }))} /></label>
          <label>Tax Number<input value={form.taxNo} onChange={(e) => setForm((p) => ({ ...p, taxNo: e.target.value }))} /></label>
          <label>Credit Limit<input type="number" value={form.creditLimit} onChange={(e) => setForm((p) => ({ ...p, creditLimit: e.target.value }))} /></label>
          <label>Payment Terms (Days)<input type="number" value={form.paymentTermsDays} onChange={(e) => setForm((p) => ({ ...p, paymentTermsDays: e.target.value }))} /></label>
          <label>Opening Balance<input type="number" value={form.openingBalance} onChange={(e) => setForm((p) => ({ ...p, openingBalance: e.target.value }))} /></label>
          <label>Active
            <CustomSelect value={form.isActive} placeholder="Select active state" options={[{ value: "true", label: "Yes" }, { value: "false", label: "No" }]} onChange={(next) => setForm((p) => ({ ...p, isActive: next }))} />
          </label>
          <label>Notes<textarea rows={3} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} /></label>
        </div>
        <div className="modal-card__actions" style={{ justifyContent: "flex-start" }}>
          <button
            type="button"
            className="primary-btn"
            onClick={() => void submit()}
            disabled={!canCreate || saving || !form.name.trim() || (isEdit && form.customerType === "WALK_IN")}
          >
            <Save size={16} />
            {saving ? "Saving..." : isEdit ? "Update Customer" : "Create Customer"}
          </button>
        </div>
      </section>
    </main>
  );
}
