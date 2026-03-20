import axios from "axios";
import { useEffect, useState } from "react";
import { getAuthState } from "../models/auth";
import { api } from "../services/api";

const defaultModuleToggles: Record<string, boolean> = {
  reports: true,
  pos: true,
  quotations: true,
  salesOrders: true,
  salesInvoices: true,
  purchases: true,
  pricing: true,
  inventory: true,
  payments: true,
  refunds: true,
  expenses: true,
  printCenter: true,
  salesReturns: true,
};

const moduleToggleLabels: Record<string, string> = {
  reports: "Reports",
  pos: "POS",
  quotations: "Quotations",
  salesOrders: "Sales Orders",
  salesInvoices: "Sales Invoices",
  purchases: "Purchases",
  pricing: "Pricing",
  inventory: "Inventory",
  payments: "Payments",
  refunds: "Refunds",
  expenses: "Expenses",
  printCenter: "Print Center",
  salesReturns: "Sales Returns",
};

export function SettingsPage() {
  const auth = getAuthState();
  const canManageSettings = Boolean(auth?.permissions.includes("*") || auth?.permissions.includes("settings.manage"));
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [taxInvoicePrefix, setTaxInvoicePrefix] = useState("INV");
  const [nonTaxInvoicePrefix, setNonTaxInvoicePrefix] = useState("NINV");
  const [themeColor, setThemeColor] = useState("#f34e4e");
  const [taxFooterText, setTaxFooterText] = useState("Thank you for your business.");
  const [nonTaxFooterText, setNonTaxFooterText] = useState("Thank you for your business.");
  const [moduleToggles, setModuleToggles] = useState<Record<string, boolean>>(defaultModuleToggles);
  const [permissionSuggestions, setPermissionSuggestions] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadPageData() {
      if (!auth) return;
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
        setOwnerName(String(business.ownerName ?? ""));
        setTaxInvoicePrefix(String(business.taxInvoicePrefix ?? "INV"));
        setNonTaxInvoicePrefix(String(business.nonTaxInvoicePrefix ?? "NINV"));

        const customization = customizationResponse.data?.data ?? {};
        const themeConfig = customization.themeConfig as { primaryColor?: string } | undefined;
        if (themeConfig?.primaryColor) setThemeColor(themeConfig.primaryColor);
        const invoiceTemplate = customization.invoiceTemplate as { footerText?: string } | undefined;
        const nonTaxTemplate = customization.nonTaxTemplate as { footerText?: string } | undefined;
        if (invoiceTemplate?.footerText) setTaxFooterText(invoiceTemplate.footerText);
        if (nonTaxTemplate?.footerText) setNonTaxFooterText(nonTaxTemplate.footerText);
        const savedToggles = customization.moduleToggles as Record<string, boolean> | undefined;
        setModuleToggles({ ...defaultModuleToggles, ...(savedToggles ?? {}) });
      } catch {
        setPermissionSuggestions([]);
      }
    }
    void loadPageData();
  }, [auth]);

  async function saveBusiness() {
    if (!auth || !canManageSettings) return;
    try {
      await api.post(
        "/settings/business",
        { name: businessName, ownerName },
        { headers: { Authorization: `Bearer ${auth.accessToken}` } },
      );
      setMessage("Business settings saved");
      setError("");
    } catch (saveError) {
      if (axios.isAxiosError(saveError)) setError(saveError.response?.data?.message ?? "Failed to save business settings");
    }
  }

  async function saveNumbering() {
    if (!auth || !canManageSettings) return;
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
    } catch (saveError) {
      if (axios.isAxiosError(saveError)) setError(saveError.response?.data?.message ?? "Failed to save numbering settings");
    }
  }

  async function saveCustomization() {
    if (!auth || !canManageSettings) return;
    try {
      await api.post(
        "/settings/customization",
        {
          themeConfig: { primaryColor: themeColor, radius: 12, fontFamily: "Segoe UI" },
          invoiceTemplate: { footerText: taxFooterText.trim() || "Thank you for your business." },
          nonTaxTemplate: { footerText: nonTaxFooterText.trim() || "Thank you for your business." },
          moduleToggles,
          paymentMethods: ["CASH", "CARD", "BANK_TRANSFER", "WALLET", "CHEQUE"],
          allowedDiscount: 100000,
        },
        { headers: { Authorization: `Bearer ${auth.accessToken}` } },
      );
      setMessage("Customization saved");
      setError("");
    } catch (saveError) {
      if (axios.isAxiosError(saveError)) setError(saveError.response?.data?.message ?? "Failed to save customization");
    }
  }

  async function copyPermissionSuggestions() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(permissionSuggestions, null, 2));
      setMessage("Permission suggestions copied");
      setError("");
    } catch {
      setError("Failed to copy permission suggestions");
    }
  }

  return (
    <main className="content">
      <header className="content-header">
        <div>
          <h1>Settings</h1>
          <p>Business, numbering, and customization</p>
        </div>
      </header>

      <section className="panel pad">
        <h3>Business</h3>
        <div className="inline-form">
          <input placeholder="Business name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
          <input placeholder="Owner name" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
          <button onClick={saveBusiness} disabled={!canManageSettings}>Save business</button>
        </div>
      </section>

      <section className="panel pad">
        <h3>Numbering</h3>
        <div className="inline-form">
          <input placeholder="Tax invoice prefix" value={taxInvoicePrefix} onChange={(e) => setTaxInvoicePrefix(e.target.value)} />
          <input placeholder="Non-tax invoice prefix" value={nonTaxInvoicePrefix} onChange={(e) => setNonTaxInvoicePrefix(e.target.value)} />
          <button onClick={saveNumbering} disabled={!canManageSettings}>Save numbering</button>
        </div>
      </section>

      <section className="panel pad">
        <h3>Customization</h3>
        <div className="inline-form">
          <input type="color" value={themeColor} onChange={(e) => setThemeColor(e.target.value)} />
          <button onClick={saveCustomization} disabled={!canManageSettings}>Save customization</button>
        </div>
        <div className="stack" style={{ marginTop: 10 }}>
          <label>
            Tax invoice footer text
            <textarea
              value={taxFooterText}
              onChange={(e) => setTaxFooterText(e.target.value)}
              rows={2}
              style={{ width: "100%", marginTop: 4 }}
            />
          </label>
          <label>
            Non-tax invoice footer text
            <textarea
              value={nonTaxFooterText}
              onChange={(e) => setNonTaxFooterText(e.target.value)}
              rows={2}
              style={{ width: "100%", marginTop: 4 }}
            />
          </label>
        </div>
        <div className="inline-form" style={{ marginTop: 8 }}>
          {Object.keys(defaultModuleToggles).map((key) => (
            <label key={key}>
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

      <section className="panel pad">
        <h3>Role permissions helper</h3>
        <p>Use these backend-suggested permissions while creating roles.</p>
        <div className="inline-form">
          <button onClick={copyPermissionSuggestions} disabled={permissionSuggestions.length === 0}>
            Copy permissions JSON
          </button>
        </div>
        {permissionSuggestions.length > 0 ? (
          <code>{permissionSuggestions.join(", ")}</code>
        ) : (
          <p>No permission suggestions available for this account.</p>
        )}
      </section>

      {message ? <p>{message}</p> : null}
      {!canManageSettings ? <p>You have view-only access for settings.</p> : null}
      {error ? <p>{error}</p> : null}
    </main>
  );
}
