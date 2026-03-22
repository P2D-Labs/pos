import axios from "axios";
import { ArrowLeft, Save, Tag } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { SpinnerBlock } from "../components/ui/Spinner";
import { ImageField } from "../components/ui/ImageField";
import { CustomSelect } from "../components/ui/CustomSelect";
import { getAuthState } from "../models/auth";
import { api } from "../services/api";

type Option = { id: string; name: string; categoryId?: string };

const defaultForm: Record<string, string> = {
  type: "PRODUCT",
  status: "ACTIVE",
  name: "",
  code: "",
  sku: "",
  barcode: "",
  categoryId: "",
  subCategoryId: "",
  brandId: "",
  description: "",
  imageUrl: "",
  primaryUnitId: "",
  secondaryUnitId: "",
  secondaryToPrimaryFactor: "",
  allowSalesInSecondaryUnit: "false",
  allowPurchaseInSecondaryUnit: "false",
  allowSecondaryFraction: "false",
  trackInventory: "true",
  allowNegativeStock: "false",
  openingStockPrimary: "",
  reorderLevelPrimary: "",
  salesPricePrimary: "",
  purchasePricePrimary: "",
  taxable: "true",
  defaultTaxRateId: "",
  notes: "",
};

export function ItemEditorPage() {
  const navigate = useNavigate();
  const params = useParams();
  const itemId = params.id ?? "";
  const isEdit = Boolean(itemId);
  const auth = getAuthState();
  const canCreate = Boolean(auth?.permissions.includes("*") || auth?.permissions.includes("products.create"));

  const [form, setForm] = useState<Record<string, string>>(defaultForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [categories, setCategories] = useState<Option[]>([]);
  const [subCategories, setSubCategories] = useState<Option[]>([]);
  const [brands, setBrands] = useState<Option[]>([]);
  const [units, setUnits] = useState<Option[]>([]);
  const [taxRates, setTaxRates] = useState<Option[]>([]);

  const visibleSubCategories = useMemo(() => {
    if (!form.categoryId) return subCategories;
    return subCategories.filter((entry) => !entry.categoryId || entry.categoryId === form.categoryId);
  }, [subCategories, form.categoryId]);

  useEffect(() => {
    async function load() {
      if (!auth) return;
      setLoading(true);
      try {
        const requests = [
          api.get("/categories", { params: { page: 1, pageSize: 200 }, headers: { Authorization: `Bearer ${auth.accessToken}` } }),
          api.get("/subcategories", { params: { page: 1, pageSize: 200 }, headers: { Authorization: `Bearer ${auth.accessToken}` } }),
          api.get("/brands", { params: { page: 1, pageSize: 200 }, headers: { Authorization: `Bearer ${auth.accessToken}` } }),
          api.get("/units", { params: { page: 1, pageSize: 200 }, headers: { Authorization: `Bearer ${auth.accessToken}` } }),
          api.get("/tax-rates", { params: { page: 1, pageSize: 200 }, headers: { Authorization: `Bearer ${auth.accessToken}` } }),
        ] as const;
        const [categoriesRes, subCategoriesRes, brandsRes, unitsRes, taxRatesRes] = await Promise.all(requests);
        const nextSubCategories = (subCategoriesRes.data?.data ?? []).map((r: Record<string, unknown>) => ({
          id: String(r.id),
          name: String(r.name ?? r.id),
          categoryId: String(r.categoryId ?? ""),
        }));
        setCategories((categoriesRes.data?.data ?? []).map((r: Record<string, unknown>) => ({ id: String(r.id), name: String(r.name ?? r.id) })));
        setSubCategories(nextSubCategories);
        setBrands((brandsRes.data?.data ?? []).map((r: Record<string, unknown>) => ({ id: String(r.id), name: String(r.name ?? r.id) })));
        setUnits((unitsRes.data?.data ?? []).map((r: Record<string, unknown>) => ({ id: String(r.id), name: String(r.name ?? r.id) })));
        setTaxRates((taxRatesRes.data?.data ?? []).map((r: Record<string, unknown>) => ({ id: String(r.id), name: String(r.name ?? r.id) })));

        if (isEdit) {
          const itemRes = await api.get(`/items/${itemId}`, { headers: { Authorization: `Bearer ${auth.accessToken}` } });
          const row = (itemRes.data?.data ?? {}) as Record<string, unknown>;
          setForm({
            name: String(row.name ?? ""),
            type: String(row.type ?? "PRODUCT"),
            status: String(row.status ?? "ACTIVE"),
            code: String(row.code ?? ""),
            sku: String(row.sku ?? ""),
            barcode: String(row.barcode ?? ""),
            categoryId: String(row.categoryId ?? ""),
            subCategoryId: String(row.subCategoryId ?? ""),
            brandId: String(row.brandId ?? ""),
            description: String(row.description ?? ""),
            imageUrl: String(row.imageUrl ?? ""),
            primaryUnitId: String(row.primaryUnitId ?? ""),
            secondaryUnitId: String(row.secondaryUnitId ?? ""),
            secondaryToPrimaryFactor: String(row.secondaryToPrimaryFactor ?? ""),
            allowSalesInSecondaryUnit: String(row.allowSalesInSecondaryUnit ?? false),
            allowPurchaseInSecondaryUnit: String(row.allowPurchaseInSecondaryUnit ?? false),
            allowSecondaryFraction: String(row.allowSecondaryFraction ?? false),
            trackInventory: String(row.trackInventory ?? true),
            allowNegativeStock: String(row.allowNegativeStock ?? false),
            openingStockPrimary: String(row.openingStockPrimary ?? ""),
            reorderLevelPrimary: String(row.reorderLevelPrimary ?? ""),
            salesPricePrimary: String(row.salesPricePrimary ?? ""),
            purchasePricePrimary: String(row.purchasePricePrimary ?? ""),
            taxable: String(row.taxable ?? true),
            defaultTaxRateId: String(row.defaultTaxRateId ?? ""),
            notes: String(row.notes ?? ""),
          });
        } else {
          setForm(defaultForm);
        }
        setError("");
      } catch (loadError) {
        if (axios.isAxiosError(loadError)) setError(loadError.response?.data?.message ?? "Failed to load item form.");
        else setError("Failed to load item form.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [auth?.accessToken, isEdit, itemId]);

  async function submit() {
    if (!auth || !canCreate || !form.name.trim()) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const payload: Record<string, unknown> = {
        ...form,
      };
      for (const key of [
        "secondaryToPrimaryFactor",
        "openingStockPrimary",
        "reorderLevelPrimary",
        "salesPricePrimary",
        "purchasePricePrimary",
      ]) {
        if (payload[key] === "") delete payload[key];
        else payload[key] = Number(payload[key]);
      }
      for (const key of [
        "allowSalesInSecondaryUnit",
        "allowPurchaseInSecondaryUnit",
        "allowSecondaryFraction",
        "trackInventory",
        "allowNegativeStock",
        "taxable",
      ]) {
        payload[key] = payload[key] === "true";
      }
      Object.keys(payload).forEach((key) => {
        if (payload[key] === "") delete payload[key];
      });
      if (isEdit) {
        await api.patch(`/items/${itemId}`, payload, { headers: { Authorization: `Bearer ${auth.accessToken}` } });
      } else {
        await api.post("/items", payload, { headers: { Authorization: `Bearer ${auth.accessToken}` } });
      }
      setMessage(isEdit ? "Item updated successfully." : "Item created successfully.");
      navigate("/items");
    } catch (saveError) {
      if (axios.isAxiosError(saveError)) setError(saveError.response?.data?.message ?? "Failed to save item.");
      else setError("Failed to save item.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="content">
        <PageHeader title={isEdit ? "Edit Item" : "Create Item"} subtitle="Complete item setup" />
        <SpinnerBlock label="Loading item form" />
      </main>
    );
  }

  return (
    <main className="content">
      <PageHeader
        title={isEdit ? "Edit Item" : "Create Item"}
        subtitle="Complete item setup with linked master data"
        actions={
          <button type="button" className="btn btn-secondary" onClick={() => navigate("/items")}>
            <ArrowLeft size={16} />
            Back to Items
          </button>
        }
      />
      {message ? <p className="alert alert-success">{message}</p> : null}
      {error ? <p className="alert alert-error">{error}</p> : null}

      <section className="panel panel--pad">
        <div className="stack">
          <h3 className="form-section-title">BASIC DETAILS</h3>
          <div className="form-grid">
            <label>
              Item Type
              <CustomSelect
                value={form.type}
                placeholder="Select item type"
                options={[
                  { value: "PRODUCT", label: "PRODUCT" },
                  { value: "SERVICE", label: "SERVICE" },
                ]}
                onChange={(next) => setForm((p) => ({ ...p, type: next }))}
              />
            </label>
            <label>
              Status
              <CustomSelect
                value={form.status}
                placeholder="Select status"
                options={[
                  { value: "ACTIVE", label: "ACTIVE" },
                  { value: "INACTIVE", label: "INACTIVE" },
                ]}
                onChange={(next) => setForm((p) => ({ ...p, status: next }))}
              />
            </label>
            <label>
              Item Name
              <input placeholder="Item name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            </label>
            <label>
              Code
              <input placeholder="Code" value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} />
            </label>
            <label>
              SKU
              <input placeholder="SKU" value={form.sku} onChange={(e) => setForm((p) => ({ ...p, sku: e.target.value }))} />
            </label>
            <label>
              Barcode
              <input placeholder="Barcode" value={form.barcode} onChange={(e) => setForm((p) => ({ ...p, barcode: e.target.value }))} />
            </label>
            <label>
              Description
              <textarea rows={3} placeholder="Short description" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
            </label>
          </div>

          <h3 className="form-section-title">CATEGORY AND BRAND</h3>
          <div className="form-grid">
            <label>
              Category
              <CustomSelect
                value={form.categoryId}
                placeholder="Select category"
                options={categories.map((o) => ({ value: o.id, label: o.name }))}
                onChange={(next) => setForm((p) => ({ ...p, categoryId: next, subCategoryId: "" }))}
                searchable
              />
            </label>
            <label>
              Subcategory
              <CustomSelect
                value={form.subCategoryId}
                placeholder="Select subcategory"
                options={visibleSubCategories.map((o) => ({ value: o.id, label: o.name }))}
                onChange={(next) => setForm((p) => ({ ...p, subCategoryId: next }))}
                searchable
              />
            </label>
            <label>
              Brand
              <CustomSelect
                value={form.brandId}
                placeholder="Select brand"
                options={brands.map((o) => ({ value: o.id, label: o.name }))}
                onChange={(next) => setForm((p) => ({ ...p, brandId: next }))}
                searchable
              />
            </label>
          </div>

          <h3 className="form-section-title">UNITS AND PRICING</h3>
          <div className="form-grid">
            <label>
              Primary Unit
              <CustomSelect
                value={form.primaryUnitId}
                placeholder="Select primary unit"
                options={units.map((o) => ({ value: o.id, label: o.name }))}
                onChange={(next) => setForm((p) => ({ ...p, primaryUnitId: next }))}
                searchable
              />
            </label>
            <label>
              Secondary Unit
              <CustomSelect
                value={form.secondaryUnitId}
                placeholder="Select secondary unit"
                options={units.map((o) => ({ value: o.id, label: o.name }))}
                onChange={(next) => setForm((p) => ({ ...p, secondaryUnitId: next }))}
                searchable
              />
            </label>
            <label>
              Secondary to Primary Factor
              <input type="number" value={form.secondaryToPrimaryFactor} onChange={(e) => setForm((p) => ({ ...p, secondaryToPrimaryFactor: e.target.value }))} />
            </label>
            <label>
              Track Inventory
              <CustomSelect value={form.trackInventory} placeholder="Track inventory" options={[{ value: "true", label: "Yes" }, { value: "false", label: "No" }]} onChange={(next) => setForm((p) => ({ ...p, trackInventory: next }))} />
            </label>
            <label>
              Allow Negative Stock
              <CustomSelect value={form.allowNegativeStock} placeholder="Allow negative stock" options={[{ value: "true", label: "Yes" }, { value: "false", label: "No" }]} onChange={(next) => setForm((p) => ({ ...p, allowNegativeStock: next }))} />
            </label>
            <label>
              Allow Sales In Secondary Unit
              <CustomSelect value={form.allowSalesInSecondaryUnit} placeholder="Allow sales in secondary unit" options={[{ value: "true", label: "Yes" }, { value: "false", label: "No" }]} onChange={(next) => setForm((p) => ({ ...p, allowSalesInSecondaryUnit: next }))} />
            </label>
            <label>
              Allow Purchase In Secondary Unit
              <CustomSelect value={form.allowPurchaseInSecondaryUnit} placeholder="Allow purchase in secondary unit" options={[{ value: "true", label: "Yes" }, { value: "false", label: "No" }]} onChange={(next) => setForm((p) => ({ ...p, allowPurchaseInSecondaryUnit: next }))} />
            </label>
            <label>
              Allow Secondary Fraction
              <CustomSelect value={form.allowSecondaryFraction} placeholder="Allow secondary fraction" options={[{ value: "true", label: "Yes" }, { value: "false", label: "No" }]} onChange={(next) => setForm((p) => ({ ...p, allowSecondaryFraction: next }))} />
            </label>
            <label>
              Opening Stock (Primary)
              <input type="number" value={form.openingStockPrimary} onChange={(e) => setForm((p) => ({ ...p, openingStockPrimary: e.target.value }))} />
            </label>
            <label>
              Reorder Level (Primary)
              <input type="number" value={form.reorderLevelPrimary} onChange={(e) => setForm((p) => ({ ...p, reorderLevelPrimary: e.target.value }))} />
            </label>
            <label>
              Sales Price
              <input type="number" value={form.salesPricePrimary} onChange={(e) => setForm((p) => ({ ...p, salesPricePrimary: e.target.value }))} />
            </label>
            <label>
              Purchase Price
              <input type="number" value={form.purchasePricePrimary} onChange={(e) => setForm((p) => ({ ...p, purchasePricePrimary: e.target.value }))} />
            </label>
            <label>
              Default Tax Rate
              <CustomSelect
                value={form.defaultTaxRateId}
                placeholder="Select default tax rate"
                options={taxRates.map((o) => ({ value: o.id, label: o.name }))}
                onChange={(next) => setForm((p) => ({ ...p, defaultTaxRateId: next }))}
                searchable
              />
            </label>
            <label>
              Taxable
              <CustomSelect value={form.taxable} placeholder="Taxable" options={[{ value: "true", label: "Yes" }, { value: "false", label: "No" }]} onChange={(next) => setForm((p) => ({ ...p, taxable: next }))} />
            </label>
            <label>
              Notes
              <textarea rows={3} placeholder="Internal notes" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
            </label>
          </div>
        </div>
        <div className="stack panel-section-top">
          <ImageField
            label="Product image"
            value={form.imageUrl}
            onChange={(next) => setForm((p) => ({ ...p, imageUrl: next }))}
            hint="Recommended 800x800 PNG/JPG, up to 2MB. You can paste URL, drag-drop, or select file."
          />
          <p className="page-desc">
            <Tag size={14} className="icon-title" />
            Item image preview is shown instantly and stored with the record.
          </p>
        </div>
        <div className="modal-card__actions" style={{ justifyContent: "flex-start" }}>
          <button type="button" className="primary-btn" onClick={() => void submit()} disabled={!canCreate || saving || !form.name.trim()}>
            <Save size={16} />
            {saving ? "Saving..." : isEdit ? "Update Item" : "Create Item"}
          </button>
        </div>
      </section>
    </main>
  );
}
