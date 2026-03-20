import axios from "axios";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { getAuthState } from "../models/auth";
import type { LineDraft, SelectOption } from "../models/document.model";
import { api } from "../services/api";
import { getOptions } from "../services/document.service";

type DocumentKind = "quotation" | "sales-order" | "sales-invoice" | "purchase";

export function DocumentPage({
  title,
  listEndpoint,
  createEndpoint,
  kind,
}: {
  title: string;
  listEndpoint: string;
  createEndpoint: string;
  kind: DocumentKind;
}) {
  const auth = getAuthState();
  const canCreateNonTax = Boolean(auth?.permissions.includes("*") || auth?.permissions.includes("sales.non_tax.create"));
  const canCreateDocument = Boolean(
    auth?.permissions.includes("*") ||
      (kind === "purchase" ? auth?.permissions.includes("purchases.create") : auth?.permissions.includes("sales.create")),
  );
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [partyId, setPartyId] = useState("");
  const [taxMode, setTaxMode] = useState<"TAX" | "NON_TAX">("TAX");
  const [amountValue, setAmountValue] = useState("0");
  const [partyOptions, setPartyOptions] = useState<SelectOption[]>([]);
  const [itemOptions, setItemOptions] = useState<SelectOption[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [line, setLine] = useState<LineDraft>({
    itemId: "",
    unitType: "PRIMARY",
    unitId: "PRIMARY",
    quantity: 1,
    price: 0,
    discount: 0,
    taxRate: 0,
  });
  const [canEditPrice, setCanEditPrice] = useState(true);

  async function load() {
    if (!auth) return;
    const [listResponse, parties, items] = await Promise.all([
      api.get(listEndpoint, {
        params: {
          search: search || undefined,
          page,
          pageSize,
          documentTaxMode: kind === "sales-order" || kind === "sales-invoice" ? taxMode : undefined,
        },
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      }),
      getOptions(auth.accessToken, kind === "purchase" ? "/suppliers" : "/customers"),
      getOptions(auth.accessToken, "/items"),
    ]);
    setRows(listResponse.data.data ?? []);
    setPartyOptions(parties);
    setItemOptions(items);
  }

  useEffect(() => {
    if (!auth) return;
    load().catch(() => setError("Failed to load page data"));
  }, [auth, listEndpoint, kind, page, taxMode]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!auth || !partyId || !line.itemId) return;
    setLoading(true);
    setMessage("");
    setError("");
    try {
      const payload =
        kind === "purchase"
          ? {
              supplierId: partyId,
              amountPaid: Number(amountValue || 0),
              lines: [
                {
                  itemId: line.itemId,
                  enteredQuantity: line.quantity,
                  unitType: line.unitType,
                  unitId: line.unitId,
                  unitCost: line.price,
                  taxRate: line.taxRate,
                },
              ],
            }
          : {
              customerId: partyId,
              ...(kind !== "quotation" ? { documentTaxMode: taxMode } : {}),
              ...(kind === "sales-invoice" ? { amountReceived: Number(amountValue || 0) } : {}),
              lines: [
                {
                  itemId: line.itemId,
                  enteredQuantity: line.quantity,
                  unitType: line.unitType,
                  unitId: line.unitId,
                  unitPrice: line.price,
                  discountAmount: line.discount,
                  taxRate: line.taxRate,
                },
              ],
            };

      await api.post(createEndpoint, payload, {
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      setMessage("Saved");
      await load();
    } catch (submitError) {
      if (axios.isAxiosError(submitError)) setError(submitError.response?.data?.message ?? "Save failed");
      else setError("Save failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleItemChange(nextItemId: string) {
    setLine((prev) => ({ ...prev, itemId: nextItemId }));
    if (!auth || !nextItemId || kind === "purchase") return;
    try {
      const response = await api.get(`/items/${nextItemId}/resolved-price`, {
        params: { unitType: line.unitType, unitId: line.unitId },
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      const data = response.data?.data;
      setLine((prev) => ({ ...prev, price: Number(data?.price ?? prev.price) }));
      setCanEditPrice(Boolean(data?.canEdit));
    } catch {
      // keep form usable if price resolve fails
    }
  }

  return (
    <main className="content">
      <header className="content-header">
        <div>
          <h1>{title}</h1>
          <p>Transaction workflow form</p>
        </div>
      </header>
      <section className="panel pad">
        <form className="inline-form" onSubmit={submit}>
          <select value={partyId} onChange={(e) => setPartyId(e.target.value)}>
            <option value="">{kind === "purchase" ? "Select supplier" : "Select customer"}</option>
            {partyOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          {kind !== "quotation" && kind !== "purchase" ? (
            <select value={taxMode} onChange={(e) => setTaxMode(e.target.value as "TAX" | "NON_TAX")}>
              <option value="TAX">TAX</option>
              {canCreateNonTax ? <option value="NON_TAX">NON_TAX</option> : null}
            </select>
          ) : null}
          <select value={line.itemId} onChange={(e) => void handleItemChange(e.target.value)}>
            <option value="">Select item</option>
            {itemOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <input type="number" step="0.01" placeholder="Qty" value={line.quantity} onChange={(e) => setLine((prev) => ({ ...prev, quantity: Number(e.target.value || 0) }))} />
          <input
            type="number"
            step="0.01"
            placeholder={kind === "purchase" ? "Unit cost" : "Unit price"}
            value={line.price}
            disabled={kind !== "purchase" && !canEditPrice}
            onChange={(e) => setLine((prev) => ({ ...prev, price: Number(e.target.value || 0) }))}
          />
          <input type="number" step="0.01" placeholder="Discount" value={line.discount} onChange={(e) => setLine((prev) => ({ ...prev, discount: Number(e.target.value || 0) }))} />
          <input type="number" step="0.01" placeholder="Tax %" value={line.taxRate} onChange={(e) => setLine((prev) => ({ ...prev, taxRate: Number(e.target.value || 0) }))} />
          {kind === "sales-invoice" || kind === "purchase" ? (
            <input
              type="number"
              step="0.01"
              placeholder={kind === "sales-invoice" ? "Amount received" : "Amount paid"}
              value={amountValue}
              onChange={(e) => setAmountValue(e.target.value)}
            />
          ) : null}
          <button disabled={loading || !canCreateDocument}>{loading ? "Saving..." : "Create"}</button>
          {message ? <span>{message}</span> : null}
          {kind !== "purchase" && !canEditPrice ? <span>Price override not allowed for your role.</span> : null}
          {!canCreateDocument ? <span>You have view-only access for this module.</span> : null}
        </form>
        {error ? <p>{error}</p> : null}
      </section>

      <section className="panel">
        <div className="toolbar">
          <input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <button onClick={() => { setPage(1); void load(); }}>Search</button>
          <button onClick={() => setPage((prev) => Math.max(1, prev - 1))}>Prev</button>
          <span>Page {page}</span>
          <button onClick={() => setPage((prev) => prev + 1)}>Next</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Data</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                <td>{index + 1}</td>
                <td>
                  <code>{JSON.stringify(row)}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
