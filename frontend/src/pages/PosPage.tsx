import axios from "axios";
import { Check, FileText, ListOrdered, Minus, Plus, Printer, ScanLine, Search, ShoppingCart, Trash2, User, Wallet } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { ConfirmModal } from "../components/ui/ConfirmModal";
import { CustomSelect } from "../components/ui/CustomSelect";
import { SpinnerBlock } from "../components/ui/Spinner";
import { getAuthState } from "../models/auth";
import { api } from "../services/api";
import { getOptions } from "../services/document.service";

type CartLine = {
  itemId: string;
  name: string;
  quantity: number;
  unitId: string;
  unitLabel: string;
  unitPrice: number;
  discountAmount: number;
  taxable: boolean;
  /** Percent e.g. 18 — used when document is TAX */
  taxRatePercent: number;
  source: string;
  canEditPrice: boolean;
  imageUrl?: string | null;
};

type ProductRow = {
  id: string;
  name: string;
  salesPricePrimary?: unknown;
  imageUrl?: string | null;
  categoryId?: string | null;
  primaryUnitId?: string | null;
  defaultTaxRateId?: string | null;
  taxable?: boolean;
};

type PaymentMethod = "CASH" | "CARD" | "BANK_TRANSFER" | "WALLET" | "CHEQUE";

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "CASH", label: "Cash" },
  { value: "CARD", label: "Card" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "WALLET", label: "Wallet" },
  { value: "CHEQUE", label: "Cheque" },
];

type CheckoutContext = {
  customerType: string;
  storeCreditBalance: number;
  accountsReceivable: number;
  pendingOrders: Array<{
    id: string;
    orderNo: string;
    balanceDue: number;
    grandTotal: number;
    amountPaid: number;
  }>;
  /** Recent returns that added to store credit (informational; apply credit via store credit tender). */
  recentReturns?: Array<{
    id: string;
    salesReturnNo: string;
    grandTotal: number;
    createdAt: string;
    sourceInvoiceId: string;
  }>;
};

type TenderRow = { id: string; method: PaymentMethod; amount: string };

function newTenderRowId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatMoney(n: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
}

