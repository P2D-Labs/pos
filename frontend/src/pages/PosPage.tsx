import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { getAuthState } from "../models/auth";
import { api } from "../services/api";
import { getOptions } from "../services/document.service";

type CartLine = {
  itemId: string;
  itemLabel: string;
  quantity: number;
  unitType: "PRIMARY" | "SECONDARY";
  unitPrice: number;
  source: string;
  canEditPrice: boolean;
};

export function PosPage() {
  const auth = getAuthState();
  const canCreateNonTax = Boolean(auth?.permissions.includes("*") || auth?.permissions.includes("sales.non_tax.create"));
  const canCreateSales = Boolean(auth?.permissions.includes("*") || auth?.permissions.includes("sales.create"));
  const [customers, setCustomers] = useState<Array<{ id: string; label: string }>>([]);
  const [items, setItems] = useState<Array<{ id: string; label: string }>>([]);
  const [customerId, setCustomerId] = useState("");
  const [itemId, setItemId] = useState("");
  const [barcode, setBarcode] = useState("");
  const [unitType, setUnitType] = useState<"PRIMARY" | "SECONDARY">("PRIMARY");
  const [documentTaxMode, setDocumentTaxMode] = useState<"TAX" | "NON_TAX">("TAX");
  const [lines, setLines] = useState<CartLine[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      if (!auth) return;
      const [customerOpts, itemOpts] = await Promise.all([
        getOptions(auth.accessToken, "/customers"),
        getOptions(auth.accessToken, "/items"),
      ]);
      setCustomers(customerOpts);
      setItems(itemOpts);
      if (customerOpts[0]) setCustomerId(customerOpts[0].id);
    }
    load().catch(() => setError("Failed to load POS options"));
  }, [auth]);

  const total = useMemo(
    () => lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0),
    [lines],
  );

  async function addItem(selectedItemId?: string) {
    if (!auth) return;
    const id = selectedItemId ?? itemId;
    if (!id) return;
    const itemLabel = items.find((item) => item.id === id)?.label ?? id;
    const response = await api.get(`/items/${id}/resolved-price`, {
      params: { unitType, unitId: unitType },
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    });
    const priceData = response.data.data;
    setLines((prev) => [
      ...prev,
      {
        itemId: id,
        itemLabel,
        quantity: 1,
        unitType,
        unitPrice: Number(priceData.price ?? 0),
        source: String(priceData.source ?? "ITEM_DEFAULT"),
        canEditPrice: Boolean(priceData.canEdit),
      },
    ]);
    setItemId("");
  }

  async function addByBarcode() {
    const matched = items.find((item) =>
      item.label.toLowerCase().includes(barcode.trim().toLowerCase()),
    );
    if (!matched) {
      setError("No item found for barcode/search value");
      return;
    }
    setError("");
    await addItem(matched.id);
    setBarcode("");
  }

  async function checkout() {
    if (!auth || !customerId || lines.length === 0) return;
    setError("");
    setMessage("");
    try {
      await api.post(
        "/sales-invoices",
        {
          customerId,
          documentTaxMode,
          amountReceived: total,
          lines: lines.map((line) => ({
            itemId: line.itemId,
            enteredQuantity: line.quantity,
            unitType: line.unitType,
            unitId: line.unitType,
            unitPrice: line.unitPrice,
            discountAmount: 0,
            taxRate: 0,
          })),
        },
        { headers: { Authorization: `Bearer ${auth.accessToken}` } },
      );
      setMessage("POS invoice created");
      setLines([]);
    } catch (checkoutError) {
      if (axios.isAxiosError(checkoutError)) {
        setError(checkoutError.response?.data?.message ?? "Checkout failed");
      } else {
        setError("Checkout failed");
      }
    }
  }

  return (
    <main className="content">
      <header className="content-header">
        <div>
          <h1>POS / Till</h1>
          <p>Fast billing with price source visibility</p>
        </div>
      </header>

      <section className="panel pad">
        <div className="inline-form">
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">Select customer</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.label}
              </option>
            ))}
          </select>
          <select
            value={documentTaxMode}
            onChange={(e) => setDocumentTaxMode(e.target.value as "TAX" | "NON_TAX")}
          >
            <option value="TAX">TAX</option>
            {canCreateNonTax ? <option value="NON_TAX">NON_TAX</option> : null}
          </select>
          <input
            placeholder="Scan barcode / quick search"
            autoFocus
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void addByBarcode();
              }
            }}
          />
          <button onClick={addByBarcode}>Add by scan</button>
        </div>

        <div className="inline-form" style={{ marginTop: 8 }}>
          <select value={unitType} onChange={(e) => setUnitType(e.target.value as "PRIMARY" | "SECONDARY")}>
            <option value="PRIMARY">PRIMARY</option>
            <option value="SECONDARY">SECONDARY</option>
          </select>
          <select value={itemId} onChange={(e) => setItemId(e.target.value)}>
            <option value="">Select item</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <button onClick={() => addItem()}>Add item</button>
          <strong>Total: {total.toFixed(2)}</strong>
          <button onClick={checkout} disabled={!canCreateSales}>Checkout</button>
        </div>
        {!canCreateSales ? <p>You have view-only access for sales.</p> : null}
        {error ? <p>{error}</p> : null}
        {message ? <p>{message}</p> : null}
      </section>

      <section className="panel">
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Unit</th>
              <th>Price</th>
              <th>Price Source</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={`${line.itemId}-${index}`}>
                <td>{line.itemLabel}</td>
                <td>{line.quantity}</td>
                <td>{line.unitType}</td>
                <td>
                  <input
                    type="number"
                    step="0.01"
                    value={line.unitPrice}
                    disabled={!line.canEditPrice}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, unitPrice: Number(e.target.value || 0) } : row,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <span className="status">{line.source}</span>
                  {!line.canEditPrice ? <p>Locked</p> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
