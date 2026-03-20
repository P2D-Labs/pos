import axios from "axios";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit() {
    try {
      const response = await api.post("/auth/forgot-password", { email });
      const token = response.data?.data?.resetToken;
      setMessage(
        token
          ? `Reset token (dev): ${token}`
          : "If account exists, a reset token has been generated.",
      );
      setError("");
    } catch (submitError) {
      if (axios.isAxiosError(submitError)) setError(submitError.response?.data?.message ?? "Failed");
    }
  }

  return (
    <section className="auth-shell">
      <div className="auth-card">
        <h2>Forgot Password</h2>
        <input
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button onClick={submit}>Generate reset token</button>
        {message ? <p>{message}</p> : null}
        {error ? <p>{error}</p> : null}
        <Link to="/reset-password">Go to reset page</Link>
        <Link to="/login">Back to login</Link>
      </div>
    </section>
  );
}