function parseAmount(s: string) {
  const n = Number(String(s).replace(/,/g, ""));
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

export function PosPage() {
  const auth = getAuthState();
  const canCreateNonTax = Boolean(auth?.permissions.includes("*") || auth?.permissions.includes("sales.non_tax.create"));
  const canCreateSales = Boolean(auth?.permissions.includes("*") || auth?.permissions.includes("sales.create"));

  const [customers, setCustomers] = useState<Array<{ id: string; label: string }>>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [unitById, setUnitById] = useState<Record<string, { name: string; code?: string | null }>>({});
  const [taxPercentByRateId, setTaxPercentByRateId] = useState<Record<string, number>>({});
  const [posShowProductImages, setPosShowProductImages] = useState(false);
  const [moduleToggles, setModuleToggles] = useState<Record<string, boolean> | null>(null);

  const [customerId, setCustomerId] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [debouncedProductQuery, setDebouncedProductQuery] = useState("");
  const [categoryTab, setCategoryTab] = useState("");
  const [documentTaxMode, setDocumentTaxMode] = useState<"TAX" | "NON_TAX">("TAX");
  const [lines, setLines] = useState<CartLine[]>([]);
  const [productRows, setProductRows] = useState<ProductRow[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [currency, setCurrency] = useState("LKR");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [checkoutCtx, setCheckoutCtx] = useState<CheckoutContext | null>(null);
  const [checkoutCtxLoading, setCheckoutCtxLoading] = useState(false);
  const [tenderRows, setTenderRows] = useState<TenderRow[]>([{ id: newTenderRowId(), method: "CASH", amount: "" }]);
  const [storeCreditStr, setStoreCreditStr] = useState("");
  const [payTowardByOrderId, setPayTowardByOrderId] = useState<Record<string, string>>({});
  const [applyFullStoreCredit, setApplyFullStoreCredit] = useState(false);
  const [lastPosPrint, setLastPosPrint] = useState<{
    orderId: string;
    invoiceId: string;
    documentTaxMode: "TAX" | "NON_TAX";
    invoiceNo?: string;
  } | null>(null);
  const [lastQuotationForPrint, setLastQuotationForPrint] = useState<{ id: string } | null>(null);
  const [quotationConfirmOpen, setQuotationConfirmOpen] = useState(false);
  const [quotationSubmitLoading, setQuotationSubmitLoading] = useState(false);

  const quotationsEnabled = useMemo(() => {
    if (!moduleToggles) return true;
    return moduleToggles.quotations !== false;
  }, [moduleToggles]);
  const canSaveQuotation = canCreateSales && quotationsEnabled;

  async function openOrderPrintHtml(path: string) {
    if (!auth) return;
    try {
      const res = await api.get(path, { headers: { Authorization: `Bearer ${auth.accessToken}` } });
      const html = res.data?.data?.html as string | undefined;
      if (!html) return;
      const w = window.open("", "_blank");
      if (w) {
        w.document.write(html);
        w.document.close();
      }
    } catch {
      setError("Could not open print preview.");
    }
  }

  async function openQuotationPrintPdf(path: string) {
    if (!auth) return;
    try {
      const res = await api.get(path, { responseType: "blob", headers: { Authorization: `Bearer ${auth.accessToken}` } });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch {
      setError("Could not open quotation PDF.");
    }
  }

  async function submitQuotation() {
    if (!auth || !customerId || lines.length === 0) return;
    setQuotationSubmitLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await api.post(
        "/quotations",
        { customerId, lines: buildLinePayload() },
        { headers: { Authorization: `Bearer ${auth.accessToken}` } },
      );
      const saved = res.data?.data as { id?: string; quotationNo?: string } | undefined;
      setMessage(
        saved?.quotationNo
          ? `Quotation ${saved.quotationNo} saved. View it under Quotations.`
          : "Quotation saved. View it under Quotations.",
      );
      setLastQuotationForPrint(saved?.id ? { id: saved.id } : null);
      setLastPosPrint(null);
      setLines([]);
      setTenderRows([{ id: newTenderRowId(), method: "CASH", amount: "" }]);
      setStoreCreditStr("");
      setApplyFullStoreCredit(false);
      setPayTowardByOrderId({});
      setQuotationConfirmOpen(false);
    } catch (e) {
      if (axios.isAxiosError(e)) setError(e.response?.data?.message ?? "Failed to save quotation.");
      else setError("Failed to save quotation.");
    } finally {
      setQuotationSubmitLoading(false);
    }
  }

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedProductQuery(productQuery.trim()), 280);
    return () => window.clearTimeout(t);
  }, [productQuery]);

  useEffect(() => {
    async function load() {
      if (!auth) return;
      setLoading(true);
      try {
        const [customerOpts, catRes, unitRes, taxRes, custRes] = await Promise.all([
          getOptions(auth.accessToken, "/customers"),
          api.get("/auth/categories", { headers: { Authorization: `Bearer ${auth.accessToken}` } }).catch(() => ({ data: { data: [] } })),
          api.get("/auth/units", { headers: { Authorization: `Bearer ${auth.accessToken}` } }).catch(() => ({ data: { data: [] } })),
          api.get("/auth/tax-rates", { headers: { Authorization: `Bearer ${auth.accessToken}` } }).catch(() => ({ data: { data: [] } })),
          api.get("/settings/customization", { headers: { Authorization: `Bearer ${auth.accessToken}` } }).catch(() => ({ data: {} })),
        ]);
        setCustomers(customerOpts);
        setCategories((catRes.data?.data ?? []) as Array<{ id: string; name: string }>);
        const units = (unitRes.data?.data ?? []) as Array<{ id: string; name: string; symbol?: string | null }>;
        const umap: Record<string, { name: string; code?: string | null }> = {};
        for (const u of units) umap[u.id] = { name: u.name, code: u.symbol ?? null };
        setUnitById(umap);
        const tr = (taxRes.data?.data ?? []) as Array<{ id: string; ratePercent: unknown }>;
        const trMap: Record<string, number> = {};
        for (const r of tr) trMap[r.id] = Number(r.ratePercent ?? 0);
        setTaxPercentByRateId(trMap);

        const customization = custRes.data?.data ?? {};
        const mt = customization.moduleToggles as Record<string, boolean> | undefined;
        setModuleToggles(
          mt && typeof mt === "object" && !Array.isArray(mt) ? mt : {},
        );
        const themeConfig = customization.themeConfig as { posShowProductImages?: boolean } | undefined;
        setPosShowProductImages(Boolean(themeConfig?.posShowProductImages));
        const businessRes = await api.get("/business/me", { headers: { Authorization: `Bearer ${auth.accessToken}` } }).catch(() => ({ data: {} }));
        const cur = (businessRes.data?.data as { currency?: string } | undefined)?.currency;
        if (cur) setCurrency(cur);

        if (customerOpts[0]) setCustomerId(customerOpts[0].id);
        setError("");
      } catch {
        setError("Failed to load POS");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [auth?.accessToken]);

  useEffect(() => {
    async function loadProducts() {
      if (!auth) return;
      setProductsLoading(true);
      try {
        const res = await api.get("/items", {
          params: {
            page: 1,
            pageSize: 500,
            search: debouncedProductQuery || undefined,
            categoryId: categoryTab || undefined,
          },
          headers: { Authorization: `Bearer ${auth.accessToken}` },
        });
        setProductRows((res.data.data ?? []) as ProductRow[]);
      } catch {
        setProductRows([]);
      } finally {
        setProductsLoading(false);
      }
    }
    void loadProducts();
  }, [auth?.accessToken, debouncedProductQuery, categoryTab]);

  useEffect(() => {
    async function loadCtx() {
      if (!auth || !customerId) {
        setCheckoutCtx(null);
        return;
      }
      setCheckoutCtxLoading(true);
      try {
        const res = await api.get(`/customers/${customerId}/checkout-context`, {
          headers: { Authorization: `Bearer ${auth.accessToken}` },
        });
        const d = res.data?.data as CheckoutContext;
        setCheckoutCtx(d);
        setPayTowardByOrderId({});
        setStoreCreditStr("");
        setApplyFullStoreCredit(false);
      } catch {
        setCheckoutCtx(null);
      } finally {
        setCheckoutCtxLoading(false);
      }
    }
    void loadCtx();
  }, [auth?.accessToken, customerId]);

  const { subtotalPreTax, taxTotal, grandTotal } = useMemo(() => {
    let sub = 0;
    let tax = 0;
    for (const line of lines) {
      const pre = line.quantity * line.unitPrice - line.discountAmount;
      sub += pre;
      const rate =
        documentTaxMode === "TAX" && line.taxable ? line.taxRatePercent : 0;
      tax += (pre * rate) / 100;
    }
    return { subtotalPreTax: sub, taxTotal: tax, grandTotal: sub + tax };
  }, [lines, documentTaxMode]);

  const tenderCashTotal = useMemo(
    () => tenderRows.reduce((s, r) => s + parseAmount(r.amount), 0),
    [tenderRows],
  );
  const storeCreditNum = useMemo(() => {
    if (applyFullStoreCredit && checkoutCtx) return checkoutCtx.storeCreditBalance;
    return parseAmount(storeCreditStr);
  }, [applyFullStoreCredit, checkoutCtx, storeCreditStr]);
  const tenderTotal = useMemo(() => tenderCashTotal + storeCreditNum, [tenderCashTotal, storeCreditNum]);

  const payTowardOrdersPayload = useMemo(() => {
    const out: Array<{ salesOrderId: string; amount: number }> = [];
    if (!checkoutCtx || checkoutCtx.customerType === "WALK_IN") return out;
    for (const o of checkoutCtx.pendingOrders) {
      const raw = payTowardByOrderId[o.id];
      const amt = parseAmount(raw ?? "");
      if (amt > 0.0001) out.push({ salesOrderId: o.id, amount: amt });
    }
    return out;
  }, [checkoutCtx, payTowardByOrderId]);

  const sumPriorAllocated = useMemo(() => payTowardOrdersPayload.reduce((s, p) => s + p.amount, 0), [payTowardOrdersPayload]);

  const remainingAfterPrior = Math.max(0, tenderTotal - sumPriorAllocated);
  const appliedToNewPreview = Math.min(remainingAfterPrior, grandTotal);
  const newBalancePreview = Math.max(0, grandTotal - appliedToNewPreview);
  const changeOrOverpayPreview = Math.max(0, remainingAfterPrior - appliedToNewPreview);

  const autoClassification = useMemo(() => {
    if (grandTotal <= 0.0001) return "zero_total";
    if (newBalancePreview <= 0.0001) return "paid_in_full";
    return "on_account";
  }, [grandTotal, newBalancePreview]);

  const isWalkIn = checkoutCtx?.customerType === "WALK_IN";

  const resolveUnitLabel = useCallback(
    (unitId: string) => {
      const u = unitById[unitId];
      if (!u) return "unit";
      return u.name || u.code || "unit";
    },
    [unitById],
  );

  const resolveTaxPercentForItem = useCallback(
    (item: ProductRow) => {
      if (!item.taxable) return 0;
      if (!item.defaultTaxRateId) return 0;
      return taxPercentByRateId[item.defaultTaxRateId] ?? 0;
    },
    [taxPercentByRateId],
  );

  async function addItemById(id: string) {
    if (!auth || !id) return;
    let itemRow: ProductRow | undefined = productRows.find((p) => p.id === id);
    if (!itemRow || !itemRow.primaryUnitId) {
      try {
        const full = await api.get(`/items/${id}`, { headers: { Authorization: `Bearer ${auth.accessToken}` } });
        itemRow = full.data.data as ProductRow;
      } catch {
        setError("Product not found");
        return;
      }
    }
    const primaryUnitId = itemRow.primaryUnitId ?? "";
    if (!primaryUnitId) {
      setError("Product has no primary unit configured");
      return;
    }
    try {
      const lastCartLine = [...lines].reverse().find((l) => l.itemId === id && l.unitId === primaryUnitId);
      let unitPrice = 0;
      let priceSource = "ITEM_DEFAULT";
      let canEdit = true;
      if (lastCartLine) {
        unitPrice = lastCartLine.unitPrice;
        priceSource = "CURRENT_CART";
        canEdit = lastCartLine.canEditPrice;
      } else {
        const response = await api.get(`/items/${id}/resolved-price`, {
          params: { unitType: "PRIMARY", unitId: primaryUnitId },
          headers: { Authorization: `Bearer ${auth.accessToken}` },
        });
        const priceData = response.data.data;
        unitPrice = Number(priceData.price ?? 0);
        priceSource = String(priceData.source ?? "ITEM_DEFAULT");
        canEdit = Boolean(priceData.canEdit);
      }
      const taxPct = resolveTaxPercentForItem(itemRow);

      setLines((prev) => [
        ...prev,
        {
          itemId: id,
          name: itemRow.name ?? id,
          quantity: 1,
          unitId: primaryUnitId,
          unitLabel: resolveUnitLabel(primaryUnitId),
          unitPrice,
          discountAmount: 0,
          taxable: Boolean(itemRow.taxable),
          taxRatePercent: taxPct,
          source: priceSource,
          canEditPrice: canEdit,
          imageUrl: itemRow.imageUrl ?? null,
        },
      ]);
      setProductQuery("");
      setError("");
    } catch {
      setError("Could not resolve price for product");
    }
  }

  async function addByScan() {
    const q = productQuery.trim().toLowerCase();
    const matched =
      productRows.find((p) => p.name.toLowerCase().includes(q)) ||
      productRows.find((p) => String(p.id).toLowerCase() === q);
    if (!matched) {
      setError("No product found for scan / search");
      return;
    }
    setError("");
    await addItemById(matched.id);
  }

  function updateLine(index: number, patch: Partial<CartLine>) {
    setLines((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  function buildLinePayload() {
    return lines.map((line) => {
      const effectiveTax =
        documentTaxMode === "NON_TAX" || !line.taxable ? 0 : line.taxRatePercent;
      return {
        itemId: line.itemId,
        enteredQuantity: line.quantity,
        unitType: "PRIMARY" as const,
        unitId: line.unitId,
        unitPrice: line.unitPrice,
        discountAmount: line.discountAmount,
        taxRate: effectiveTax,
      };
    });
  }

  async function submitSalesOrder() {
    if (!auth || !customerId || lines.length === 0) return;
    if (documentTaxMode === "NON_TAX" && !canCreateNonTax) {
      setError("Non-tax orders not allowed for your role");
      return;
    }
    if (isWalkIn && newBalancePreview > 0.0001) {
      setError("Walk-in customers must pay the full cart total today.");
      return;
    }
    if (sumPriorAllocated > tenderTotal + 0.0001) {
      setError("Allocations to old orders exceed total tender.");
      return;
    }
    if (!applyFullStoreCredit && storeCreditNum > (checkoutCtx?.storeCreditBalance ?? 0) + 0.0001) {
      setError("Store credit exceeds available balance.");
      return;
    }
    setSubmitLoading(true);
    setError("");
    setMessage("");
    try {
      const paymentLines = tenderRows
        .map((r) => ({ method: r.method, amount: parseAmount(r.amount) }))
        .filter((r) => r.amount > 0.0001);
      const res = await api.post(
        "/sales-orders",
        {
          customerId,
          documentTaxMode,
          lines: buildLinePayload(),
          ...(paymentLines.length > 0 ? { paymentLines } : { initialPaymentAmount: 0, paymentMethod: "CASH" }),
          ...(applyFullStoreCredit ? { applyFullStoreCredit: true } : storeCreditNum > 0 ? { storeCreditAmount: storeCreditNum } : {}),
          payTowardOrders: payTowardOrdersPayload.length > 0 ? payTowardOrdersPayload : undefined,
        },
        { headers: { Authorization: `Bearer ${auth.accessToken}` } },
      );
      const saved = res.data?.data as
        | {
            id?: string;
            documentTaxMode?: "TAX" | "NON_TAX";
            salesInvoice?: { id?: string; invoiceNo?: string };
            checkout?: Record<string, unknown>;
          }
        | undefined;
      const checkout = saved?.checkout as
        | {
            checkoutBatchId?: string;
            classification?: string;
            appliedToPriorOrders?: number;
            appliedToNewOrder?: number;
            newOrderBalanceDue?: number;
            changeOrOverpay?: number;
            storeCreditCashPayout?: number;
          }
        | undefined;
      const batch = checkout?.checkoutBatchId ? ` Batch ${String(checkout.checkoutBatchId)}.` : "";
      const cashPayout = checkout?.storeCreditCashPayout && checkout.storeCreditCashPayout > 0.0001
        ? ` Return credit paid out as cash: ${formatMoney(checkout.storeCreditCashPayout, currency)}.`
        : "";
      const inv = saved?.salesInvoice;
      const invBit =
        inv?.invoiceNo && saved?.id && inv?.id
          ? ` Invoice ${inv.invoiceNo} created with this order.`
          : saved?.id && inv?.id
            ? " Sales invoice created with this order."
            : "";
      setMessage(
        `Order saved.${invBit}${batch} ${checkout?.classification === "PAID_IN_FULL" ? "Paid in full." : checkout?.classification === "ON_ACCOUNT" ? "Balance on account." : ""}${cashPayout}`.trim(),
      );
      if (saved?.id && inv?.id) {
        setLastPosPrint({
          orderId: saved.id,
          invoiceId: inv.id,
          documentTaxMode: saved.documentTaxMode ?? documentTaxMode,
          invoiceNo: inv.invoiceNo,
        });
      } else {
        setLastPosPrint(null);
      }
      setLastQuotationForPrint(null);
      setLines([]);
      setTenderRows([{ id: newTenderRowId(), method: "CASH", amount: "" }]);
      setStoreCreditStr("");
      setApplyFullStoreCredit(false);
      setPayTowardByOrderId({});
      setConfirmOpen(false);
      if (customerId) {
        try {
          const ctxRes = await api.get(`/customers/${customerId}/checkout-context`, {
            headers: { Authorization: `Bearer ${auth.accessToken}` },
          });
          setCheckoutCtx(ctxRes.data?.data as CheckoutContext);
        } catch {
          /* ignore */
        }
      }
    } catch (e) {
      if (axios.isAxiosError(e)) setError(e.response?.data?.message ?? "Failed to create order");
      else setError("Failed to create order");
    } finally {
      setSubmitLoading(false);
    }
  }

  const selectedCustomerLabel = customers.find((c) => c.id === customerId)?.label ?? "—";

  if (loading) {
    return (
      <main className="content">
        <PageHeader title="Till / POS" subtitle="Fast checkout" />
        <SpinnerBlock label="Loading till" />
      </main>
    );
  }

  return (
    <main className="content content--pos">
      <PageHeader
        title="Till / POS"
        subtitle="Multi-method tender, optional pay-down of open orders, store credit from returns — each line is stored and grouped by checkout batch for traceability."
      />

      <div className="pos-till-root">
        <div className="pos-till">
          <div className="pos-till__left">
            <section className="pos-surface pos-till__products" aria-label="Products and catalog">
              <div className="pos-till__toolbar">
                <h3 className="pos-till__title">
                  <ShoppingCart size={18} strokeWidth={2} aria-hidden />
                  Menu
                </h3>
                <label
                  className="pos-tax-tick"
                  title={
                    canCreateNonTax
                      ? "Checked: apply tax rates on taxable lines. Unchecked: non-tax sale."
                      : "Non-tax sales are not allowed for your role"
                  }
                >
                  <span className="pos-tax-tick__box" aria-hidden>
                    <input
                      type="checkbox"
                      className="pos-tax-tick__input"
                      checked={documentTaxMode === "TAX"}
                      onChange={(e) => {
                        if (e.target.checked) setDocumentTaxMode("TAX");
                        else if (canCreateNonTax) setDocumentTaxMode("NON_TAX");
                      }}
                      disabled={!canCreateNonTax}
                    />
                    {documentTaxMode === "TAX" ? <Check size={14} className="pos-tax-tick__icon" strokeWidth={3} /> : null}
                  </span>
                  <span className="pos-tax-tick__label">Tax sale</span>
                </label>
              </div>

            <div className="pos-till-search-row">
              <div className="search-field pos-till__search pos-till__search--rounded">
                <Search size={18} />
                <input
                  placeholder="Search products, SKU, barcode…"
                  value={productQuery}
                  onChange={(e) => setProductQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void addByScan();
                    }
                  }}
                />
              </div>
              <button type="button" className="pos-till-icon-btn" onClick={() => void addByScan()} title="Add from search">
                <ScanLine size={18} />
              </button>
            </div>

            <div className="pos-category-tabs" role="tablist" aria-label="Categories">
              <button
                type="button"
                role="tab"
                className={`pos-category-tab${categoryTab === "" ? " is-active" : ""}`}
                onClick={() => setCategoryTab("")}
              >
                All
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="tab"
                  className={`pos-category-tab${categoryTab === c.id ? " is-active" : ""}`}
                  onClick={() => setCategoryTab(c.id)}
                >
                  {c.name}
                </button>
              ))}
            </div>

            <div className="pos-product-grid-wrap">
              {productsLoading ? <SpinnerBlock label="Loading products" /> : null}
              {!productsLoading && productRows.length === 0 ? <p className="page-desc">No products match.</p> : null}
              <div className="pos-product-grid">
                {productRows.map((p) => {
                  const price = Number(p.salesPricePrimary ?? 0);
                  return (
                    <button key={p.id} type="button" className="pos-product-card" onClick={() => void addItemById(p.id)}>
                      {posShowProductImages ? (
                        <div className="pos-product-card__img-wrap">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt="" className="pos-product-card__img" />
                          ) : (
                            <div className="pos-product-card__img-placeholder" aria-hidden />
                          )}
                        </div>
                      ) : null}
                      <div className="pos-product-card__body">
                        <div className="pos-product-card__title">{p.name}</div>
                        <div className="pos-product-card__row">
                          <span className="pos-product-card__price">{formatMoney(price, currency)}</span>
                          <span className="pos-product-card__add" aria-hidden>
                            <Plus size={18} strokeWidth={2.5} />
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        </div>

          <div className="pos-till__right">
            <section className="pos-surface pos-till__customer" aria-label="Customer">
              <h3 className="pos-till__title">
                <User size={18} strokeWidth={2} aria-hidden />
                Customer
              </h3>
              <div className="pos-till__customer-select">
                <CustomSelect
                  value={customerId}
                  placeholder="Search or select customer…"
                  options={customers.map((c) => ({ value: c.id, label: c.label }))}
                  onChange={setCustomerId}
                  searchable
                  className="custom-select--till"
                  searchPlaceholder="Search by name…"
                />
              </div>
            </section>

            <section className="pos-till__cart-panel" aria-label="Cart">
              <h3 className="pos-till__title">Current order</h3>
              <div className="pos-till__cart-scroll">
                {lines.length === 0 ? (
                  <p className="pos-till-empty">Select products from the menu to start.</p>
                ) : (
                  lines.map((line, index) => (
                    <div key={`${line.itemId}-${index}`} className="pos-cart-line">
                      {posShowProductImages && line.imageUrl ? (
                        <div className="pos-cart-line__thumb">
                          <img src={line.imageUrl} alt="" />
                        </div>
                      ) : null}
                      <div className="pos-cart-line__col">
                        <div className="pos-cart-line__name">{line.name}</div>
                        <p className="pos-cart-line__meta">
                          {line.quantity} {line.unitLabel} × {formatMoney(line.unitPrice, currency)}
                          {documentTaxMode === "TAX" && line.taxable ? ` · ${line.taxRatePercent}% tax` : null}
                        </p>
                        <div className="pos-cart-line__controls">
                          <div className="pos-qty-pill">
                            <button
                              type="button"
                              className="pos-qty-pill__btn"
                              aria-label="Decrease quantity"
                              onClick={() => updateLine(index, { quantity: Math.max(0.01, line.quantity - 1) })}
                            >
                              <Minus size={14} />
                            </button>
                            <input
                              type="number"
                              step="0.01"
                              value={line.quantity}
                              className="pos-qty-pill__input"
                              onChange={(e) => updateLine(index, { quantity: Number(e.target.value || 0) })}
                            />
                            <button
                              type="button"
                              className="pos-qty-pill__btn"
                              aria-label="Increase quantity"
                              onClick={() => updateLine(index, { quantity: line.quantity + 1 })}
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                          <input
                            type="number"
                            step="0.01"
                            value={line.unitPrice}
                            className="pos-cart-line__price input-control"
                            disabled={!line.canEditPrice}
                            title={line.canEditPrice ? "Unit price" : "Price locked"}
                            onChange={(e) => updateLine(index, { unitPrice: Number(e.target.value || 0) })}
                          />
                          <button type="button" className="pos-cart-line__remove" aria-label="Remove line" onClick={() => removeLine(index)}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="pos-till__payment" aria-label="Totals and checkout">
              <div className="pos-till__payment-inner">
                <p className="pos-till__cust-line">
                  <span className="pos-till__cust-label">Selected customer</span>
                  <span className="pos-till__cust-value">{selectedCustomerLabel}</span>
                </p>
                <div className="pos-pay-breakdown">
                  <div className="pos-pay-row">
                    <span>Subtotal</span>
                    <span>{formatMoney(subtotalPreTax, currency)}</span>
                  </div>
                  <div className="pos-pay-row">
                    <span>Tax</span>
                    <span>{formatMoney(taxTotal, currency)}</span>
                  </div>
                  <div className="pos-pay-total">{formatMoney(grandTotal, currency)}</div>
                </div>

                <p className="pos-checkout-modes__hint pos-checkout-modes__hint--solo">
                  Tender is split across methods (cash, card, …). The system applies it to <strong>older open orders</strong> first (if you enter amounts), then to this cart.
                  <strong> Store credit</strong> from returns is pooled — use the credit amount below toward this sale or take cash change per policy.
                </p>

                {checkoutCtxLoading ? <p className="page-desc">Loading account…</p> : null}
                {!isWalkIn && checkoutCtx && (checkoutCtx.recentReturns?.length ?? 0) > 0 ? (
                  <div className="pos-till-field">
                    <span>Recent returns (credit history)</span>
                    <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12, color: "var(--muted)", lineHeight: 1.45 }}>
                      {checkoutCtx.recentReturns!.map((r) => (
                        <li key={r.id}>
                          {r.salesReturnNo}: {formatMoney(r.grandTotal, currency)} ·{" "}
                          {r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {!isWalkIn && checkoutCtx && checkoutCtx.pendingOrders.length > 0 ? (
                  <div className="pos-till-field">
                    <span>Pay toward open orders</span>
                    <div className="pos-prior-orders">
                      {checkoutCtx.pendingOrders.map((o) => (
                        <label key={o.id} className="pos-prior-order-row">
                          <span className="pos-prior-order-row__label">
                            {o.orderNo} · due {formatMoney(o.balanceDue, currency)}
                          </span>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder="0"
                            className="input-control input-control--till"
                            value={payTowardByOrderId[o.id] ?? ""}
                            onChange={(e) =>
                              setPayTowardByOrderId((prev) => ({ ...prev, [o.id]: e.target.value }))
                            }
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}

                {!isWalkIn && checkoutCtx && checkoutCtx.storeCreditBalance > 0 ? (
                  <div className="pos-till-field stack">
                    <label className="toggle-chip" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={applyFullStoreCredit}
                        onChange={(e) => {
                          const on = e.target.checked;
                          setApplyFullStoreCredit(on);
                          if (on) setStoreCreditStr(String(checkoutCtx.storeCreditBalance));
                          else setStoreCreditStr("");
                        }}
                      />
                      <span>
                        <Wallet size={14} className="pos-till-inline-icon" aria-hidden /> Use full return credit (
                        {formatMoney(checkoutCtx.storeCreditBalance, currency)})
                      </span>
                    </label>
                    <label className="pos-till-field">
                      <span>Store credit amount {applyFullStoreCredit ? "(full balance)" : `(max ${formatMoney(checkoutCtx.storeCreditBalance, currency)})`}</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className="input-control input-control--till"
                        value={storeCreditStr}
                        onChange={(e) => setStoreCreditStr(e.target.value)}
                        placeholder="0"
                        disabled={applyFullStoreCredit}
                      />
                    </label>
                  </div>
                ) : null}

                <div className="pos-till-field">
                  <span>Tender (multiple methods)</span>
                  <div className="pos-tender-rows">
                    {tenderRows.map((row, idx) => (
                      <div key={row.id} className="pos-tender-row">
                        <CustomSelect
                          className="custom-select--till"
                          value={row.method}
                          placeholder="Method"
                          options={PAYMENT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                          onChange={(v) =>
                            setTenderRows((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, method: v as PaymentMethod } : r)),
                            )
                          }
                        />
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="0"
                          className="input-control input-control--till"
                          value={row.amount}
                          onChange={(e) =>
                            setTenderRows((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, amount: e.target.value } : r)),
                            )
                          }
                        />
                        {tenderRows.length > 1 ? (
                          <button
                            type="button"
                            className="pos-tender-row__remove"
                            aria-label="Remove tender line"
                            onClick={() => setTenderRows((prev) => prev.filter((_, i) => i !== idx))}
                          >
                            <Trash2 size={16} />
                          </button>
                        ) : null}
                      </div>
                    ))}
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setTenderRows((prev) => [...prev, { id: newTenderRowId(), method: "CARD", amount: "" }])}
                    >
                      <Plus size={14} /> Add tender line
                    </button>
                  </div>
                </div>

                <div className="pos-pay-quick" role="group" aria-label="Quick tender">
                  <button
                    type="button"
                    className="pos-pay-quick__btn"
                    onClick={() => {
                      const target = grandTotal + sumPriorAllocated - storeCreditNum;
                      setTenderRows([{ id: newTenderRowId(), method: "CASH", amount: Math.max(0, target).toFixed(2) }]);
                    }}
                  >
                    Match cart + allocations
                  </button>
                  <button
                    type="button"
                    className="pos-pay-quick__btn"
                    onClick={() => {
                      setTenderRows([{ id: newTenderRowId(), method: "CASH", amount: "0" }]);
                      setStoreCreditStr("");
                    }}
                  >
                    Clear tender
                  </button>
                </div>

                <div className="pos-pay-breakdown pos-pay-breakdown--compact">
                  <div className="pos-pay-row">
                    <span>Total tender</span>
                    <span>{formatMoney(tenderTotal, currency)}</span>
                  </div>
                  <div className="pos-pay-row">
                    <span>To older orders</span>
                    <span>{formatMoney(sumPriorAllocated, currency)}</span>
                  </div>
                  <div className="pos-pay-row">
                    <span>Applied to this cart</span>
                    <span>{formatMoney(appliedToNewPreview, currency)}</span>
                  </div>
                  <div className="pos-pay-row pos-pay-row--balance">
                    <span>Remaining on this cart</span>
                    <span>{formatMoney(newBalancePreview, currency)}</span>
                  </div>
                  {changeOrOverpayPreview > 0.0001 ? (
                    <div className="pos-pay-row">
                      <span>Unused tender (change / overpay)</span>
                      <span>{formatMoney(changeOrOverpayPreview, currency)}</span>
                    </div>
                  ) : null}
                  <p className="pos-auto-status">
                    <strong>Status:</strong>{" "}
                    {isWalkIn
                      ? newBalancePreview > 0.0001
                        ? "Walk-in — pay full total"
                        : "Walk-in — OK"
                      : autoClassification === "paid_in_full"
                        ? "Paid in full"
                        : autoClassification === "on_account"
                          ? "On account (registered customer)"
                          : "—"}
                  </p>
                </div>

                <div className="pos-till-cta-row" style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {quotationsEnabled ? (
                    <button
                      type="button"
                      className="btn btn-secondary pos-till-cta"
                      style={{ flex: "1 1 140px" }}
                      disabled={!canSaveQuotation || lines.length === 0 || !customerId || checkoutCtxLoading}
                      onClick={() => setQuotationConfirmOpen(true)}
                    >
                      <FileText size={20} strokeWidth={2} />
                      Save as quotation
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="pos-till-cta"
                    style={{ flex: "1 1 160px" }}
                    disabled={!canCreateSales || lines.length === 0 || !customerId || checkoutCtxLoading}
                    onClick={() => setConfirmOpen(true)}
                  >
                    <ListOrdered size={20} strokeWidth={2} />
                    Place order
                  </button>
                </div>
                {!canCreateSales ? <p className="pos-till-footnote">View-only sales access.</p> : null}
                {error ? <p className="alert alert-error">{error}</p> : null}
                {message ? <p className="alert alert-success">{message}</p> : null}
                {lastPosPrint ? (
                  <div className="pos-print-prompt panel panel--pad" style={{ marginTop: 10 }}>
                    <p className="page-desc" style={{ marginBottom: 8 }}>
                      <strong>Print invoice?</strong>{" "}
                      {lastPosPrint.invoiceNo ? (
                        <span>
                          ({lastPosPrint.invoiceNo}) — same document as Sales Invoices.
                        </span>
                      ) : (
                        <span>Opens a new window (use the browser print dialog for paper).</span>
                      )}
                    </p>
                    <div className="inline-form" style={{ gap: 8 }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => void openOrderPrintHtml(`/print/thermal-receipt/${lastPosPrint.invoiceId}`)}
                      >
                        <Printer size={14} /> Thermal
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() =>
                          void openOrderPrintHtml(
                            lastPosPrint.documentTaxMode === "NON_TAX"
                              ? `/print/a4-non-tax-invoice/${lastPosPrint.invoiceId}`
                              : `/print/a4-tax-invoice/${lastPosPrint.invoiceId}`,
                          )
                        }
                      >
                        <Printer size={14} /> A4 invoice
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={() => setLastPosPrint(null)}>
                        Dismiss
                      </button>
                    </div>
                  </div>
                ) : null}
                {lastQuotationForPrint ? (
                  <div className="pos-print-prompt panel panel--pad" style={{ marginTop: 10 }}>
                    <p className="page-desc" style={{ marginBottom: 8 }}>
                      <strong>Print this quotation?</strong>
                    </p>
                    <div className="inline-form" style={{ gap: 8 }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => void openOrderPrintHtml(`/print/quotations/${lastQuotationForPrint.id}`)}
                      >
                        <Printer size={14} /> HTML
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => void openQuotationPrintPdf(`/print/pdf/quotations/${lastQuotationForPrint.id}`)}
                      >
                        <Printer size={14} /> PDF
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={() => setLastQuotationForPrint(null)}>
                        Dismiss
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title="Place this order?"
        message={`Cart total ${formatMoney(grandTotal, currency)}. Total tender ${formatMoney(tenderTotal, currency)} (incl. store credit). To older orders: ${formatMoney(sumPriorAllocated, currency)}. Applied to this cart: ${formatMoney(appliedToNewPreview, currency)}. Remaining on this cart: ${formatMoney(newBalancePreview, currency)}. All payment lines are recorded and linked by batch id.`}
        confirmLabel="Place order"
        loading={submitLoading}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void submitSalesOrder()}
      />
      <ConfirmModal
        open={quotationConfirmOpen}
        title="Save as quotation?"
        message={`This saves an estimate only — it does not create a sales order or invoice. Cart total ${formatMoney(grandTotal, currency)}. You can print or open the Quotations list after saving.`}
        confirmLabel="Save quotation"
        loading={quotationSubmitLoading}
        onCancel={() => setQuotationConfirmOpen(false)}
        onConfirm={() => void submitQuotation()}
      />
    </main>
  );
}
