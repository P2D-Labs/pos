import axios from "axios";
import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";

export function SetupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    businessName: "",
    ownerName: "",
    adminName: "",
    adminEmail: "",
    adminPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      await api.post("/auth/setup", form);
      setMessage("Setup completed. Login to continue.");
      navigate("/login");
    } catch (error) {
      if (axios.isAxiosError(error)) setMessage(error.response?.data?.message ?? "Setup failed");
      else setMessage("Setup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="auth-shell">
      <form className="auth-card" onSubmit={submit}>
        <h2>Business Setup</h2>
        <input placeholder="Business name" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} required />
        <input placeholder="Owner name" value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} />
        <input placeholder="Admin name" value={form.adminName} onChange={(e) => setForm({ ...form, adminName: e.target.value })} required />
        <input placeholder="Admin email" type="email" value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} required />
        <input placeholder="Admin password" type="password" value={form.adminPassword} onChange={(e) => setForm({ ...form, adminPassword: e.target.value })} required />
        <button disabled={loading}>{loading ? "Saving..." : "Complete setup"}</button>
        {message ? <p>{message}</p> : null}
      </form>
    </section>
  );
}
