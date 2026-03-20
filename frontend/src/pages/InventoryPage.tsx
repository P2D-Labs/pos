import axios from "axios";
import { useState } from "react";
import { getAuthState } from "../models/auth";
import { api } from "../services/api";

export function InventoryPage() {
  const auth = getAuthState();
  const [itemId, setItemId] = useState("");
  const [direction, setDirection] = useState<"IN" | "OUT">("IN");
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submitAdjustment() {
    if (!auth || !itemId) return;
    try {
      await api.post(
        "/stock-adjustments",
        {
          itemId,
          enteredQuantity: Number(quantity || 0),
          unitType: "PRIMARY",
          unitId: "PRIMARY",
          direction,
          note,
        },
        { headers: { Authorization: `Bearer ${auth.accessToken}` } },
      );
      setMessage("Stock adjustment saved");
      setError("");
    } catch (adjustError) {
      if (axios.isAxiosError(adjustError)) setError(adjustError.response?.data?.message ?? "Failed");
      else setError("Failed");
    }
  }

  return (
    <main className="content">
      <header className="content-header">
        <div>
          <h1>Inventory Adjustment</h1>
          <p>Manual stock in/out adjustments</p>
        </div>
      </header>
      <section className="panel pad">
        <div className="inline-form">
          <input placeholder="Item ID" value={itemId} onChange={(e) => setItemId(e.target.value)} />
          <select value={direction} onChange={(e) => setDirection(e.target.value as "IN" | "OUT")}>
            <option value="IN">Adjustment In</option>
            <option value="OUT">Adjustment Out</option>
          </select>
          <input type="number" step="0.01" placeholder="Quantity" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          <input placeholder="Note" value={note} onChange={(e) => setNote(e.target.value)} />
          <button onClick={submitAdjustment}>Save adjustment</button>
        </div>
        {message ? <p>{message}</p> : null}
        {error ? <p>{error}</p> : null}
      </section>
    </main>
  );
}
