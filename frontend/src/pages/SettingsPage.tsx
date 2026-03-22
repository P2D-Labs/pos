import axios from "axios";
import { Copy, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { ConfirmModal } from "../components/ui/ConfirmModal";
import { ImageField } from "../components/ui/ImageField";
import { SpinnerBlock } from "../components/ui/Spinner";
import { getAuthState } from "../models/auth";
import { api } from "../services/api";
import { applyThemePrimaryCss } from "../lib/theme";
import { moduleToggleOrder } from "../services/module.service";

const defaultModuleToggles: Record<string, boolean> = {
  roles: true,
  users: true,
  customers: true,
  suppliers: true,
  items: true,
  reports: true,
  pos: true,
  quotations: true,
  salesOrders: true,
  salesInvoices: true,
  purchases: true,
  taxRates: true,
  units: true,
  categories: true,
  subcategories: true,
  brands: true,
  ledger: true,
  inventory: true,
  payments: true,
  salesReturns: true,
  sessions: true,
  auditLogs: true,
};

const moduleToggleLabels: Record<string, string> = {
  roles: "Roles",
  users: "Users",
  customers: "Customers",
  suppliers: "Suppliers",
  items: "Items",
  reports: "Reports",
  pos: "POS",
  quotations: "Quotations",
  salesOrders: "Sales Orders",
  salesInvoices: "Sales Invoices",
  purchases: "Purchases",
  taxRates: "Tax Rates",
  units: "Units",
  categories: "Categories",
  brands: "Brands",
  ledger: "Ledger",
  inventory: "Inventory",
  payments: "Payments",
  salesReturns: "Sales Returns",
  sessions: "Device Sessions",
  auditLogs: "Audit Logs",
};

export function SettingsPage() {
  const auth = getAuthState();
  const canManageSettings = Boolean(auth?.permissions.includes("*") || auth?.permissions.includes("settings.manage"));
  const [businessName, setBusinessName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("");
  const [taxRegistrationNo, setTaxRegistrationNo] = useState("");
  const [currency, setCurrency] = useState("LKR");
  const [timezone, setTimezone] = useState("Asia/Colombo");
  const [financialYearStart, setFinancialYearStart] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [signatureUrl, setSignatureUrl] = useState("");
  const [receiptFooter, setReceiptFooter] = useState("");
  const [taxInvoicePrefix, setTaxInvoicePrefix] = useState("INV");
  const [nonTaxInvoicePrefix, setNonTaxInvoicePrefix] = useState("NINV");
  const [themeColor, setThemeColor] = useState("#f34e4e");
  const [posShowProductImages, setPosShowProductImages] = useState(false);
  const [taxFooterText, setTaxFooterText] = useState("Thank you for your business.");
  const [nonTaxFooterText, setNonTaxFooterText] = useState("Thank you for your business.");
  const [quotationDisclaimer, setQuotationDisclaimer] = useState("");
  const [returnDisclaimer, setReturnDisclaimer] = useState("");
  const [moduleToggles, setModuleToggles] = useState<Record<string, boolean>>(defaultModuleToggles);
  const [permissionSuggestions, setPermissionSuggestions] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | "business" | "numbering" | "customization">(null);
  const orderedPermissionSuggestions = [...permissionSuggestions].sort((a, b) => a.localeCompare(b));

  useEffect(() => {
    async function loadPageData() {
      if (!auth) return;
      setLoading(true);
      try {
        const [permissionsResponse, businessResponse, customizationResponse] = await Promise.all([
          api.get("/permissions/suggestions", {
            headers: { Authorization: `Bearer ${auth.accessToken}` },
          }),
          api.get("/business/me", {
            headers: { Authorization: `Bearer ${auth.accessToken}` },
          }),
          api.get("/settings/customization", {
            headers: { Authorization: `Bearer ${auth.accessToken}` },
          }),
        ]);

        setPermissionSuggestions((permissionsResponse.data?.data ?? []) as string[]);

        const business = businessResponse.data?.data ?? {};
        setBusinessName(String(business.name ?? ""));
        setLegalName(String(business.legalName ?? ""));
        setOwnerName(String(business.ownerName ?? ""));
        setBusinessEmail(String(business.email ?? ""));
        setBusinessPhone(String(business.phone ?? ""));
        setAddressLine1(String(business.addressLine1 ?? ""));
        setAddressLine2(String(business.addressLine2 ?? ""));
        setCity(String(business.city ?? ""));
        setStateName(String(business.state ?? ""));
        setPostalCode(String(business.postalCode ?? ""));
        setCountry(String(business.country ?? ""));
        setTaxRegistrationNo(String(business.taxRegistrationNo ?? ""));
        setCurrency(String(business.currency ?? "LKR"));
        setTimezone(String(business.timezone ?? "Asia/Colombo"));
        setFinancialYearStart(String(business.financialYearStart ?? ""));
        setLogoUrl(String(business.logoUrl ?? ""));
        setSignatureUrl(String(business.signatureUrl ?? ""));
        setReceiptFooter(String(business.receiptFooter ?? ""));
        setTaxInvoicePrefix(String(business.taxInvoicePrefix ?? "INV"));
        setNonTaxInvoicePrefix(String(business.nonTaxInvoicePrefix ?? "NINV"));

        const customization = customizationResponse.data?.data ?? {};
        const themeConfig = customization.themeConfig as { primaryColor?: string } | undefined;
        if (themeConfig?.primaryColor) setThemeColor(themeConfig.primaryColor);
        const invoiceTemplate = customization.invoiceTemplate as { footerText?: string } | undefined;
        const nonTaxTemplate = customization.nonTaxTemplate as { footerText?: string } | undefined;
        if (invoiceTemplate?.footerText) setTaxFooterText(invoiceTemplate.footerText);
        if (nonTaxTemplate?.footerText) setNonTaxFooterText(nonTaxTemplate.footerText);
        setQuotationDisclaimer(String((customization as { quotationDisclaimer?: string }).quotationDisclaimer ?? ""));
        setReturnDisclaimer(String((customization as { returnDisclaimer?: string }).returnDisclaimer ?? ""));
        const savedToggles = customization.moduleToggles as Record<string, boolean> | undefined;
        setModuleToggles({ ...defaultModuleToggles, ...(savedToggles ?? {}) });
      } catch {
        setPermissionSuggestions([]);
      } finally {
        setLoading(false);
      }
    }
    void loadPageData();
  }, [auth?.accessToken]);

  async function saveBusiness() {
    if (!auth || !canManageSettings) return;
    setSaving(true);
    try {
      await api.post(
        "/settings/business",
        {
          name: businessName,
          legalName: legalName || undefined,
          ownerName: ownerName || undefined,
          email: businessEmail || undefined,
          phone: businessPhone || undefined,
          addressLine1: addressLine1 || undefined,
          addressLine2: addressLine2 || undefined,
          city: city || undefined,
          state: stateName || undefined,
          postalCode: postalCode || undefined,
          country: country || undefined,
          taxRegistrationNo: taxRegistrationNo || undefined,
          currency: currency || undefined,
          timezone: timezone || undefined,
          financialYearStart: financialYearStart || undefined,
          logoUrl: logoUrl || undefined,
          signatureUrl: signatureUrl || undefined,
          receiptFooter: receiptFooter || undefined,
        },
        { headers: { Authorization: `Bearer ${auth.accessToken}` } },
      );
      setMessage("Business settings saved");
      setError("");
      setConfirmAction(null);
    } catch (saveError) {
      if (axios.isAxiosError(saveError)) setError(saveError.response?.data?.message ?? "Failed to save business settings");
    } finally {
      setSaving(false);
    }
  }

  async function saveNumbering() {
    if (!auth || !canManageSettings) return;
    setSaving(true);
    try {
      await api.patch(
        "/settings/numbering",
        {
          taxInvoicePrefix,
          nonTaxInvoicePrefix,
          taxOrderPrefix: "ORD",
          nonTaxOrderPrefix: "NORD",
          quotationPrefix: "QT",
          purchasePrefix: "PUR",
          salesReturnPrefix: "RET",
        },
        { headers: { Authorization: `Bearer ${auth.accessToken}` } },
      );
      setMessage("Numbering settings saved");
      setError("");
      setConfirmAction(null);
    } catch (saveError) {
      if (axios.isAxiosError(saveError)) setError(saveError.response?.data?.message ?? "Failed to save numbering settings");
    } finally {
      setSaving(false);
    }
  }

  async function saveCustomization() {
    if (!auth || !canManageSettings) return;
    setSaving(true);
    try {
      await api.post(
        "/settings/customization",
        {
          themeConfig: {
            primaryColor: themeColor,
            radius: 12,
            fontFamily: "Segoe UI",
            posShowProductImages,
          },
          invoiceTemplate: { footerText: taxFooterText.trim() || "Thank you for your business." },
          nonTaxTemplate: { footerText: nonTaxFooterText.trim() || "Thank you for your business." },
          quotationDisclaimer: quotationDisclaimer.trim() || undefined,
          returnDisclaimer: returnDisclaimer.trim() || undefined,
          moduleToggles,
          paymentMethods: ["CASH", "CARD", "BANK_TRANSFER", "WALLET", "CHEQUE"],
          allowedDiscount: 100000,
        },
        { headers: { Authorization: `Bearer ${auth.accessToken}` } },
      );
      applyThemePrimaryCss(themeColor);
      setMessage("Customization saved");
      setError("");
      setConfirmAction(null);
    } catch (saveError) {
      if (axios.isAxiosError(saveError)) setError(saveError.response?.data?.message ?? "Failed to save customization");
    } finally {
      setSaving(false);
    }
  }

  async function copyPermissionSuggestions() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(orderedPermissionSuggestions, null, 2));
      setMessage("Permission suggestions copied");
      setError("");
    } catch {
      setError("Failed to copy permission suggestions");
    }
  }

  if (loading) {
    return (
      <main className="content">
        <PageHeader title="Settings" subtitle="Business, numbering, and customization" />
        <SpinnerBlock label="Loading settings" />
      </main>
    );
  }

  return (
    <main className="content">
      <PageHeader title="Settings" subtitle="Business, numbering, and customization" />

      <section className="panel panel--pad panel-section">
        <h3 className="section-title">
          Business
        </h3>
        <div className="panel panel--pad panel-section">
          <div className="inline-form">
            {logoUrl ? <img src={logoUrl} alt="Business logo" style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }} /> : null}
            <div className="stack">
              <div className="cell-strong">{businessName || "Business name"}</div>
              <p className="page-desc">{legalName || "Legal name not set"}</p>
              <p className="page-desc">{[addressLine1, addressLine2, city, stateName, postalCode, country].filter(Boolean).join(", ") || "Business address not set"}</p>
              <p className="page-desc">Tax No: {taxRegistrationNo || "Not set"} | FY Start: {financialYearStart || "Not set"}</p>
            </div>
            {signatureUrl ? <img src={signatureUrl} alt="Business signature" style={{ width: 140, height: 84, objectFit: "contain", borderRadius: 8, border: "1px solid var(--border)", background: "#fff" }} /> : null}
          </div>
        </div>
        <div className="inline-form">
          <input placeholder="Business name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
          <input placeholder="Legal name (optional)" value={legalName} onChange={(e) => setLegalName(e.target.value)} />
          <input placeholder="Owner name" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
          <input placeholder="Business email" value={businessEmail} onChange={(e) => setBusinessEmail(e.target.value)} />
          <input placeholder="Business phone" value={businessPhone} onChange={(e) => setBusinessPhone(e.target.value)} />
          <input placeholder="Address line 1" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} />
          <input placeholder="Address line 2" value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} />
          <input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
          <input placeholder="State" value={stateName} onChange={(e) => setStateName(e.target.value)} />
          <input placeholder="Postal code" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
          <input placeholder="Country" value={country} onChange={(e) => setCountry(e.target.value)} />
          <input placeholder="Tax registration no" value={taxRegistrationNo} onChange={(e) => setTaxRegistrationNo(e.target.value)} />
          <input placeholder="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)} />
          <input placeholder="Timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
          <input placeholder="Financial year start (YYYY-MM-DD)" value={financialYearStart} onChange={(e) => setFinancialYearStart(e.target.value)} />
          <input placeholder="Receipt footer" value={receiptFooter} onChange={(e) => setReceiptFooter(e.target.value)} />
          <button
            type="button"
            className="primary-btn"
            onClick={() => setConfirmAction("business")}
            disabled={!canManageSettings || saving}
          >
            <Save size={16} />
            Save
          </button>
        </div>
        <div className="stack panel-section-top">
          <ImageField label="Business logo" value={logoUrl} onChange={setLogoUrl} hint="Recommended 512x512 PNG/JPG, up to 2MB." />
          <ImageField label="Business signature" value={signatureUrl} onChange={setSignatureUrl} hint="Recommended transparent PNG, up to 2MB." />
        </div>
      </section>

      <section className="panel panel--pad panel-section">
        <h3 className="section-title">
          Numbering
        </h3>
        <div className="inline-form">
          <input placeholder="Tax invoice prefix" value={taxInvoicePrefix} onChange={(e) => setTaxInvoicePrefix(e.target.value)} />
          <input
            placeholder="Non-tax invoice prefix"
            value={nonTaxInvoicePrefix}
            onChange={(e) => setNonTaxInvoicePrefix(e.target.value)}
          />
          <button
            type="button"
            className="primary-btn"
            onClick={() => setConfirmAction("numbering")}
            disabled={!canManageSettings || saving}
          >
            Save
          </button>
        </div>
      </section>

      <section className="panel panel--pad panel-section">
        <h3 className="section-title">
          Customization
        </h3>
        <p className="page-desc" style={{ marginTop: 4, marginBottom: 12 }}>
          <strong>Prints &amp; bills:</strong> Invoice and quotation prints use your <strong>Business</strong> profile (name, logo, address, signature, receipt footer). The <strong>tax</strong> and <strong>non-tax invoice footer</strong> texts below are applied per document type (tax vs non-tax invoices); if a template footer is empty, the business receipt footer is used. Optional <strong>quotation</strong> and <strong>sales return</strong> notes appear on those documents only (advisory text; no automatic enforcement). Invoice numbering prefixes are under <strong>Numbering</strong>.
        </p>
        <div className="inline-form" style={{ alignItems: "center" }}>
          <input type="color" value={themeColor} onChange={(e) => setThemeColor(e.target.value)} aria-label="Theme color" />
          <button
            type="button"
            className="primary-btn"
            onClick={() => setConfirmAction("customization")}
            disabled={!canManageSettings || saving}
          >
            Save
          </button>
        </div>
        <label
          className="toggle-chip settings-pos-images-row"
          style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "nowrap", cursor: "pointer" }}
        >
          <input
            type="checkbox"
            checked={posShowProductImages}
            onChange={(e) => setPosShowProductImages(e.target.checked)}
            style={{ flexShrink: 0 }}
          />
          <span>Show product images on POS / till grid</span>
        </label>
        <div className="stack" style={{ marginTop: 10 }}>
          <label>
            Tax invoice footer text
            <textarea
              value={taxFooterText}
              onChange={(e) => setTaxFooterText(e.target.value)}
              rows={2}
            />
          </label>
          <label>
            Non-tax invoice footer text
            <textarea
              value={nonTaxFooterText}
              onChange={(e) => setNonTaxFooterText(e.target.value)}
              rows={2}
            />
          </label>
          <label>
            Quotation note (e.g. validity)
            <textarea
              value={quotationDisclaimer}
              onChange={(e) => setQuotationDisclaimer(e.target.value)}
              rows={2}
              placeholder="e.g. Valid for 14 days from the date of issue."
            />
          </label>
          <label>
            Sales return note
            <textarea
              value={returnDisclaimer}
              onChange={(e) => setReturnDisclaimer(e.target.value)}
              rows={2}
            />
          </label>
        </div>
        <div className="toggle-grid" style={{ marginTop: 8 }}>
          {moduleToggleOrder.map((key) => (
            <label key={key} className="toggle-chip">
              <input
                type="checkbox"
                checked={moduleToggles[key] !== false}
                onChange={(e) =>
                  setModuleToggles((prev) => ({
                    ...prev,
                    [key]: e.target.checked,
                  }))
                }
              />
              {` ${moduleToggleLabels[key] ?? key}`}
            </label>
          ))}
        </div>
      </section>

      <section className="panel panel--pad panel-section">
        <h3 className="section-title">
          Role permissions helper
        </h3>
        <p className="page-desc">Use these backend-suggested permissions while creating roles.</p>
        <div className="inline-form" style={{ margin: "10px 0 12px" }}>
          <button type="button" className="btn btn-secondary" onClick={copyPermissionSuggestions} disabled={orderedPermissionSuggestions.length === 0}>
            <Copy size={16} />
            Copy JSON
          </button>
        </div>
        {orderedPermissionSuggestions.length > 0 ? (
          <code>{orderedPermissionSuggestions.join(", ")}</code>
        ) : (
          <p className="page-desc">No permission suggestions available.</p>
        )}
      </section>

      {message ? <p className="alert alert-success">{message}</p> : null}
      {!canManageSettings ? <p className="badge-muted">Read-only access</p> : null}
      {error ? <p className="alert alert-error">{error}</p> : null}
      <ConfirmModal
        open={confirmAction !== null}
        title={
          confirmAction === "business"
            ? "Save business settings?"
            : confirmAction === "numbering"
              ? "Save numbering settings?"
              : "Save customization settings?"
        }
        message="These changes will apply immediately for this business."
        confirmLabel="Save"
        loading={saving}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          if (confirmAction === "business") void saveBusiness();
          else if (confirmAction === "numbering") void saveNumbering();
          else if (confirmAction === "customization") void saveCustomization();
        }}
      />
    </main>
  );
}
